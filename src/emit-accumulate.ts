// Self-recursive checked sums, written as one loop (issue #1582). The checker
// chose the functions and their steps (`src/accumulate.ts`); this module
// writes them.
//
//   const fib = (n: i32): i32 => {
//     if (n < 2) { return n }
//     return fib(n - 1) + fib(n - 2)
//   }
//
// becomes, in outline (`docs/IR_COOKBOOK.md` has the exact IR):
//
//   entry:     br label %rec.head
//   rec.head:  %n = phi i32 [ %n.in, %entry ], [ <n - 2>, <step> ]
//              %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, <step> ]
//              %rec.last = phi i32 [ 0, %entry ], [ <x>, <step> ]
//              %rec.sum = add i32 %rec.prev, %rec.last     ; wraps
//              %rec.cold = (%rec.last | %rec.sum) < 0
//              leave when n < 2 or cold; otherwise run the step
//   rec.exit:  cold ? rec.call : base
//   (base)     ret i32 (%rec.sum + n, checked)
//   (step)     x = fib(n - 1); n' = n - 2; br label %rec.head
//   rec.call:  ret i32 (%rec.prev + (%rec.last + fib(n), checked), checked)
//
// Each parameter is a `phi` of the header, so the body reads it as before:
// a parameter is an SSA value no statement assigns. A step evaluates its `X`,
// then its arguments, the order the source evaluates them in, and loops back
// instead of calling. A base answers the sum of every `X` and its own value.
// Each step's `X` is checked when the header is entered again, and any step
// the check rejects is handed back to the recursion: `rec.call` makes that
// step's call itself.
//
// Why the result and the panic are the recursion's. Say a call takes steps
// 1..k, whose `X` values are x_1..x_k, with arguments p_1..p_k, and ends on
// the base value b. The recursion answers r_k = b and r_(j-1) = x_j + r_j, a
// checked `+` each, evaluated on the way back up, deepest first. Let
// S_j = x_1 + ... + x_j, exactly. The header's i-th entry has the arguments
// p_i, `%rec.prev` = S_(i-1) and `%rec.last` = x_i (x_0 = 0, S_(-1) = 0).
//
// While no entry was cold, every x so far is at least 0 and every S_j is
// exact and in [0, MAX]. The 0th entry is not cold. If entries 0..i-1 were
// not, `%rec.prev` = S_(i-1) is exact and in [0, MAX], so if x_i >= 0 the
// true sum lies in [0, 2 MAX], and it wraps, to a negative `%rec.sum`,
// exactly when it passes MAX. Not being cold says neither happened.
//
// A base reached with no cold entry answers S_k + b, checked. In the
// recursion every x is at least 0, so its partial sums b, b + x_k, ...,
// b + S_k never fall below b >= MIN and never fall as they go: it overflows
// exactly when the last, b + S_k, passes MAX, which is when the loop's one
// add does. A cold i-th entry makes the recursion's i-th call, of p_i, which
// answers r_i or panics as that call does, and answers
// S_(i-1) + (x_i + r_i), each checked. The inner add is the recursion's own;
// what the recursion adds after it, x_(i-1) .. x_1, is all at least 0, so
// for the same reason it overflows exactly when that add of S_(i-1) does.
// Every one of these adds panics with `OVERFLOW_ADD`, and nothing the
// recursion does between its base and the failing add can be observed: the
// adds are all it does. Each step's `X` and arguments run where the recursion
// runs them.
//
// What runs between the header and its test. Where the header's own code
// only computes (`onlyComputes`), the test is folded into the branch that
// ends it, so the hot loop takes no branch of its own: a cold entry runs that
// code once, and the call runs it again, with no effect to repeat; a panic
// that code would take is the call's to take. Otherwise the test comes first
// and the code moves to `rec.body`, so a cold entry runs none of it before
// the call does. A cold call may itself loop, and each sign change of the
// sum makes one more call, never more frames than the recursion had.
//
// A function emitted this way may run deeper than its recursion could before
// the stack ran out, as tail-call elimination lets any loop do; nothing that
// completed before completes differently. A cycle in the call graph already
// takes `willreturn` off the function (`src/attributes.ts`), so the loop
// carries no promise to end.

