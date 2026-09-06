/**
 * String constructs (WP3): literals, template literals, `+` concatenation,
 * `===` / `!==` by content, `.length`, and builtin calls such as
 * `console.log` whose callee is a dotted name rather than a user function.
 *
 * Everything here is registered into the core tables with a spread. The
 * binary handlers replace the numeric-only `+`, `===`, `!==` entries with
 * string-aware versions that keep the numeric behaviour and messages intact,
 * so no existing negative test changes.
 *
 * Decisions:
 *   - `"a" + 1` is rejected. StaticTS has no implicit string conversion; a
 *     template literal is the explicit spelling.
 *   - `<`, `<=`, `>`, `>=` on strings stay rejected (no collation semantics).
 *   - `s.length` is the UTF-8 *byte* length (see docs/wp3-strings.md).
 *   - `console.log` takes exactly one string | number | boolean, returns
 *     `void`, and may only appear as a statement.
 */
import ts from "typescript";
import { BOOL, F64, I32, STRING, StaticType, VOID, isNumeric, sameType, typeToString } from "../types";
import { BuiltinCallChecker, dottedName } from "./builtins";
import { BinaryChecker, CheckContext, CheckerTable, ExpressionChecker } from "./context";
import { ioBuiltinCalls } from "./io";
import { mathBuiltinCalls, mathBuiltinProperties } from "./math";
import { Scope } from "./scope";

export { dottedName } from "./builtins";
export type { BuiltinCallChecker } from "./builtins";

/** Types that can be turned into text: template holes and `console.log` arguments. */
export function isStringifiable(t: StaticType): boolean {
  return t.kind === "string" || t.kind === "bool" || isNumeric(t);
}

// ---- Literals ---------------------------------------------------------------------

const checkStringLiteral: ExpressionChecker = () => STRING;

const checkTemplateExpression: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.TemplateExpression;
  for (const span of expr.templateSpans) {
    const t = ctx.checkExpression(span.expression, scope);
    if (!isStringifiable(t)) {
      throw ctx.error(`Template literal hole must be string, number, or boolean, got ${typeToString(t)}`, span.expression);
    }
  }
  return STRING;
};

// ---- Properties -------------------------------------------------------------------

/** `s.length`, plus the builtin constants `Math.PI` / `Math.E` (WP7). */
const checkPropertyAccess: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.PropertyAccessExpression;
  const constant = mathBuiltinProperties[dottedName(expr) ?? ""];
  if (constant) return constant;
  const target = ctx.checkExpression(expr.expression, scope);
  const name = expr.name.text;
  if (target.kind === "string" && name === "length") return ctx.opts.numberMode === "f64" ? F64 : I32;
  throw ctx.error(`Unknown property \`${name}\` on ${typeToString(target)}`, expr.name);
};

// ---- Operators --------------------------------------------------------------------

/** `+`: two numbers of the same type, or two strings (concatenation). */
const checkPlus: BinaryChecker = (ctx, expr, scope) => {
  const lhs = ctx.checkExpression(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (lhs.kind === "string" && rhs.kind === "string") return STRING;
  if (isNumeric(lhs) && sameType(lhs, rhs)) return lhs;
  throw ctx.error(
    `Operator \`+\` requires two operands of the same numeric type or two strings, got ${typeToString(lhs)} and ${typeToString(rhs)}` +
      (lhs.kind === "string" || rhs.kind === "string" ? " (no implicit string conversion; use a template literal)" : ""),
    expr
  );
};

/** `===` / `!==`: any primitive against the same primitive; strings compare by content. */
const checkStrictEquality: BinaryChecker = (ctx, expr, scope) => {
  const lhs = ctx.checkExpression(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (!sameType(lhs, rhs) || lhs.kind === "void") {
    throw ctx.error(
      `Operator \`${ts.tokenToString(expr.operatorToken.kind)}\` requires two operands of the same primitive type, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return BOOL;
};

// ---- Builtin calls (`console.log`, `Math.*`, `process.exit`) ------------------------------

const checkConsoleLog: BuiltinCallChecker = (ctx, expr, scope) => {
  if (expr.arguments.length !== 1) {
    throw ctx.error(`\`console.log\` expects exactly 1 argument, got ${expr.arguments.length}`, expr);
  }
  const t = ctx.checkExpression(expr.arguments[0], scope);
  if (!isStringifiable(t)) {
    throw ctx.error(`\`console.log\` accepts string, number, or boolean, got ${typeToString(t)}`, expr.arguments[0]);
  }
  if (!ts.isExpressionStatement(expr.parent)) {
    throw ctx.error("`console.log` returns void and can only be used as a statement", expr);
  }
  return VOID;
};

/** Builtins keyed by dotted callee name. Add an entry to support another. */
export const builtinCalls: Record<string, BuiltinCallChecker> = {
  "console.log": checkConsoleLog,
  ...mathBuiltinCalls, // WP7: Math.sqrt, ..., Math.random
  ...ioBuiltinCalls, // WP7: process.exit
};

/** Entry point for `checkCall` when the callee is a property access. */
export function checkBuiltinCall(ctx: CheckContext, expr: ts.CallExpression, scope: Scope): StaticType {
  const name = dottedName(expr.expression);
  const builtin = name === undefined ? undefined : builtinCalls[name];
  if (!builtin) {
    throw ctx.error(
      `Unknown builtin \`${name ?? expr.expression.getText(ctx.sf)}\` (supported: ${Object.keys(builtinCalls).join(", ")})`,
      expr.expression
    );
  }
  return builtin(ctx, expr, scope);
}

// ---- Registration -----------------------------------------------------------------

export const stringExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.StringLiteral]: checkStringLiteral,
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: checkStringLiteral,
  [ts.SyntaxKind.TemplateExpression]: checkTemplateExpression,
  [ts.SyntaxKind.PropertyAccessExpression]: checkPropertyAccess,
};

/** Overrides the numeric-only `+`, `===`, `!==` entries (spread after them). */
export const stringBinaryCheckers: CheckerTable<BinaryChecker> = {
  [ts.SyntaxKind.PlusToken]: checkPlus,
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: checkStrictEquality,
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: checkStrictEquality,
};
