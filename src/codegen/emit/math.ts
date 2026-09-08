/**
 * Math builtins and numeric conversions (WP7), checked by `checker/math.ts`.
 *
 * Every lowering is either a single LLVM intrinsic call or a short
 * straight-line sequence; nothing here touches memory, so callers stay
 * `readnone` (the intrinsics carry `effect: "none"` in runtime.ts).
 *
 *   Math.sqrt/floor/ceil/trunc/sin/cos/exp/log(x)   call double @llvm.<f>.f64(double x)
 *   Math.pow(x, y)                                  llvm.pow.f64 plus selects for the ECMAScript NaN cases
 *   Math.abs(x)      f64: @llvm.fabs.f64          i32/i64: @llvm.abs.<T>(T x, i1 false)
 *                    (`i1 false`: INT_MIN wraps to itself instead of poison)
 *                    unsigned: nothing, the value is already its own magnitude
 *   Math.min/max     f64: @llvm.minnum/maxnum.f64   i32/i64: @llvm.smin/smax.<T>
 *                    unsigned: @llvm.umin/umax.<T>
 *   Math.round(x)    f = floor(x); f + 1 when x - f >= 0.5 else f  (see below)
 *   Math.random()    call double @amrit_random()   (write effect: RNG state)
 *   Math.PI, Math.E  f64 constants
 *   toI32/toI64/toF64(x)   sext / trunc / sitofp / @llvm.fptosi.sat.<T>.f64
 *   toU8/toU16/toU32/toU64(x)  zext / trunc / uitofp / @llvm.fptoui.sat.<T>.f64,
 *                    and *nothing* between two integers of the same width that
 *                    differ only in signedness (WP15)
 *   parseFloat(s)          call double @amrit_parse_number(i8* s, i32 0)
 *   Number(s)              call double @amrit_parse_number(i8* s, i32 1)   (string)
 *   Number(x)              sitofp / `uitofp i1` / nothing                (i32, i64, boolean, f64)
 *   parseInt(s)            @amrit_parse_number(s, i32 2) then @llvm.fptosi.sat.i32.f64
 *
 * The parsing runtime call takes a mode instead of being three symbols to
 * keep runtime.c within its size budget. parseInt comes back as the exact
 * integer value in a double (or 0 without digits, since NaN has no i32) and
 * the saturating conversion clamps it into the i32 range, so
 * `parseInt("99999999999")` is 2147483647, exactly what `toI32` would do.
 *
 * Math.round: JavaScript rounds half toward +infinity (`Math.round(-2.5)` is
 * -2), which is neither `llvm.round` (half away from zero: -3) nor
 * `llvm.roundeven`. `floor(x + 0.5)` is also wrong: 0.49999999999999994 + 0.5
 * rounds up to 1.0 in double arithmetic. The emitted sequence computes
 * `f = floor(x)` and adds 1 when `x - f >= 0.5`; `x - f` is exact for every
 * finite double, NaN and +/-Infinity fall through unchanged (the compare is
 * false), so only the sign of a zero result can differ from JavaScript
 * (`Math.round(-0.3)` is `-0` there, `0` here; both print as `0`).
 *
 * Math.min/max on f64 use `minnum`/`maxnum`, which return the non-NaN operand
 * when the other is NaN (JavaScript returns NaN) and may pick either zero for
 * `min(0, -0)`. Documented in docs/wp7-runtime.md.
 *
 * toI32/toI64 from f64 use the saturating intrinsics: NaN becomes 0 and
 * out-of-range values clamp, so the conversion is defined for every input
 * (plain `fptosi` would be poison there). This is C#/Rust `as` behaviour, not
 * JavaScript's modulo-2^32 `ToInt32`. The unsigned targets use `fptoui.sat`,
 * whose clamp is to `0 .. 2^bits-1`, so a negative double becomes 0.
 */
import { CheckedProgram } from "../../checker";
import {
  F32,
  F64,
  I32,
  I64,
  StaticType,
  U8,
  U16,
  U32,
  U64,
  intBits,
  isFloat,
  isInteger,
  isUnsigned,
  llvmType,
} from "../../types";
import { BuiltinCall, BuiltinProperty, f64Constant } from "./builtins";
import { EmitContext } from "./context";

