/**
 * Flow narrowing: what a condition proves about a *variable* in the region it
 * guards.
 *
 * Two construct families narrow today, and they share this engine because
 * they share the hard part — deciding which region a proof holds in:
 *
 *   `p !== null`   a `T | null` local reads as `T`          (WP6, `nullable.ts`)
 *   `r.ok`         a `Result<T, E>` local reads as its `ok`
 *                  arm, and as its `err` arm when the test
 *                  is false                                 (WP16, `result.ts`)
 *
 * Each family registers a `ConditionNarrower` here; the engine owns the
 * boolean algebra around them (`!`, `&&`, `||`, parentheses) and the scope
 * plumbing. Adding a third kind of proof means adding a narrower, not editing
 * this file.
 *
 * A narrowing is sound by construction because of three rules, and every one
 * of them is a rule about *variables*, never about property paths:
 *   - it applies to a local or a parameter, so no store through an alias and
 *     no call can invalidate it behind the checker's back;
 *   - it ends at any assignment to the variable (`Scope.clearNarrowing`);
 *   - it is dropped before a loop whose body, condition or update assigns the
 *     variable (`invalidateNarrowings`), because the second iteration sees the
 *     assigned value before the statements that precede the assignment
 *     textually.
 */
import ts from "typescript";
import { StaticType } from "../types";
import { LocalVar } from "./program";
import { Scope } from "./scope";

export type Narrowing = {
  v: LocalVar;
  type: StaticType;
};

/** What a condition proves in the region where it holds, and in the region where it does not. */
export type Narrowings = {
  whenTrue: Narrowing[];
  whenFalse: Narrowing[];
};

export const NO_NARROWINGS: Narrowings = { whenTrue: [], whenFalse: [] };

/**
 * One family's rule for a *leaf* condition: the boolean operators are already
 * peeled off when this is called. Returns undefined when the condition says
 * nothing about this family, so the next narrower gets a look.
 *
 * It runs purely on syntax plus scope lookups, so it may be called before or
 * after the condition itself has been checked.
 */
export type ConditionNarrower = (cond: ts.Expression, scope: Scope) => Narrowings | undefined;

/** Registered by `nullable.ts` and `result.ts` at module load; consulted in order. */
export const conditionNarrowers: ConditionNarrower[] = [];

export const unwrapParens = (expr: ts.Expression): ts.Expression => {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
};

/** What a condition proves about narrowable variables when it is true and when it is false. */
export const conditionNarrowings = (cond: ts.Expression, scope: Scope): Narrowings => {
  const expr = unwrapParens(cond);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = conditionNarrowings(expr.operand, scope);
    return { whenTrue: inner.whenFalse, whenFalse: inner.whenTrue };
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    // `a && b` proves both only when it is true; false says nothing about which
    // operand failed. `a || b` is the mirror image.
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      const l = conditionNarrowings(expr.left, scope);
      const r = conditionNarrowings(expr.right, scope);
      return { whenTrue: [...l.whenTrue, ...r.whenTrue], whenFalse: [] };
    }
    if (op === ts.SyntaxKind.BarBarToken) {
      const l = conditionNarrowings(expr.left, scope);
      const r = conditionNarrowings(expr.right, scope);
      return { whenTrue: [], whenFalse: [...l.whenFalse, ...r.whenFalse] };
    }
  }
  for (const narrower of conditionNarrowers) {
    const found = narrower(expr, scope);
    if (found) return found;
  }
  return NO_NARROWINGS;
};

/** A child scope of `scope` in which every narrowing in `list` holds. */
export const narrowedScope = (scope: Scope, list: Narrowing[]): Scope => {
  const child = scope.child();
  for (const n of list) child.narrow(n.v, n.type);
  return child;
};

/** Make `list` hold for the rest of `scope` (after an early exit). */
export const applyNarrowings = (scope: Scope, list: Narrowing[]): void => {
  for (const n of list) scope.narrow(n.v, n.type);
};

/**
 * Before a loop: every variable assigned anywhere in it (`x = ...`, `x op= ...`)
 * loses its narrowing, because the second iteration sees the assigned value
 * before the statements that precede the assignment textually.
 */
export const invalidateNarrowings = (scope: Scope, loop: ts.Node): void => {
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(node.left)
    ) {
      const v = scope.lookup(node.left.text);
      if (v) scope.clearNarrowing(v);
    }
    ts.forEachChild(node, visit);
  };
  visit(loop);
};
