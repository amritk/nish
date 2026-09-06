/**
 * `T | null` (WP6) for pointer types: classes, interfaces, arrays, strings.
 *
 * A nullable value has the same LLVM pointer type as `T`; `null` is the
 * pointer constant `null`. The only operations on a `T | null` value are
 *
 *   p === null, p !== null   pointer comparison against the literal `null`
 *   assignment / passing     a `T` converts to `T | null` implicitly
 *                            (`assignable` in types.ts); the reverse never
 *   narrowing                inside `if (p !== null) { ... }`, in the else
 *                            branch of `if (p === null)`, after an early exit
 *                            (`if (p === null) { return ...; }`), in the body
 *                            of `while (p !== null)`, in the right operand of
 *                            `p !== null && ...` / `p === null || ...`, and
 *                            in the arms of `p !== null ? ... : ...`, `p`
 *                            reads as `T`.
 *
 * Field access, method calls, indexing, `.length`, `+`, template holes and
 * `console.log` on an un-narrowed nullable are checker errors (the receiver
 * kind `nullable` has no handler, or an explicit one below with a hint).
 *
 * Narrowing is flow-insensitive within a region and sound by construction:
 *   - it applies to a *variable* (local or parameter), not to a property path;
 *   - it is dropped at any assignment to the variable (`Scope.clearNarrowing`),
 *     and before a loop whose body, condition or update assigns it
 *     (`invalidateNarrowings`), since the body may run again with the
 *     assigned value;
 *   - `this` is never nullable.
 *
 * The `null` literal takes its type from the context: a `T | null` annotation
 * on the variable, the return type, a parameter, a field, a `push` receiver,
 * or the other operand of `===` / `!==`. Without one it is an error, and so
 * is `null` where a plain `T` is expected.
 */
import ts from "typescript";
import { StaticType, resolveTypeNode, stripNull, typeToString } from "../types";
import { contextualType } from "./classes";
import { CheckContext, CheckerTable, ExpressionChecker } from "./context";
import { methodCallCheckers, propertyCheckers } from "./members";
import { LocalVar } from "./program";
import { Scope } from "./scope";

function unwrapParens(expr: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
}

export function isNullLiteral(expr: ts.Expression): boolean {
  return unwrapParens(expr).kind === ts.SyntaxKind.NullKeyword;
}

function isStrictEquality(kind: ts.SyntaxKind): boolean {
  return kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
}

// ---- The `null` literal ----------------------------------------------------------------

/** The type the position of `null` expects, beyond what `contextualType` (classes.ts) knows. */
function nullContext(ctx: CheckContext, expr: ts.Expression, scope: Scope): StaticType | undefined {
  const known = contextualType(ctx, expr, scope);
  if (known) return known;
  let node: ts.Expression = expr;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (ts.isPropertyDeclaration(parent) && parent.type) return resolveTypeNode(parent.type, ctx.sf, ctx.opts);
  if (ts.isBinaryExpression(parent) && isStrictEquality(parent.operatorToken.kind)) {
    // `p === null` / `null === p`: the other operand decides. The left operand
    // is already checked; a right-hand identifier can be looked up; anything
    // else is checked here (checking is idempotent, the operator re-checks it).
    const other = unwrapParens(parent.left === node ? parent.right : parent.left);
    const recorded = ctx.program.types.get(other);
    if (recorded) return recorded;
    if (ts.isIdentifier(other)) {
      const v = scope.lookup(other.text);
      return v ? scope.typeOf(v) : undefined;
    }
    return ctx.checkExpression(other, scope);
  }
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === "push") {
    const receiver = ctx.program.types.get(parent.expression.expression);
    return receiver?.kind === "array" ? receiver.elem : undefined;
  }
  return undefined;
}

const checkNullLiteral: ExpressionChecker = (ctx, expr, scope) => {
  const want = nullContext(ctx, expr, scope);
  if (!want) {
    throw ctx.error("`null` needs a contextual `T | null` type (annotate the variable, e.g. `let p: P | null = null`)", expr);
  }
  if (want.kind !== "nullable") {
    throw ctx.error(`\`null\` is not a ${typeToString(want)}; declare the type as \`${typeToString(want)} | null\``, expr);
  }
  return want;
};

