// Control-flow lowering for stage1 (stage0's `src/codegen/emit/control-flow.ts`,
// docs/wp14-selfhost.md milestone S4): `if`, the loops, `switch`,
// `break`/`continue`, `throw`, the ternary and the short-circuit operators,
// compound assignment on a local and `++`/`--`.
//
// Block layout follows clang, and the labels are the ones stage0's `src/` reserves:
// `if.then`, `if.else`, `if.end`, suffixed `.N` on reuse, with the blocks
// placed in control-flow order. Every placed block ends in a terminator — a
// block that cannot fall through is left alone, and the exit block of an
// infinite loop ends in `unreachable`. Values that merge from two arms use
// `phi`; mutable locals already live in allocas, so loops load and store them
// and `mem2reg` builds the loop phis later.

import { closeHeaderScope, openHeaderScope } from "./emit-arrays"
import { Emitter, LoopTarget } from "./emit"
import { emitScopeJoins } from "./emit-parallel"
import { emitRangedStore } from "./emit-builtins"
import {
  compoundFloatOpcode,
  compoundIntegerOpcode,
  emitIntBinary,
  loadLocal,
  storeLocal,
  targetLocal,
} from "./emit-ops"
import { unwrapParens } from "./emit-util"
import { internalErrorFor } from "./ice"
import { IRBlock } from "./ir"
import { FLAG_POSTFIX, N_BLOCK, N_CASE, N_EMPTY, N_TRUE, N_VAR, Node } from "./nodes"
import { SWITCH_COVERED } from "./program"
import { isFloat } from "./types"

// ---- Branch helpers -----------------------------------------------------------

const branch = (emitter: Emitter, target: IRBlock): void => {
  emitter.fn.emit(`br label %${target.label}`)
}

const condBranch = (emitter: Emitter, cond: string, ifTrue: IRBlock, ifFalse: IRBlock): void => {
  emitter.fn.emit(`br i1 ${cond}, label %${ifTrue.label}, label %${ifFalse.label}`)
}

/** Branch to `target` unless the current block already ended; answers whether it did branch. */
const fallThrough = (emitter: Emitter, target: IRBlock): boolean => {
  if (emitter.fn.currentBlock().terminated()) {
    return false
  }
  branch(emitter, target)
  return true
}

/** A condition the compiler can see is always taken: `while (true)`, or none at all. */
const isAlwaysTrue = (cond: Node): boolean => cond.kind === N_EMPTY || unwrapParens(cond).kind === N_TRUE

/** Emit a loop body with `loop` on the stack so `break`/`continue` find their targets. */
const emitLoopBody = (emitter: Emitter, body: Node, loop: LoopTarget): void => {
  emitter.loops.push(loop)
  emitter.emitStatement(body)
  emitter.loops.pop()
}

// ---- Statements ---------------------------------------------------------------

export const emitIf = (emitter: Emitter, stmt: Node): void => {
  const fn = emitter.fn
  const hasElse = stmt.children[2].kind !== N_EMPTY
  const thenBlock = fn.newBlock("if.then")
  const elseBlock = hasElse ? fn.newBlock("if.else") : thenBlock
  const endBlock = fn.newBlock("if.end")

  const cond = emitter.emitExpression(stmt.children[0])
  condBranch(emitter, cond, thenBlock, hasElse ? elseBlock : endBlock)

  fn.placeBlock(thenBlock)
  emitter.emitStatement(stmt.children[1])
  let reachesEnd = fallThrough(emitter, endBlock)

  if (hasElse) {
    fn.placeBlock(elseBlock)
    emitter.emitStatement(stmt.children[2])
    reachesEnd = fallThrough(emitter, endBlock) || reachesEnd
  } else {
    reachesEnd = true // the false edge of the branch lands here
  }
  // When both arms return, nothing reaches `if.end`; leave it out.
  if (reachesEnd) {
    fn.placeBlock(endBlock)
  }
}

