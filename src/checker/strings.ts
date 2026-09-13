/**
 * String constructs (WP3): literals, template literals, `+` concatenation,
 * `===` / `!==` by content, `.length`, the byte methods of WP14 A2
 * (`charCodeAt`, `substring`, `slice`, `indexOf`, `startsWith`, `endsWith`) and
 * builtin calls such as `console.log` and `String.fromCharCode` whose callee
 * is a dotted name rather than a user function.
 *
 * Everything here is registered into the core tables with a spread. The
 * binary handlers replace the numeric-only `+`, `===`, `!==` entries with
 * string-aware versions that keep the numeric behaviour and messages intact,
 * so no existing negative test changes.
 *
 * Decisions:
 *   - `"a" + 1` is rejected. the language has no implicit string conversion; a
 *     template literal is the explicit spelling.
 *   - `<`, `<=`, `>`, `>=` on strings stay rejected (no collation semantics).
 *   - `s.length` is the UTF-8 *byte* length (see docs/wp3-strings.md), and
 *     every method here is byte-indexed for the same reason: a lexer walks
 *     bytes, and a code-point index would need a decode per access.
 *   - `charCodeAt` bounds-checks and panics like `a[i]` rather than
 *     returning JavaScript's `NaN`, which `number` cannot represent.
 *   - `substring` and `slice` are the two halves of WP15 §4: `substring` keeps
 *     JavaScript's clamp so a ported program behaves the way its author
 *     expects, and `slice` refuses a range the string does not contain so the
 *     hot path is a compare and a branch instead of six min/max.
 *   - `console.log` takes exactly one string | number | boolean, returns
 *     `void`, and may only appear as a statement. `console.error` is the
 *     same on stderr (WP14 B2), which is where a compiler's diagnostics go.
 */
import ts from "typescript";
import { BOOL, F64, I32, STRING, StaticType, VOID, isNumeric, sameType, typeToString } from "../types.js";
import { checkArgumentType, checkArity } from "./builtins.js";
import { methodCallCheckers } from "./members.js";
import { BuiltinCallChecker, dottedName } from "./builtins.js";
import { BinaryChecker, CheckContext, CheckerTable, ExpressionChecker } from "./context.js";
import { arenaBuiltinCalls } from "./arena.js";
import { namespaceProperties, propertyCheckers } from "./members.js";
import { checkNullableComparison } from "./nullable.js";
import { ioBuiltinCalls } from "./io.js";
import { mathBuiltinCalls, mathBuiltinProperties } from "./math.js";
import { Scope } from "./scope.js";
import { lookup } from "../lookup.js";

export { dottedName } from "./builtins.js";
export type { BuiltinCallChecker } from "./builtins.js";

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
      throw ctx.error(
        `Template literal hole must be string, number, or boolean, got ${typeToString(t)}`,
        span.expression
      );
    }
  }
  return STRING;
};

// ---- Properties -------------------------------------------------------------------

/** `s.length` is the only string property today; registered in the member dispatch. */
/** `Math.PI` / `Math.E` (WP7) are namespace properties, dispatched by dotted name. */
for (const [name, type] of Object.entries(mathBuiltinProperties)) namespaceProperties[name] = () => type;

propertyCheckers.string = (ctx, expr, target) => {
  const name = expr.name.text;
  if (name === "length") return ctx.opts.numberMode === "f64" ? F64 : I32;
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
      (lhs.kind === "string" || rhs.kind === "string"
        ? " (no implicit string conversion; use a template literal)"
        : ""),
    expr
  );
};

/**
 * `===` / `!==`: any primitive against the same primitive; strings compare by
 * content; a `T | null` value compares with the literal `null` by pointer (WP6).
 */
