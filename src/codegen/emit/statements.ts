/** Statement lowering, one handler per `ts.SyntaxKind`. */
import ts from "typescript";
import { llvmType } from "../../types";
import { arrayStatementEmitters } from "./arrays";
import { EmitContext, EmitterTable, StatementEmitter } from "./context";
import { controlFlowStatementEmitters } from "./control-flow";

/** `return e`: the value first (it may allocate), then the arena scope release (WP6), then `ret`. */
const emitReturn: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.ReturnStatement;
  if (!stmt.expression) {
    ctx.emitScopeExit();
    ctx.fn.emit("ret void");
    return;
  }
  const type = ctx.typeOf(stmt.expression);
  const value = ctx.emitExpression(stmt.expression);
  ctx.emitScopeExit();
  ctx.fn.emit(`ret ${llvmType(type)} ${value}`);
};

/**
 * `let`/`const`: an alloca hoisted into the entry block plus a store. The
 * alloca is named after the variable so temp numbering is unaffected.
 */
const emitVariableStatement: StatementEmitter = (ctx, node) => {
  emitVariableDeclarationList(ctx, (node as ts.VariableStatement).declarationList);
};

/** Shared by variable statements and `for` initializers. */
export function emitVariableDeclarationList(ctx: EmitContext, list: ts.VariableDeclarationList): void {
  for (const decl of list.declarations) {
    const local = ctx.program.locals.get(decl)!;
    const ty = llvmType(local.type);
    const slot = ctx.fn.emitAlloca(`${local.name}.addr`, ty, ctx.align(local.type));
    ctx.setSlot(local, slot);
    const init = ctx.emitExpression(decl.initializer!);
    ctx.fn.emit(`store ${ty} ${init}, ${ty}* ${slot}${ctx.alignSuffix(local.type)}`);
    ctx.debug?.declareLocal(ctx.fn, local, slot, decl); // `-g`: llvm.dbg.declare on the slot
  }
}

const emitExpressionStatement: StatementEmitter = (ctx, node) => {
  ctx.emitExpression((node as ts.ExpressionStatement).expression);
};

const emitBlockStatement: StatementEmitter = (ctx, node) => ctx.emitBlock(node as ts.Block);

export const statementEmitters: EmitterTable<StatementEmitter> = {
  [ts.SyntaxKind.ReturnStatement]: emitReturn,
  [ts.SyntaxKind.VariableStatement]: emitVariableStatement,
  [ts.SyntaxKind.ExpressionStatement]: emitExpressionStatement,
  [ts.SyntaxKind.Block]: emitBlockStatement,
  ...controlFlowStatementEmitters,
  ...arrayStatementEmitters, // `for (const x of a)`
};