// ---- Math.* -----------------------------------------------------------------------

function callIntrinsic(ctx: EmitContext, name: string, ret: string, args: string): string {
  return ctx.fn.emitValue(`call ${ret} ${ctx.useRuntime(name)}(${args})`);
}

/** `Math.<f>(x: f64): f64` as one intrinsic call. */
function f64Unary(intrinsic: string): BuiltinCall {
  return {
    emit: (ctx, expr) =>
      callIntrinsic(ctx, intrinsic, "double", `double ${ctx.emitExpression(expr.arguments[0])}`),
    callees: () => [intrinsic],
  };
}

const mathPow: BuiltinCall = {
  emit: (ctx, expr) => {
    const x = ctx.emitExpression(expr.arguments[0]);
    const y = ctx.emitExpression(expr.arguments[1]);
    // ECMAScript special cases on top of C99 pow: pow(x, NaN) is NaN (C: pow(1, NaN) = 1)
    // and pow(±1, ±Infinity) is NaN (C: 1). Everything else, including pow(x, ±0) = 1, agrees.
    const p = callIntrinsic(ctx, "llvm.pow.f64", "double", `double ${x}, double ${y}`);
    const yNaN = ctx.fn.emitValue(`fcmp uno double ${y}, ${y}`);
    const absX = callIntrinsic(ctx, "llvm.fabs.f64", "double", `double ${x}`);
    const absY = callIntrinsic(ctx, "llvm.fabs.f64", "double", `double ${y}`);
    const xOne = ctx.fn.emitValue(`fcmp oeq double ${absX}, 1.0`);
    const yInf = ctx.fn.emitValue(`fcmp oeq double ${absY}, 0x7FF0000000000000`);
    const special = ctx.fn.emitValue(`and i1 ${xOne}, ${yInf}`);
    const nan = ctx.fn.emitValue(`or i1 ${yNaN}, ${special}`);
    return ctx.fn.emitValue(`select i1 ${nan}, double 0x7FF8000000000000, double ${p}`);
  },
  callees: () => ["llvm.pow.f64", "llvm.fabs.f64"],
};

const mathRound: BuiltinCall = {
  emit: (ctx, expr) => {
    const x = ctx.emitExpression(expr.arguments[0]);
    const floor = callIntrinsic(ctx, "llvm.floor.f64", "double", `double ${x}`);
    const frac = ctx.fn.emitValue(`fsub double ${x}, ${floor}`);
    const up = ctx.fn.emitValue(`fcmp oge double ${frac}, ${f64Constant(0.5)}`);
    const next = ctx.fn.emitValue(`fadd double ${floor}, ${f64Constant(1)}`);
    return ctx.fn.emitValue(`select i1 ${up}, double ${next}, double ${floor}`);
  },
  callees: () => ["llvm.floor.f64"],
};

/**
 * `Math.abs` on an unsigned value is the identity, so it lowers to no
 * instruction; `undefined` says "there is no intrinsic to call" (WP15).
 */
function absIntrinsic(t: StaticType): string | undefined {
  if (isUnsigned(t)) return undefined;
  return isInteger(t) ? `llvm.abs.${llvmType(t)}` : `llvm.fabs.${t.kind}`;
}

const mathAbs: BuiltinCall = {
  emit: (ctx, expr) => {
    const t = ctx.typeOf(expr.arguments[0]);
    const x = ctx.emitExpression(expr.arguments[0]);
    const intrinsic = absIntrinsic(t);
    if (!intrinsic) return x;
    const ty = llvmType(t);
    return callIntrinsic(ctx, intrinsic, ty, isInteger(t) ? `${ty} ${x}, i1 false` : `${ty} ${x}`);
  },
  callees: (program, expr) => {
    const intrinsic = absIntrinsic(program.types.get(expr.arguments[0])!);
    return intrinsic ? [intrinsic] : [];
  },
};