const checkStrictEquality: BinaryChecker = (ctx, expr, scope) => {
  const lhs = ctx.checkExpression(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (!sameType(lhs, rhs) || lhs.kind === "void") {
    const op = ts.tokenToString(expr.operatorToken.kind);
    if (lhs.kind === "nullable" || rhs.kind === "nullable") {
      throw ctx.error(
        `Cannot compare ${typeToString(lhs)} with ${typeToString(rhs)} using \`${op}\`; check the nullable side against \`null\` first, then compare the narrowed values`,
        expr
      );
    }
    throw ctx.error(
      `Operator \`${op}\` requires two operands of the same type, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
      expr
    );
  }
  checkNullableComparison(ctx, expr, lhs);
  return BOOL;
};

// ---- Methods ----------------------------------------------------------------------

/** `number` in the current mode: `i32`, or `f64` under `--number-mode f64`. */
const numberType = (ctx: CheckContext): StaticType => (ctx.opts.numberMode === "f64" ? F64 : I32);

/**
 * The byte methods (WP14 A2). Every index is a byte offset, matching
 * `.length`; `substring` clamps its arguments the way JavaScript does, `slice`
 * refuses what it cannot cut, and `charCodeAt` bounds-checks the way `a[i]`
 * does.
 */
const STRING_METHODS = ["charCodeAt", "substring", "slice", "indexOf", "startsWith", "endsWith"];

const checkIndexArgument = (ctx: CheckContext, arg: ts.Expression, scope: Scope, name: string): void => {
  const t = ctx.checkExpression(arg, scope);
  if (!isNumeric(t)) throw ctx.error(`\`${name}\` expects a number index, got ${typeToString(t)}`, arg);
};

methodCallCheckers.string = (ctx, expr, receiver, scope) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const name = access.name.text;
  switch (name) {
    case "charCodeAt":
      checkArity(ctx, expr, "charCodeAt", 1);
      checkIndexArgument(ctx, expr.arguments[0], scope, "charCodeAt");
      return numberType(ctx);
    case "substring":
      if (expr.arguments.length === 0 || expr.arguments.length > 2) {
        throw ctx.error(`\`substring\` expects 1 or 2 arguments, got ${expr.arguments.length}`, expr);
      }
      for (const arg of expr.arguments) checkIndexArgument(ctx, arg, scope, "substring");
      return STRING;
    case "slice":
      if (expr.arguments.length === 0 || expr.arguments.length > 2) {
        throw ctx.error(`\`slice\` expects 1 or 2 arguments, got ${expr.arguments.length}`, expr);
      }
      for (const arg of expr.arguments) checkIndexArgument(ctx, arg, scope, "slice");
      return STRING;
    case "indexOf":
      checkArity(ctx, expr, "indexOf", 1);
      checkArgumentType(ctx, expr.arguments[0], scope, "indexOf", STRING);
      return numberType(ctx);
    case "startsWith":
    case "endsWith":
      checkArity(ctx, expr, name, 1);
      checkArgumentType(ctx, expr.arguments[0], scope, name, STRING);
      return BOOL;
    default:
      throw ctx.error(
        `Unknown method \`${name}\` on ${typeToString(receiver)} (supported: ${STRING_METHODS.join(", ")})`,
        access.name
      );
  }
};

/**
 * `String.fromCharCode(code)`: the one-byte string of `code & 0xFF`, the
 * inverse of `charCodeAt`. It is a byte, not a UTF-16 code unit, for the same
 * reason the rest of the family is byte-indexed; the high bits are dropped
 * the way integer arithmetic wraps rather than by rejecting the value, which
 * would need a check on a path that is always a constant in practice.
 */
const checkFromCharCode: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "String.fromCharCode", 1);
  checkIndexArgument(ctx, expr.arguments[0], scope, "String.fromCharCode");
  return STRING;
};

// ---- Builtin calls (`console.log`, `Math.*`, `process.exit`) ------------------------------

/** `console.log` and `console.error` differ only in the stream they write to. */
const consoleWriter =
  (name: string): BuiltinCallChecker =>
  (ctx, expr, scope) => {
    if (expr.arguments.length !== 1) {
      throw ctx.error(`\`${name}\` expects exactly 1 argument, got ${expr.arguments.length}`, expr);
    }
    const t = ctx.checkExpression(expr.arguments[0], scope);
    if (!isStringifiable(t)) {
      throw ctx.error(
        `\`${name}\` accepts string, number, or boolean, got ${typeToString(t)}`,
        expr.arguments[0]
      );
    }
    if (!ts.isExpressionStatement(expr.parent)) {
      throw ctx.error(`\`${name}\` returns void and can only be used as a statement`, expr);
    }
    return VOID;
  };

/** Builtins keyed by dotted callee name. Add an entry to support another. */
export const builtinCalls: Record<string, BuiltinCallChecker> = {
  "console.log": consoleWriter("console.log"),
  "console.error": consoleWriter("console.error"), // WP14 B2: the same, on stderr
  "String.fromCharCode": checkFromCharCode, // WP14 A2
  ...mathBuiltinCalls, // WP7: Math.sqrt, ..., Math.random
  ...ioBuiltinCalls, // WP7: process.exit
  ...arenaBuiltinCalls, // WP6: Arena.reset / mark / release / used
};

/** Entry point for `checkCall` when the callee is a property access. */
export function checkBuiltinCall(ctx: CheckContext, expr: ts.CallExpression, scope: Scope): StaticType {
  const name = dottedName(expr.expression);
  const builtin = name === undefined ? undefined : lookup(builtinCalls, name);
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
};

/** Overrides the numeric-only `+`, `===`, `!==` entries (spread after them). */
export const stringBinaryCheckers: CheckerTable<BinaryChecker> = {
  [ts.SyntaxKind.PlusToken]: checkPlus,
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: checkStrictEquality,
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: checkStrictEquality,
};
