// Control-flow lowering for stage1 (`src/codegen/emit/control-flow.ts`,
// docs/wp14-selfhost.md milestone S4): `if`, the loops, `switch`,
// `break`/`continue`, `throw`, the ternary and the short-circuit operators,
// compound assignment on a local and `++`/`--`.
//
// Block layout follows clang, and the labels are the ones `src/` reserves:
// `if.then`, `if.else`, `if.end`, suffixed `.N` on reuse, with the blocks
// placed in control-flow order. Every placed block ends in a terminator — a
// block that cannot fall through is left alone, and the exit block of an
// infinite loop ends in `unreachable`. Values that merge from two arms use
// `phi`; mutable locals already live in allocas, so loops load and store them
// and `mem2reg` builds the loop phis later.

import { Emitter, LoopTarget } from "./emit";
import {
  compoundFloatOpcode,
  compoundIntegerOpcode,
  emitIntBinary,
  intOpcode,
  loadLocal,
  storeLocal,
  targetLocal,
} from "./emit_ops";
import { unwrapParens } from "./emit_util";
import { IRBlock } from "./ir";
import { FLAG_POSTFIX, N_CASE, N_EMPTY, N_TRUE, N_VAR, Node } from "./nodes";
import { isFloat } from "./types";

// ---- Branch helpers -----------------------------------------------------------

function branch(emitter: Emitter, target: IRBlock): void {
  emitter.fn.emit(`br label %${target.label}`);
}

function condBranch(emitter: Emitter, cond: string, ifTrue: IRBlock, ifFalse: IRBlock): void {
  emitter.fn.emit(`br i1 ${cond}, label %${ifTrue.label}, label %${ifFalse.label}`);
}

/** Branch to `target` unless the current block already ended; answers whether it did branch. */
function fallThrough(emitter: Emitter, target: IRBlock): boolean {
  if (emitter.fn.currentBlock().terminated()) {
    return false;
  }
  branch(emitter, target);
  return true;
}

/** A condition the compiler can see is always taken: `while (true)`, or none at all. */
function isAlwaysTrue(cond: Node): boolean {
  return cond.kind === N_EMPTY || unwrapParens(cond).kind === N_TRUE;
}

/** Emit a loop body with `loop` on the stack so `break`/`continue` find their targets. */
function emitLoopBody(emitter: Emitter, body: Node, loop: LoopTarget): void {
  emitter.loops.push(loop);
  emitter.emitStatement(body);
  emitter.loops.pop();
}

// ---- Statements ---------------------------------------------------------------

export function emitIf(emitter: Emitter, stmt: Node): void {
  const fn = emitter.fn;
  const hasElse = stmt.children[2].kind !== N_EMPTY;
  const thenBlock = fn.newBlock("if.then");
  const elseBlock = hasElse ? fn.newBlock("if.else") : thenBlock;
  const endBlock = fn.newBlock("if.end");

  const cond = emitter.emitExpression(stmt.children[0]);
  condBranch(emitter, cond, thenBlock, hasElse ? elseBlock : endBlock);

  fn.placeBlock(thenBlock);
  emitter.emitStatement(stmt.children[1]);
  let reachesEnd = fallThrough(emitter, endBlock);

  if (hasElse) {
    fn.placeBlock(elseBlock);
    emitter.emitStatement(stmt.children[2]);
    reachesEnd = fallThrough(emitter, endBlock) || reachesEnd;
  } else {
    reachesEnd = true; // the false edge of the branch lands here
  }
  // When both arms return, nothing reaches `if.end`; leave it out.
  if (reachesEnd) {
    fn.placeBlock(endBlock);
  }
}

