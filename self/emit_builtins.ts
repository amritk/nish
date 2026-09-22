// Builtin lowering for stage1 (`src/codegen/emit/math.ts`, `io.ts`, `arena.ts`
// and the dotted-call table of `emit/strings.ts`; docs/wp14-selfhost.md
// milestone S4).
//
// Two families, told apart the same way the checker tells them apart. **Dotted
// callees** (`console.log`, `Math.sqrt`, `process.exit`, `Arena.reset`,
// `String.fromCharCode`) are member calls whose receiver is not a value;
// **plain callees** (`toI32`, `parseInt`, `readFileSync`, `panic`) are
// consulted only when no user function of that name is in scope.
//
// `src/` pairs each lowering with a `callees` function inside one
// `BuiltinCall` object, so that what a builtin *emits* and what the attribute
// analysis is *told* it emits cannot drift apart. The language has no function
// values, so the pair is kept by locality instead: `emitBuiltinCall` and
// `builtinCallees` are the same `if` chain in the same order, and so are
// `emitIdentifierBuiltinCall` and `identifierBuiltinCallees`. An omission in
// either half is a wrong attribute on the caller, which is what the IR oracle
// is there to catch.

import { isBuiltinFunction } from "./builtins";
import { Emitter } from "./emit";
import { emitIndex } from "./emit_arrays";
import { emitConsoleError, emitConsoleLog, emitFromCharCode, stringifyCallee } from "./emit_strings";
import { internalErrorFor } from "./ice";
import { N_IDENT, Node } from "./nodes";
import { CheckedProgram } from "./program";
import { ARGV_GLOBAL, ARRAY_TYPE } from "./runtime";
import { f64Hex } from "./strings";
import {
  intBits,
  isFloat,
  isInteger,
  isUnsigned,
  ARRAY_STRUCT,
  T_BOOL,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  TypeTable,
} from "./types";

const PARSE_RUNTIME: string = "nish_parse_number";
const SAT_I32: string = "llvm.fptosi.sat.i32.f64";

const callIntrinsic = (emitter: Emitter, name: string, ret: string, args: string): string => emitter.fn.emitValue(`call ${ret} ${emitter.useRuntime(name)}(${args})`);

/** The first argument of a call, which is what most builtins take. */
const firstArgument = (expr: Node): Node => expr.children[1].children[0];

// ---- Conversions --------------------------------------------------------------------

/**
 * The intrinsic a `from -> to` conversion calls, if any (only float -> integer
 * needs one). The saturating family is chosen by the *target's* signedness:
 * `fptoui.sat` clamps a negative double to 0 rather than to the type's
 * minimum, which is the only sensible answer for an unsigned type.
 */
export const conversionIntrinsic = (table: TypeTable, from: i32, to: i32): string => {
  if (!isFloat(from) || !isInteger(to)) {
    return "";
  }
  const family = isUnsigned(to) ? "fptoui" : "fptosi";
  return `llvm.${family}.sat.${table.llvmType(to)}.${from === T_F32 ? "f32" : "f64"}`;
};

/**
 * Lower a numeric `value` of type `from` to type `to`.
 *
 * Same type, or two integers of the same width that differ only in signedness:
 * no instruction at all, because signedness is not in the LLVM type and the
 * bits do not move. Otherwise: widen with `sext`/`zext` by the *source's*
 * signedness, narrow with `trunc`, and cross to or from a float with the
 * signed or unsigned form.
 */
