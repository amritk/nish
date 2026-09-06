/**
 * Expression checkers, one per `ts.SyntaxKind`, plus a second table for
 * binary operators keyed by the operator token kind.
 *
 * To add an expression kind: write an `ExpressionChecker` and register it in
 * `expressionCheckers`. To add an operator: register a `BinaryChecker` in
 * `binaryCheckers`.
 */
import ts from "typescript";
import { BOOL, F64, I32, isNumeric, sameType, typeToString } from "../types";
import { arrayExpressionCheckers, installArrayAssignmentCheckers } from "./arrays";
import { checkMethodCall, isValueReceiver, memberExpressionCheckers } from "./members";
import { checkBuiltinCall, stringBinaryCheckers, stringExpressionCheckers } from "./strings";
import { BinaryChecker, CheckerTable, ExpressionChecker, UnaryChecker } from "./context";
import {
  controlFlowBinaryCheckers,
  controlFlowExpressionCheckers,
  controlFlowUnaryCheckers,
} from "./control-flow";

// ---- Leaves -----------------------------------------------------------------

const checkParenthesized: ExpressionChecker = (ctx, expr, scope) =>
  ctx.checkExpression((expr as ts.ParenthesizedExpression).expression, scope);

const checkNumericLiteral: ExpressionChecker = (ctx, node) => {
  const expr = node as ts.NumericLiteral;
  if (ctx.opts.numberMode === "f64") return F64;
  const n = Number(expr.text);
  if (!Number.isInteger(n)) {
    throw ctx.error(`Non-integer literal \`${expr.text}\` in i32 number mode (use --number-mode f64)`, expr);
  }
  if (n > 0x7fffffff) throw ctx.error(`Literal \`${expr.text}\` does not fit in i32`, expr);
  return I32;
};

const checkBooleanLiteral: ExpressionChecker = () => BOOL;

const checkIdentifier: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.Identifier;
  const v = scope.lookup(expr.text);
  if (!v) throw ctx.error(`Unknown identifier \`${expr.text}\``, expr);
  ctx.program.bindings.set(expr, v);
  return v.type;
};

// ---- Operators ------------------------------------------------------------------

const checkNegate: UnaryChecker = (ctx, expr, scope) => {
  const operand = ctx.checkExpression(expr.operand, scope);
  if (!isNumeric(operand)) throw ctx.error(`Unsupported unary operator \`-\` on ${typeToString(operand)}`, expr);
  return operand;
};

const checkNot: UnaryChecker = (ctx, expr, scope) => {
  const operand = ctx.checkExpression(expr.operand, scope);
  if (operand.kind !== "bool") throw ctx.error(`Unsupported unary operator \`!\` on ${typeToString(operand)}`, expr);
  return BOOL;
};

/** Prefix operators keyed by operator token, like `binaryCheckers` for binary ones. */
export const unaryCheckers: CheckerTable<UnaryChecker> = {
  [ts.SyntaxKind.MinusToken]: checkNegate,
  [ts.SyntaxKind.ExclamationToken]: checkNot,
  ...controlFlowUnaryCheckers,
};

const checkPrefixUnary: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.PrefixUnaryExpression;
  const handler = unaryCheckers[expr.operator];
  if (!handler) throw ctx.error(`Unsupported unary operator \`${ts.tokenToString(expr.operator)}\``, expr);
  return handler(ctx, expr, scope);
};

const checkAssignment: BinaryChecker = (ctx, expr, scope) => {
  if (!ts.isIdentifier(expr.left)) throw ctx.error("Only simple variables can be assigned", expr.left);
  const target = scope.lookup(expr.left.text);
  if (!target) throw ctx.error(`Unknown identifier \`${expr.left.text}\``, expr.left);
  if (!target.mutable) {
    throw ctx.error(
      `Cannot assign to \`${target.name}\` because it is a ${target.storage === "param" ? "parameter" : "const"}`,
      expr.left
    );
  }
  ctx.program.bindings.set(expr.left, target);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (!sameType(rhs, target.type)) {
    throw ctx.error(
      `Cannot assign ${typeToString(rhs)} to ${typeToString(target.type)} variable \`${target.name}\``,
      expr.right
    );
  }
  return target.type;
};

