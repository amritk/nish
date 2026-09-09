/**
 * Expression checkers, one per `ts.SyntaxKind`, plus a second table for
 * binary operators keyed by the operator token kind.
 *
 * To add an expression kind: write an `ExpressionChecker` and register it in
 * `expressionCheckers`. To add an operator: register a `BinaryChecker` in
 * `binaryCheckers`.
 */
import ts from "typescript";
import { BOOL, F64, I32, assignable, isInteger, isNumeric, sameType, typeToString } from "../types.js";
import { arrayExpressionCheckers, installArrayAssignmentCheckers } from "./arrays.js";
import { bitwiseBinaryCheckers, bitwiseUnaryCheckers } from "./bitwise.js";
import { BuiltinCallChecker } from "./builtins.js";
import { ioBuiltinFunctions } from "./io.js";
import { contextualLiteralType, conversionBuiltins, parseBuiltins } from "./math.js";
import { checkSuperCall, classExpressionCheckers, isAssignmentOperator } from "./classes.js";
import {
  assignmentTargetCheckers,
  checkMethodCall,
  isValueReceiver,
  memberExpressionCheckers,
} from "./members.js";
import { nullableExpressionCheckers } from "./nullable.js";
import { resultBuiltinFunctions } from "./result.js";
import { checkBuiltinCall, stringBinaryCheckers, stringExpressionCheckers } from "./strings.js";
import { BinaryChecker, CheckerTable, ExpressionChecker, UnaryChecker } from "./context.js";
import {
  controlFlowBinaryCheckers,
  controlFlowExpressionCheckers,
  controlFlowUnaryCheckers,
} from "./control-flow.js";
import { lookup } from "../lookup.js";

// ---- Leaves -----------------------------------------------------------------

const checkParenthesized: ExpressionChecker = (ctx, expr, scope) =>
  ctx.checkExpression((expr as ts.ParenthesizedExpression).expression, scope);

const checkNumericLiteral: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.NumericLiteral;
  const contextual = contextualLiteralType(ctx, expr, scope); // WP7: `let x: i64 = 5`, `x + 5`, ...
  if (contextual) return contextual;
  if (ctx.opts.numberMode === "f64") return F64;
  const n = Number(expr.text);
  if (!Number.isInteger(n)) {
    throw ctx.error(`Non-integer literal \`${expr.text}\` in i32 number mode (use --number-mode f64)`, expr);
  }
  // `-2147483648` parses as minus applied to 2147483648; allow exactly that form.
  const negated =
    ts.isPrefixUnaryExpression(expr.parent) && expr.parent.operator === ts.SyntaxKind.MinusToken;
  if (n > 0x7fffffff + (negated ? 1 : 0))
    throw ctx.error(`Literal \`${expr.text}\` does not fit in i32`, expr);
  return I32;
};

const checkBooleanLiteral: ExpressionChecker = () => BOOL;

const checkIdentifier: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.Identifier;
  const v = scope.lookup(expr.text);
  if (v) {
    ctx.program.bindings.set(expr, v);
    return scope.typeOf(v); // the declared type, or the narrowed one inside `if (p !== null)` (WP6)
  }
  // A local shadows a module constant, as it would in TypeScript, so the
  // constant table is consulted only after the scope chain (WP14).
  const constant = ctx.program.constants.get(expr.text);
  if (constant) {
    ctx.program.constRefs.set(expr, constant);
    return constant.type;
  }
  throw ctx.error(`Unknown identifier \`${expr.text}\``, expr);
};

// ---- Operators ------------------------------------------------------------------

const checkNegate: UnaryChecker = (ctx, expr, scope) => {
  const operand = ctx.checkExpression(expr.operand, scope);
  if (!isNumeric(operand))
    throw ctx.error(`Unsupported unary operator \`-\` on ${typeToString(operand)}`, expr);
  return operand;
};

const checkNot: UnaryChecker = (ctx, expr, scope) => {
  const operand = ctx.checkExpression(expr.operand, scope);
  if (operand.kind !== "bool")
    throw ctx.error(`Unsupported unary operator \`!\` on ${typeToString(operand)}`, expr);
  return BOOL;
};