export function emitWhile(emitter: Emitter, stmt: Node): void {
  const fn = emitter.fn;
  const condBlock = fn.newBlock("while.cond");
  const bodyBlock = fn.newBlock("while.body");
  const endBlock = fn.newBlock("while.end");

  branch(emitter, condBlock);
  fn.placeBlock(condBlock);
  condBranch(emitter, emitter.emitExpression(stmt.children[0]), bodyBlock, endBlock);

  fn.placeBlock(bodyBlock);
  const loop = new LoopTarget(endBlock, condBlock);
  emitLoopBody(emitter, stmt.children[1], loop);
  fallThrough(emitter, condBlock);

  fn.placeBlock(endBlock);
  if (isAlwaysTrue(stmt.children[0]) && !loop.hasBreak) {
    fn.emit("unreachable");
  }
}

export function emitDo(emitter: Emitter, stmt: Node): void {
  const fn = emitter.fn;
  const bodyBlock = fn.newBlock("do.body");
  const condBlock = fn.newBlock("do.cond");
  const endBlock = fn.newBlock("do.end");

  branch(emitter, bodyBlock);
  fn.placeBlock(bodyBlock);
  const loop = new LoopTarget(endBlock, condBlock);
  emitLoopBody(emitter, stmt.children[0], loop);
  fallThrough(emitter, condBlock);

  fn.placeBlock(condBlock);
  condBranch(emitter, emitter.emitExpression(stmt.children[1]), bodyBlock, endBlock);

  fn.placeBlock(endBlock);
  if (isAlwaysTrue(stmt.children[1]) && !loop.hasBreak) {
    fn.emit("unreachable");
  }
}

/**
 * `for (init; cond; inc) body` becomes `for.cond` -> `for.body` -> `for.inc`
 * -> `for.cond`. A missing condition drops `for.cond` (the loop head is the
 * body) and a missing incrementor drops `for.inc` (`continue` jumps to the
 * head). `for.end` is placed only when something can reach it: the condition's
 * false edge or a `break`.
 */
export function emitFor(emitter: Emitter, stmt: Node): void {
  const fn = emitter.fn;
  const initializer = stmt.children[0];
  const condition = stmt.children[1];
  const incrementor = stmt.children[2];
  const hasCond = condition.kind !== N_EMPTY;
  const hasInc = incrementor.kind !== N_EMPTY;
  let condBlock: IRBlock | null = null;
  if (hasCond) {
    condBlock = fn.newBlock("for.cond");
  }
  const bodyBlock = fn.newBlock("for.body");
  let incBlock: IRBlock | null = null;
  if (hasInc) {
    incBlock = fn.newBlock("for.inc");
  }
  const endBlock = fn.newBlock("for.end");
  const head = condBlock === null ? bodyBlock : condBlock;

  if (initializer.kind === N_VAR) {
    emitter.emitVariableDeclarations(initializer.children[0]);
  } else if (initializer.kind !== N_EMPTY) {
    emitter.emitExpression(initializer);
  }
  branch(emitter, head);

  if (condBlock !== null) {
    fn.placeBlock(condBlock);
    condBranch(emitter, emitter.emitExpression(condition), bodyBlock, endBlock);
  }

  fn.placeBlock(bodyBlock);
  const loop = new LoopTarget(endBlock, incBlock === null ? head : incBlock);
  emitLoopBody(emitter, stmt.children[3], loop);

  if (incBlock !== null) {
    fallThrough(emitter, incBlock);
    fn.placeBlock(incBlock);
    emitter.emitExpression(incrementor);
    branch(emitter, head);
  } else {
    fallThrough(emitter, head);
  }

  if (hasCond || loop.hasBreak) {
    fn.placeBlock(endBlock);
    if (isAlwaysTrue(condition) && !loop.hasBreak) {
      fn.emit("unreachable");
    }
  }
}

/**
 * `switch` becomes LLVM's `switch`: one table of constant-to-label pairs and a
 * default edge, which the backend turns into a jump table, a bit test or a
 * comparison chain depending on how dense the labels are.
 *
 * A clause with no statements has no block of its own — its label points at
 * the next clause that has one, which is exactly the fallthrough of
 * `case 1: case 2: body`. Every other clause ends in a terminator (the checker
 * proved it), except the last, which may fall out into `sw.end`.
 */