export const emitConversion = (emitter: Emitter, value: string, from: i32, to: i32): string => {
  if (from === to) {
    return value;
  }
  const fromTy = emitter.llvm(from);
  const toTy = emitter.llvm(to);
  const intrinsic = conversionIntrinsic(emitter.table, from, to);
  if (intrinsic.length > 0) {
    return callIntrinsic(emitter, intrinsic, toTy, `${fromTy} ${value}`);
  }
  if (isFloat(to)) {
    // float -> float is a plain widen or narrow; integer -> float picks the
    // family by the source's signedness, so a u32 above INT_MAX converts to
    // four billion rather than to a negative double.
    if (isFloat(from)) {
      const widen = from === T_F32; // the only float pair today is f32 <-> f64
      return emitter.fn.emitValue(`${widen ? "fpext" : "fptrunc"} ${fromTy} ${value} to ${toTy}`);
    }
    return emitter.fn.emitValue(`${isUnsigned(from) ? "uitofp" : "sitofp"} ${fromTy} ${value} to ${toTy}`);
  }
  if (fromTy === toTy) {
    return value; // i32 <-> u32, i64 <-> u64: the same bits, read differently
  }
  const op = intBits(from) < intBits(to) ? (isUnsigned(from) ? "zext" : "sext") : "trunc";
  return emitter.fn.emitValue(`${op} ${fromTy} ${value} to ${toTy}`);
};

/** The type a plain-identifier conversion builtin targets, or -1 when the name is not one. */
const builtinConversionTarget = (name: string): i32 => {
  if (name === "toI32") {
    return T_I32;
  }
  if (name === "toI64") {
    return T_I64;
  }
  if (name === "toU8") {
    return T_U8;
  }
  if (name === "toU16") {
    return T_U16;
  }
  if (name === "toU32") {
    return T_U32;
  }
  if (name === "toU64") {
    return T_U64;
  }
  if (name === "toF32") {
    return T_F32;
  }
  if (name === "toF64") {
    return T_F64;
  }
  return -1;
};

// ---- Math ---------------------------------------------------------------------------

/** The `llvm.<f>.f64` behind a one-argument `Math.*`, or the empty string. */
const f64UnaryIntrinsic = (name: string): string => {
  if (
    name === "sqrt" ||
    name === "floor" ||
    name === "ceil" ||
    name === "trunc" ||
    name === "sin" ||
    name === "cos" ||
    name === "exp" ||
    name === "log"
  ) {
    return `llvm.${name}.f64`;
  }
  return "";
};

/**
 * `Math.abs` on an unsigned value is the identity, so it lowers to no
 * instruction; the empty string says "there is no intrinsic to call".
 */
const absIntrinsic = (table: TypeTable, type: i32): string => {
  if (isUnsigned(type)) {
    return "";
  }
  return isInteger(type) ? `llvm.abs.${table.llvmType(type)}` : `llvm.fabs.${type === T_F32 ? "f32" : "f64"}`;
};

/** `llvm.umin`/`umax` for the unsigned widths, `smin`/`smax` for the signed ones. */
const minMaxIntrinsic = (table: TypeTable, which: string, type: i32): string => {
  if (!isInteger(type)) {
    return `llvm.${which}num.${type === T_F32 ? "f32" : "f64"}`;
  }
  return `llvm.${isUnsigned(type) ? "u" : "s"}${which}.${table.llvmType(type)}`;
};

/**
 * `Math.pow(x, y)`: `llvm.pow.f64` plus the two ECMAScript special cases C99
 * `pow` gets wrong — `pow(x, NaN)` is NaN and `pow(±1, ±Infinity)` is NaN.
 */
const emitMathPow = (emitter: Emitter, expr: Node): string => {
  const args = expr.children[1];
  const x = emitter.emitExpression(args.children[0]);
  const y = emitter.emitExpression(args.children[1]);
  const p = callIntrinsic(emitter, "llvm.pow.f64", "double", `double ${x}, double ${y}`);
  const yNaN = emitter.fn.emitValue(`fcmp uno double ${y}, ${y}`);
  const absX = callIntrinsic(emitter, "llvm.fabs.f64", "double", `double ${x}`);
  const absY = callIntrinsic(emitter, "llvm.fabs.f64", "double", `double ${y}`);
  const xOne = emitter.fn.emitValue(`fcmp oeq double ${absX}, 1.0`);
  const yInf = emitter.fn.emitValue(`fcmp oeq double ${absY}, 0x7FF0000000000000`);
  const special = emitter.fn.emitValue(`and i1 ${xOne}, ${yInf}`);
  const nan = emitter.fn.emitValue(`or i1 ${yNaN}, ${special}`);
  return emitter.fn.emitValue(`select i1 ${nan}, double 0x7FF8000000000000, double ${p}`);
};