export const emitWhile = (emitter: Emitter, stmt: Node): void => {
  const fn = emitter.fn
  const condBlock = fn.newBlock("while.cond")
  const bodyBlock = fn.newBlock("while.body")
  const endBlock = fn.newBlock("while.end")

  // WP15 section 2c: the block being emitted is the loop's preheader, so this
  // is where an array header the loop reads is loaded -- once, and into one
  // `len` that the condition below and the bounds checks in the body both read.
  openHeaderScope(emitter, stmt)
  branch(emitter, condBlock)
  fn.placeBlock(condBlock)
  condBranch(emitter, emitter.emitExpression(stmt.children[0]), bodyBlock, endBlock)

  fn.placeBlock(bodyBlock)
  const loop = new LoopTarget(endBlock, condBlock)
  emitLoopBody(emitter, stmt.children[1], loop)
  fallThrough(emitter, condBlock)

  closeHeaderScope(emitter)
  fn.placeBlock(endBlock)
  if (isAlwaysTrue(stmt.children[0]) && !loop.hasBreak) {
    fn.emit("unreachable")
  }
}

export const emitDo = (emitter: Emitter, stmt: Node): void => {
  const fn = emitter.fn
  const bodyBlock = fn.newBlock("do.body")
  const condBlock = fn.newBlock("do.cond")
  const endBlock = fn.newBlock("do.end")

  openHeaderScope(emitter, stmt)
  branch(emitter, bodyBlock)
  fn.placeBlock(bodyBlock)
  const loop = new LoopTarget(endBlock, condBlock)
  emitLoopBody(emitter, stmt.children[0], loop)
  fallThrough(emitter, condBlock)

  fn.placeBlock(condBlock)
  condBranch(emitter, emitter.emitExpression(stmt.children[1]), bodyBlock, endBlock)

  closeHeaderScope(emitter)
  fn.placeBlock(endBlock)
  if (isAlwaysTrue(stmt.children[1]) && !loop.hasBreak) {
    fn.emit("unreachable")
  }
}

/**
 * `for (init; cond; inc) body` becomes `for.cond` -> `for.body` -> `for.inc`
 * -> `for.cond`. A missing condition drops `for.cond` (the loop head is the
 * body) and a missing incrementor drops `for.inc` (`continue` jumps to the
 * head). `for.end` is placed only when something can reach it: the condition's
 * false edge or a `break`.
 */
