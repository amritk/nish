/**
 * Control-flow lowering: `if`, `while`, `do`, `for`, `break`/`continue`,
 * `throw`, the ternary and short-circuit operators, compound assignment and
 * `++`/`--`.
 *
 * Block layout follows clang. Labels are reserved in source order
 * (`if.then`, `if.else`, `if.end`, suffixed `.N` on reuse) and the blocks
 * are placed in control-flow order. Every placed block ends in a
 * terminator: a block that cannot fall through (after `return`, `break`,
 * `continue`, `throw`) is left alone, and the exit block of an infinite loop
 * ends in `unreachable`. Values that merge from two arms (`?:`, `&&`, `||`)
 * use `phi`; mutable locals already live in allocas, so loops simply load
 * and store them and `mem2reg` builds the loop phis later.
 */
import ts from "typescript";
import { LocalVar } from "../../checker";
import { isAlwaysTrue } from "../../checker/control-flow";
import { isFloat, llvmType } from "../../types";
import { IRBlock } from "../ir";
import {
  BinaryEmitter,
  EmitContext,
  EmitterTable,
  ExpressionEmitter,
  LoopTarget,
  StatementEmitter,
  UnaryEmitter,
  intOpcode,
} from "./context";
import { emitIntBinary } from "./arithmetic";

// ---- Branch helpers -----------------------------------------------------------

function branch(ctx: EmitContext, target: IRBlock): void {
  ctx.fn.emit(`br label %${target.label}`);
}

function condBranch(ctx: EmitContext, cond: string, ifTrue: IRBlock, ifFalse: IRBlock): void {
  ctx.fn.emit(`br i1 ${cond}, label %${ifTrue.label}, label %${ifFalse.label}`);
}

/** Branch to `target` unless the current block already ended; returns whether it did branch. */
function fallThrough(ctx: EmitContext, target: IRBlock): boolean {
  if (ctx.fn.currentBlock.terminated) return false;
  branch(ctx, target);
  return true;
}

/** Emit a loop body with `loop` on the stack so `break`/`continue` find their targets. */
function emitLoopBody(ctx: EmitContext, body: ts.Statement, loop: LoopTarget): LoopTarget {
  ctx.loops.push(loop);
  ctx.emitStatement(body);
  ctx.loops.pop();
  return loop;
}

/** Read a mutable local from its alloca slot; shared with the `&=` family in `bitwise.ts`. */
export function loadLocal(ctx: EmitContext, local: LocalVar): string {
  const ty = llvmType(local.type);
  return ctx.fn.emitValue(`load ${ty}, ${ty}* ${ctx.slotOf(local)}${ctx.alignSuffix(local.type)}`);
}