import { condBranch } from "./emit-control"
import { Emitter } from "./emit"
import { emitCheckedArith, OVERFLOW_ADD } from "./emit-ops"
import { unwrapParens } from "./emit-util"
import { FunctionFacts } from "./attributes"
import { internalError } from "./ice"
import { IRBlock, IRFunction, paramValue } from "./ir"
import { Node } from "./nodes"
import { ACC_FUNCTION, ACC_SPLIT, ACC_STEP, FunctionSig } from "./program"

/** One function's loop while its body is emitted: the header and every edge back into it. */
export class RecursionLoop {
  /** The function the loop is. */
  sig: FunctionSig
  /** The block that enters the header first: the function's own first block. */
  entry: string
  head: IRBlock
  /** The parameters' LLVM types, in order. */
  types: string[]
  /** For each edge back into the header, the block it leaves, the arguments it passes and the `X` it adds. */
  edges: string[]
  args: string[][]
  addends: string[]

  constructor(sig: FunctionSig, entry: string, head: IRBlock, types: string[]) {
    this.sig = sig
    this.entry = entry
    this.head = head
    this.types = types
    this.edges = []
    this.args = []
    this.addends = []
  }
}

/**
 * Whether `sig` is emitted as a loop: the checker recorded it, and nothing
 * this emitter adds to a function is in play — no debug info or wasm panic
 * sites (both name the `+` that overflowed, which the loop no longer has), no
 * arena bracket, stack object or scope a loop would have to repeat.
 */
export const emitsAsLoop = (emitter: Emitter, sig: FunctionSig, facts: FunctionFacts): boolean => {
  if (
    emitter.program.accumulate.roleOf(sig.decl.id) !== ACC_FUNCTION ||
    !sig.definedIn(emitter.program.source) ||
    emitter.isLibraryCopy(sig) ||
    emitter.debug !== null ||
    emitter.panicSites !== null ||
    facts.arenaScope ||
    facts.stackLocals.length > 0 ||
    facts.scopesAnyPass()
  ) {
    return false
  }
  for (const stack of facts.stackSites) {
    if (stack) {
      return false
    }
  }
  return true
}

/** The name an accumulating function's parameter `name` arrives under; the header's `phi` takes the parameter's own. */
export const incomingName = (name: string): string => `${name}.in`

/**
 * Open the loop: branch from the prologue to the header and start emitting
 * there. Called once the prologue is written, before the body.
 */
export const openAccumulation = (emitter: Emitter, sig: FunctionSig): void => {
  const fn = emitter.fn
  const types: string[] = []
  for (const type of sig.paramTypes) {
    types.push(emitter.llvm(type))
  }
  // The prologue must still be one block: the header's `phi`s name it as
  // the only way in that is not a step.
  const entry = fn.currentBlock()
  if (fn.blocks.length === 0 || fn.blocks[0] !== entry) {
    process.exit(internalError(`emit: \`${sig.name}\`'s loop opens after its first block (openAccumulation)`))
  }
  const head = fn.newBlock("rec.head")
  fn.emit(`br label %${head.label}`)
  fn.placeBlock(head)
  emitter.accumulator = new RecursionLoop(sig, entry.label, head, types)
}

/**
 * Close the loop once every edge back into the header is known: write the
 * header's `phi`s and its test of the last step, and the call that takes
 * over when that test fails.
 */
export const closeAccumulation = (emitter: Emitter, acc: RecursionLoop): void => {
  const fn = emitter.fn
  const lines: string[] = []
  const operands: string[] = []
  const names = acc.sig.paramNames
  for (let i = 0; i < names.length; i++) {
    const passed: string[] = []
    for (const args of acc.args) {
      passed.push(args[i])
    }
    lines.push(headPhi(acc, paramValue(names[i]), acc.types[i], `%${incomingName(names[i])}`, passed))
    operands.push(`${acc.types[i]} ${paramValue(names[i])}`)
  }
  const sums: string[] = []
  for (let e = 0; e < acc.edges.length; e++) {
    sums.push("%rec.sum")
  }
  lines.push(headPhi(acc, "%rec.prev", "i32", "0", sums))
  lines.push(headPhi(acc, "%rec.last", "i32", "0", acc.addends))
  lines.push("%rec.sum = add i32 %rec.prev, %rec.last")
  lines.push("%rec.signs = or i32 %rec.last, %rec.sum")
  lines.push("%rec.cold = icmp slt i32 %rec.signs, 0")
  const body = acc.head.instructions
  acc.head.instructions = lines
  const call = fn.newBlock("rec.call")
  if (!foldColdTest(fn, acc.head, body, call)) {
    // The body's first block does more than compute: test before it runs.
    const rest = fn.newBlock("rec.body")
    rest.instructions = body
    // The phis above name each step's block; one leaving from the header's
    // own code would now leave from `rec.body`. No step can: its tail sits
    // after the base's test or a split's branch, each a block of its own.
    for (const edge of acc.edges) {
      if (edge === acc.head.label) {
        process.exit(
          internalError(
            `emit: a step of \`${acc.sig.name}\` loops back from its own header (closeAccumulation)`
          )
        )
      }
    }
    acc.head.instructions.push(`br i1 %rec.cold, label %${call.label}, label %${rest.label}`)
    renameEdges(fn, acc.head.label, rest.label)
    placeAfter(fn, acc.head, rest)
  }
  fn.placeBlock(call)
  const answer = fn.emitValue(`call i32 @${acc.sig.name}(${operands.join(", ")})`)
  fn.emit(`ret i32 ${checkedAdd(emitter, "%rec.prev", checkedAdd(emitter, "%rec.last", answer))}`)
  emitter.accumulator = null
}