/**
 * `Math.round(x)`: JavaScript rounds half toward +infinity, which is neither
 * `llvm.round` nor `llvm.roundeven`, and `floor(x + 0.5)` is wrong for
 * 0.49999999999999994. `f = floor(x)`, plus one when `x - f >= 0.5`.
 */
const emitMathRound = (emitter: Emitter, expr: Node): string => {
  const x = emitter.emitExpression(firstArgument(expr));
  const floor = callIntrinsic(emitter, "llvm.floor.f64", "double", `double ${x}`);
  const frac = emitter.fn.emitValue(`fsub double ${x}, ${floor}`);
  const up = emitter.fn.emitValue(`fcmp oge double ${frac}, ${f64Hex(0.5)}`);
  const next = emitter.fn.emitValue(`fadd double ${floor}, ${f64Hex(1.0)}`);
  return emitter.fn.emitValue(`select i1 ${up}, double ${next}, double ${floor}`);
};

const emitMathAbs = (emitter: Emitter, expr: Node): string => {
  const arg = firstArgument(expr);
  const type = emitter.typeOf(arg);
  const x = emitter.emitExpression(arg);
  const intrinsic = absIntrinsic(emitter.table, type);
  if (intrinsic.length === 0) {
    return x;
  }
  const ty = emitter.llvm(type);
  return callIntrinsic(emitter, intrinsic, ty, isInteger(type) ? `${ty} ${x}, i1 false` : `${ty} ${x}`);
};

const emitMathMinMax = (emitter: Emitter, expr: Node, which: string): string => {
  const args = expr.children[1];
  const type = emitter.typeOf(args.children[0]);
  const a = emitter.emitExpression(args.children[0]);
  const b = emitter.emitExpression(args.children[1]);
  const ty = emitter.llvm(type);
  return callIntrinsic(emitter, minMaxIntrinsic(emitter.table, which, type), ty, `${ty} ${a}, ${ty} ${b}`);
};

// ---- Process, files and the arena ------------------------------------------------------

/** Every argument as an `i8*`, which is what the file and stream builtins take. */
const stringArgs = (emitter: Emitter, expr: Node): string => {
  const parts: string[] = [];
  for (const arg of expr.children[1].children) {
    parts.push(`i8* ${emitter.emitExpression(arg)}`);
  }
  return parts.join(", ");
};

/** `write` / `writeError`: the bytes as they are, on fd 1 or 2. */
const emitStreamWrite = (emitter: Emitter, expr: Node, fd: i32): string => {
  const text = emitter.emitExpression(firstArgument(expr));
  emitter.fn.emit(`call void ${emitter.useRuntime("nish_write")}(i8* ${text}, i32 ${fd}, i1 false)`);
  return "void";
};

/**
 * `panic(message)`: the message and a newline on stderr, then exit 1 — the
 * same observable ending as the index panic, so a program has one failure mode
 * rather than two. `nish_exit` is `noreturn`, which is what makes the
 * `unreachable` legal and lets a non-void function end with a panic.
 */
const emitPanic = (emitter: Emitter, expr: Node): string => {
  const message = emitter.emitExpression(firstArgument(expr));
  emitter.fn.emit(`call void ${emitter.useRuntime("nish_write")}(i8* ${message}, i32 2, i1 true)`);
  emitter.fn.emit(`call void ${emitter.useRuntime("nish_exit")}(i32 1)`);
  emitter.fn.emit("unreachable");
  return "void";
};

/** `call double @nish_parse_number(i8* s, i32 mode)`: 0 parseFloat, 1 Number, 2 parseInt. */
const emitParseCall = (emitter: Emitter, s: string, mode: i32): string => emitter.fn.emitValue(
    `call double ${emitter.useRuntime(PARSE_RUNTIME)}(i8* ${s}, i32 ${mode})`
  );

