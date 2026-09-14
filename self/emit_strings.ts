// String lowering for stage1 (`src/codegen/emit/strings.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// Layout (ABI, shared with `runtime/runtime.c`): a `string` is an `i8*` to
// `{ i64 len, i8 data[len], i8 0 }`, 8-byte aligned, immutable. The lowerings
// are `src/codegen/emit/strings.ts`'s, unchanged: a literal is an interned
// `@.str.N`, `a + b` is `nish_str_concat`, `a === b` is `nish_str_eq`,
// `.length` is a header load with no call, and the byte methods lower inline
// so `runtime.c` stays inside its budget.
//
// `stringifyCallee` and `stringConstructCallees` are the halves
// `self/attributes.ts` reads: what a construct calls has to match what it
// emits exactly, so both live beside the lowering they describe.

import { Emitter } from "./emit";
import { emitIndex, emitNumberFromI64, emitRangeCheck } from "./emit_arrays";
import { isTemplateExpression, templateParts } from "./emit_util";
import { IRModule } from "./ir";
import { N_TEMPLATE_TEXT, Node } from "./nodes";
import { irEscape } from "./strings";
import { isFloat, isUnsigned, T_BOOL, T_F32, T_F64, T_I32, T_I64, T_STRING } from "./types";

// ---- Constants --------------------------------------------------------------------

/**
 * Add `@.str.<index>` for `text` to the module and answer the `i8*` constant
 * expression that points at its header (what every `nish_str_*` expects).
 */
export function addStringConstant(module: IRModule, index: i32, text: string): string {
  // A string is bytes, so `length` is already the byte length the
  // header needs; `src/` gets the same number from `Buffer.byteLength`.
  const array = `[${text.length + 1} x i8]`;
  const type = `{ i64, ${array} }`;
  module.addGlobal(
    `@.str.${index} = private unnamed_addr constant ${type} { i64 ${text.length}, ${array} c"${irEscape(text)}\\00" }, align 8`
  );
  return `bitcast (${type}* @.str.${index} to i8*)`;
}

// ---- Conversion to string -----------------------------------------------------------

/**
 * The runtime symbol that converts `type` to a string, or the empty string
 * when no call is needed. Every unsigned width shares `nish_str_from_u64`: the
 * value is `zext`ed to i64 first, which is one instruction the optimiser
 * usually folds away and much cheaper than four formatters in a runtime with
 * a size budget.
 */
export function stringifyCallee(type: i32): string {
  if (isUnsigned(type)) {
    return "nish_str_from_u64";
  }
  if (type === T_I32) {
    return "nish_str_from_i32";
  }
  if (type === T_I64) {
    return "nish_str_from_i64";
  }
  if (isFloat(type)) {
    return "nish_str_from_f64";
  }
  return ""; // string: identity; bool: a select between two literals
}

/** Lower `expr` (string, number or boolean) and answer an `i8*` string value. */
export function emitToString(emitter: Emitter, expr: Node): string {
  const type = emitter.typeOf(expr);
  let value = emitter.emitExpression(expr);
  if (type === T_BOOL) {
    return emitter.fn.emitValue(
      `select i1 ${value}, i8* ${emitter.stringConstant("true")}, i8* ${emitter.stringConstant("false")}`
    );
  }
  const callee = stringifyCallee(type);
  if (callee.length === 0) {
    return value;
  }
  let ty = emitter.llvm(type);
  // `zext`, never `sext`: printing a u32 of 0xFFFFFFFF must give 4294967295.
  if (isUnsigned(type) && ty !== "i64") {
    value = emitter.fn.emitValue(`zext ${ty} ${value} to i64`);
    ty = "i64";
  }
  // An `f32` widens to double and reuses the f64 formatter: `fpext` is exact,
  // so the digits are JavaScript's for the float's *value*, and the runtime
  // needs no second formatter.
  if (type === T_F32) {
    value = emitter.fn.emitValue(`fpext float ${value} to double`);
    ty = "double";
  }
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime(callee)}(${ty} ${value})`);
}

export function emitConcat(emitter: Emitter, lhs: string, rhs: string): string {
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("nish_str_concat")}(i8* ${lhs}, i8* ${rhs})`);
}

// ---- Template literals ----------------------------------------------------------------

/**
 * Constant parts are literals, holes are converted, and the parts are joined
 * left to right with `nish_str_concat`. A template with no parts at all
 * (`` `` ``) is the empty string.
 */