/** `llvm.umin`/`umax` for the unsigned widths, `smin`/`smax` for the signed ones. */
function minMaxIntrinsic(which: "min" | "max", t: StaticType): string {
  if (!isInteger(t)) return `llvm.${which}num.${t.kind}`;
  return `llvm.${isUnsigned(t) ? "u" : "s"}${which}.${llvmType(t)}`;
}

function mathMinMax(which: "min" | "max"): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      const t = ctx.typeOf(expr.arguments[0]);
      const a = ctx.emitExpression(expr.arguments[0]);
      const b = ctx.emitExpression(expr.arguments[1]);
      const ty = llvmType(t);
      return callIntrinsic(ctx, minMaxIntrinsic(which, t), ty, `${ty} ${a}, ${ty} ${b}`);
    },
    callees: (program, expr) => [minMaxIntrinsic(which, program.types.get(expr.arguments[0])!)],
  };
}

const mathRandom: BuiltinCall = {
  emit: (ctx) => ctx.fn.emitValue(`call double ${ctx.useRuntime("amrit_random")}()`),
  callees: () => ["amrit_random"],
};

const F64_UNARY: Record<string, string> = {
  sqrt: "llvm.sqrt.f64",
  floor: "llvm.floor.f64",
  ceil: "llvm.ceil.f64",
  trunc: "llvm.trunc.f64",
  sin: "llvm.sin.f64",
  cos: "llvm.cos.f64",
  exp: "llvm.exp.f64",
  log: "llvm.log.f64",
};

/** Dotted callees, spread into `builtinCallEmitters`; mirrors `mathBuiltinCalls`. */
export const mathBuiltinCallEmitters: Record<string, BuiltinCall> = {
  ...Object.fromEntries(
    Object.entries(F64_UNARY).map(([f, intrinsic]) => [`Math.${f}`, f64Unary(intrinsic)])
  ),
  "Math.pow": mathPow,
  "Math.round": mathRound,
  "Math.abs": mathAbs,
  "Math.min": mathMinMax("min"),
  "Math.max": mathMinMax("max"),
  "Math.random": mathRandom,
};

/** Builtin constants; mirrors `mathBuiltinProperties`. */
export const mathPropertyEmitters: Record<string, BuiltinProperty> = {
  "Math.PI": { value: f64Constant(Math.PI) },
  "Math.E": { value: f64Constant(Math.E) },
};

// ---- Conversions ------------------------------------------------------------------

/**
 * The intrinsic a `from -> to` conversion calls, if any (only f64 -> integer
 * needs one). The saturating family is chosen by the *target's* signedness:
 * `fptoui.sat` clamps a negative double to 0 rather than to the type's
 * minimum, which is the only sensible answer for an unsigned type (WP15).
 */
function conversionIntrinsic(from: StaticType, to: StaticType): string | undefined {
  if (!isFloat(from) || !isInteger(to)) return undefined;
  return `llvm.${isUnsigned(to) ? "fptoui" : "fptosi"}.sat.${llvmType(to)}.${from.kind}`;
}

/**
 * Lower a numeric `value` of type `from` to type `to`.
 *
 * Same type, or two integers of the same width that differ only in
 * signedness: no instruction at all, because signedness is not in the LLVM
 * type and the bits do not move (WP15; `tests/cases/u_conv_same_width`).
 * Otherwise: widen with `sext`/`zext` by the *source's* signedness, narrow
 * with `trunc`, and cross to or from `f64` with the signed or unsigned form.
 */
export function emitConversion(ctx: EmitContext, value: string, from: StaticType, to: StaticType): string {
  if (from.kind === to.kind) return value;
  const fromTy = llvmType(from);
  const toTy = llvmType(to);
  const intrinsic = conversionIntrinsic(from, to);
  if (intrinsic) return callIntrinsic(ctx, intrinsic, toTy, `${fromTy} ${value}`);
  if (isFloat(to)) {
    // float -> float is a plain widen or narrow; integer -> float picks the
    // family by the source's signedness, so a u32 above INT_MAX converts to
    // four billion rather than to a negative double (WP15).
    if (isFloat(from)) {
      const widen = from.kind === "f32"; // the only float pair today is f32 <-> f64
      return ctx.fn.emitValue(`${widen ? "fpext" : "fptrunc"} ${fromTy} ${value} to ${toTy}`);
    }
    return ctx.fn.emitValue(`${isUnsigned(from) ? "uitofp" : "sitofp"} ${fromTy} ${value} to ${toTy}`);
  }
  if (fromTy === toTy) return value; // i32 <-> u32, i64 <-> u64: the same bits, read differently
  const op = intBits(from) < intBits(to) ? (isUnsigned(from) ? "zext" : "sext") : "trunc";
  return ctx.fn.emitValue(`${op} ${fromTy} ${value} to ${toTy}`);
}

