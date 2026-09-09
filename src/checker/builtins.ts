/**
 * Shared plumbing for builtin calls: functions that exist without a
 * declaration (`console.log`, `Math.sqrt`, `toI32`, `readFileSync`, ...).
 *
 * Two families, two tables:
 *   - dotted callees (`console.log`, `Math.sqrt`, `process.exit`) go through
 *     `builtinCalls` in `strings.ts`, keyed by the dotted name;
 *   - plain identifier callees (`toI32`, `readFileSync`) go through
 *     `builtinFunctions` in `expressions.ts`, consulted only when no user
 *     function of that name is in scope (a user definition wins).
 *
 * This module has no sibling imports so `math.ts`, `io.ts`, and `strings.ts`
 * can all depend on it without cycles.
 */
import ts from "typescript";
import { StaticType, sameType, typeToString } from "../types.js";
import { CheckContext } from "./context.js";
import { Scope } from "./scope.js";

export type BuiltinCallChecker = (ctx: CheckContext, expr: ts.CallExpression, scope: Scope) => StaticType;

/** `a.b` for a plain `identifier.identifier` property access, else undefined. */
export function dottedName(expr: ts.Expression): string | undefined {
  if (!ts.isPropertyAccessExpression(expr) || !ts.isIdentifier(expr.expression)) return undefined;
  return `${expr.expression.text}.${expr.name.text}`;
}

/** Display name of a call's callee: dotted (`Math.sqrt`) or plain (`toI32`). */
export function calleeName(expr: ts.CallExpression): string | undefined {
  return ts.isIdentifier(expr.expression) ? expr.expression.text : dottedName(expr.expression);
}

/** Reject a call whose argument count is not `arity`, using the console.log wording. */
export function checkArity(ctx: CheckContext, expr: ts.CallExpression, name: string, arity: number): void {
  if (expr.arguments.length !== arity) {
    throw ctx.error(
      `\`${name}\` expects exactly ${arity} argument${arity === 1 ? "" : "s"}, got ${expr.arguments.length}`,
      expr
    );
  }
}

/** Reject a void builtin used as a value; mirrors `console.log`. */
export function requireStatementPosition(ctx: CheckContext, expr: ts.CallExpression, name: string): void {
  if (!ts.isExpressionStatement(expr.parent)) {
    throw ctx.error(`\`${name}\` returns void and can only be used as a statement`, expr);
  }
}

/**
 * Check one argument and require a specific type. `sameType` rather than a
 * comparison of kinds, because a builtin can want a composite: `spawnSync`
 * takes a `string[]` and an `i32[]` is not one, though both are arrays.
 */
export function checkArgumentType(
  ctx: CheckContext,
  arg: ts.Expression,
  scope: Scope,
  name: string,
  want: StaticType
): StaticType {
  const got = ctx.checkExpression(arg, scope);
  if (!sameType(got, want)) {
    // "an argument of type" rather than the bare type, so the message has a
    // literal run of its own: `scripts/gen-diagnostic-codes.mjs` derives a code
    // from the longest run between interpolations, and `` `${n}` expects ${a},
    // got ${b} `` has none long enough to name a rule. This one template was
    // eight of the nine uncoded diagnostics in the suite's coverage check.
    throw ctx.error(`\`${name}\` expects an argument of type ${typeToString(want)}, got ${typeToString(got)}`, arg);
  }
  return got;
}
