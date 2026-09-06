/**
 * Math builtins and numeric conversions (WP7), checked by `checker/math.ts`.
 *
 * Every lowering is either a single LLVM intrinsic call or a short
 * straight-line sequence; nothing here touches memory, so callers stay
 * `readnone` (the intrinsics carry `effect: "none"` in runtime.ts).
 *
 *   Math.sqrt/floor/ceil/trunc/sin/cos/exp/log(x)   call double @llvm.<f>.f64(double x)
 *   Math.pow(x, y)                                  call double @llvm.pow.f64(double x, double y)
 *   Math.abs(x)      f64: @llvm.fabs.f64          i32/i64: @llvm.abs.<T>(T x, i1 false)
 *                    (`i1 false`: INT_MIN wraps to itself instead of poison)
 *   Math.min/max     f64: @llvm.minnum/maxnum.f64   i32/i64: @llvm.smin/smax.<T>
 *   Math.round(x)    f = floor(x); f + 1 when x - f >= 0.5 else f  (see below)
 *   Math.random()    call double @sts_random()   (write effect: RNG state)
 *   Math.PI, Math.E  f64 constants
 *   toI32/toI64/toF64(x)   sext / trunc / sitofp / @llvm.fptosi.sat.<T>.f64
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
 * JavaScript's modulo-2^32 `ToInt32`.
 */
import { CheckedProgram } from "../../checker";
import { StaticType, isInteger, llvmType } from "../../types";
import { BuiltinCall, BuiltinProperty, f64Constant } from "./builtins";
import { EmitContext } from "./context";

// ---- Math.* -----------------------------------------------------------------------

function callIntrinsic(ctx: EmitContext, name: string, ret: string, args: string): string {
  return ctx.fn.emitValue(`call ${ret} ${ctx.useRuntime(name)}(${args})`);
}

/** `Math.<f>(x: f64): f64` as one intrinsic call. */
function f64Unary(intrinsic: string): BuiltinCall {
  return {
    emit: (ctx, expr) => callIntrinsic(ctx, intrinsic, "double", `double ${ctx.emitExpression(expr.arguments[0])}`),
    callees: () => [intrinsic],
  };
}

const mathPow: BuiltinCall = {
  emit: (ctx, expr) => {
    const x = ctx.emitExpression(expr.arguments[0]);
    const y = ctx.emitExpression(expr.arguments[1]);
    return callIntrinsic(ctx, "llvm.pow.f64", "double", `double ${x}, double ${y}`);
  },
  callees: () => ["llvm.pow.f64"],
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

function absIntrinsic(t: StaticType): string {
  return isInteger(t) ? `llvm.abs.${t.kind}` : "llvm.fabs.f64";
}

const mathAbs: BuiltinCall = {
  emit: (ctx, expr) => {
    const t = ctx.typeOf(expr.arguments[0]);
    const x = ctx.emitExpression(expr.arguments[0]);
    const ty = llvmType(t);
    return callIntrinsic(ctx, absIntrinsic(t), ty, isInteger(t) ? `${ty} ${x}, i1 false` : `${ty} ${x}`);
  },
  callees: (program, expr) => [absIntrinsic(program.types.get(expr.arguments[0])!)],
};

function minMaxIntrinsic(which: "min" | "max", t: StaticType): string {
  return isInteger(t) ? `llvm.s${which}.${t.kind}` : `llvm.${which}num.f64`;
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
  emit: (ctx) => ctx.fn.emitValue(`call double ${ctx.useRuntime("sts_random")}()`),
  callees: () => ["sts_random"],
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
  ...Object.fromEntries(Object.entries(F64_UNARY).map(([f, intrinsic]) => [`Math.${f}`, f64Unary(intrinsic)])),
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

/** The intrinsic a `from -> to` conversion calls, if any (only f64 -> integer needs one). */
function conversionIntrinsic(from: StaticType, to: StaticType): string | undefined {
  return from.kind === "f64" && isInteger(to) ? `llvm.fptosi.sat.${to.kind}.f64` : undefined;
}

/** Lower a numeric `value` of type `from` to type `to`. Same type: no instruction. */
export function emitConversion(ctx: EmitContext, value: string, from: StaticType, to: StaticType): string {
  if (from.kind === to.kind) return value;
  const intrinsic = conversionIntrinsic(from, to);
  if (intrinsic) return callIntrinsic(ctx, intrinsic, llvmType(to), `double ${value}`);
  if (to.kind === "f64") return ctx.fn.emitValue(`sitofp ${llvmType(from)} ${value} to double`);
  const op = from.kind === "i32" ? "sext" : "trunc";
  return ctx.fn.emitValue(`${op} ${llvmType(from)} ${value} to ${llvmType(to)}`);
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

/** Identifier callees, spread into `builtinFunctionEmitters`; mirrors `conversionBuiltins`. */
export const conversionEmitters: Record<string, BuiltinCall> = {
  toI32: conversion({ kind: "i32" }),
  toI64: conversion({ kind: "i64" }),
  toF64: conversion({ kind: "f64" }),
};
