/** Statement lowering, one handler per `ts.SyntaxKind`. */
import ts from "typescript";
import { ResultType, llvmType, resultByValue } from "../../types.js";
import { emitPackedResult, emitResultReturn, privateResultAbi } from "./result.js";
import { arrayStatementEmitters } from "./arrays.js";
import { EmitContext, EmitterTable, StatementEmitter } from "./context.js";
import { controlFlowStatementEmitters } from "./control-flow.js";

/**
 * `return e`: the value first (it may allocate), then the arena scope release
 * (WP6), then `ret` — unless the value is a tail call, which is marked `tail`
 * and takes the release with it, ahead of the call, so that the call is the
 * last instruction before the `ret`.
 */
const emitReturn: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.ReturnStatement;
  if (!stmt.expression) {
    ctx.emitScopeExit();
    ctx.fn.emit("ret void");
    return;
  }
  emitReturnValue(ctx, stmt.expression);
};

/**
 * The value half of a `return`, shared with the concise arrow body (WP22 §4),
 * which lowers to exactly the same instructions as the block with one `return`
 * it means — the goldens for the two spellings are byte-identical.
 */
export const emitReturnValue = (ctx: EmitContext, expression: ts.Expression): void => {
  // WP17: a small `Result` leaves in a register. The word is built before the
  // scope release, because the object it may be read out of is arena memory
  // the release reclaims.
  const want = ctx.currentSig.returnType;
  if (resultByValue(want)) {
    const value = emitPackedResult(ctx, expression, want as ResultType, privateResultAbi(ctx, ctx.currentSig));
    ctx.emitScopeExit();
    emitResultReturn(ctx, value);
    return;
  }
  const type = ctx.typeOf(expression);
  // WP6: a tail call is marked `tail`, and in a scoped function it takes the
  // release with it, ahead of the call — so this `return` emits none of its
  // own either way (there is none to emit when the function has no scope).
  // Decided before the expression is lowered, because that is when `emitCall`
  // needs the answer.
  const sunk = ctx.planTailCall(expression);
  const value = ctx.emitExpression(expression);
  if (!sunk) ctx.emitScopeExit();
  // `return g()` where `g` answers nothing is a `ret` with no operand: the
  // call is the whole of the statement, and `emitExpression` answers the
  // marker string `"void"` for it rather than a value. Writing that marker
  // after `ret void` is what made this one shape assemble to nothing at all.
  ctx.fn.emit(type.kind === "void" ? "ret void" : `ret ${llvmType(type)} ${value}`);
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