// ---- Dotted builtins -------------------------------------------------------------------

/** `console.log(x)`, `Math.sqrt(x)`, `process.exit(n)`, `Arena.reset()`, ... */
export const emitBuiltinCall = (emitter: Emitter, expr: Node, name: string): string => {
  if (name === "console.log") {
    return emitConsoleLog(emitter, expr);
  }
  if (name === "console.error") {
    return emitConsoleError(emitter, expr);
  }
  if (name === "String.fromCharCode") {
    return emitFromCharCode(emitter, expr);
  }
  if (name === "Math.pow") {
    return emitMathPow(emitter, expr);
  }
  if (name === "Math.round") {
    return emitMathRound(emitter, expr);
  }
  if (name === "Math.abs") {
    return emitMathAbs(emitter, expr);
  }
  if (name === "Math.min") {
    return emitMathMinMax(emitter, expr, "min");
  }
  if (name === "Math.max") {
    return emitMathMinMax(emitter, expr, "max");
  }
  if (name === "Math.random") {
    return emitter.fn.emitValue(`call double ${emitter.useRuntime("nish_random")}()`);
  }
  if (name.startsWith("Math.")) {
    const intrinsic = f64UnaryIntrinsic(name.substring(5, name.length));
    if (intrinsic.length > 0) {
      return callIntrinsic(emitter, intrinsic, "double", `double ${emitter.emitExpression(firstArgument(expr))}`);
    }
  }
  if (name === "process.exit") {
    const code = emitter.emitExpression(firstArgument(expr));
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_exit")}(i32 ${code})`);
    emitter.fn.emit("unreachable");
    return "void";
  }
  if (name === "Arena.reset") {
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_reset_arena")}()`);
    return "void";
  }
  if (name === "Arena.release") {
    const mark = emitter.emitExpression(firstArgument(expr));
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_arena_release")}(i64 ${mark})`);
    return "void";
  }
  if (name === "Arena.mark") {
    return emitter.fn.emitValue(`call i64 ${emitter.useRuntime("nish_arena_mark")}()`);
  }
  if (name === "Arena.used") {
    return emitter.fn.emitValue(`call i64 ${emitter.useRuntime("nish_arena_used")}()`);
  }
  process.exit(internalErrorFor(emitter.opts.json, `emitter: unexpected builtin \`${name}\``));
};

/**
 * The runtime symbols and intrinsics the dotted lowerings above may call. The
 * order of the tests is theirs, so a reader can diff the two halves.
 */
export const builtinCallees = (program: CheckedProgram, table: TypeTable, call: Node): string[] => {
  const access = call.children[0];
  return builtinCalleesNamed(program, table, call, `${access.children[0].text}.${access.text}`);
};

/**
 * The same, under a name the call site does not spell. A `nish:` import can
 * bring a dotted builtin in as a plain identifier (`exit` for `process.exit`),
 * and the analysis has to be told what that call emits whichever way the
 * program spelled it — an omission here is a wrong attribute, not a cosmetic
 * difference.
 */