/** Write a mutable local back to its alloca slot. */
export function storeLocal(ctx: EmitContext, local: LocalVar, value: string): void {
  const ty = llvmType(local.type);
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${ctx.slotOf(local)}${ctx.alignSuffix(local.type)}`);
}

// ---- Statements ---------------------------------------------------------------

const emitIf: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.IfStatement;
  const fn = ctx.fn;
  const thenBlock = fn.newBlock("if.then");
  const elseBlock = stmt.elseStatement ? fn.newBlock("if.else") : undefined;
  const endBlock = fn.newBlock("if.end");

  const cond = ctx.emitExpression(stmt.expression);
  condBranch(ctx, cond, thenBlock, elseBlock ?? endBlock);

  fn.placeBlock(thenBlock);
  ctx.emitStatement(stmt.thenStatement);
  let reachesEnd = fallThrough(ctx, endBlock);

  if (elseBlock) {
    fn.placeBlock(elseBlock);
    ctx.emitStatement(stmt.elseStatement!);
    reachesEnd = fallThrough(ctx, endBlock) || reachesEnd;
  } else {
    reachesEnd = true; // the false edge of the branch lands here
  }
  // When both arms return, nothing reaches `if.end`; leave it out.
  if (reachesEnd) fn.placeBlock(endBlock);
};

const emitWhile: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.WhileStatement;
  const fn = ctx.fn;
  const condBlock = fn.newBlock("while.cond");
  const bodyBlock = fn.newBlock("while.body");
  const endBlock = fn.newBlock("while.end");

  branch(ctx, condBlock);
  fn.placeBlock(condBlock);
  condBranch(ctx, ctx.emitExpression(stmt.expression), bodyBlock, endBlock);

  fn.placeBlock(bodyBlock);
  const loop = emitLoopBody(ctx, stmt.statement, {
    breakBlock: endBlock,
    continueBlock: condBlock,
    hasBreak: false,
  });
  fallThrough(ctx, condBlock);

  fn.placeBlock(endBlock);
  if (isAlwaysTrue(stmt.expression) && !loop.hasBreak) fn.emit("unreachable");
};

const emitDo: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.DoStatement;
  const fn = ctx.fn;
  const bodyBlock = fn.newBlock("do.body");
  const condBlock = fn.newBlock("do.cond");
  const endBlock = fn.newBlock("do.end");

  branch(ctx, bodyBlock);
  fn.placeBlock(bodyBlock);
  const loop = emitLoopBody(ctx, stmt.statement, {
    breakBlock: endBlock,
    continueBlock: condBlock,
    hasBreak: false,
  });
  fallThrough(ctx, condBlock);

  fn.placeBlock(condBlock);
  condBranch(ctx, ctx.emitExpression(stmt.expression), bodyBlock, endBlock);

  fn.placeBlock(endBlock);
  if (isAlwaysTrue(stmt.expression) && !loop.hasBreak) fn.emit("unreachable");
};

/**
 * `for (init; cond; inc) body` becomes `for.cond` -> `for.body` -> `for.inc`
 * -> `for.cond`. A missing condition drops `for.cond` (the loop head is the
 * body) and a missing incrementor drops `for.inc` (`continue` jumps to the
 * head). `for.end` is placed only when something can reach it: the
 * condition's false edge or a `break`.
 */
const emitFor: StatementEmitter = (ctx, node) => {
  const stmt = node as ts.ForStatement;
  const fn = ctx.fn;
  const condBlock = stmt.condition ? fn.newBlock("for.cond") : undefined;
  const bodyBlock = fn.newBlock("for.body");
  const incBlock = stmt.incrementor ? fn.newBlock("for.inc") : undefined;
  const endBlock = fn.newBlock("for.end");
  const head = condBlock ?? bodyBlock;

  if (stmt.initializer) {
    if (ts.isVariableDeclarationList(stmt.initializer)) ctx.emitVariableDeclarations(stmt.initializer);
    else ctx.emitExpression(stmt.initializer);
  }
  branch(ctx, head);

  if (condBlock) {
    fn.placeBlock(condBlock);
    condBranch(ctx, ctx.emitExpression(stmt.condition!), bodyBlock, endBlock);
  }

  fn.placeBlock(bodyBlock);
  const loop = emitLoopBody(ctx, stmt.statement, {
    breakBlock: endBlock,
    continueBlock: incBlock ?? head,
    hasBreak: false,
  });

  if (incBlock) {
    fallThrough(ctx, incBlock);
    fn.placeBlock(incBlock);
    ctx.emitExpression(stmt.incrementor!);
    branch(ctx, head);
  } else {
    fallThrough(ctx, head);
  }

  if (condBlock || loop.hasBreak) {
    fn.placeBlock(endBlock);
    if (isAlwaysTrue(stmt.condition) && !loop.hasBreak) fn.emit("unreachable");
  }
};

const emitBreak: StatementEmitter = (ctx) => {
  const loop = ctx.loops[ctx.loops.length - 1];
  loop.hasBreak = true;
  branch(ctx, loop.breakBlock);
};

const emitContinue: StatementEmitter = (ctx) => {
  branch(ctx, ctx.loops[ctx.loops.length - 1].continueBlock);
};

/** `throw e`: evaluate `e` for its effects, then trap. There is no unwinding in StaticTS. */
const emitThrow: StatementEmitter = (ctx, node) => {
  ctx.emitExpression((node as ts.ThrowStatement).expression);
  ctx.declare("declare void @llvm.trap()");
  ctx.fn.emit("call void @llvm.trap()");
  ctx.fn.emit("unreachable");
};

export const controlFlowStatementEmitters: EmitterTable<StatementEmitter> = {
  [ts.SyntaxKind.IfStatement]: emitIf,
  [ts.SyntaxKind.WhileStatement]: emitWhile,
  [ts.SyntaxKind.DoStatement]: emitDo,
  [ts.SyntaxKind.ForStatement]: emitFor,
  [ts.SyntaxKind.BreakStatement]: emitBreak,
  [ts.SyntaxKind.ContinueStatement]: emitContinue,
  [ts.SyntaxKind.ThrowStatement]: emitThrow,
};

// ---- Expressions --------------------------------------------------------------

/**
 * `c ? a : b`: each arm is evaluated in its own block and the results meet
 * in a `phi`. The phi's incoming labels are read after emitting each arm,
 * because an arm may itself contain branches (nested `?:`, `&&`).
 */
const emitConditional: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ConditionalExpression;
  const fn = ctx.fn;
  const trueBlock = fn.newBlock("cond.true");
  const falseBlock = fn.newBlock("cond.false");
  const endBlock = fn.newBlock("cond.end");

  condBranch(ctx, ctx.emitExpression(expr.condition), trueBlock, falseBlock);

  fn.placeBlock(trueBlock);
  const whenTrue = ctx.emitExpression(expr.whenTrue);
  const trueEdge = fn.currentBlock.label;
  branch(ctx, endBlock);

  fn.placeBlock(falseBlock);
  const whenFalse = ctx.emitExpression(expr.whenFalse);
  const falseEdge = fn.currentBlock.label;
  branch(ctx, endBlock);

  fn.placeBlock(endBlock);
  return fn.emitValue(
    `phi ${llvmType(ctx.typeOf(expr))} [ ${whenTrue}, %${trueEdge} ], [ ${whenFalse}, %${falseEdge} ]`
  );
};

/** `a && b` / `a || b`: the right operand runs only when the left did not decide the result. */
const emitLogical: BinaryEmitter = (ctx, expr) => {
  const isAnd = expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
  const fn = ctx.fn;
  const rhsBlock = fn.newBlock(isAnd ? "land.rhs" : "lor.rhs");
  const endBlock = fn.newBlock(isAnd ? "land.end" : "lor.end");

  const lhs = ctx.emitExpression(expr.left);
  const lhsEdge = fn.currentBlock.label;
  if (isAnd) condBranch(ctx, lhs, rhsBlock, endBlock);
  else condBranch(ctx, lhs, endBlock, rhsBlock);

  fn.placeBlock(rhsBlock);
  const rhs = ctx.emitExpression(expr.right);
  const rhsEdge = fn.currentBlock.label;
  branch(ctx, endBlock);

  fn.placeBlock(endBlock);
  return fn.emitValue(`phi i1 [ ${isAnd ? "false" : "true"}, %${lhsEdge} ], [ ${rhs}, %${rhsEdge} ]`);
};

/** Opcode per compound operator: [integer form, floating-point form]. */
const COMPOUND_OPCODES: Partial<Record<ts.SyntaxKind, [string, string]>> = {
  [ts.SyntaxKind.PlusEqualsToken]: ["add", "fadd"],
  [ts.SyntaxKind.MinusEqualsToken]: ["sub", "fsub"],
  [ts.SyntaxKind.AsteriskEqualsToken]: ["mul", "fmul"],
  [ts.SyntaxKind.SlashEqualsToken]: ["sdiv", "fdiv"],
  [ts.SyntaxKind.PercentEqualsToken]: ["srem", "frem"],
};

/** `x op= e`: JS reads `x` before evaluating `e`; the expression's value is the stored result. */
const emitCompoundAssignment: BinaryEmitter = (ctx, expr) => {
  const target = ctx.program.bindings.get(expr.left as ts.Identifier)!;
  const old = loadLocal(ctx, target);
  const rhs = ctx.emitExpression(expr.right);
  const [intOp, floatOp] = COMPOUND_OPCODES[expr.operatorToken.kind]!;
  const value = isFloat(target.type)
    ? ctx.fn.emitValue(`${floatOp} ${llvmType(target.type)} ${old}, ${rhs}`)
    : emitIntBinary(ctx, intOp, target.type, old, rhs);
  storeLocal(ctx, target, value);
  return value;
};

/** `++x`/`x++`/`--x`/`x--`: postfix yields the old value, prefix the new one. */
function emitIncDec(ctx: EmitContext, expr: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression): string {
  const target = ctx.program.bindings.get(expr.operand as ts.Identifier)!;
  const float = isFloat(target.type);
  const increment = expr.operator === ts.SyntaxKind.PlusPlusToken;
  const opcode = float
    ? increment
      ? "fadd"
      : "fsub"
    : intOpcode(ctx, increment ? "add" : "sub", target.type);
  // `1.0` in LLVM's hex form; the same 64-bit pattern serves `float` and `double`.
  const one = float ? "0x3FF0000000000000" : "1";
  const old = loadLocal(ctx, target);
  const value = ctx.fn.emitValue(`${opcode} ${llvmType(target.type)} ${old}, ${one}`);
  storeLocal(ctx, target, value);
  return ts.isPostfixUnaryExpression(expr) ? old : value;
}

const emitPostfixUnary: ExpressionEmitter = (ctx, node) => emitIncDec(ctx, node as ts.PostfixUnaryExpression);
const emitPrefixIncDec: UnaryEmitter = (ctx, expr) => emitIncDec(ctx, expr);

export const controlFlowExpressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.ConditionalExpression]: emitConditional,
  [ts.SyntaxKind.PostfixUnaryExpression]: emitPostfixUnary,
};

export const controlFlowBinaryEmitters: EmitterTable<BinaryEmitter> = {
  [ts.SyntaxKind.AmpersandAmpersandToken]: emitLogical,
  [ts.SyntaxKind.BarBarToken]: emitLogical,
  [ts.SyntaxKind.PlusEqualsToken]: emitCompoundAssignment,
  [ts.SyntaxKind.MinusEqualsToken]: emitCompoundAssignment,
  [ts.SyntaxKind.AsteriskEqualsToken]: emitCompoundAssignment,
  [ts.SyntaxKind.SlashEqualsToken]: emitCompoundAssignment,
  [ts.SyntaxKind.PercentEqualsToken]: emitCompoundAssignment,
};

export const controlFlowUnaryEmitters: EmitterTable<UnaryEmitter> = {
  [ts.SyntaxKind.PlusPlusToken]: emitPrefixIncDec,
  [ts.SyntaxKind.MinusMinusToken]: emitPrefixIncDec,
};
