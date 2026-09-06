/**
 * Member lowering dispatch, mirroring `checker/members.ts`: property reads,
 * method calls, and `new`, keyed by the receiver's StaticType kind or the
 * constructor name. A receiver is a value when the checker recorded a type
 * for it (namespaces such as `console` / `Math` never get one).
 *
 * `factCollectors` lets each family tell `attributes.ts` what its constructs
 * do to memory (runtime callees, reads, writes); an omission there is a
 * wrong attribute, so every emitter that touches memory must have one.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker";
import { StaticType } from "../../types";
import { EmitContext, EmitterTable, ExpressionEmitter } from "./context";

export type PropertyEmitter = (ctx: EmitContext, expr: ts.PropertyAccessExpression, receiver: StaticType) => string;
export type MethodCallEmitter = (ctx: EmitContext, expr: ts.CallExpression, receiver: StaticType) => string;
export type NewEmitter = (ctx: EmitContext, expr: ts.NewExpression) => string;
export type NamespacePropertyEmitter = (ctx: EmitContext, expr: ts.PropertyAccessExpression) => string;

export interface MemoryFacts {
  readsMemory: boolean;
  effect: "none" | "read" | "write";
  callees: Set<string>;
}
export type FactCollector = (program: CheckedProgram, node: ts.Node, facts: MemoryFacts) => void;

export const propertyEmitters: Partial<Record<StaticType["kind"], PropertyEmitter>> = {};
export const methodCallEmitters: Partial<Record<StaticType["kind"], MethodCallEmitter>> = {};
export const newEmitters: Record<string, NewEmitter> = {};
export const namespacePropertyEmitters: Record<string, NamespacePropertyEmitter> = {};
export const factCollectors: FactCollector[] = [];

export function isValueReceiver(program: CheckedProgram, receiver: ts.Expression): boolean {
  return program.types.has(receiver);
}

const emitPropertyAccess: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.PropertyAccessExpression;
  if (!isValueReceiver(ctx.program, expr.expression)) {
    const dotted = `${(expr.expression as ts.Identifier).text}.${expr.name.text}`;
    return namespacePropertyEmitters[dotted](ctx, expr);
  }
  const receiver = ctx.typeOf(expr.expression);
  return propertyEmitters[receiver.kind]!(ctx, expr, receiver);
};

export function emitMethodCall(ctx: EmitContext, expr: ts.CallExpression): string {
  const access = expr.expression as ts.PropertyAccessExpression;
  const receiver = ctx.typeOf(access.expression);
  return methodCallEmitters[receiver.kind]!(ctx, expr, receiver);
}

const emitNew: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.NewExpression;
  const name = ts.isIdentifier(expr.expression) ? expr.expression.text : undefined;
  const handler = (name !== undefined && newEmitters[name]) || newEmitters["*"];
  return handler(ctx, expr);
};

export const memberExpressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.PropertyAccessExpression]: emitPropertyAccess,
  [ts.SyntaxKind.NewExpression]: emitNew,
};