export const builtinCalleesNamed = (
  program: CheckedProgram,
  table: TypeTable,
  call: Node,
  name: string
): string[] => {
  const out: string[] = [];
  const args = call.children[1];
  const firstType = args.children.length > 0 ? program.nodeTypes[args.children[0].id] : -1;
  if (name === "console.log" || name === "console.error") {
    out.push(name === "console.log" ? "nish_print" : "nish_write");
    const callee = firstType >= 0 ? stringifyCallee(firstType) : "";
    if (callee.length > 0) {
      out.push(callee);
    }
    return out;
  }
  if (name === "String.fromCharCode") {
    out.push("nish_str_new");
    return out;
  }
  if (name === "Math.pow") {
    out.push("llvm.pow.f64");
    out.push("llvm.fabs.f64");
    return out;
  }
  if (name === "Math.round") {
    out.push("llvm.floor.f64");
    return out;
  }
  if (name === "Math.abs") {
    const intrinsic = absIntrinsic(table, firstType);
    if (intrinsic.length > 0) {
      out.push(intrinsic);
    }
    return out;
  }
  if (name === "Math.min") {
    out.push(minMaxIntrinsic(table, "min", firstType));
    return out;
  }
  if (name === "Math.max") {
    out.push(minMaxIntrinsic(table, "max", firstType));
    return out;
  }
  if (name === "Math.random") {
    out.push("nish_random");
    return out;
  }
  if (name.startsWith("Math.")) {
    const intrinsic = f64UnaryIntrinsic(name.substring(5, name.length));
    if (intrinsic.length > 0) {
      out.push(intrinsic);
    }
    return out;
  }
  if (name === "process.exit") {
    out.push("nish_exit");
    return out;
  }
  if (name === "Arena.reset") {
    out.push("nish_reset_arena");
    return out;
  }
  if (name === "Arena.release") {
    out.push("nish_arena_release");
    return out;
  }
  if (name === "Arena.mark") {
    out.push("nish_arena_mark");
    return out;
  }
  if (name === "Arena.used") {
    out.push("nish_arena_used");
    return out;
  }
  return out;
};

// ---- Identifier builtins ----------------------------------------------------------------

/** A call of a builtin by plain name, when no user function of that name is in scope. */
export const isIdentifierBuiltinCall = (program: CheckedProgram, call: Node): boolean => {
  if (call.children[0].kind !== N_IDENT || program.nodeCallees[call.id] !== null) {
    return false;
  }
  return isBuiltinFunction(call.children[0].text);
};