export function emitSwitch(emitter: Emitter, stmt: Node): void {
  const fn = emitter.fn;
  const clauses = stmt.children[1].children;
  const bodies: (IRBlock | null)[] = [];
  for (const clause of clauses) {
    if (clauseBody(clause).children.length > 0) {
      bodies.push(fn.newBlock(clause.kind === N_CASE ? "sw.case" : "sw.default"));
    } else {
      bodies.push(null);
    }
  }
  const endBlock = fn.newBlock("sw.end");

  const type = emitter.llvm(emitter.typeOf(stmt.children[0]));
  const subject = emitter.emitExpression(stmt.children[0]);
  let defaultIndex = -1;
  let i = 0;
  while (i < clauses.length) {
    if (clauses[i].kind !== N_CASE && defaultIndex < 0) {
      defaultIndex = i;
    }
    i = i + 1;
  }
  const table: string[] = [];
  i = 0;
  while (i < clauses.length) {
    if (clauses[i].kind === N_CASE) {
      const value = emitter.program.nodeCaseValues[clauses[i].id];
      table.push(`    ${type} ${value}, label %${targetOf(bodies, endBlock, i).label}`);
    }
    i = i + 1;
  }
  const defaultBlock = defaultIndex < 0 ? endBlock : targetOf(bodies, endBlock, defaultIndex);
  fn.emit(`switch ${type} ${subject}, label %${defaultBlock.label} [\n${table.join("\n")}\n  ]`);

  // `sw.end` is reachable from the implicit default edge, from a `break`, and
  // from a last clause that falls out; an empty trailing clause is the same
  // edge as the second of those.
  let reachesEnd = defaultIndex < 0 || defaultBlock === endBlock;
  const target = new LoopTarget(endBlock, null);
  emitter.loops.push(target);
  i = 0;
  while (i < clauses.length) {
    const body = bodies[i];
    if (body === null) {
      if (targetOf(bodies, endBlock, i) === endBlock) {
        reachesEnd = true;
      }
    } else {
      fn.placeBlock(body);
      for (const statement of clauseBody(clauses[i]).children) {
        emitter.emitStatement(statement);
      }
      if (fallThrough(emitter, endBlock)) {
        reachesEnd = true;
      }
    }
    i = i + 1;
  }
  emitter.loops.pop();
  if (target.hasBreak) {
    reachesEnd = true;
  }
  if (reachesEnd) {
    fn.placeBlock(endBlock);
  }
}

/** The `BLOCK` of a clause: after the label for a `case`, the only child for a `default`. */
function clauseBody(clause: Node): Node {
  return clause.kind === N_CASE ? clause.children[1] : clause.children[0];
}

/** Where a label jumps: its own body, or the first one below it that exists. */
function targetOf(bodies: (IRBlock | null)[], endBlock: IRBlock, from: i32): IRBlock {
  let i = from;
  while (i < bodies.length) {
    const body = bodies[i];
    if (body !== null) {
      return body;
    }
    i = i + 1;
  }
  return endBlock;
}

export function emitBreak(emitter: Emitter): void {
  const target = emitter.loops[emitter.loops.length - 1];
  target.hasBreak = true;
  branch(emitter, target.breakBlock);
}

/** `continue` looks past any enclosing `switch` for the innermost loop. */
export function emitContinue(emitter: Emitter): void {
  let i = emitter.loops.length - 1;
  while (i >= 0) {
    const target = emitter.loops[i].continueBlock;
    if (target !== null) {
      branch(emitter, target);
      return;
    }
    i = i - 1;
  }
}

/** `throw e`: evaluate `e` for its effects, then trap. There is no unwinding. */
export function emitThrow(emitter: Emitter, stmt: Node): void {
  emitter.emitExpression(stmt.children[0]);
  emitter.declare("declare void @llvm.trap()");
  emitter.fn.emit("call void @llvm.trap()");
  emitter.fn.emit("unreachable");
}

// ---- Expressions --------------------------------------------------------------