export function emitTemplate(emitter: Emitter, expr: Node): string {
  const parts = templateParts(expr);
  let acc = "";
  let first = true;
  for (const part of parts) {
    const value =
      part.kind === N_TEMPLATE_TEXT ? emitter.stringConstant(part.text) : emitToString(emitter, part);
    acc = first ? value : emitConcat(emitter, acc, value);
    first = false;
  }
  return first ? emitter.stringConstant("") : acc;
}

// ---- `.length` --------------------------------------------------------------------------

/** `s.length`: the header load, then the width the checker recorded for the expression. */
export function emitStringLength(emitter: Emitter, expr: Node): string {
  const str = emitter.emitExpression(expr.children[0]);
  const len = loadStringLength(emitter, str);
  if (emitter.typeOf(expr) === T_F64) {
    return emitter.fn.emitValue(`sitofp i64 ${len} to double`);
  }
  return emitter.fn.emitValue(`trunc i64 ${len} to i32`);
}

/** Byte length, from the header the string pointer points at. */
function loadStringLength(emitter: Emitter, str: string): string {
  const header = emitter.fn.emitValue(`bitcast i8* ${str} to i64*`);
  return emitter.fn.emitValue(`load i64, i64* ${header}${emitter.alignSuffix(T_STRING)}`);
}

/** The bytes themselves: past the 8-byte length header. */
function stringData(emitter: Emitter, str: string): string {
  return emitter.fn.emitValue(`getelementptr inbounds i8, i8* ${str}, i64 8`);
}

/** `llvm.smax(0, llvm.smin(value, len))`: JavaScript's `substring` clamp. */
function clampToLength(emitter: Emitter, value: string, len: string): string {
  const low = emitter.fn.emitValue(
    `call i64 ${emitter.useRuntime("llvm.smin.i64")}(i64 ${value}, i64 ${len})`
  );
  return emitter.fn.emitValue(`call i64 ${emitter.useRuntime("llvm.smax.i64")}(i64 ${low}, i64 0)`);
}