/** The header's `phi` named `value`: `entry` passes `initial`, edge `e` passes `incoming[e]`. */
const headPhi = (
  acc: RecursionLoop,
  value: string,
  type: string,
  initial: string,
  incoming: string[]
): string => {
  let line = `${value} = phi ${type} [ ${initial}, %${acc.entry} ]`
  for (let e = 0; e < acc.edges.length; e++) {
    line = `${line}, [ ${incoming[e]}, %${acc.edges[e]} ]`
  }
  return line
}

/**
 * Fold `%rec.cold` into the conditional branch that ends the header's own
 * code, when that code only computes (no call but an overflow intrinsic, no
 * store), so the hot loop takes no branch of its own; answer whether it did.
 * The header then leaves through `rec.exit` when the test fails or the
 * condition holds, and `rec.exit` sorts the two out.
 */
const foldColdTest = (fn: IRFunction, head: IRBlock, body: string[], call: IRBlock): boolean => {
  const n = body.length
  if (n === 0) {
    return false
  }
  const last = body[n - 1]
  const prefix = "br i1 "
  const sep = ", label %"
  const thenAt = last.indexOf(sep)
  if (!last.startsWith(prefix) || thenAt < 0) {
    return false
  }
  const rest = last.substring(thenAt + sep.length)
  const elseAt = rest.indexOf(sep)
  if (elseAt < 0) {
    return false
  }
  const flag = last.substring(prefix.length, thenAt)
  const whenTrue = rest.substring(0, elseAt)
  const whenFalse = untilComma(rest.substring(elseAt + sep.length))
  if (whenTrue === whenFalse) {
    return false
  }
  let k = 0
  while (k < n - 1) {
    if (!onlyComputes(body[k])) {
      return false
    }
    k = k + 1
  }
  const exit = fn.newBlock("rec.exit")
  k = 0
  while (k < n - 1) {
    head.instructions.push(body[k])
    k = k + 1
  }
  head.instructions.push(`%rec.leave = or i1 ${flag}, %rec.cold`)
  head.instructions.push(`br i1 %rec.leave, label %${exit.label}, label %${whenFalse}`)
  exit.instructions.push(`br i1 %rec.cold, label %${call.label}, label %${whenTrue}`)
  for (const block of fn.blocks) {
    if (block.label === whenTrue) {
      renamePhiEdges(block, head.label, exit.label)
    }
  }
  renameOverflowEdges(fn, head.label, exit.label)
  fn.placeBlock(exit)
  return true
}

/**
 * Put `block` right after `anchor` in `fn`: the code moved into it numbered
 * its unnamed values before every block that follows, and LLVM reads them in
 * the order they are written.
 */
const placeAfter = (fn: IRFunction, anchor: IRBlock, block: IRBlock): void => {
  const placed: IRBlock[] = []
  for (const each of fn.blocks) {
    placed.push(each)
    if (each === anchor) {
      placed.push(block)
    }
  }
  fn.blocks = placed
}

/** `text` up to its first comma: a label without the metadata a branch may carry. */
const untilComma = (text: string): string => {
  const comma = text.indexOf(",")
  return comma < 0 ? text : text.substring(0, comma)
}

/**
 * Whether instruction `line` has no effect but its value: no call or invoke
 * other than an overflow intrinsic, no store, nothing volatile or atomic.
 */