/**
 * `c ? a : b`: each arm is evaluated in its own block and the results meet in
 * a `phi`. The incoming labels are read after emitting each arm, because an
 * arm may itself contain branches (a nested `?:`, an `&&`).
 */
export function emitConditional(emitter: Emitter, expr: Node): string {
  const fn = emitter.fn;
  const trueBlock = fn.newBlock("cond.true");
  const falseBlock = fn.newBlock("cond.false");
  const endBlock = fn.newBlock("cond.end");

  condBranch(emitter, emitter.emitExpression(expr.children[0]), trueBlock, falseBlock);

  fn.placeBlock(trueBlock);
  const whenTrue = emitter.emitExpression(expr.children[1]);
  const trueEdge = fn.currentBlock().label;
  branch(emitter, endBlock);

  fn.placeBlock(falseBlock);
  const whenFalse = emitter.emitExpression(expr.children[2]);
  const falseEdge = fn.currentBlock().label;
  branch(emitter, endBlock);

  fn.placeBlock(endBlock);
  return fn.emitValue(
    `phi ${emitter.llvm(emitter.typeOf(expr))} [ ${whenTrue}, %${trueEdge} ], [ ${whenFalse}, %${falseEdge} ]`
  );
}

/** `a && b` / `a || b`: the right operand runs only when the left did not decide the result. */
export function emitLogical(emitter: Emitter, expr: Node): string {
  const isAnd = expr.text === "&&";
  const fn = emitter.fn;
  const rhsBlock = fn.newBlock(isAnd ? "land.rhs" : "lor.rhs");
  const endBlock = fn.newBlock(isAnd ? "land.end" : "lor.end");

  const lhs = emitter.emitExpression(expr.children[0]);
  const lhsEdge = fn.currentBlock().label;
  if (isAnd) {
    condBranch(emitter, lhs, rhsBlock, endBlock);
  } else {
    condBranch(emitter, lhs, endBlock, rhsBlock);
  }

  fn.placeBlock(rhsBlock);
  const rhs = emitter.emitExpression(expr.children[1]);
  const rhsEdge = fn.currentBlock().label;
  branch(emitter, endBlock);

  fn.placeBlock(endBlock);
  return fn.emitValue(`phi i1 [ ${isAnd ? "false" : "true"}, %${lhsEdge} ], [ ${rhs}, %${rhsEdge} ]`);
}

/** `x op= e`: JS reads `x` before evaluating `e`; the expression's value is the stored result. */
export function emitCompoundAssignment(emitter: Emitter, expr: Node): string {
  const local = targetLocal(emitter, expr.children[0]);
  const old = loadLocal(emitter, local);
  const rhs = emitter.emitExpression(expr.children[1]);
  const value = isFloat(local.type)
    ? emitter.fn.emitValue(`${compoundFloatOpcode(expr.text)} ${emitter.llvm(local.type)} ${old}, ${rhs}`)
    : emitIntBinary(emitter, compoundIntegerOpcode(expr.text), local.type, old, rhs);
  storeLocal(emitter, local, value);
  return value;
}

/** `++x`/`x++`/`--x`/`x--`: postfix yields the old value, prefix the new one. */
export function emitIncDec(emitter: Emitter, expr: Node): string {
  const local = targetLocal(emitter, expr.children[0]);
  const float = isFloat(local.type);
  const increment = expr.text === "++";
  let opcode = increment ? "fadd" : "fsub";
  if (!float) {
    opcode = intOpcode(emitter, increment ? "add" : "sub", local.type);
  }
  // `1.0` in LLVM's hex form; the same 64-bit pattern serves `float` and `double`.
  const one = float ? "0x3FF0000000000000" : "1";
  const old = loadLocal(emitter, local);
  const value = emitter.fn.emitValue(`${opcode} ${emitter.llvm(local.type)} ${old}, ${one}`);
  storeLocal(emitter, local, value);
  return expr.flags === FLAG_POSTFIX ? old : value;
}