export const emitFor = (emitter: Emitter, stmt: Node): void => {
  const fn = emitter.fn
  const initializer = stmt.children[0]
  const condition = stmt.children[1]
  const incrementor = stmt.children[2]
  const hasCond = condition.kind !== N_EMPTY
  const hasInc = incrementor.kind !== N_EMPTY
  let condBlock: IRBlock | null = null
  if (hasCond) {
    condBlock = fn.newBlock("for.cond")
  }
  const bodyBlock = fn.newBlock("for.body")
  let incBlock: IRBlock | null = null
  if (hasInc) {
    incBlock = fn.newBlock("for.inc")
  }
  const endBlock = fn.newBlock("for.end")
  const head = condBlock === null ? bodyBlock : condBlock

  if (initializer.kind === N_VAR) {
    emitter.emitVariableDeclarations(initializer.children[0])
  } else if (initializer.kind !== N_EMPTY) {
    emitter.emitExpression(initializer)
  }
  openHeaderScope(emitter, stmt)
  branch(emitter, head)

  if (condBlock !== null) {
    fn.placeBlock(condBlock)
    condBranch(emitter, emitter.emitExpression(condition), bodyBlock, endBlock)
  }

  fn.placeBlock(bodyBlock)
  const loop = new LoopTarget(endBlock, incBlock === null ? head : incBlock)
  emitLoopBody(emitter, stmt.children[3], loop)

  if (incBlock !== null) {
    fallThrough(emitter, incBlock)
    fn.placeBlock(incBlock)
    emitter.emitExpression(incrementor)
    branch(emitter, head)
  } else {
    fallThrough(emitter, head)
  }

  closeHeaderScope(emitter)
  if (hasCond || loop.hasBreak) {
    fn.placeBlock(endBlock)
    if (isAlwaysTrue(condition) && !loop.hasBreak) {
      fn.emit("unreachable")
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
 * `case 1: case 2: body`. A body that does not end in a terminator branches
 * to the next body, or out into `sw.end` from the last.
 */
export const emitSwitch = (emitter: Emitter, stmt: Node): void => {
  const fn = emitter.fn
  const clauses = stmt.children[1].children
  const bodies: (IRBlock | null)[] = []
  for (const clause of clauses) {
    if (clauseBody(clause).children.length > 0) {
      bodies.push(fn.newBlock(clause.kind === N_CASE ? "sw.case" : "sw.default"))
    } else {
      bodies.push(null)
    }
  }
  const endBlock = fn.newBlock("sw.end")

  const type = emitter.llvm(emitter.typeOf(stmt.children[0]))
  const subject = emitter.emitExpression(stmt.children[0])
  let defaultIndex = -1
  let i = 0
  while (i < clauses.length) {
    if (clauses[i].kind !== N_CASE && defaultIndex < 0) {
      defaultIndex = i
    }
    i = i + 1
  }
  const table: string[] = []
  i = 0
  while (i < clauses.length) {
    if (clauses[i].kind === N_CASE) {
      const value = emitter.program.nodeCaseValues[clauses[i].id]
      table.push(`    ${type} ${value}, label %${targetOf(bodies, endBlock, i).label}`)
    }
    i = i + 1
  }
  // A union's tag the labels name every value of has no default to take: the
  // checker proved it (`switchCoverage`), so the edge goes to `unreachable`,
  // which lets the last clause end the function and the backend drop the
  // range check in front of a jump table.
  const covered = defaultIndex < 0 && emitter.program.switchCoverage[stmt.id] === SWITCH_COVERED
  const unmatched = covered ? fn.newBlock("sw.unreachable") : endBlock
  const defaultBlock = defaultIndex < 0 ? unmatched : targetOf(bodies, endBlock, defaultIndex)
  fn.emit(`switch ${type} ${subject}, label %${defaultBlock.label} [\n${table.join("\n")}\n  ]`)

  // `sw.end` is reachable from the implicit default edge, from a `break`, and
  // from a last clause that falls out; an empty trailing clause is the same
  // edge as the second of those.
  let reachesEnd = defaultBlock === endBlock
  const target = new LoopTarget(endBlock, null)
  emitter.loops.push(target)
  i = 0
  while (i < clauses.length) {
    const body = bodies[i]
    if (body === null) {
      if (targetOf(bodies, endBlock, i) === endBlock) {
        reachesEnd = true
      }
    } else {
      fn.placeBlock(body)
      for (const statement of clauseBody(clauses[i]).children) {
        emitter.emitStatement(statement)
      }
      const next = targetOf(bodies, endBlock, i + 1)
      if (fallThrough(emitter, next) && next === endBlock) {
        reachesEnd = true
      }
    }
    i = i + 1
  }
  emitter.loops.pop()
  if (target.hasBreak) {
    reachesEnd = true
  }
  if (covered) {
    fn.placeBlock(unmatched)
    fn.emit("unreachable")
  }
  if (reachesEnd) {
    fn.placeBlock(endBlock)
  }
}

/** The `BLOCK` of a clause: after the label for a `case`, the only child for a `default`. */
const clauseBody = (clause: Node): Node => (clause.kind === N_CASE ? clause.children[1] : clause.children[0])

/** Where a label jumps: its own body, or the first one below it that exists. */
const targetOf = (bodies: (IRBlock | null)[], endBlock: IRBlock, from: i32): IRBlock => {
  let i = from
  while (i < bodies.length) {
    const body = bodies[i]
    if (body !== null) {
      return body
    }
    i = i + 1
  }
  return endBlock
}

/**
 * A labelled loop or `switch` is emitted as one, its label naming the target
 * it pushes; a labelled block pushes one of its own, which only a `break`
 * naming the label reaches, and whose `label.end` follows the block.
 */
export const emitLabeled = (emitter: Emitter, stmt: Node): void => {
  const fn = emitter.fn
  const body = stmt.children[0]
  emitter.labelNames.push(stmt.text)
  emitter.labelDepths.push(emitter.loops.length)
  if (body.kind === N_BLOCK) {
    const endBlock = fn.newBlock("label.end")
    const target = new LoopTarget(endBlock, null)
    target.labelOnly = true
    emitter.loops.push(target)
    emitter.emitStatement(body)
    emitter.loops.pop()
    if (target.hasBreak) {
      fallThrough(emitter, endBlock)
      fn.placeBlock(endBlock)
    }
  } else {
    // The loop or `switch` pushes its own target at the depth recorded above.
    emitter.emitStatement(body)
  }
  emitter.labelNames.pop()
  emitter.labelDepths.pop()
}

/**
 * The index in `loops` of what a jump's label names, which the checker proved
 * is there: a label the stack lacks is the compiler's own fault, so it ends the
 * compile with the exit-70 report rather than read below the stack.
 */
const labelled = (emitter: Emitter, label: string): i32 => {
  let i = emitter.labelNames.length - 1
  while (i >= 0 && emitter.labelNames[i] !== label) {
    i = i - 1
  }
  if (i < 0) {
    process.exit(internalErrorFor(`emitter: no enclosing label \`${label}\``, emitter.opts.json))
  }
  return emitter.labelDepths[i]
}

/**
 * Leave every loop inside `loops[at]` for it: the scopes and arenas opened
 * inside close first (WP29 P2), each walk left closes (WP32), and the
 * outermost scoped pass from `at` in is released, which frees the inner
 * passes' memory too.
 */
const leaveTo = (emitter: Emitter, at: i32): void => {
  emitScopeJoins(emitter, at + 1, true)
  let i = emitter.loops.length - 1
  while (i > at) {
    const close = emitter.loops[i].walkClose
    if (close.length > 0) {
      emitter.fn.emit(close)
    }
    i = i - 1
  }
  i = at
  while (i < emitter.loops.length && !emitter.loops[i].scopesPass()) {
    i = i + 1
  }
  if (i < emitter.loops.length) {
    emitter.releasePass(emitter.loops[i])
  }
}

/**
 * `break` leaves the innermost loop or `switch`, or what its label names, and
 * the pass of each loop it leaves.
 */
export const emitBreak = (emitter: Emitter, stmt: Node): void => {
  let at = emitter.loops.length - 1
  if (stmt.text !== "") {
    at = labelled(emitter, stmt.text)
  } else {
    while (emitter.loops[at].labelOnly) {
      at = at - 1
    }
  }
  const target = emitter.loops[at]
  target.hasBreak = true
  leaveTo(emitter, at)
  branch(emitter, target.breakBlock)
}

/**
 * `continue` looks past any enclosing `switch` for the innermost loop, or
 * goes to the loop its label names, and ends the pass of each loop it leaves.
 */
export const emitContinue = (emitter: Emitter, stmt: Node): void => {
  let at = emitter.loops.length - 1
  if (stmt.text !== "") {
    at = labelled(emitter, stmt.text)
  } else {
    while (at >= 0 && emitter.loops[at].continueBlock === null) {
      at = at - 1
    }
  }
  const target = at >= 0 ? emitter.loops[at].continueBlock : null
  if (target === null) {
    process.exit(internalErrorFor(`emitter: \`continue ${stmt.text}\` names no loop`, emitter.opts.json))
  }
  leaveTo(emitter, at)
  branch(emitter, target)
}

/** `throw e`: evaluate `e` for its effects, then trap. There is no unwinding. */
export const emitThrow = (emitter: Emitter, stmt: Node): void => {
  emitter.emitExpression(stmt.children[0])
  emitter.declare("declare void @llvm.trap()")
  emitter.fn.emit("call void @llvm.trap()")
  emitter.fn.emit("unreachable")
}

// ---- Expressions --------------------------------------------------------------

/**
 * `c ? a : b`: each arm is evaluated in its own block and the results meet in
 * a `phi`. The incoming labels are read after emitting each arm, because an
 * arm may itself contain branches (a nested `?:`, an `&&`).
 */
export const emitConditional = (emitter: Emitter, expr: Node): string => {
  const fn = emitter.fn
  const trueBlock = fn.newBlock("cond.true")
  const falseBlock = fn.newBlock("cond.false")
  const endBlock = fn.newBlock("cond.end")

  condBranch(emitter, emitter.emitExpression(expr.children[0]), trueBlock, falseBlock)

  fn.placeBlock(trueBlock)
  const whenTrue = emitter.emitExpression(expr.children[1])
  const trueEdge = fn.currentBlock().label
  branch(emitter, endBlock)

  fn.placeBlock(falseBlock)
  const whenFalse = emitter.emitExpression(expr.children[2])
  const falseEdge = fn.currentBlock().label
  branch(emitter, endBlock)

  fn.placeBlock(endBlock)
  return fn.emitValue(
    `phi ${emitter.llvm(emitter.typeOf(expr))} [ ${whenTrue}, %${trueEdge} ], [ ${whenFalse}, %${falseEdge} ]`
  )
}

/** `a && b` / `a || b`: the right operand runs only when the left did not decide the result. */
export const emitLogical = (emitter: Emitter, expr: Node): string => {
  const isAnd = expr.text === "&&"
  const fn = emitter.fn
  const rhsBlock = fn.newBlock(isAnd ? "land.rhs" : "lor.rhs")
  const endBlock = fn.newBlock(isAnd ? "land.end" : "lor.end")

  const lhs = emitter.emitExpression(expr.children[0])
  const lhsEdge = fn.currentBlock().label
  if (isAnd) {
    condBranch(emitter, lhs, rhsBlock, endBlock)
  } else {
    condBranch(emitter, lhs, endBlock, rhsBlock)
  }

  fn.placeBlock(rhsBlock)
  const rhs = emitter.emitExpression(expr.children[1])
  const rhsEdge = fn.currentBlock().label
  branch(emitter, endBlock)

  fn.placeBlock(endBlock)
  return fn.emitValue(`phi i1 [ ${isAnd ? "false" : "true"}, %${lhsEdge} ], [ ${rhs}, %${rhsEdge} ]`)
}

/** `x op= e`: JS reads `x` before evaluating `e`; the expression's value is the stored result. */
export const emitCompoundAssignment = (emitter: Emitter, expr: Node): string => {
  const local = targetLocal(emitter, expr.children[0])
  const old = loadLocal(emitter, local)
  const rhs = emitter.emitExpression(expr.children[1])
  const value = isFloat(local.type)
    ? emitter.fn.emitValue(
        `${compoundFloatOpcode(expr.text, emitter.opts.json)} ${emitter.llvm(local.type)} ${old}, ${rhs}`
      )
    : emitIntBinary(emitter, compoundIntegerOpcode(expr.text, emitter.opts.json), local.type, old, rhs, expr)
  emitRangedStore(emitter, expr, value)
  storeLocal(emitter, local, value)
  return value
}

/** `++x`/`x++`/`--x`/`x--`: postfix yields the old value, prefix the new one. */
export const emitIncDec = (emitter: Emitter, expr: Node): string => {
  const local = targetLocal(emitter, expr.children[0])
  const increment = expr.text === "++"
  const old = loadLocal(emitter, local)
  // `1.0` in LLVM's hex form; the same 64-bit pattern serves `float` and `double`.
  const value = isFloat(local.type)
    ? emitter.fn.emitValue(
        `${increment ? "fadd" : "fsub"} ${emitter.llvm(local.type)} ${old}, 0x3FF0000000000000`
      )
    : emitIntBinary(emitter, increment ? "add" : "sub", local.type, old, "1", expr)
  emitRangedStore(emitter, expr, value)
  storeLocal(emitter, local, value)
  return expr.flags === FLAG_POSTFIX ? old : value
}
