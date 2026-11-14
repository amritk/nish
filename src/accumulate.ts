// Self-recursive checked sums, emitted as a loop (issue #1582).
//
//   const fib = (n: i32): i32 => {
//     if (n < 2) { return n }
//     return fib(n - 1) + fib(n - 2)
//   }
//
// Every return that is not a base case is a *step*, `X + self(args)` over the
// checked `i32` `+`: the frame's answer is its own `X` plus whatever the
// recursion answers. LLVM's tail-recursion elimination folds such a return
// into a loop and an accumulator only when the `+` is a plain `add`; the
// checked one, `llvm.sadd.with.overflow` and a branch, defeats it, and `fib`
// stays a tree of two calls per frame. This module finds the functions whose
// every recursive return is a step, so `src/emit-accumulate.ts` can write the
// loop itself, with an overflow check that panics exactly when the recursion
// would (the proof is beside the emitter).
//
// A function qualifies when all of this holds, and compiles as it always did
// when any of it does not — so this module only records; it reports nothing:
//
// - It is a plain function of this module, or a method of a class of this
//   module (issue #1612): not a constructor, an instantiation, a lifted
//   arrow, async, a generator, foreign or generic, not a method of a generic
//   or atomic class, and with no compile-time, defaulted or rest parameter
//   and no captures.
// - It returns `i32`, and no parameter is ranged or a `Result`.
// - Its body is blocks, `if`, `const` / `let` (no `using`), expression
//   statements and `return`: no loop, `switch`, `try`, `throw` or `defer`,
//   and no arrow anywhere in it, so no closure can see a local.
// - Each `return` value, under parentheses and through either arm of a
//   `c ? A : B` (neither converting the value), is a step or a base, there
//   is at least one of each, and the recursion it folds is a step's own call.
//   Any other call of the function (`fib(n - 1)` in `fib`'s `X`) stays the
//   ordinary call it is. A method's self call is `r.m(a, ...)`, written with
//   `.` and not `?.`, on a receiver `r` the checker typed as the method's own
//   class: the receiver is the loop's first parameter, `this`. Nish binds
//   every method call statically (`docs/LANGUAGE.md`: no inheritance, no
//   method in an interface, no method call on a union), so that call reaches
//   this very body; a call through a function-valued field is no method call
//   and is never a step.
//   - `X + self(a, ...)` with `X` any `i32` expression. `X` is evaluated
//     before the arguments in the source and in the loop alike.
//   - `self(a, ...) + Y` with `Y` a number or a parameter: reading `Y` after
//     the recursion and reading it before are one value, because the
//     recursion cannot assign this frame's parameters.
//   - anything else is a base, whose value is what the whole sum ends on.
//
// The checker calls `recordAccumulation` once a body has checked cleanly and
// its proofs are in (`checkFunctionBody`); `forgetProofs` in `src/bounds.ts`
// takes the records back for `--no-elision`, so the soundness differential
// compares every such function with its plain recursive self.

import { CheckContext } from "./context"
import { isGenericFunction } from "./generics"
import { hasSpread } from "./members"
import { FLAG_GENERATOR, FLAG_OPTIONAL, FLAG_USING, Node, NodeKind } from "./nodes"
import {
  ACC_FUNCTION,
  ACC_SPLIT,
  ACC_STEP,
  FunctionSig,
  ROLE_FUNCTION,
  ROLE_METHOD,
  STRUCT_CLASS,
} from "./program"
import { STORAGE_PARAM } from "./symbols"
import { T_I32 } from "./types"

/** What `tailKind` found in one tail position, as a bitmask. */
const TAIL_BASE: i32 = 1
const TAIL_STEP: i32 = 2
/** `TAIL_BASE | TAIL_STEP`: a constant may not use `|`. */
const TAIL_BOTH: i32 = 3

/**
 * Record `sig` as one loop, with its steps and splits, when its body is the
 * shape the comment above describes. `body` is the checked body.
 */
export const recordAccumulation = (ctx: CheckContext, sig: FunctionSig, body: Node): void => {
  if (!signatureQualifies(ctx, sig) || containsArrow(body)) {
    return
  }
  const steps: Node[] = []
  const splits: Node[] = []
  const returns: Node[] = []
  if (body.kind === NodeKind.Block) {
    if (!collectTailValues(body, returns)) {
      return
    }
  } else {
    returns.push(body)
  }
  let seen = 0
  for (const value of returns) {
    seen = seen | tailKind(ctx, sig, value, steps, splits)
  }
  if (seen !== TAIL_BOTH) {
    return
  }
  const table = ctx.program.accumulate
  table.record(sig.decl.id, ACC_FUNCTION, sig.decl.id)
  for (const step of steps) {
    table.record(step.id, ACC_STEP, stepCall(ctx, sig, step).id)
  }
  for (const split of splits) {
    table.record(split.id, ACC_SPLIT, split.id)
  }
}

/** The declaration-level conditions: a plain `i32` function or method of this module. */
const signatureQualifies = (ctx: CheckContext, sig: FunctionSig): boolean => {
  if (
    sig.instance !== null ||
    sig.lifted ||
    !ownerQualifies(sig) ||
    sig.dispatcher ||
    sig.foreign() ||
    sig.isAsync() ||
    (sig.decl.flags & FLAG_GENERATOR) !== 0 ||
    isGenericFunction(sig.decl) ||
    sig.captures.length > 0 ||
    sig.compileTime.length > 0 ||
    sig.restIndex >= 0 ||
    sig.returnType !== T_I32
  ) {
    return false
  }
  for (let i = 0; i < sig.paramTypes.length; i++) {
    const type = sig.paramTypes[i]
    if (ctx.table.isRanged(type) || ctx.table.isResult(type) || sig.defaultOf(i) !== null) {
      return false
    }
  }
  return true
}

