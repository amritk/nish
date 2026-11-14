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
//              %rec.sum = phi i64 [ 0, %entry ], [ <sum + x>, <step> ]
//              %rec.min / %rec.max = phi i64 ...   ; the extremes of the sums
//   (base)     T = sum + n; panic unless min >= T - MAX and max <= T - MIN;
//              ret i32 (trunc T)
//   (step)     x = fib(n - 1); n' = n - 2; record sum in min/max;
//              sum = sum + x; br label %rec.head
//
// Each parameter is a `phi` of the header, so the body reads it as before:
// a parameter is an SSA value no statement assigns. A step evaluates its `X`,
// then its arguments, the order the source evaluates them in, and loops back
// instead of calling. A base answers the sum of every `X` and its own value.
//
// Why the deferred check is exact. Say a call takes steps 1..k, whose `X`
// values are x_1..x_k, and ends on the base value b. The recursion answers
// r_k = b and r_(j-1) = x_j + r_j, a checked `+` each, evaluated on the way
// back up, deepest first. Let P_j = x_1 + ... + x_j (P_0 = 0) and
// T = P_k + b, all exact. Then r_(j-1) = T - P_(j-1) whenever every add below
// it succeeded, so the recursion panics exactly when some P_j with j < k lies
// outside [T - MAX, T - MIN], MAX and MIN being i32's. That is the test the
// base makes: `%rec.min` and `%rec.max` are the least and greatest of
// P_0..P_(k-1) (each step records the sum before adding its `X`; both start
// at P_0 = 0, so k = 0 tests 0 against the window around b, which always
// holds). The panic is the same one: every `+` here panics with
// `OVERFLOW_ADD`, and nothing the recursion does between its base and the
// failing add can be observed — the adds are all it does. What runs before
// the base runs in both forms in the same order.
//
// Why `i64` is wide enough, with plain wrapping adds. Until some exact P_j
// reaches 2^32 in magnitude no `i64` value can wrap (each x is below 2^31 in
// magnitude), so up to there the loop's values are exact. A panic-free run
// needs every P_j, j < k, and P_0 = 0 inside one window 2^32 - 1 wide, so
// such a run never gets there and its answer is exact. Otherwise let J be
// the first index with |P_J| >= 2^32. If J = k nothing was recorded wrong
// and T is exact, so the test is exact. If J < k, the next step records P_J,
// and `%rec.min` and `%rec.max` only move outward, so say max >= 2^32 (min
// is the mirror image). Whatever T has become: if T < max - 2^31, then
// T - MIN = T + 2^31 cannot wrap and is below max, so the test fails; if
// not, T >= 2^31, so T - MAX cannot wrap and is at least 1, above
// min <= 0, and the test fails. Either way it panics, as the recursion does.
//
// A function emitted this way may run deeper than its recursion could before
// the stack ran out, as tail-call elimination lets any loop do; nothing that
// completed before completes differently. A cycle in the call graph already
// takes `willreturn` off the function (`src/attributes.ts`), so the loop
// carries no promise to end.

import { condBranch } from "./emit-control"
import { Emitter } from "./emit"
import { OVERFLOW_ADD } from "./emit-ops"
import { unwrapParens } from "./emit-util"
import { FunctionFacts } from "./attributes"
import { IRBlock, paramValue } from "./ir"
import { Node } from "./nodes"
import { ACC_FUNCTION, ACC_SPLIT, ACC_STEP, FunctionSig } from "./program"

/** `i32`'s bounds, as the `i64` constants the base's test offsets `T` by. */
const I32_MAX: string = "2147483647"
const I32_MIN_NEGATED: string = "2147483648"

/** One function's loop while its body is emitted: the header and every edge back into it. */
export class RecursionLoop {
  head: IRBlock
  /** The parameters' names and LLVM types, in order. */
  names: string[]
  types: string[]
  /** For each step, the block it branches back from and what it passes. */
  edges: string[]
  args: string[][]
  sums: string[]
  mins: string[]
  maxes: string[]