const checkArithmetic: BinaryChecker = (ctx, expr, scope) => {
  const lhs = ctx.checkExpression(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (!isNumeric(lhs) || !sameType(lhs, rhs)) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(expr.operatorToken.kind)}\` requires two operands of the same numeric type, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return lhs;
};

const checkComparison: BinaryChecker = (ctx, expr, scope) => {
  const lhs = ctx.checkExpression(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (!sameType(lhs, rhs) || lhs.kind === "void" || lhs.kind === "string") {
    throw ctx.error(
      `Operator \`${ts.tokenToString(expr.operatorToken.kind)}\` requires two operands of the same primitive type, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return BOOL;
};

const rejectLooseEquality: BinaryChecker = (ctx, expr) => {
  throw ctx.error("Loose equality is forbidden; use === / !==", expr);
};

export const binaryCheckers: CheckerTable<BinaryChecker> = {
  [ts.SyntaxKind.EqualsToken]: checkAssignment,
  [ts.SyntaxKind.PlusToken]: checkArithmetic,
  [ts.SyntaxKind.MinusToken]: checkArithmetic,
  [ts.SyntaxKind.AsteriskToken]: checkArithmetic,
  [ts.SyntaxKind.SlashToken]: checkArithmetic,
  [ts.SyntaxKind.PercentToken]: checkArithmetic,
  [ts.SyntaxKind.LessThanToken]: checkComparison,
  [ts.SyntaxKind.LessThanEqualsToken]: checkComparison,
  [ts.SyntaxKind.GreaterThanToken]: checkComparison,
  [ts.SyntaxKind.GreaterThanEqualsToken]: checkComparison,
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: checkComparison,
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: checkComparison,
  [ts.SyntaxKind.EqualsEqualsToken]: rejectLooseEquality,
  [ts.SyntaxKind.ExclamationEqualsToken]: rejectLooseEquality,
  ...stringBinaryCheckers, // string-aware `+`, `===`, `!==` (numeric behaviour unchanged)
  ...controlFlowBinaryCheckers,
};
installArrayAssignmentCheckers(binaryCheckers); // `a[i] = v`, `a[i] op= v`; other targets keep the handlers above

const checkBinary: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.BinaryExpression;
  const handler = binaryCheckers[expr.operatorToken.kind];
  if (!handler) {
    throw ctx.error(`Unsupported binary operator \`${ts.tokenToString(expr.operatorToken.kind)}\``, expr);
  }
  return handler(ctx, expr, scope);
};

// ---- Calls ---------------------------------------------------------------------

const checkCall: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.CallExpression;
  if (ts.isPropertyAccessExpression(expr.expression)) {
    // `value.method(...)` dispatches on the receiver type; `console.log(...)` is a dotted builtin.
    return isValueReceiver(expr.expression.expression, scope)
      ? checkMethodCall(ctx, expr, scope)
      : checkBuiltinCall(ctx, expr, scope);
  }
  if (!ts.isIdentifier(expr.expression)) {
    throw ctx.error("Only direct calls to named functions are supported", expr);
  }
  const callee = ctx.sigs.get(expr.expression.text);
  if (!callee) throw ctx.error(`Unknown function \`${expr.expression.text}\``, expr.expression);
  if (expr.arguments.length !== callee.params.length) {
    throw ctx.error(`\`${callee.name}\` expects ${callee.params.length} argument(s), got ${expr.arguments.length}`, expr);
  }
  expr.arguments.forEach((arg, i) => {
    const t = ctx.checkExpression(arg, scope);
    if (!sameType(t, callee.params[i].type)) {
      throw ctx.error(
        `Argument ${i + 1} of \`${callee.name}\`: expected ${typeToString(callee.params[i].type)}, got ${typeToString(t)}`,
        arg
      );
    }
  });
  ctx.program.callees.set(expr, callee);
  return callee.returnType;
};

export const expressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.ParenthesizedExpression]: checkParenthesized,
  [ts.SyntaxKind.NumericLiteral]: checkNumericLiteral,
  [ts.SyntaxKind.TrueKeyword]: checkBooleanLiteral,
  [ts.SyntaxKind.FalseKeyword]: checkBooleanLiteral,
  [ts.SyntaxKind.Identifier]: checkIdentifier,
  [ts.SyntaxKind.PrefixUnaryExpression]: checkPrefixUnary,
  [ts.SyntaxKind.BinaryExpression]: checkBinary,
  [ts.SyntaxKind.CallExpression]: checkCall,
  ...stringExpressionCheckers,
  ...memberExpressionCheckers, // property access, method calls, `new` (dispatch by receiver type)
  ...controlFlowExpressionCheckers,
  ...arrayExpressionCheckers, // `[a, b]`, `a[i]`
};
