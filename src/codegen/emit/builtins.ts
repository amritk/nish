/**
 * Shared shapes for builtin lowerings. Mirrors `checker/builtins.ts`: dotted
 * callees live in `builtinCallEmitters` (strings.ts), identifier callees in
 * `builtinFunctionEmitters` (expressions.ts). No sibling imports, so every
 * construct module can depend on this one.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker";
import { StaticType } from "../../types";
import { EmitContext } from "./context";

export interface BuiltinCall {
  emit: (ctx: EmitContext, expr: ts.CallExpression) => string;
  /**
   * Runtime symbols and intrinsics the lowering may call, for the purity
   * analysis in attributes.ts. Must match `emit` exactly: an omission here
   * is a wrong attribute on the caller.
   */
  callees: (program: CheckedProgram, expr: ts.CallExpression) => string[];
}

/** A builtin constant read as `Identifier.name` (`Math.PI`). */
export interface BuiltinProperty {
  /** LLVM constant text (`0x400921FB54442D18`). */
  value: string;
}

/**
 * IEEE-754 bit pattern of `n` as LLVM writes it. LLVM only accepts decimal
 * float literals that round-trip exactly, so the hex form is always valid.
 */
export function f64Constant(n: number): string {
  const buf = Buffer.alloc(8);
  buf.writeDoubleBE(n);
  return "0x" + buf.toString("hex").toUpperCase();
}

/**
 * The same for an `f32` (WP15). LLVM writes a `float` constant with the
 * *64-bit* hex of the double it equals — a 32-bit pattern would be read as a
 * different type — and requires that double to be exactly representable as a
 * float, which is what `Math.fround` guarantees. So `0.1` as an `f32` is
 * `float 0x3FB99999A0000000`, the double nearest to `(float) 0.1`, not
 * `0x3FB999999999999A`.
 */
export function f32Constant(n: number): string {
  return f64Constant(Math.fround(n));
}

/** The LLVM constant for a float literal at either width. */
export function floatConstant(n: number, t: StaticType): string {
  return t.kind === "f32" ? f32Constant(n) : f64Constant(n);
}