export const emitIdentifierBuiltinCall = (emitter: Emitter, expr: Node, name: string): string => {
  const target = builtinConversionTarget(name);
  if (target >= 0) {
    const arg = firstArgument(expr);
    return emitConversion(emitter, emitter.emitExpression(arg), emitter.typeOf(arg), target);
  }
  if (name === "f64ToBits") {
    return emitter.fn.emitValue(`bitcast double ${emitter.emitExpression(firstArgument(expr))} to i64`);
  }
  if (name === "bitsToF64") {
    return emitter.fn.emitValue(`bitcast i64 ${emitter.emitExpression(firstArgument(expr))} to double`);
  }
  if (name === "parseInt") {
    const value = emitParseCall(emitter, emitter.emitExpression(firstArgument(expr)), 2);
    return callIntrinsic(emitter, SAT_I32, "i32", `double ${value}`);
  }
  if (name === "parseFloat") {
    return emitParseCall(emitter, emitter.emitExpression(firstArgument(expr)), 0);
  }
  if (name === "Number") {
    const arg = firstArgument(expr);
    const from = emitter.typeOf(arg);
    const value = emitter.emitExpression(arg);
    if (from === T_STRING) {
      return emitParseCall(emitter, value, 1);
    }
    if (from === T_BOOL) {
      return emitter.fn.emitValue(`uitofp i1 ${value} to double`);
    }
    return emitConversion(emitter, value, from, T_F64);
  }
  if (name === "readFileSync") {
    return emitter.fn.emitValue(
      `call i8* ${emitter.useRuntime("nish_read_file")}(${stringArgs(emitter, expr)})`
    );
  }
  if (name === "readFileSyncOrNull") {
    return emitter.fn.emitValue(
      `call i8* ${emitter.useRuntime("nish_read_file_or_null")}(${stringArgs(emitter, expr)})`
    );
  }
  if (name === "writeFileSync") {
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_write_file")}(${stringArgs(emitter, expr)})`);
    return "void";
  }
  if (name === "appendFileSync") {
    emitter.fn.emit(`call void ${emitter.useRuntime("nish_append_file")}(${stringArgs(emitter, expr)})`);
    return "void";
  }
  // WP14 D4: the two host calls a self-hosted driver needs to link its output.
  if (name === "mkdirSync") {
    return emitter.fn.emitValue(`call zeroext i1 ${emitter.useRuntime("nish_mkdir")}(${stringArgs(emitter, expr)})`);
  }
  // The array header goes straight to the runtime, which builds the C vector
  // from it. The status is an `i32`, so `--number-mode f64` widens it the way
  // `a.length` is widened.
  if (name === "spawnSync") {
    emitter.declareType(ARRAY_TYPE);
    const argv = emitter.emitExpression(firstArgument(expr));
    const status = emitter.fn.emitValue(`call i32 ${emitter.useRuntime("nish_spawn")}(${ARRAY_STRUCT}* ${argv})`);
    if (emitter.typeOf(expr) === T_F64) {
      return emitter.fn.emitValue(`sitofp i32 ${status} to double`);
    }
    return status;
  }
  // The same call with the two paths after the vector. The arguments are
  // emitted left to right, as every call's are, so a path expression that
  // allocates does so before the child starts.
  if (name === "spawnSyncTo") {
    emitter.declareType(ARRAY_TYPE);
    const args = expr.children[1].children;
    const argv = emitter.emitExpression(args[0]);
    const out = emitter.emitExpression(args[1]);
    const err = emitter.emitExpression(args[2]);
    const status = emitter.fn.emitValue(
      `call i32 ${emitter.useRuntime("nish_spawn_to")}(${ARRAY_STRUCT}* ${argv}, i8* ${out}, i8* ${err})`
    );
    if (emitter.typeOf(expr) === T_F64) {
      return emitter.fn.emitValue(`sitofp i32 ${status} to double`);
    }
    return status;
  }
  // One call answering the array header, which may be null. The same shape as
  // `readFileSyncOrNull` one type up: the checker typed it `string[] | null` and
  // an ordinary null compare narrows it, so nothing here has to know that a
  // nullable array is a nullable pointer.
  if (name === "readdirSync") {
    emitter.declareType(ARRAY_TYPE);
    return emitter.fn.emitValue(
      `call ${ARRAY_STRUCT}* ${emitter.useRuntime("nish_readdir")}(${stringArgs(emitter, expr)})`
    );
  }
  // One call, an `i64`, and no arguments to emit.
  if (name === "monotonicNanos") {
    return emitter.fn.emitValue(`call i64 ${emitter.useRuntime("nish_monotonic_nanos")}()`);
  }
  // WP14 §7a: one `stat`, and the C answer is already the language's `boolean`.
  if (name === "isDirectorySync") {
    return emitter.fn.emitValue(`call zeroext i1 ${emitter.useRuntime("nish_is_dir")}(${stringArgs(emitter, expr)})`);
  }
  // WP19 R1: one call, and the runtime's null is already the language's — the
  // same shape as `readFileSyncOrNull` down to the LLVM type.
  if (name === "realpathSync") {
    return emitter.fn.emitValue(
      `call i8* ${emitter.useRuntime("nish_realpath")}(${stringArgs(emitter, expr)})`
    );
  }
  if (name === "getenv") {
    return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("nish_getenv")}(${stringArgs(emitter, expr)})`);
  }
  if (name === "write") {
    return emitStreamWrite(emitter, expr, 1);
  }
  if (name === "writeError") {
    return emitStreamWrite(emitter, expr, 2);
  }
  if (name === "panic") {
    return emitPanic(emitter, expr);
  }
  process.exit(internalErrorFor(emitter.opts.json, `emitter: unexpected builtin \`${name}\``));
};

/** The other half of the pair above, in the same order. */
/**
 * A call of the `spawnSync` or `spawnSyncTo` builtin (not of a user function
 * that happens to be called either, which wins the name as every identifier
 * builtin loses it). `attributes.ts` asks, because the argument escapes into
 * the runtime: the spawn path copies each element's bytes pointer into an arena
 * vector that outlives the call. It answers for both names, because both reach
 * that same C.
 */
export const isSpawnCall = (program: CheckedProgram, call: Node): boolean => {
  const callee = call.children[0];
  if (callee.kind !== N_IDENT || program.nodeCallees[call.id] !== null) {
    return false;
  }
  return callee.text === "spawnSync" || callee.text === "spawnSyncTo";
};