/** A fresh arena string holding `n` bytes copied from `bytes`. */
function newString(emitter: Emitter, bytes: string, n: string): string {
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("nish_str_new")}(i8* ${bytes}, i64 ${n})`);
}

/**
 * The range check of `s.slice(from, to)`: `0 <= from <= to <= len`, or a cold
 * block that panics and never returns.
 *
 * Two unsigned compares are the whole test. A negative offset arrives here as
 * the `sext` of a negative `i32`, which read as unsigned is at least 2^63 and
 * so greater than any byte length, which is why `icmp ule i64 to, len` rejects
 * a negative `to` and `icmp ule i64 from, to` rejects a negative `from` once
 * `to` is known non-negative. Without an explicit end, `to` *is* `len` and the
 * second compare is a tautology, so only the first is emitted.
 *
 * `--unchecked-indexing` drops it, exactly as it drops `a[i]`'s.
 */
function emitSliceCheck(emitter: Emitter, from: string, to: string, len: string, hasEnd: boolean): void {
  if (emitter.opts.uncheckedIndexing) {
    return;
  }
  const fn = emitter.fn;
  let inRange = fn.emitValue(`icmp ule i64 ${from}, ${to}`);
  if (hasEnd) {
    const within = fn.emitValue(`icmp ule i64 ${to}, ${len}`);
    inRange = fn.emitValue(`and i1 ${inRange}, ${within}`);
  }
  const failBlock = fn.newBlock("slice.fail");
  const okBlock = fn.newBlock("slice.ok");
  fn.emit(`br i1 ${inRange}, label %${okBlock.label}, label %${failBlock.label}`);
  fn.placeBlock(failBlock);
  fn.emit(`call void ${emitter.useRuntime("nish_panic_slice")}(i64 ${from}, i64 ${to}, i64 ${len})`);
  fn.emit("unreachable");
  fn.placeBlock(okBlock);
}

/**
 * `s.slice(a, b)`: the bytes of `[a, b)` with no clamp, `b` defaulting to
 * `s.length` (WP15 section 4). This is `substring` minus the six `llvm.smin` /
 * `llvm.smax` calls that put JavaScript's arguments in range.
 */
function emitSlice(emitter: Emitter, expr: Node, str: string): string {
  const args = expr.children[1];
  const len = loadStringLength(emitter, str);
  const from = emitIndex(emitter, args.children[0]);
  const hasEnd = args.children.length > 1;
  let to = len;
  if (hasEnd) {
    to = emitIndex(emitter, args.children[1]);
  }
  emitSliceCheck(emitter, from, to, len, hasEnd);
  const n = emitter.fn.emitValue(`sub i64 ${to}, ${from}`);
  const at = emitter.fn.emitValue(
    `getelementptr inbounds i8, i8* ${stringData(emitter, str)}, i64 ${from}`
  );
  return newString(emitter, at, n);
}

/** `nish_str_at(s, at, sub)`: whether `sub`'s bytes sit at offset `at`. */
function emitOccursAt(emitter: Emitter, str: string, at: string, sub: string): string {
  return emitter.fn.emitValue(
    `call zeroext i1 ${emitter.useRuntime("nish_str_at")}(i8* ${str}, i64 ${at}, i8* ${sub})`
  );
}

/**
 * `s.charCodeAt(i)`: the byte at `i`, bounds-checked exactly as `a[i]` is —
 * including the WP15 §2 proof, which is why the check is looked up on the call
 * node here and on the element access there. A string's length cannot change
 * once the variable holding it is bound, so this is the shape the analysis
 * proves most often: a scanner's cursor stays proven across the calls in its
 * own loop body.
 */
function emitCharCodeAt(emitter: Emitter, expr: Node, str: string): string {
  const args = expr.children[1];
  const index = emitIndex(emitter, args.children[0]);
  if (!emitter.program.nodeProvenIndex[expr.id]) {
    emitRangeCheck(emitter, index, loadStringLength(emitter, str));
  }
  const at = emitter.fn.emitValue(
    `getelementptr inbounds i8, i8* ${stringData(emitter, str)}, i64 ${index}`
  );
  const byte = emitter.fn.emitValue(`load i8, i8* ${at}, align 1`);
  if (emitter.typeOf(expr) === T_F64) {
    return emitter.fn.emitValue(`uitofp i8 ${byte} to double`);
  }
  return emitter.fn.emitValue(`zext i8 ${byte} to i32`);
}

/**
 * One end of a `substring`: the clamp, or the value itself where the WP15 §2
 * analysis proved `0 <= bound <= len` (`self/bounds.ts`, `nodeProvenClamp`).
 *
 * The clamp cannot move a bound that is already inside the range, so dropping
 * it changes no answer — the checker recorded the verdict and the emitter reads
 * it, exactly as it does for a bounds check it may omit. LLVM does this itself
 * only where it can hoist the receiver's length: with a string literal in a
 * local it folds all six calls unaided, but where the receiver is a parameter
 * the guard compares `i32`s, the clamp runs on their `sext`, and the length is
 * re-read across an allocating call, so the clamp on the guarded bound
 * survives whether the guard is there or not. "All six" is exact only when
 * both bounds are guarded locals; `s.substring(0, i)` goes six to two, and the
 * two that live are `i`'s own pair (WP15 §9).
 *
 * `first` is emitted and clamped before `second` is evaluated at all, which is
 * the order `self/bounds.ts` takes its verdicts in: a fact argument 1
 * establishes may not reach argument 0.
 */
function clampBound(emitter: Emitter, bound: Node, len: string): string {
  const value = emitIndex(emitter, bound);
  if (emitter.program.nodeProvenClamp[bound.id]) {
    return value;
  }
  return clampToLength(emitter, value, len);
}

/**
 * `s.substring(a, b)`: both ends clamped into `[0, len]` and then swapped into
 * order, as JavaScript specifies, so the length is never negative and the copy
 * never leaves the string. A bound the checker proved in range is written
 * through instead (`clampBound`); the swap stays either way, because nothing
 * here proves `a <= b`.
 */
function emitSubstring(emitter: Emitter, expr: Node, str: string): string {
  const args = expr.children[1];
  const len = loadStringLength(emitter, str);
  const first = clampBound(emitter, args.children[0], len);
  const second = args.children.length > 1 ? clampBound(emitter, args.children[1], len) : len;
  const from = emitter.fn.emitValue(
    `call i64 ${emitter.useRuntime("llvm.smin.i64")}(i64 ${first}, i64 ${second})`
  );
  const to = emitter.fn.emitValue(
    `call i64 ${emitter.useRuntime("llvm.smax.i64")}(i64 ${first}, i64 ${second})`
  );
  const n = emitter.fn.emitValue(`sub i64 ${to}, ${from}`);
  const at = emitter.fn.emitValue(
    `getelementptr inbounds i8, i8* ${stringData(emitter, str)}, i64 ${from}`
  );
  return newString(emitter, at, n);
}

/**
 * `s.indexOf(sub)`: the first byte offset where `sub` occurs, or -1.
 *
 * This was an inline loop over `nish_str_at`, one probe per offset, to keep
 * `runtime.c` inside its size budget. That made the idiomatic search a
 * byte-at-a-time scan, and the budget yields to a measured win, so it moved
 * into the runtime where the libc's vectorised routines can do it
 * (`src/codegen/emit/strings.ts` has the measurement).
 */
function emitStringIndexOf(emitter: Emitter, expr: Node, str: string): string {
  const sub = emitter.emitExpression(expr.children[1].children[0]);
  const found = emitter.fn.emitValue(
    `call i64 ${emitter.useRuntime("nish_str_index_of")}(i8* ${str}, i8* ${sub})`
  );
  return emitNumberFromI64(emitter, found, expr);
}

/** The byte methods on a string receiver. */
export function emitStringMethodCall(emitter: Emitter, expr: Node): string {
  const access = expr.children[0];
  const str = emitter.emitExpression(access.children[0]);
  const name = access.text;
  if (name === "charCodeAt") {
    return emitCharCodeAt(emitter, expr, str);
  }
  if (name === "substring") {
    return emitSubstring(emitter, expr, str);
  }
  if (name === "slice") {
    return emitSlice(emitter, expr, str);
  }
  if (name === "indexOf") {
    return emitStringIndexOf(emitter, expr, str);
  }
  if (name === "startsWith") {
    return emitOccursAt(emitter, str, "0", emitter.emitExpression(expr.children[1].children[0]));
  }
  // `endsWith`: the suffix sits at `len - sub.len`, which is negative when the
  // suffix is the longer string, and `nish_str_at` then answers false.
  const sub = emitter.emitExpression(expr.children[1].children[0]);
  const at = emitter.fn.emitValue(
    `sub i64 ${loadStringLength(emitter, str)}, ${loadStringLength(emitter, sub)}`
  );
  return emitOccursAt(emitter, str, at, sub);
}

/** `String.fromCharCode(c)`: one byte on the stack, copied into an arena string. */
export function emitFromCharCode(emitter: Emitter, expr: Node): string {
  const code = emitIndex(emitter, expr.children[1].children[0]);
  const byte = emitter.fn.emitValue(`trunc i64 ${code} to i8`);
  const slot = emitter.fn.emitAlloca("chr", "i8", 1);
  emitter.fn.emit(`store i8 ${byte}, i8* ${slot}, align 1`);
  return newString(emitter, slot, "1");
}

/**
 * The runtime symbols a string byte method calls, for the attribute fixpoint.
 *
 * `slice` can also reach `nish_panic_slice`, which is `noreturn`, so a caller
 * keeps `willreturn` only when the check is not emitted at all — the same rule
 * `a[i]` follows with `nish_panic_index`.
 */
export function stringConstructCallees(name: string, uncheckedIndexing: boolean): string[] {
  const out: string[] = [];
  if (name === "substring") {
    out.push("nish_str_new");
  } else if (name === "slice") {
    out.push("nish_str_new");
    if (!uncheckedIndexing) {
      out.push("nish_panic_slice");
    }
  } else if (name !== "charCodeAt") {
    out.push("nish_str_at");
  }
  return out;
}

// ---- Operators ----------------------------------------------------------------------

/** `a === b` / `a !== b`, string-aware; the numeric lowering is unchanged. */
export function emitStrictEquality(emitter: Emitter, expr: Node): string {
  const type = emitter.typeOf(expr.children[0]);
  const negate = expr.text === "!==";
  const lhs = emitter.emitExpression(expr.children[0]);
  const rhs = emitter.emitExpression(expr.children[1]);
  if (type === T_STRING) {
    const eq = emitter.fn.emitValue(
      `call zeroext i1 ${emitter.useRuntime("nish_str_eq")}(i8* ${lhs}, i8* ${rhs})`
    );
    return negate ? emitter.fn.emitValue(`xor i1 ${eq}, true`) : eq;
  }
  // `T | null` compares against the literal `null` by pointer; the checker
  // allows nothing else.
  let opcode = negate ? "icmp ne" : "icmp eq";
  if (isFloat(type)) {
    opcode = negate ? "fcmp une" : "fcmp oeq";
  }
  return emitter.fn.emitValue(`${opcode} ${emitter.llvm(type)} ${lhs}, ${rhs}`);
}

// ---- console ------------------------------------------------------------------------

/** `console.log(x)`: convert, then `nish_print`, its own one-argument entry point. */
export function emitConsoleLog(emitter: Emitter, expr: Node): string {
  const text = emitToString(emitter, expr.children[1].children[0]);
  emitter.fn.emit(`call void ${emitter.useRuntime("nish_print")}(i8* ${text})`);
  return "void";
}

/** `console.error(x)`: the general `nish_write(s, fd, newline)` on fd 2. */
export function emitConsoleError(emitter: Emitter, expr: Node): string {
  const text = emitToString(emitter, expr.children[1].children[0]);
  emitter.fn.emit(`call void ${emitter.useRuntime("nish_write")}(i8* ${text}, i32 2, i1 true)`);
  return "void";
}
