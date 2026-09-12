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
import { CheckedProgram, LocalVar } from "../../checker/index.js";
import { CompilerOptions, StaticType } from "../../types.js";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter } from "./context.js";
import { lookup } from "../../lookup.js";

export type PropertyEmitter = (ctx: EmitContext, expr: ts.PropertyAccessExpression, receiver: StaticType) => string;
export type MethodCallEmitter = (ctx: EmitContext, expr: ts.CallExpression, receiver: StaticType) => string;
export type NewEmitter = (ctx: EmitContext, expr: ts.NewExpression) => string;
export type NamespacePropertyEmitter = (ctx: EmitContext, expr: ts.PropertyAccessExpression) => string;

export interface MemoryFacts {
  readsMemory: boolean;
  effect: "none" | "read" | "write";
  callees: Set<string>;
  /** WP6: allocations lowered to allocas; stores into them are own memory, not an allocator call. */
  stackSites: Set<ts.Node>;
  /** WP6: locals that only ever hold a stack object; a field access through one is own memory. */
  stackLocals: Set<LocalVar>;
}

/** WP6: `expr` denotes a stack object: a stack allocation itself, or a local that only holds one. */
export function isStackOwned(program: CheckedProgram, facts: MemoryFacts, expr: ts.Expression): boolean {
  let e = expr;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (facts.stackSites.has(e)) return true;
  if (!ts.isIdentifier(e)) return false;
  const local = program.bindings.get(e);
  return local !== undefined && facts.stackLocals.has(local);
}
export type FactCollector = (program: CheckedProgram, node: ts.Node, facts: MemoryFacts, opts: CompilerOptions) => void;

export const propertyEmitters: Partial<Record<StaticType["kind"], PropertyEmitter>> = {};
export const methodCallEmitters: Partial<Record<StaticType["kind"], MethodCallEmitter>> = {};
export const newEmitters: Record<string, NewEmitter> = {};
export const namespacePropertyEmitters: Record<string, NamespacePropertyEmitter> = {};
export const factCollectors: FactCollector[] = [];
/** Mirrors `assignmentTargetCheckers`: `=` / `op=` lowering keyed by the target expression's kind. */
export const assignmentTargetEmitters: EmitterTable<BinaryEmitter> = {};

export function isValueReceiver(program: CheckedProgram, receiver: ts.Expression): boolean {
  return program.types.has(receiver);
}

const emitPropertyAccess: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.PropertyAccessExpression;
  if (!isValueReceiver(ctx.program, expr.expression)) {
    // WP23: `Kind.If` was folded by the checker, so it lowers to its integer
    // with no global and no load — the same arrangement a module constant has.
    const member = ctx.program.enumRefs.get(expr);
    if (member !== undefined) return String(member);
    const dotted = `${(expr.expression as ts.Identifier).text}.${expr.name.text}`;
    return lookup(namespacePropertyEmitters, dotted)!(ctx, expr);
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
  const handler = (name !== undefined && lookup(newEmitters, name)) || newEmitters["*"];
  return handler(ctx, expr);
};

export const memberExpressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.PropertyAccessExpression]: emitPropertyAccess,
  [ts.SyntaxKind.NewExpression]: emitNew,
};