export const identifierBuiltinCallees = (program: CheckedProgram, table: TypeTable, call: Node): string[] => identifierBuiltinCalleesNamed(program, table, call, call.children[0].text);

/** The same, under the name a `nish:` import bound — see `builtinCalleesNamed`. */
export const identifierBuiltinCalleesNamed = (
  program: CheckedProgram,
  table: TypeTable,
  call: Node,
  name: string
): string[] => {
  const out: string[] = [];
  if (!isBuiltinFunction(name)) {
    return out;
  }
  const args = call.children[1];
  const firstType = args.children.length > 0 ? program.nodeTypes[args.children[0].id] : -1;
  const target = builtinConversionTarget(name);
  if (target >= 0) {
    const intrinsic = firstType >= 0 ? conversionIntrinsic(table, firstType, target) : "";
    if (intrinsic.length > 0) {
      out.push(intrinsic);
    }
    return out;
  }
  if (name === "parseInt") {
    out.push(PARSE_RUNTIME);
    out.push(SAT_I32);
    return out;
  }
  if (name === "parseFloat") {
    out.push(PARSE_RUNTIME);
    return out;
  }
  if (name === "Number") {
    if (firstType === T_STRING) {
      out.push(PARSE_RUNTIME);
    }
    return out;
  }
  if (name === "readFileSync") {
    out.push("nish_read_file");
    return out;
  }
  if (name === "readFileSyncOrNull") {
    out.push("nish_read_file_or_null");
    return out;
  }
  if (name === "writeFileSync") {
    out.push("nish_write_file");
    return out;
  }
  if (name === "appendFileSync") {
    out.push("nish_append_file");
    return out;
  }
  if (name === "mkdirSync") {
    out.push("nish_mkdir");
    return out;
  }
  if (name === "spawnSync") {
    out.push("nish_spawn");
    return out;
  }
  if (name === "spawnSyncTo") {
    out.push("nish_spawn_to");
    return out;
  }
  if (name === "readdirSync") {
    out.push("nish_readdir");
    return out;
  }
  if (name === "monotonicNanos") {
    out.push("nish_monotonic_nanos");
    return out;
  }
  if (name === "isDirectorySync") {
    out.push("nish_is_dir");
    return out;
  }
  if (name === "getenv") {
    out.push("nish_getenv");
    return out;
  }
  if (name === "realpathSync") {
    out.push("nish_realpath");
    return out;
  }
  if (name === "write" || name === "writeError") {
    out.push("nish_write");
    return out;
  }
  if (name === "panic") {
    out.push("nish_write");
    out.push("nish_exit");
    return out;
  }
  return out; // f64ToBits / bitsToF64: one bitcast, no call
};

// ---- Namespace properties -----------------------------------------------------------------

/** `Math.PI`, `Math.E`, `process.argv` and the two machine strings: values rather than calls. */
export const emitNamespaceProperty = (emitter: Emitter, expr: Node, name: string): string => {
  if (name === "Math.PI") {
    return f64Hex(Math.PI);
  }
  if (name === "Math.E") {
    return f64Hex(Math.E);
  }
  if (name === "process.argv") {
    // The array pointer the entry wrapper stored in `@nish_argv`.
    emitter.declareType(ARRAY_TYPE);
    emitter.declareGlobal(ARGV_GLOBAL);
    const align = emitter.opts.optimizeAttributes ? ", align 8" : "";
    return emitter.fn.emitValue(`load ${ARRAY_STRUCT}*, ${ARRAY_STRUCT}** @nish_argv${align}`);
  }
  // WP14 §7a. One call to the runtime, which answers the address of a string
  // in its own constant data: nothing is read and nothing is allocated, so
  // unlike `process.argv` this leaves a function `readnone`.
  if (name === "process.platform") {
    return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("nish_platform")}()`);
  }
  if (name === "process.arch") {
    return emitter.fn.emitValue(`call i8* ${emitter.useRuntime("nish_arch")}()`);
  }
  process.exit(internalErrorFor(emitter.opts.json, `emitter: unexpected builtin property \`${name}\``));
};