export const nullableExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.NullKeyword]: checkNullLiteral,
};

// ---- Members on an un-narrowed nullable ------------------------------------------------

function hint(receiver: StaticType): string {
  return `check for null first: \`if (p !== null) { ... }\` narrows \`${typeToString(receiver)}\` to \`${typeToString(stripNull(receiver))}\``;
}

propertyCheckers.nullable = (ctx, expr, receiver) => {
  throw ctx.error(`Cannot read property \`${expr.name.text}\` of \`${typeToString(receiver)}\`; ${hint(receiver)}`, expr.name);
};

methodCallCheckers.nullable = (ctx, expr, receiver) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  throw ctx.error(`Cannot call \`${access.name.text}\` on \`${typeToString(receiver)}\`; ${hint(receiver)}`, access.name);
};

// ---- `===` / `!==` involving nullable operands ----------------------------------------------

/**
 * Called by the strict-equality checker once both operand types are known and
 * agree. A `T | null` operand may only be compared with the literal `null`:
 * comparing two nullable values would compare pointers, which for strings is
 * not `===`; narrow both first.
 */
export function checkNullableComparison(ctx: CheckContext, expr: ts.BinaryExpression, type: StaticType): void {
  if (type.kind !== "nullable") return;
  if (isNullLiteral(expr.left) || isNullLiteral(expr.right)) return;
  throw ctx.error(
    `Cannot compare two \`${typeToString(type)}\` values; compare each with \`null\` and then compare the narrowed values`,
    expr
  );
}

// ---- Narrowing ------------------------------------------------------------------------------

export interface Narrowing {
  v: LocalVar;
  type: StaticType;
}

export interface Narrowings {
  whenTrue: Narrowing[];
  whenFalse: Narrowing[];
}

const NONE: Narrowings = { whenTrue: [], whenFalse: [] };

/** `x !== null`, `null !== x`, `x === null`: the nullable variable `x` and whether the test is for non-null. */
function nullTest(cond: ts.BinaryExpression, scope: Scope): { v: LocalVar; nonNull: boolean } | undefined {
  if (!isStrictEquality(cond.operatorToken.kind)) return undefined;
  const leftNull = isNullLiteral(cond.left);
  const rightNull = isNullLiteral(cond.right);
  if (leftNull === rightNull) return undefined;
  const other = unwrapParens(leftNull ? cond.right : cond.left);
  if (!ts.isIdentifier(other)) return undefined;
  const v = scope.lookup(other.text);
  if (!v || scope.typeOf(v).kind !== "nullable") return undefined;
  return { v, nonNull: cond.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken };
}

/**
 * What a condition proves about nullable variables when it is true and when
 * it is false. Purely syntactic plus scope lookups: nothing is checked here,
 * so it can run before or after the condition itself is checked.
 */
export function conditionNarrowings(cond: ts.Expression, scope: Scope): Narrowings {
  const expr = unwrapParens(cond);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    const inner = conditionNarrowings(expr.operand, scope);
    return { whenTrue: inner.whenFalse, whenFalse: inner.whenTrue };
  }
  if (!ts.isBinaryExpression(expr)) return NONE;
  const op = expr.operatorToken.kind;
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
  const test = nullTest(expr, scope);
  if (!test) return NONE;
  const narrowing: Narrowing = { v: test.v, type: stripNull(scope.typeOf(test.v)) };
  return test.nonNull ? { whenTrue: [narrowing], whenFalse: [] } : { whenTrue: [], whenFalse: [narrowing] };
}

/** A child scope of `scope` in which every narrowing in `list` holds. */
export function narrowedScope(scope: Scope, list: Narrowing[]): Scope {
  const child = scope.child();
  for (const n of list) child.narrow(n.v, n.type);
  return child;
}

/** Make `list` hold for the rest of `scope` (after an early exit). */
export function applyNarrowings(scope: Scope, list: Narrowing[]): void {
  for (const n of list) scope.narrow(n.v, n.type);
}

/**
 * Before a loop: every variable assigned anywhere in it (`x = ...`, `x op= ...`)
 * loses its narrowing, because the second iteration sees the assigned value
 * before the statements that precede the assignment textually.
 */
export function invalidateNarrowings(scope: Scope, loop: ts.Node): void {
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
}
