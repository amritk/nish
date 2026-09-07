// String lowering for stage1 (`src/codegen/emit/strings.ts`,
// docs/wp14-selfhost.md milestone S4).
//
// Layout (ABI, shared with `runtime/runtime.c`): a `string` is an `i8*` to
// `{ i64 len, i8 data[len], i8 0 }`, 8-byte aligned, immutable. The lowerings
// are `src/codegen/emit/strings.ts`'s, unchanged: a literal is an interned
// `@.str.N`, `a + b` is `sts_str_concat`, `a === b` is `sts_str_eq`,
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
 * expression that points at its header (what every `sts_str_*` expects).
 */
export function addStringConstant(module: IRModule, index: i32, text: string): string {
  // A StaticTS string is bytes, so `length` is already the byte length the
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
 * when no call is needed. Every unsigned width shares `sts_str_from_u64`: the
 * value is `zext`ed to i64 first, which is one instruction the optimiser
 * usually folds away and much cheaper than four formatters in a runtime with
 * a size budget.
 */
export function stringifyCallee(type: i32): string {
  if (isUnsigned(type)) {
    return "sts_str_from_u64";
  }
  if (type === T_I32) {
    return "sts_str_from_i32";
  }
  if (type === T_I64) {
    return "sts_str_from_i64";
  }
  if (isFloat(type)) {
    return "sts_str_from_f64";
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
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("sts_str_concat")}(i8* ${lhs}, i8* ${rhs})`);
}

// ---- Template literals ----------------------------------------------------------------

/**
 * Constant parts are literals, holes are converted, and the parts are joined
 * left to right with `sts_str_concat`. A template with no parts at all
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
  return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("sts_str_new")}(i8* ${bytes}, i64 ${n})`);
}

/** `sts_str_at(s, at, sub)`: whether `sub`'s bytes sit at offset `at`. */
function emitOccursAt(emitter: Emitter, str: string, at: string, sub: string): string {
  return emitter.fn.emitValue(
    `call zeroext i1 ${emitter.useRuntime("sts_str_at")}(i8* ${str}, i64 ${at}, i8* ${sub})`
  );
}

/** `s.charCodeAt(i)`: the byte at `i`, bounds-checked exactly as `a[i]` is. */
function emitCharCodeAt(emitter: Emitter, expr: Node, str: string): string {
  const args = expr.children[1];
  const index = emitIndex(emitter, args.children[0]);
  emitRangeCheck(emitter, index, loadStringLength(emitter, str));
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
 * `s.substring(a, b)`: both ends clamped into `[0, len]` and then swapped into
 * order, as JavaScript specifies, so the length is never negative and the copy
 * never leaves the string.
 */
function emitSubstring(emitter: Emitter, expr: Node, str: string): string {
  const args = expr.children[1];
  const len = loadStringLength(emitter, str);
  const first = clampToLength(emitter, emitIndex(emitter, args.children[0]), len);
  const second =
    args.children.length > 1 ? clampToLength(emitter, emitIndex(emitter, args.children[1]), len) : len;
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
 * `s.indexOf(sub)`: the first offset where `sub` occurs, or -1. The scan is a
 * loop here rather than a runtime function, which keeps `runtime.c` inside its
 * budget and lets LLVM see through the search when the needle is a constant.
 *
 * The loop is invisible to `attributes.ts`, which counts *source* loops, so it
 * must terminate on its own for `willreturn` to stay sound: the offset rises
 * by one per pass and the guard fails once it passes `len - sub.len`.
 */
function emitStringIndexOf(emitter: Emitter, expr: Node, str: string): string {
  const fn = emitter.fn;
  const sub = emitter.emitExpression(expr.children[1].children[0]);
  const len = loadStringLength(emitter, str);
  const subLen = loadStringLength(emitter, sub);
  const slot = fn.emitAlloca("str.at", "i64", 8);
  fn.emit(`store i64 0, i64* ${slot}, align 8`);
  const condBlock = fn.newBlock("str.find");
  const probeBlock = fn.newBlock("str.probe");
  const nextBlock = fn.newBlock("str.next");
  const missBlock = fn.newBlock("str.miss");
  const endBlock = fn.newBlock("str.found");

  fn.emit(`br label %${condBlock.label}`);
  fn.placeBlock(condBlock);
  const at = fn.emitValue(`load i64, i64* ${slot}, align 8`);
  const end = fn.emitValue(`add i64 ${at}, ${subLen}`);
  const fits = fn.emitValue(`icmp ule i64 ${end}, ${len}`);
  fn.emit(`br i1 ${fits}, label %${probeBlock.label}, label %${missBlock.label}`);

  fn.placeBlock(probeBlock);
  const hit = emitOccursAt(emitter, str, at, sub);
  fn.emit(`br i1 ${hit}, label %${endBlock.label}, label %${nextBlock.label}`);

  fn.placeBlock(nextBlock);
  const next = fn.emitValue(`add i64 ${at}, 1`);
  fn.emit(`store i64 ${next}, i64* ${slot}, align 8`);
  fn.emit(`br label %${condBlock.label}`);

  fn.placeBlock(missBlock);
  fn.emit(`br label %${endBlock.label}`);

  fn.placeBlock(endBlock);
  const found = fn.emitValue(`phi i64 [ ${at}, %${probeBlock.label} ], [ -1, %${missBlock.label} ]`);
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
  if (name === "indexOf") {
    return emitStringIndexOf(emitter, expr, str);
  }
  if (name === "startsWith") {
    return emitOccursAt(emitter, str, "0", emitter.emitExpression(expr.children[1].children[0]));
  }
  // `endsWith`: the suffix sits at `len - sub.len`, which is negative when the
  // suffix is the longer string, and `sts_str_at` then answers false.
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

/** The runtime symbols a string byte method calls, for the attribute fixpoint. */
export function stringConstructCallees(name: string): string[] {
  const out: string[] = [];
  if (name === "substring") {
    out.push("sts_str_new");
  } else if (name !== "charCodeAt") {
    out.push("sts_str_at");
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
      `call zeroext i1 ${emitter.useRuntime("sts_str_eq")}(i8* ${lhs}, i8* ${rhs})`
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

/** `console.log(x)`: convert, then `sts_print`, its own one-argument entry point. */
export function emitConsoleLog(emitter: Emitter, expr: Node): string {
  const text = emitToString(emitter, expr.children[1].children[0]);
  emitter.fn.emit(`call void ${emitter.useRuntime("sts_print")}(i8* ${text})`);
  return "void";
}

/** `console.error(x)`: the general `sts_write(s, fd, newline)` on fd 2. */
export function emitConsoleError(emitter: Emitter, expr: Node): string {
  const text = emitToString(emitter, expr.children[1].children[0]);
  emitter.fn.emit(`call void ${emitter.useRuntime("sts_write")}(i8* ${text}, i32 2, i1 true)`);
  return "void";
}
