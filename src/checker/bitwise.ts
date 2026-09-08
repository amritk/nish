/**
 * Bitwise operators: `& | ^ << >> >>>`, unary `~`, and the compound forms
 * `&= |= ^= <<= >>= >>>=` on a mutable local.
 *
 * Both operands are integers of the same width (two `i32` or two `i64`), and
 * `~` takes one. There are two deliberate rejections:
 *
 *   - `f64` has no bit operations. JavaScript's would convert the double
 *     through `ToInt32` first, and the language never converts implicitly; under
 *     `--number-mode f64` that makes plain `number` ineligible, so the
 *     message says which flag put it there.
 *   - `boolean` is rejected even though JavaScript accepts it, because
 *     `true & true` there is the *number* 1 and the language has no truthiness to
 *     turn that back into a boolean. The message names the operator that does
 *     the job instead (`&&`, `||`, `!==`, `!`).
 *
 * The lowering, including the shift-count mask that keeps `x << 33` defined,
 * is in `codegen/emit/bitwise.ts`.
 */
import ts from "typescript";
import { StaticType, isInteger, sameType, typeToString } from "../types";
import { BinaryChecker, CheckContext, CheckerTable, UnaryChecker } from "./context";
import { resolveMutableTarget } from "./control-flow";

/** Every operator this module owns, mapped to the operator it becomes on booleans (if any). */
const BOOLEAN_ALTERNATIVE: Partial<Record<ts.SyntaxKind, string>> = {
  [ts.SyntaxKind.AmpersandToken]: "&&",
  [ts.SyntaxKind.AmpersandEqualsToken]: "&&",
  [ts.SyntaxKind.BarToken]: "||",
  [ts.SyntaxKind.BarEqualsToken]: "||",
  [ts.SyntaxKind.CaretToken]: "!==",
  [ts.SyntaxKind.CaretEqualsToken]: "!==",
  [ts.SyntaxKind.TildeToken]: "!",
};

/**
 * `f64` reaching a bit operator is usually plain `number` under
 * `--number-mode f64` rather than a deliberate `f64` annotation, so say so:
 * the fix is `toI32(x)`, not a different operator.
 */
const f64Hint = (ctx: CheckContext, ...operands: StaticType[]): string => {
  const fromNumberMode = ctx.opts.numberMode === "f64" && operands.some((t) => t.kind === "f64");
  return fromNumberMode ? " (`number` is f64 under --number-mode f64; convert with toI32/toI64)" : "";
};

/** The refusal for a boolean operand, naming the operator that is defined on booleans. */
const booleanMessage = (op: ts.SyntaxKind): string => {
  const alternative = BOOLEAN_ALTERNATIVE[op];
  const suggestion = alternative ? ` (use \`${alternative}\`)` : "";
  return `Operator \`${ts.tokenToString(op)}\` is not available on boolean${suggestion}`;
};

const checkBitwise: BinaryChecker = (ctx, expr, scope) => {
  const op = expr.operatorToken.kind;
  const lhs = ctx.checkExpression(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (lhs.kind === "bool" || rhs.kind === "bool") throw ctx.error(booleanMessage(op), expr);
  if (!isInteger(lhs) || !sameType(lhs, rhs)) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(op)}\` requires two operands of the same integer type, got ${typeToString(lhs)} and ${typeToString(rhs)}${f64Hint(ctx, lhs, rhs)}`,
      expr
    );
  }
  return lhs;
};

/** `x &= e` and friends: the `+=` rule with the integer operand types of `&`. */
const checkBitwiseAssignment: BinaryChecker = (ctx, expr, scope) => {
  const op = expr.operatorToken.kind;
  const target = resolveMutableTarget(ctx, expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (target.type.kind === "bool" || rhs.kind === "bool") throw ctx.error(booleanMessage(op), expr);
  if (!isInteger(target.type) || !sameType(rhs, target.type)) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(op)}\` requires two operands of the same integer type, got ${typeToString(target.type)} and ${typeToString(rhs)}${f64Hint(ctx, target.type, rhs)}`,
      expr
    );
  }
  return target.type;
};

const checkBitwiseNot: UnaryChecker = (ctx, expr, scope) => {
  const operand = ctx.checkExpression(expr.operand, scope);
  if (operand.kind === "bool") throw ctx.error(booleanMessage(ts.SyntaxKind.TildeToken), expr);
  if (!isInteger(operand)) {
    throw ctx.error(
      `Operator \`~\` requires an integer operand, got ${typeToString(operand)}${f64Hint(ctx, operand)}`,
      expr
    );
  }
  return operand;
};

export const bitwiseBinaryCheckers: CheckerTable<BinaryChecker> = {
  [ts.SyntaxKind.AmpersandToken]: checkBitwise,
  [ts.SyntaxKind.BarToken]: checkBitwise,
  [ts.SyntaxKind.CaretToken]: checkBitwise,
  [ts.SyntaxKind.LessThanLessThanToken]: checkBitwise,
  [ts.SyntaxKind.GreaterThanGreaterThanToken]: checkBitwise,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: checkBitwise,
  [ts.SyntaxKind.AmpersandEqualsToken]: checkBitwiseAssignment,
  [ts.SyntaxKind.BarEqualsToken]: checkBitwiseAssignment,
  [ts.SyntaxKind.CaretEqualsToken]: checkBitwiseAssignment,
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: checkBitwiseAssignment,
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: checkBitwiseAssignment,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: checkBitwiseAssignment,
};

export const bitwiseUnaryCheckers: CheckerTable<UnaryChecker> = {
  [ts.SyntaxKind.TildeToken]: checkBitwiseNot,
};