function conversion(to: StaticType): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      const arg = expr.arguments[0];
      return emitConversion(ctx, ctx.emitExpression(arg), ctx.typeOf(arg), to);
    },
    callees: (program: CheckedProgram, expr) => {
      const intrinsic = conversionIntrinsic(program.types.get(expr.arguments[0])!, to);
      return intrinsic ? [intrinsic] : [];
    },
  };
}

/**
 * `f64ToBits` / `bitsToF64`: one `bitcast`, which LLVM resolves in the register
 * allocator rather than emitting an instruction. No call, no memory, no runtime
 * symbol, so a function that only reinterprets bits stays `readnone`.
 */
function bitcast(from: string, to: string): BuiltinCall {
  return {
    emit: (ctx, expr) => ctx.fn.emitValue(`bitcast ${from} ${ctx.emitExpression(expr.arguments[0])} to ${to}`),
    callees: () => [],
  };
}

/** Identifier callees, spread into `builtinFunctionEmitters`; mirrors `conversionBuiltins`. */
export const conversionEmitters: Record<string, BuiltinCall> = {
  toI32: conversion(I32),
  toI64: conversion(I64),
  toU8: conversion(U8),
  toU16: conversion(U16),
  toU32: conversion(U32),
  toU64: conversion(U64),
  toF32: conversion(F32),
  toF64: conversion(F64),
  f64ToBits: bitcast("double", "i64"),
  bitsToF64: bitcast("i64", "double"),
};

// ---- String to number (WP7) ---------------------------------------------------------

const PARSE_RUNTIME = "amrit_parse_number";
const SAT_I32 = "llvm.fptosi.sat.i32.f64";

/** `call double @amrit_parse_number(i8* s, i32 mode)`: 0 parseFloat, 1 Number, 2 parseInt. */
function parseCall(ctx: EmitContext, s: string, mode: 0 | 1 | 2): string {
  return ctx.fn.emitValue(`call double ${ctx.useRuntime(PARSE_RUNTIME)}(i8* ${s}, i32 ${mode})`);
}

const parseIntCall: BuiltinCall = {
  emit: (ctx, expr) => {
    const value = parseCall(ctx, ctx.emitExpression(expr.arguments[0]), 2);
    return callIntrinsic(ctx, SAT_I32, "i32", `double ${value}`);
  },
  callees: () => [PARSE_RUNTIME, SAT_I32],
};

const parseFloatCall: BuiltinCall = {
  emit: (ctx, expr) => parseCall(ctx, ctx.emitExpression(expr.arguments[0]), 0),
  callees: () => [PARSE_RUNTIME],
};

/** `Number(x)`: a string is parsed by the runtime; `boolean` is `uitofp`; numbers convert as `toF64`. */
const numberOf: BuiltinCall = {
  emit: (ctx, expr) => {
    const arg = expr.arguments[0];
    const from = ctx.typeOf(arg);
    const value = ctx.emitExpression(arg);
    if (from.kind === "string") return parseCall(ctx, value, 1);
    if (from.kind === "bool") return ctx.fn.emitValue(`uitofp i1 ${value} to double`);
    return emitConversion(ctx, value, from, F64);
  },
  callees: (program, expr) =>
    program.types.get(expr.arguments[0])!.kind === "string" ? [PARSE_RUNTIME] : [],
};

/** Identifier callees, spread into `builtinFunctionEmitters`; mirrors `parseBuiltins`. */
export const parseEmitters: Record<string, BuiltinCall> = {
  parseInt: parseIntCall,
  parseFloat: parseFloatCall,
  Number: numberOf,
};