/** Prefix operators keyed by operator token, like `binaryCheckers` for binary ones. */
export const unaryCheckers: CheckerTable<UnaryChecker> = {
  [ts.SyntaxKind.MinusToken]: checkNegate,
  [ts.SyntaxKind.ExclamationToken]: checkNot,
  ...bitwiseUnaryCheckers, // `~`
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
  if (!target) {
    if (ctx.program.constants.has(expr.left.text)) {
      throw ctx.error(`Cannot assign to \`${expr.left.text}\` because it is a module constant`, expr.left);
    }
    throw ctx.error(`Unknown identifier \`${expr.left.text}\``, expr.left);
  }
  if (!target.mutable) {
    throw ctx.error(
      `Cannot assign to \`${target.name}\` because it is a ${target.storage === "param" ? "parameter" : "const"}`,
      expr.left
    );
  }
  ctx.program.bindings.set(expr.left, target);
  const rhs = ctx.checkExpression(expr.right, scope); // sees the old value: `cur = cur.next` reads a narrowed `cur`
  scope.clearNarrowing(target); // `p = ...` ends any `p !== null` narrowing (WP6)
  if (!assignable(rhs, target.type)) {
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
  // Equality is defined for numbers and booleans here; `===`/`!==` on other
  // kinds are handled by their own overrides (strings by content, structs by identity).
  // Ordering (`<`, `<=`, `>`, `>=`) is numeric only: an `i1` compare would have to
  // pick signed or unsigned, and JS's `true > false` has no use worth that trap.
  const op = expr.operatorToken.kind;
  const equality =
    op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken;
  if (!sameType(lhs, rhs) || !(isNumeric(lhs) || (equality && lhs.kind === "bool"))) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(op)}\` requires two ${equality ? "operands of the same primitive type" : "numeric operands"}, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
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
  ...bitwiseBinaryCheckers, // `& | ^ << >> >>>` and their compound forms
  ...controlFlowBinaryCheckers,
};
installArrayAssignmentCheckers(binaryCheckers); // `a[i] = v`, `a[i] op= v`; other targets keep the handlers above

const checkBinary: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.BinaryExpression;
  const op = expr.operatorToken.kind;
  // `p.x = v` and friends dispatch on the target's kind (WP2 fields, later WP4 elements).
  const handler =
    (isAssignmentOperator(op) && assignmentTargetCheckers[expr.left.kind]) || binaryCheckers[op];
  if (!handler) {
    throw ctx.error(`Unsupported binary operator \`${ts.tokenToString(expr.operatorToken.kind)}\``, expr);
  }
  return handler(ctx, expr, scope);
};

// ---- Calls ---------------------------------------------------------------------

/** Builtins called by plain identifier; a user function of the same name shadows them. */
export const builtinFunctions: Record<string, BuiltinCallChecker> = {
  ...conversionBuiltins, // WP7: toI32, toI64, toF64
  ...parseBuiltins, // WP7: parseInt, parseFloat, Number
  ...ioBuiltinFunctions, // WP7: readFileSync, writeFileSync, appendFileSync
  ...resultBuiltinFunctions, // WP16: ok, err
};

const checkCall: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.CallExpression;
  if (expr.expression.kind === ts.SyntaxKind.SuperKeyword) return checkSuperCall(ctx, expr, scope); // WP2b
  if (ts.isPropertyAccessExpression(expr.expression)) {
    // `value.method(...)` dispatches on the receiver type; `console.log(...)` is a dotted builtin.
    return isValueReceiver(ctx, expr.expression.expression, scope)
      ? checkMethodCall(ctx, expr, scope)
      : checkBuiltinCall(ctx, expr, scope);
  }
  if (!ts.isIdentifier(expr.expression)) {
    throw ctx.error("Only direct calls to named functions are supported", expr);
  }
  const callee = ctx.sigs.get(expr.expression.text);
  if (!callee) {
    const builtin = lookup(builtinFunctions, expr.expression.text);
    if (builtin) return builtin(ctx, expr, scope); // no `callees` entry: the emitter knows it by name
    throw ctx.error(`Unknown function \`${expr.expression.text}\``, expr.expression);
  }
  if (expr.arguments.length !== callee.params.length) {
    throw ctx.error(
      `\`${callee.name}\` expects ${callee.params.length} argument(s), got ${expr.arguments.length}`,
      expr
    );
  }
  expr.arguments.forEach((arg, i) => {
    const t = ctx.checkExpression(arg, scope);
    if (!assignable(t, callee.params[i].type)) {
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
  ...classExpressionCheckers, // `this`, object literals (WP2)
  ...nullableExpressionCheckers, // `null` (WP6)
};
