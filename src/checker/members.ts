/**
 * Member dispatch: property access, method calls, and `new`, keyed by the
 * receiver's StaticType kind (or the constructor's name for `new`).
 *
 * Each construct family registers its entries at module load:
 *   strings.ts  -> propertyCheckers.string (`.length`)
 *   classes     -> propertyCheckers.struct, methodCallCheckers.struct, newCheckers["*"]
 *   arrays      -> propertyCheckers.array, methodCallCheckers.array, newCheckers.Array
 *
 * A receiver is a *value* when it is any expression other than a bare
 * identifier, or an identifier bound in scope. Bare unbound identifiers such
 * as `console` or `Math` are namespaces: their members are dotted builtins
 * (`builtinCalls` in strings.ts) or `namespaceProperties` here.
 */
import ts from "typescript";
import { StaticType, typeToString } from "../types";
import { CheckContext, CheckerTable, ExpressionChecker } from "./context";
import { Scope } from "./scope";

export type PropertyChecker = (
  ctx: CheckContext,
  expr: ts.PropertyAccessExpression,
  receiver: StaticType,
  scope: Scope
) => StaticType;
export type MethodCallChecker = (
  ctx: CheckContext,
  expr: ts.CallExpression,
  receiver: StaticType,
  scope: Scope
) => StaticType;
export type NewChecker = (ctx: CheckContext, expr: ts.NewExpression, scope: Scope) => StaticType;
export type NamespacePropertyChecker = (ctx: CheckContext, expr: ts.PropertyAccessExpression) => StaticType;

export const propertyCheckers: Partial<Record<StaticType["kind"], PropertyChecker>> = {};
export const methodCallCheckers: Partial<Record<StaticType["kind"], MethodCallChecker>> = {};
/** Keyed by constructor identifier (`Array`); `"*"` is the fallback for class names. */
export const newCheckers: Record<string, NewChecker> = {};
/** Keyed by dotted name (`Math.PI`). */
export const namespaceProperties: Record<string, NamespacePropertyChecker> = {};

export function isValueReceiver(receiver: ts.Expression, scope: Scope): boolean {
  return !ts.isIdentifier(receiver) || scope.lookup(receiver.text) !== undefined;
}

const checkPropertyAccess: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.PropertyAccessExpression;
  if (!isValueReceiver(expr.expression, scope)) {
    const dotted = `${(expr.expression as ts.Identifier).text}.${expr.name.text}`;
    const handler = namespaceProperties[dotted];
    if (!handler) throw ctx.error(`Unknown identifier \`${(expr.expression as ts.Identifier).text}\``, expr.expression);
    return handler(ctx, expr);
  }
  const receiver = ctx.checkExpression(expr.expression, scope);
  const handler = propertyCheckers[receiver.kind];
  if (!handler) throw ctx.error(`Unknown property \`${expr.name.text}\` on ${typeToString(receiver)}`, expr.name);
  return handler(ctx, expr, receiver, scope);
};

/** `recv.method(args)` where `recv` is a value; called from `checkCall`. */
export function checkMethodCall(ctx: CheckContext, expr: ts.CallExpression, scope: Scope): StaticType {
  const access = expr.expression as ts.PropertyAccessExpression;
  const receiver = ctx.checkExpression(access.expression, scope);
  const handler = methodCallCheckers[receiver.kind];
  if (!handler) throw ctx.error(`Unknown method \`${access.name.text}\` on ${typeToString(receiver)}`, access.name);
  return handler(ctx, expr, receiver, scope);
}

const checkNew: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.NewExpression;
  const name = ts.isIdentifier(expr.expression) ? expr.expression.text : undefined;
  const handler = (name !== undefined && newCheckers[name]) || newCheckers["*"];
  if (!handler) throw ctx.error(`Unsupported \`new ${expr.expression.getText(ctx.sf)}\``, expr);
  return handler(ctx, expr, scope);
};

export const memberExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.PropertyAccessExpression]: checkPropertyAccess,
  [ts.SyntaxKind.NewExpression]: checkNew,
};