const onlyComputes = (line: string): boolean => {
  if (line.indexOf("invoke ") >= 0) {
    return false
  }
  if (line.indexOf("call ") >= 0) {
    return line.indexOf(".with.overflow.") >= 0 && line.indexOf("@llvm.") >= 0
  }
  return (
    line.indexOf("store ") < 0 &&
    line.indexOf("volatile") < 0 &&
    line.indexOf("atomic") < 0 &&
    line.indexOf("fence") < 0 &&
    line.indexOf("cmpxchg") < 0
  )
}

/** Point every `phi` edge from `from` at `to` instead, in every block but the header and in the overflow blocks still to be written. */
const renameEdges = (fn: IRFunction, from: string, to: string): void => {
  for (const block of fn.blocks) {
    if (block.label !== from) {
      renamePhiEdges(block, from, to)
    }
  }
  renameOverflowEdges(fn, from, to)
}

/** The header's branch to an overflow block now leaves from `to`: the block's `phi` of codes, written last, must say so. */
const renameOverflowEdges = (fn: IRFunction, from: string, to: string): void => {
  let k = 0
  while (k < fn.overflowEdges.length) {
    if (fn.overflowEdges[k] === from) {
      fn.overflowEdges[k] = to
    }
    k = k + 1
  }
}

/** Point `block`'s `phi` edges from `from` at `to`. */
const renamePhiEdges = (block: IRBlock, from: string, to: string): void => {
  const old = `, %${from} ]`
  const updated: string[] = []
  for (const line of block.instructions) {
    let text = line
    if (text.indexOf(" = phi ") >= 0) {
      let done = ""
      let at = text.indexOf(old)
      while (at >= 0) {
        done = `${done}${text.substring(0, at)}, %${to} ]`
        text = text.substring(at + old.length)
        at = text.indexOf(old)
      }
      text = `${done}${text}`
    }
    updated.push(text)
  }
  block.instructions = updated
}

/** The value of a `return` in an accumulating function: a step, a split between tails, or a base. */
export const emitAccumulateTail = (emitter: Emitter, acc: RecursionLoop, value: Node): void => {
  const inner = unwrapParens(value)
  const role = emitter.program.accumulate.roleOf(inner.id)
  if (role === ACC_SPLIT) {
    const fn = emitter.fn
    const whenTrue = fn.newBlock("rec.true")
    const whenFalse = fn.newBlock("rec.false")
    condBranch(emitter, emitter.emitExpression(inner.children[0]), whenTrue, whenFalse)
    fn.placeBlock(whenTrue)
    emitAccumulateTail(emitter, acc, inner.children[1])
    fn.placeBlock(whenFalse)
    emitAccumulateTail(emitter, acc, inner.children[2])
  } else if (role === ACC_STEP) {
    emitStep(emitter, acc, inner)
  } else {
    const total = checkedAdd(emitter, "%rec.sum", emitter.emitExpression(value))
    emitter.emitScopeExit()
    emitter.fn.emit(`ret i32 ${total}`)
  }
}

/**
 * `X + self(args)` or `self(args) + Y`: `X`, the arguments, then `Y`, as the
 * call would, and back to the header, which tests what this step added.
 */
const emitStep = (emitter: Emitter, acc: RecursionLoop, step: Node): void => {
  const fn = emitter.fn
  const partner = emitter.program.accumulate.partnerOf(step.id)
  const callFirst = step.children[0].id === partner
  const call = callFirst ? step.children[0] : step.children[1]
  const other = callFirst ? step.children[1] : step.children[0]
  let x = ""
  if (!callFirst) {
    x = emitter.emitExpression(other)
  }
  const args: string[] = []
  const written = call.children[1].children
  for (let i = 0; i < written.length; i++) {
    args.push(emitter.emitArgument(written[i], acc.sig, i))
  }
  if (callFirst) {
    x = emitter.emitExpression(other)
  }
  acc.edges.push(fn.currentBlock().label)
  acc.args.push(args)
  acc.addends.push(x)
  fn.emit(`br label %${acc.head.label}`)
}

/** `a + b` over `i32`, panicking with `OVERFLOW_ADD` as the checked `+` does: never `nsw`, whatever the step's proofs say. */
const checkedAdd = (emitter: Emitter, a: string, b: string): string =>
  emitCheckedArith(emitter, "add", "i32", a, b, OVERFLOW_ADD)
