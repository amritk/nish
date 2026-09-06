/**
 * Bitwise lowering: `& | ^` to `and` / `or` / `xor`, `~x` to `xor x, -1`,
 * `<<` to `shl`, `>>` to `ashr` (sign-filling) and `>>>` to `lshr`
 * (zero-filling), plus the compound forms on a mutable local.
 *
 * Shift counts are masked to the operand width, because LLVM and JavaScript
 * disagree about what an over-wide shift means: LLVM makes `shl i32 %x, 33`
 * poison, while JavaScript computes `x << 1`. StaticTS follows JavaScript, so
 * `a << b` on `i32` is `shl i32 %a, (%b and 31)` and on `i64` `shl i64 %a,
 * (%b and 63)`. A constant count is masked here at compile time and emitted
 * as the masked literal, so the common `x << 3` stays one instruction and no
 * `and` appears in the IR at all.
 *
 * These are the only integer operators with no panic path: unlike `/` and
 * `%` nothing here can fail, so a function whose arithmetic is all bitwise
 * keeps `readnone` and `willreturn` (`tests/cases/bit_attributes`).
 */
import ts from "typescript";
import { llvmType } from "../../types";
import { BinaryEmitter, EmitContext, EmitterTable, UnaryEmitter } from "./context";
import { loadLocal, storeLocal } from "./control-flow";

/** LLVM opcode per operator token; the compound form of an operator shares its row. */
const BITWISE_OPCODES: Partial<Record<ts.SyntaxKind, string>> = {
  [ts.SyntaxKind.AmpersandToken]: "and",
  [ts.SyntaxKind.BarToken]: "or",
  [ts.SyntaxKind.CaretToken]: "xor",
  [ts.SyntaxKind.LessThanLessThanToken]: "shl",
  [ts.SyntaxKind.GreaterThanGreaterThanToken]: "ashr",
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: "lshr",
  [ts.SyntaxKind.AmpersandEqualsToken]: "and",
  [ts.SyntaxKind.BarEqualsToken]: "or",
  [ts.SyntaxKind.CaretEqualsToken]: "xor",
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: "shl",
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: "ashr",
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: "lshr",
};

/** The compound operators, which load the target before applying the opcode. */
const COMPOUND_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
]);

/** The three opcodes whose right operand is a count and therefore needs the mask. */
const SHIFTS = new Set(["shl", "ashr", "lshr"]);

/**
 * The value of a shift count the compiler can already see: an integer
 * literal, possibly parenthesised or negated. `null` for anything else, which
 * is what makes the emitter fall back to an `and` instruction.
 */
const constantCount = (expr: ts.Expression): bigint | null => {
  let inner = expr;
  let negative = false;
  for (;;) {
    if (ts.isParenthesizedExpression(inner)) {
      inner = inner.expression;
    } else if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken) {
      negative = !negative;
      inner = inner.operand;
    } else {
      break;
    }
  }
  if (!ts.isNumericLiteral(inner)) return null;
  const n = Number(inner.text);
  if (!Number.isSafeInteger(n)) return null;
  return negative ? -BigInt(n) : BigInt(n);
};

/**
 * The masked count as an LLVM value. A literal is masked here (`x << 33`
 * becomes `shl i32 %x, 1`, and `x << -1` becomes `shl i32 %x, 31`, both as in
 * JavaScript); anything else costs one `and`. The count is a value of the
 * shifted type, because LLVM requires both operands of a shift to agree.
 */
const emitShiftCount = (ctx: EmitContext, ty: string, count: ts.Expression): string => {
  const mask = ty === "i64" ? 63n : 31n;
  const literal = constantCount(count);
  if (literal !== null) return String(BigInt.asUintN(64, literal) & mask);
  return ctx.fn.emitValue(`and ${ty} ${ctx.emitExpression(count)}, ${mask}`);
};

/** The right operand: a masked count for a shift, the plain value for `& | ^`. */
const emitRightOperand = (ctx: EmitContext, opcode: string, ty: string, right: ts.Expression): string =>
  SHIFTS.has(opcode) ? emitShiftCount(ctx, ty, right) : ctx.emitExpression(right);

/** `a & b` and friends: evaluate left then right (JS order), then one instruction. */
const emitBitwise: BinaryEmitter = (ctx, expr) => {
  const ty = llvmType(ctx.typeOf(expr.left));
  const opcode = BITWISE_OPCODES[expr.operatorToken.kind]!;
  const lhs = ctx.emitExpression(expr.left);
  const rhs = emitRightOperand(ctx, opcode, ty, expr.right);
  return ctx.fn.emitValue(`${opcode} ${ty} ${lhs}, ${rhs}`);
};

/** `x &= e`: JS reads `x` before evaluating `e`; the expression's value is what was stored. */
const emitBitwiseAssignment: BinaryEmitter = (ctx, expr) => {
  const target = ctx.program.bindings.get(expr.left as ts.Identifier)!;
  const ty = llvmType(target.type);
  const opcode = BITWISE_OPCODES[expr.operatorToken.kind]!;
  const old = loadLocal(ctx, target);
  const rhs = emitRightOperand(ctx, opcode, ty, expr.right);
  const value = ctx.fn.emitValue(`${opcode} ${ty} ${old}, ${rhs}`);
  storeLocal(ctx, target, value);
  return value;
};

/** `~x` is `x xor -1`; the all-ones constant is spelled `-1` at both widths. */
const emitBitwiseNot: UnaryEmitter = (ctx, expr) => {
  const ty = llvmType(ctx.typeOf(expr.operand));
  return ctx.fn.emitValue(`xor ${ty} ${ctx.emitExpression(expr.operand)}, -1`);
};

export const bitwiseBinaryEmitters: EmitterTable<BinaryEmitter> = Object.fromEntries(
  Object.keys(BITWISE_OPCODES).map((token) => [
    token,
    COMPOUND_OPERATORS.has(Number(token)) ? emitBitwiseAssignment : emitBitwise,
  ])
);

export const bitwiseUnaryEmitters: EmitterTable<UnaryEmitter> = {
  [ts.SyntaxKind.TildeToken]: emitBitwiseNot,
};