/** A plain function, or a method of a class that is neither generic nor atomic. */
const ownerQualifies = (sig: FunctionSig): boolean => {
  const owner = sig.owner
  if (sig.role === ROLE_FUNCTION) {
    return owner === null
  }
  if (sig.role !== ROLE_METHOD || owner === null) {
    return false
  }
  return owner.kind === STRUCT_CLASS && owner.instance === null && !owner.atomic
}

/**
 * Push the value of every `return` under `node` onto `out`, or answer false
 * for a statement the loop does not take.
 */
const collectTailValues = (node: Node, out: Node[]): boolean => {
  switch (node.kind) {
    case NodeKind.Block:
      for (const statement of node.children) {
        if (!collectTailValues(statement, out)) {
          return false
        }
      }
      return true
    case NodeKind.If:
      return (
        collectTailValues(node.children[1], out) &&
        (node.children.length < 3 || collectTailValues(node.children[2], out))
      )
    case NodeKind.Return: {
      const value = node.children[0]
      if (value.kind === NodeKind.Empty) {
        return false
      }
      out.push(value)
      return true
    }
    case NodeKind.Var:
      return (node.flags & FLAG_USING) === 0
    case NodeKind.ExprStmt:
    case NodeKind.Empty:
      return true
    default:
      return false
  }
}

/** Whether an arrow is written anywhere in `node`. */
const containsArrow = (node: Node): boolean => {
  if (node.kind === NodeKind.Arrow) {
    return true
  }
  for (const child of node.children) {
    if (containsArrow(child)) {
      return true
    }
  }
  return false
}

/**
 * What the tail value `value` is, recording each step into `steps` and each
 * conditional with a step in an arm into `splits`.
 */
const tailKind = (ctx: CheckContext, sig: FunctionSig, value: Node, steps: Node[], splits: Node[]): i32 => {
  // A parenthesis or a conditional that converts its value is a base: the
  // loop would skip the conversion, so neither is looked through.
  let inner = value
  while (inner.kind === NodeKind.Paren && isPlainI32(ctx, inner)) {
    inner = inner.children[0]
  }
  if (inner.kind === NodeKind.Conditional && isPlainI32(ctx, inner)) {
    const a = tailKind(ctx, sig, inner.children[1], steps, splits)
    const b = tailKind(ctx, sig, inner.children[2], steps, splits)
    const kind = a | b
    if (kind !== TAIL_BASE) {
      splits.push(inner)
    }
    return kind
  }
  if (isStep(ctx, sig, inner)) {
    steps.push(inner)
    return TAIL_STEP
  }
  return TAIL_BASE
}

/** Whether `node` is `X + self(...)` or `self(...) + Y` over `i32`, with every coercion absent. */
const isStep = (ctx: CheckContext, sig: FunctionSig, node: Node): boolean => {
  if (node.kind !== NodeKind.Binary || node.text !== "+") {
    return false
  }
  const left = node.children[0]
  const right = node.children[1]
  if (!isPlainI32(ctx, node) || !isPlainI32(ctx, left) || !isPlainI32(ctx, right)) {
    return false
  }
  if (isSelfCall(ctx, sig, right)) {
    return true
  }
  return isSelfCall(ctx, sig, left) && isStable(ctx, right)
}

/** The self call of a step `isStep` accepted: its right operand when that is one, else its left. */
const stepCall = (ctx: CheckContext, sig: FunctionSig, step: Node): Node => {
  const right = step.children[1]
  return isSelfCall(ctx, sig, right) ? right : step.children[0]
}

/** An `i32` value as the checker typed it, with no coercion on it. */
const isPlainI32 = (ctx: CheckContext, node: Node): boolean =>
  ctx.program.nodeTypes[node.id] === T_I32 && ctx.program.nodeCoercions[node.id] < 0

/**
 * A direct call of `sig` that passes every parameter it has: `self(a, ...)`,
 * or for a method `r.m(a, ...)` on a receiver of the method's own class.
 */
const isSelfCall = (ctx: CheckContext, sig: FunctionSig, node: Node): boolean => {
  if (node.kind !== NodeKind.Call || (node.flags & FLAG_OPTIONAL) !== 0) {
    return false
  }
  const callee = ctx.program.nodeCallees[node.id]
  if (callee === null || callee !== sig || hasSpread(node.children[1])) {
    return false
  }
  if (sig.role !== ROLE_METHOD) {
    return node.children[1].children.length === sig.writtenArity()
  }
  const access = node.children[0]
  return (
    access.kind === NodeKind.Member &&
    (access.flags & FLAG_OPTIONAL) === 0 &&
    node.children[1].children.length === sig.writtenArity() - 1 &&
    ctx.program.nodeTypes[access.children[0].id] === sig.paramTypes[0] &&
    ctx.program.nodeCoercions[access.children[0].id] < 0
  )
}

/** A value the recursion cannot change: a number, or a parameter of this function. */
const isStable = (ctx: CheckContext, node: Node): boolean => {
  if (node.kind === NodeKind.Number) {
    return true
  }
  if (node.kind !== NodeKind.Ident) {
    return false
  }
  const local = ctx.program.nodeLocals[node.id]
  return local !== null && local.storage === STORAGE_PARAM
}