  constructor(head: IRBlock, names: string[], types: string[]) {
    this.head = head
    this.names = names
    this.types = types
    this.edges = []
    this.args = []
    this.sums = []
    this.mins = []
    this.maxes = []
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
  const head = fn.newBlock("rec.head")
  fn.emit(`br label %${head.label}`)
  fn.placeBlock(head)
  emitter.accumulator = new RecursionLoop(head, sig.paramNames, types)
}

/** Close the loop: write the header's `phi`s, now that every edge back into it is known. */
export const closeAccumulation = (emitter: Emitter, acc: RecursionLoop): void => {
  const phis: string[] = []
  let i = 0
  while (i < acc.names.length) {
    const name = acc.names[i]
    let line = `${paramValue(name)} = phi ${acc.types[i]} [ %${incomingName(name)}, %entry ]`
    let e = 0
    while (e < acc.edges.length) {
      line = `${line}, [ ${acc.args[e][i]}, %${acc.edges[e]} ]`
      e = e + 1
    }
    phis.push(line)
    i = i + 1
  }
  phis.push(accumulatorPhi("%rec.sum", acc, acc.sums))
  phis.push(accumulatorPhi("%rec.min", acc, acc.mins))
  phis.push(accumulatorPhi("%rec.max", acc, acc.maxes))
  for (const line of acc.head.instructions) {
    phis.push(line)
  }
  acc.head.instructions = phis
  emitter.accumulator = null
}

/** One of the three `i64` `phi`s: 0 from the entry, `values[e]` from edge `e`. */
const accumulatorPhi = (name: string, acc: RecursionLoop, values: string[]): string => {
  let line = `${name} = phi i64 [ 0, %entry ]`
  let e = 0
  while (e < acc.edges.length) {
    line = `${line}, [ ${values[e]}, %${acc.edges[e]} ]`
    e = e + 1
  }
  return line
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
    emitBase(emitter, value)
  }
}

/** `X + self(args)` or `self(args) + Y`: `X`, the arguments, then `Y`, as the call would, and back to the header. */
const emitStep = (emitter: Emitter, acc: RecursionLoop, step: Node): void => {
  const fn = emitter.fn
  const partner = emitter.program.accumulate.partnerOf(step.id)
  const callFirst = step.children[0].id === partner
  const call = callFirst ? step.children[0] : step.children[1]
  const other = callFirst ? step.children[1] : step.children[0]
  const sig = emitter.currentSig
  let x = ""
  if (!callFirst) {
    x = emitter.emitExpression(other)
  }
  const args: string[] = []
  let i = 0
  for (const arg of call.children[1].children) {
    args.push(sig === null ? emitter.emitExpression(arg) : emitter.emitArgument(arg, sig, i))
    i = i + 1
  }
  if (callFirst) {
    x = emitter.emitExpression(other)
  }
  const wide = fn.emitValue(`sext i32 ${x} to i64`)
  const below = fn.emitValue("icmp slt i64 %rec.sum, %rec.min")
  const min = fn.emitValue("select i1 " + below + ", i64 %rec.sum, i64 %rec.min")
  const above = fn.emitValue("icmp sgt i64 %rec.sum, %rec.max")
  const max = fn.emitValue("select i1 " + above + ", i64 %rec.sum, i64 %rec.max")
  const sum = fn.emitValue(`add i64 %rec.sum, ${wide}`)
  acc.edges.push(fn.currentBlock().label)
  acc.args.push(args)
  acc.sums.push(sum)
  acc.mins.push(min)
  acc.maxes.push(max)
  fn.emit(`br label %${acc.head.label}`)
}

/** A base: the sum the steps owe plus this value, checked against every sum they recorded, then `ret`. */
const emitBase = (emitter: Emitter, value: Node): void => {
  const fn = emitter.fn
  const b = emitter.emitExpression(value)
  const wide = fn.emitValue(`sext i32 ${b} to i64`)
  const total = fn.emitValue(`add i64 %rec.sum, ${wide}`)
  const lo = fn.emitValue(`sub i64 ${total}, ${I32_MAX}`)
  const hi = fn.emitValue(`add i64 ${total}, ${I32_MIN_NEGATED}`)
  const under = fn.emitValue(`icmp slt i64 %rec.min, ${lo}`)
  const over = fn.emitValue(`icmp sgt i64 %rec.max, ${hi}`)
  const failed = fn.emitValue(`or i1 ${under}, ${over}`)
  fn.branchOnOverflow(failed, OVERFLOW_ADD, emitter.useRuntime("nish_panic_overflow"))
  const result = fn.emitValue(`trunc i64 ${total} to i32`)
  emitter.emitScopeExit()
  fn.emit(`ret i32 ${result}`)
}
