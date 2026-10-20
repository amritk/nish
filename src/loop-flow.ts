/**
 * The loop pre-pass: what a union or enum variable may hold at the head of a
 * loop and after it, by TypeScript's rule rather than by every value the body
 * writes anywhere.
 *
 * The checker reads a loop's body once. Before this pass it widened each
 * variable the loop assigns to everything that might reach the head — a
 * union to its declared type, an enum to what it held before the loop and
 * every member the body writes — so a comparison after the loop that
 * TypeScript's fixpoint proves disjoint compiled here (the loop accept-gap).
 * This pass runs that fixpoint over the loop first, on sets of variants and
 * members, and the checker then reads the body from the head it found:
 *
 *   entry₀ = before;  entryₙ₊₁ = before ∪ end ∪ continues
 *   after  = entry* narrowed by the condition being false, ∪ breaks
 *
 * and for a `do`, whose body runs first, the condition reads the body's end
 * and continues. The pass is coarser than the checker everywhere it differs —
 * an assignment it cannot read leaves the variable whatever it was declared,
 * a nested loop or `switch` leaves what it writes so — and gives a loop up
 * whole (`status` "bail") on a form it does not model: a `try`, a label, a
 * destructuring, unreachable code. A variable it is unsure of, one written
 * through a path, a compound assignment or a closure, it leaves untracked, to
 * the checker's own widening.
 *
 * What the checker then finds at each `continue`, at the end of the body and
 * at each `break` must lie within what the pass imposed: that is what makes
 * the head a fixpoint of the checker's own reading. A state outside it is an
 * internal compiler error, never a silent pass.
 */

import { CheckContext, LoopFlow } from "./context"
import { isOptionalChain, unwrapParens } from "./emit-util"
import {
  enumMembersOf,
  heldMembers,
  holdKept,
  localsAssignedIn,
  narrowToVariants,
  variantsIn,
  writesLeft,
} from "./expressions"
import { internalErrorFor } from "./ice"
import {
  N_ARROW,
  N_AS,
  N_BINARY,
  N_BINDING_PATTERN,
  N_BLOCK,
  N_BREAK,
  N_CLASS,
  N_CONSTRUCTOR,
  N_CONTINUE,
  N_DO,
  N_DEFAULT,
  N_EMPTY,
  N_EXPR_STMT,
  N_FALSE,
  N_FOR,
  N_FOR_OF,
  N_FUNCTION,
  N_IDENT,
  N_IF,
  N_INDEX,
  N_LABELED,
  N_MEMBER,
  N_METHOD,
  N_NULL,
  N_PAREN,
  N_RETURN,
  N_SWITCH,
  N_THROW,
  N_TRUE,
  N_TRY,
  N_UNARY,
  N_VAR,
  N_VAR_DECL,
  N_WHILE,
  N_WITH,
  Node,
} from "./nodes"
import { Local, Scope } from "./symbols"

/** The bit a nullable union variable's `null` takes, above every variant's. */
const FLOW_NULL: i32 = 1073741824

/** The most variants or members a variable may have and be tracked. */
const FLOW_BITS: i32 = 29

/** The most rounds of the fixpoint before the pass gives the loop up. */
const FLOW_ROUNDS: i32 = 1000

/** What a loop writes and what disqualifies, read from its source before it is checked. */
class FlowScan {
  /** The variables a statement-level `x = e` assigns. */
  written: string[]
  /** The variables written any other way, or named inside a nested function. */
  disq: string[]
  /** The names a declaration inside the loop binds. */
  declared: string[]
  bail: boolean

  constructor() {
    this.written = []
    this.disq = []
    this.declared = []
    this.bail = false
  }
}

const flowAddName = (names: string[], name: string): void => {
  if (names.indexOf(name) < 0) {
    names.push(name)
  }
}

/** The variable a write through `target` lands in: `h` for `h.k[0] = v`. */
const flowRootName = (target: Node): string => {
  let node = target
  while (node.kind === N_PAREN || node.kind === N_AS || node.kind === N_MEMBER || node.kind === N_INDEX) {
    node = node.children[0]
  }
  return node.kind === N_IDENT ? node.text : ""
}

/** Every name `node` mentions, which a nested function may write. */
const flowNamesIn = (node: Node, scan: FlowScan): void => {
  if (node.kind === N_IDENT) {
    flowAddName(scan.disq, node.text)
  }
  for (const child of node.children) {
    flowNamesIn(child, scan)
  }
}

const flowScanNode = (node: Node, top: boolean, scan: FlowScan): void => {
  const kind = node.kind
  if (kind === N_TRY || kind === N_WITH || kind === N_LABELED || kind === N_BINDING_PATTERN) {
    scan.bail = true
    return
  }
  if ((kind === N_BREAK || kind === N_CONTINUE) && node.text !== "") {
    scan.bail = true
    return
  }
  if (
    kind === N_FUNCTION ||
    kind === N_ARROW ||
    kind === N_METHOD ||
    kind === N_CONSTRUCTOR ||
    kind === N_CLASS
  ) {
    flowNamesIn(node, scan)
    return
  }
  if (kind === N_VAR_DECL && node.children.length > 0) {
    flowAddName(scan.declared, node.children[0].text)
  }
  if (kind === N_BINARY && writesLeft(node.text)) {
    const target = node.children[0]
    if (top && node.text === "=" && target.kind === N_IDENT) {
      flowAddName(scan.written, target.text)
    } else {
      const root = flowRootName(target)
      if (root !== "") {
        flowAddName(scan.disq, root)
      }
    }
  }
  if (kind === N_UNARY && (node.text === "++" || node.text === "--")) {
    const root = flowRootName(node.children[0])
    if (root !== "") {
      flowAddName(scan.disq, root)
    }
  }
  let i = 0
  for (const child of node.children) {
    // A statement's own expression, and a `for`'s initializer, may assign
    // a tracked variable; an assignment anywhere else in an expression may not.
    flowScanNode(child, kind === N_EXPR_STMT || (kind === N_FOR && i === 0), scan)
    i = i + 1
  }
}

// ---- states -------------------------------------------------------------------------------
//
// A state is one set per tracked variable, a bit per variant or member; the
// empty array is a point no path reaches. A variable whose set is empty holds
// nothing there, as TypeScript's `never`, which does not make the point
// unreachable.

const flowDead = (s: i32[]): boolean => s.length === 0

const flowCopy = (s: i32[]): i32[] => {
  const out: i32[] = []
  for (const bits of s) {
    out.push(bits)
  }
  return out
}

/** A nullable union's set that holds `null` is every value: what the checker narrows `null` with no variant to. */
const flowNormal = (f: LoopFlow, k: i32, bits: i32): i32 => {
  if (!f.enums[k] && (bits & FLOW_NULL) !== 0) {
    return f.full[k]
  }
  return bits
}

const flowJoin = (f: LoopFlow, a: i32[], b: i32[]): i32[] => {
  if (flowDead(a)) {
    return flowCopy(b)
  }
  if (flowDead(b)) {
    return flowCopy(a)
  }
  const out: i32[] = []
  let k = 0
  while (k < a.length && k < b.length) {
    out.push(flowNormal(f, k, a[k] | b[k]))
    k = k + 1
  }
  return out
}

const flowMeet = (a: i32[], b: i32[]): i32[] => {
  if (flowDead(a) || flowDead(b)) {
    return []
  }
  const out: i32[] = []
  let k = 0
  while (k < a.length && k < b.length) {
    out.push(a[k] & b[k])
    k = k + 1
  }
  return out
}

/** Whether every value `a` allows, `b` allows too. */
const flowWithin = (a: i32[], b: i32[]): boolean => {
  if (flowDead(a)) {
    return true
  }
  if (flowDead(b)) {
    return false
  }
  let k = 0
  while (k < a.length && k < b.length) {
    if ((a[k] & ~b[k]) !== 0) {
      return false
    }
    k = k + 1
  }
  return true
}

const flowSet = (s: i32[], k: i32, bits: i32): i32[] => {
  if (flowDead(s)) {
    return s
  }
  const out = flowCopy(s)
  out[k] = bits
  return out
}

/** The tracked variable `name` stands for, or -1. */
const flowIndex = (f: LoopFlow, name: string): i32 => {
  let k = 0
  while (k < f.locals.length) {
    if (f.locals[k].name === name) {
      return k
    }
    k = k + 1
  }
  return -1
}

// ---- reading and imposing -----------------------------------------------------------------

/** The bit `type`, a variant or a member, takes in variable `k`'s set, or 0. */
const flowBitOf = (ctx: CheckContext, f: LoopFlow, k: i32, type: i32): i32 => {
  const members = f.members[k]
  const values = f.values[k]
  let i = 0
  while (i < members.length && i < values.length) {
    if (f.enums[k] ? ctx.table.memberValue(type) === values[i] : members[i] === type) {
      return 1 << i
    }
    i = i + 1
  }
  return 0
}

/** What the checker leaves each tracked variable in `scope`. */
const flowRead = (ctx: CheckContext, f: LoopFlow, scope: Scope): i32[] => {
  const out: i32[] = []
  let k = 0
  while (k < f.locals.length) {
    const local = f.locals[k]
    let bits = 0
    if (f.enums[k]) {
      for (const member of heldMembers(ctx, scope, local)) {
        bits = bits | flowBitOf(ctx, f, k, member)
      }
    } else if (!scope.exhausted(local)) {
      const type = scope.typeOf(local)
      const nul = ctx.table.isNullable(type) ? FLOW_NULL : 0
      const bare = ctx.table.stripNull(type)
      const base = ctx.table.stripNull(local.type)
      if (bare === base) {
        bits = f.allv[k] | nul
      } else {
        const variants = variantsIn(ctx, base, bare)
        for (const variant of variants) {
          bits = bits | flowBitOf(ctx, f, k, variant)
        }
        if (variants.length === 0) {
          bits = f.full[k]
        }
        bits = bits | nul
      }
      bits = flowNormal(f, k, bits)
    }
    out.push(bits)
    k = k + 1
  }
  return out
}

/** Narrow each tracked variable in `scope` to its set in `s`, where the checker reads it otherwise. */
const flowImpose = (ctx: CheckContext, f: LoopFlow, scope: Scope, s: i32[]): void => {
  if (flowDead(s)) {
    return
  }
  const current = flowRead(ctx, f, scope)
  let k = 0
  while (k < f.locals.length && k < s.length && k < current.length) {
    const bits = s[k]
    if (bits !== current[k]) {
      const local = f.locals[k]
      const members = f.members[k]
      if (bits === f.full[k]) {
        scope.narrow(local, local.type)
        if (f.enums[k]) {
          scope.hold(local, -1)
        }
      } else if (f.enums[k]) {
        const kept: i32[] = []
        let i = 0
        while (i < members.length) {
          if ((bits & (1 << i)) !== 0) {
            kept.push(members[i])
          }
          i = i + 1
        }
        holdKept(ctx, scope, local, kept)
      } else if (bits === f.allv[k]) {
        scope.narrow(local, ctx.table.stripNull(local.type))
      } else {
        const base = ctx.table.stripNull(local.type)
        const tags = ctx.table.tagsOf(base)
        const keptVariants: i32[] = []
        const keptTags: i32[] = []
        let i = 0
        while (i < members.length && i < tags.length) {
          if ((bits & (1 << i)) !== 0) {
            keptVariants.push(members[i])
            keptTags.push(tags[i])
          }
          i = i + 1
        }
        narrowToVariants(ctx, scope, local, keptVariants, keptTags)
      }
    }
    k = k + 1
  }
}

// ---- conditions ---------------------------------------------------------------------------

/** The enum `node` names a member of, `Kind` in `Kind.A`, when nothing in the loop shadows it; or -1. */
const flowConstEnum = (ctx: CheckContext, f: LoopFlow, node: Node): i32 => {
  const bare = unwrapParens(node)
  if (bare.kind !== N_MEMBER || isOptionalChain(bare)) {
    return -1
  }
  const owner = bare.children[0]
  if (owner.kind !== N_IDENT || f.scope.lookup(owner.text) !== null || f.declared.indexOf(owner.text) >= 0) {
    return -1
  }
  const info = ctx.program.enumNamed(owner.text)
  if (info === null || !info.hasMember(bare.text)) {
    return -1
  }
  return info.type
}

const flowConstValue = (ctx: CheckContext, node: Node): i32 => {
  const bare = unwrapParens(node)
  const info = ctx.program.enumNamed(bare.children[0].text)
  return info === null ? 0 : info.memberValue(bare.text)
}

/** The bits of variable `k` whose tag or value is `value`. */
const flowBitsValued = (f: LoopFlow, k: i32, value: i32): i32 => {
  const values = f.values[k]
  let bits = 0
  let i = 0
  while (i < values.length) {
    if (values[i] === value) {
      bits = bits | (1 << i)
    }
    i = i + 1
  }
  return bits
}

/** `s` where `test`, `x === e` or `x !== e`, comes out `whenTrue`. */
const flowEquality = (ctx: CheckContext, f: LoopFlow, test: Node, s: i32[], whenTrue: boolean): i32[] => {
  const same = test.text === "===" ? whenTrue : !whenTrue
  let side = 0
  while (side < 2) {
    const read = unwrapParens(test.children[side])
    const other = unwrapParens(test.children[1 - side])
    if (read.kind === N_IDENT) {
      const k = flowIndex(f, read.text)
      if (k >= 0 && !f.enums[k] && other.kind === N_NULL) {
        // `u !== null` leaves the variants; `u === null` leaves what held.
        return same ? s : flowSet(s, k, s[k] & ~FLOW_NULL)
      }
      if (k >= 0 && f.enums[k] && flowConstEnum(ctx, f, other) === f.locals[k].type) {
        const bits = flowBitsValued(f, k, flowConstValue(ctx, other))
        return flowSet(s, k, same ? s[k] & bits : s[k] & ~bits)
      }
    }
    if (read.kind === N_MEMBER && !isOptionalChain(read) && read.children[0].kind === N_IDENT) {
      const k = flowIndex(f, read.children[0].text)
      if (k >= 0 && !f.enums[k] && (s[k] & FLOW_NULL) === 0) {
        const base = ctx.table.stripNull(f.locals[k].type)
        if (read.text === ctx.table.tagNameOf(base) && flowConstEnum(ctx, f, other) === ctx.table.tagEnumOf(base)) {
          const bits = flowBitsValued(f, k, flowConstValue(ctx, other))
          return flowSet(s, k, same ? s[k] & bits : s[k] & ~bits)
        }
      }
    }
    side = side + 1
  }
  return s
}

/** `s` where `cond` comes out `whenTrue`: dead where it cannot. */
const flowCond = (ctx: CheckContext, f: LoopFlow, cond: Node, s: i32[], whenTrue: boolean): i32[] => {
  if (flowDead(s)) {
    return s
  }
  if (cond.kind === N_PAREN) {
    return flowCond(ctx, f, cond.children[0], s, whenTrue)
  }
  if (cond.kind === N_UNARY && cond.text === "!") {
    return flowCond(ctx, f, cond.children[0], s, !whenTrue)
  }
  if (cond.kind === N_TRUE) {
    return whenTrue ? s : []
  }
  if (cond.kind === N_FALSE) {
    return whenTrue ? [] : s
  }
  if (cond.kind !== N_BINARY) {
    return s
  }
  const op = cond.text
  if (op === "&&" || op === "||") {
    const left = cond.children[0]
    const right = cond.children[1]
    // The right operand runs on the left's side that does not decide.
    const goes = flowCond(ctx, f, left, s, op === "&&")
    const decided = flowCond(ctx, f, left, s, op === "||")
    const through = flowCond(ctx, f, right, goes, whenTrue)
    if ((op === "&&") === whenTrue) {
      return through
    }
    return flowJoin(f, decided, through)
  }
  if (op === "===" || op === "!==") {
    return flowEquality(ctx, f, cond, s, whenTrue)
  }
  return s
}

// ---- statements ---------------------------------------------------------------------------

/** `s` after the `if` arms that both fall through: what they assign is either's, the rest what held. */
const flowJoinArms = (
  ctx: CheckContext,
  f: LoopFlow,
  stmt: Node,
  s: i32[],
  first: i32[],
  second: i32[]
): i32[] => {
  const assigned: Local[] = []
  localsAssignedIn(ctx, stmt.children[1], f.scope, assigned)
  localsAssignedIn(ctx, stmt.children[2], f.scope, assigned)
  const joined = flowJoin(f, first, second)
  const out = flowCopy(s)
  let k = 0
  while (k < f.locals.length) {
    if (assigned.indexOf(f.locals[k]) >= 0) {
      out[k] = joined[k]
    }
    k = k + 1
  }
  return out
}

const flowExec = (ctx: CheckContext, f: LoopFlow, node: Node, s: i32[]): i32[] => {
  if (flowDead(s) || f.status === "bail") {
    return s
  }
  const kind = node.kind
  if (kind === N_EMPTY || kind === N_VAR || kind === N_FUNCTION || kind === N_CLASS) {
    return s
  }
  if (kind === N_BLOCK) {
    let state = s
    let i = 0
    while (i < node.children.length) {
      if (flowDead(state)) {
        // Code no path reaches, which the checker still reads.
        f.status = "bail"
        return state
      }
      state = flowExec(ctx, f, node.children[i], state)
      i = i + 1
    }
    return state
  }
  if (kind === N_EXPR_STMT) {
    const expr = node.children[0]
    if (expr.kind === N_BINARY && expr.text === "=" && expr.children[0].kind === N_IDENT) {
      const k = flowIndex(f, expr.children[0].text)
      if (k >= 0) {
        let bits = f.full[k]
        const value = expr.children[1]
        if (f.enums[k] && flowConstEnum(ctx, f, value) === f.locals[k].type) {
          bits = flowBitsValued(f, k, flowConstValue(ctx, value))
        }
        return flowSet(s, k, bits)
      }
    }
    return s
  }
  if (kind === N_RETURN || kind === N_THROW) {
    return []
  }
  if (kind === N_BREAK) {
    f.breaks = flowJoin(f, f.breaks, s)
    return []
  }
  if (kind === N_CONTINUE) {
    f.conts = flowJoin(f, f.conts, s)
    return []
  }
  if (kind === N_IF) {
    const cond = node.children[0]
    const thenEnd = flowExec(ctx, f, node.children[1], flowCond(ctx, f, cond, s, true))
    const elseStart = flowCond(ctx, f, cond, s, false)
    if (node.children[2].kind === N_EMPTY) {
      if (flowDead(thenEnd)) {
        return elseStart
      }
      return flowJoinArms(ctx, f, node, s, thenEnd, elseStart)
    }
    const elseEnd = flowExec(ctx, f, node.children[2], elseStart)
    if (flowDead(thenEnd) && flowDead(elseEnd)) {
      return []
    }
    if (flowDead(thenEnd)) {
      return elseEnd
    }
    if (flowDead(elseEnd)) {
      return thenEnd
    }
    return flowJoinArms(ctx, f, node, s, thenEnd, elseEnd)
  }
  if (kind === N_WHILE || kind === N_DO || kind === N_FOR || kind === N_FOR_OF) {
    return flowNested(ctx, f, node, s)
  }
  if (kind === N_SWITCH) {
    return flowSwitch(ctx, f, node, s)
  }
  f.status = "bail"
  return s
}

/**
 * A `switch` inside the loop: each body starts from `s`, and a `break` out of
 * it, the last body falling out of the bottom, or a value no label names
 * reaches its end; a `continue` goes on to the loop. The labels narrow
 * nothing here, so this is never finer than what the checker finds.
 */
const flowSwitch = (ctx: CheckContext, f: LoopFlow, node: Node, s: i32[]): i32[] => {
  if (flowDead(s)) {
    return s
  }
  const breaks = f.breaks
  f.breaks = []
  let out: i32[] = []
  let hasDefault = false
  const clauses = node.children[1].children
  let i = 0
  while (i < clauses.length) {
    const clause = clauses[i]
    hasDefault = hasDefault || clause.kind === N_DEFAULT
    const body = clause.kind === N_DEFAULT ? clause.children[0] : clause.children[1]
    if (body.children.length > 0 || i === clauses.length - 1) {
      let state = s
      for (const statement of body.children) {
        if (flowDead(state)) {
          f.status = "bail"
        } else {
          state = flowExec(ctx, f, statement, state)
        }
      }
      out = flowJoin(f, out, state)
    }
    i = i + 1
  }
  if (!hasDefault) {
    out = flowJoin(f, out, s)
  }
  out = flowJoin(f, out, f.breaks)
  f.breaks = breaks
  return out
}

/**
 * A loop inside the loop: run it to its own fixpoint from `s` and leave what
 * reaches its end. The checker begins a pass of its own there, which tracks
 * every variable this one does that the inner loop writes, so this is never
 * finer than what the checker finds after it.
 */
const flowNested = (ctx: CheckContext, f: LoopFlow, node: Node, s: i32[]): i32[] => {
  if (flowDead(s)) {
    return s
  }
  const stmt = f.stmt
  const kind = f.kind
  const entry = f.entry
  const join = f.join
  const after = f.after
  const breaks = f.breaks
  const conts = f.conts
  const iterations = f.iterations
  f.stmt = node
  f.kind = node.kind === N_WHILE ? "while" : node.kind === N_DO ? "do" : node.kind === N_FOR ? "for" : "for-of"
  flowFixpoint(ctx, f, s)
  const out = f.after
  f.stmt = stmt
  f.kind = kind
  f.entry = entry
  f.join = join
  f.after = after
  f.breaks = breaks
  f.conts = conts
  f.iterations = iterations
  return out
}

// ---- the fixpoint -------------------------------------------------------------------------

/** Run the loop to its fixpoint from `before`, leaving `entry`, `join`, `after`, `breaks` and `conts` in `f`. */
const flowFixpoint = (ctx: CheckContext, f: LoopFlow, before: i32[]): void => {
  const stmt = f.stmt
  let start = before
  let cond: Node | null = null
  let body = stmt.children[1]
  if (f.kind === "for") {
    const init = stmt.children[0]
    if (init.kind === N_EXPR_STMT || (init.kind !== N_VAR && init.kind !== N_EMPTY)) {
      start = flowExec(ctx, f, init.kind === N_EXPR_STMT ? init : flowStatementOf(init), before)
    }
    cond = stmt.children[1]
    body = stmt.children[3]
  } else if (f.kind === "while") {
    cond = stmt.children[0]
  } else if (f.kind === "do") {
    body = stmt.children[0]
    cond = stmt.children[1]
  } else {
    body = stmt.children[2]
  }
  let entry = flowCopy(start)
  let rounds = 0
  while (rounds < FLOW_ROUNDS && f.status !== "bail") {
    rounds = rounds + 1
    f.breaks = []
    f.conts = []
    let bodyStart = entry
    if (f.kind !== "do" && cond !== null && cond.kind !== N_EMPTY) {
      bodyStart = flowCond(ctx, f, cond, entry, true)
    }
    const end = flowExec(ctx, f, body, bodyStart)
    const join = flowJoin(f, end, f.conts)
    let next = flowJoin(f, start, join)
    if (f.kind === "do") {
      next = flowJoin(f, start, cond === null ? join : flowCond(ctx, f, cond, join, true))
    }
    if (flowWithin(next, entry)) {
      f.iterations = rounds
      f.entry = entry
      f.join = join
      if (f.kind === "do") {
        f.after = flowJoin(f, cond === null ? [] : flowCond(ctx, f, cond, join, false), f.breaks)
      } else if (f.kind === "for-of") {
        f.after = flowJoin(f, entry, f.breaks)
      } else if (cond === null || cond.kind === N_EMPTY) {
        f.after = flowCopy(f.breaks)
      } else {
        f.after = flowJoin(f, flowCond(ctx, f, cond, entry, false), f.breaks)
      }
      return
    }
    entry = flowJoin(f, entry, next)
  }
  f.iterations = rounds
  f.status = "bail"
}

/** A `for` initializer that is a bare expression, as the statement it stands for. */
const flowStatementOf = (expr: Node): Node => {
  const stmt = new Node(N_EXPR_STMT, expr.start, expr.end)
  stmt.children.push(expr)
  return stmt
}

// ---- the hooks the checker calls ----------------------------------------------------------

/**
 * Before the checker widens a loop: choose the variables the pass tracks and
 * run it, from what they hold in `scope`. The frame is pushed by `flowHead`.
 */
export const flowBegin = (ctx: CheckContext, stmt: Node, scope: Scope, kind: string): LoopFlow => {
  const f = new LoopFlow(stmt, kind, scope, ctx.sink.count())
  const scan = new FlowScan()
  flowScanNode(stmt, false, scan)
  if (scan.bail) {
    f.status = "bail"
    return f
  }
  f.declared = scan.declared
  const assigned: Local[] = []
  localsAssignedIn(ctx, stmt, scope, assigned)
  for (const local of assigned) {
    const name = local.name
    const plain = scan.written.indexOf(name) >= 0 && scan.disq.indexOf(name) < 0 && scan.declared.indexOf(name) < 0
    const base = ctx.table.stripNull(local.type)
    let tracked = false
    const found = scope.lookup(name)
    const visible = found !== null && found === local
    if (plain && visible && ctx.table.isUnion(base)) {
      const variants = ctx.table.variantsOf(base)
      const tags = ctx.table.tagsOf(base)
      if (variants.length <= FLOW_BITS && variants.length === tags.length) {
        const values: i32[] = []
        for (const tag of tags) {
          values.push(ctx.table.memberValue(tag))
        }
        const allv = (1 << variants.length) - 1
        f.locals.push(local)
        f.enums.push(false)
        f.values.push(values)
        f.members.push(variants)
        f.allv.push(allv)
        f.full.push(ctx.table.isNullable(local.type) ? allv | FLOW_NULL : allv)
        tracked = true
      }
    } else if (plain && visible && ctx.table.isEnum(local.type)) {
      const members = enumMembersOf(ctx, local.type)
      if (members.length > 0 && members.length <= FLOW_BITS) {
        const values: i32[] = []
        for (const member of members) {
          values.push(ctx.table.memberValue(member))
        }
        const allv = (1 << members.length) - 1
        f.locals.push(local)
        f.enums.push(true)
        f.values.push(values)
        f.members.push(members)
        f.allv.push(allv)
        f.full.push(allv)
        tracked = true
      }
    }
    if (!tracked) {
      f.untracked = f.untracked + 1
    }
  }
  if (f.locals.length === 0) {
    return f
  }
  const before = flowRead(ctx, f, scope)
  flowFixpoint(ctx, f, before)
  if (f.status !== "bail") {
    f.status = "ok"
    f.active = true
  }
  return f
}

/**
 * At the loop's head, once the checker has widened it: narrow `target` to
 * what the pass found reaches the head, within what the checker's widening
 * left in `widenFrom`, and push the frame the body's `break` and `continue`
 * report to.
 */
export const flowHead = (ctx: CheckContext, f: LoopFlow, widenFrom: Scope, target: Scope): void => {
  if (f.active) {
    f.widened = flowRead(ctx, f, widenFrom)
    const imposed = flowMeet(f.entry, f.widened)
    f.imposed = flowDead(imposed) ? flowCopy(f.widened) : imposed
    flowImpose(ctx, f, target, f.imposed)
  }
  ctx.flowFrames.push(f)
}

const flowTop = (ctx: CheckContext): LoopFlow | null => {
  if (ctx.flowFrames.length === 0) {
    return null
  }
  return ctx.flowFrames[ctx.flowFrames.length - 1]
}

/** A `break` of the innermost loop, in `scope`. */
export const flowNoteBreak = (ctx: CheckContext, scope: Scope): void => {
  const f = flowTop(ctx)
  if (f !== null && f.active) {
    f.realBreaks = flowJoin(f, f.realBreaks, flowRead(ctx, f, scope))
  }
}

/** A way back to the innermost loop's head, a `continue` or the body's end, in `scope`. */
export const flowNoteBack = (ctx: CheckContext, scope: Scope): void => {
  const f = flowTop(ctx)
  if (f !== null && f.active) {
    f.realBack = flowJoin(f, f.realBack, flowRead(ctx, f, scope))
  }
}

const flowFail = (ctx: CheckContext, f: LoopFlow, what: string): void => {
  process.exit(
    internalErrorFor(
      `loop-flow: the checker found ${what} outside the fixpoint of the ${f.kind} loop at ${ctx.source.path}@${f.stmt.start}`,
      ctx.table.json
    )
  )
}

/** A `do` loop's condition, about to be read in `scope`: what the body's end and continues leave. */
export const flowDoCondition = (ctx: CheckContext, f: LoopFlow, scope: Scope): void => {
  if (!f.active) {
    return
  }
  if (ctx.sink.count() === f.errors && !flowWithin(f.realBack, f.join)) {
    flowFail(ctx, f, "a state at the end of the body")
  }
  flowImpose(ctx, f, scope, flowMeet(f.join, f.widened))
}

/** After the loop, once the checker has put back its widening: narrow `scope` to what leaves the loop. */
export const flowEnd = (ctx: CheckContext, f: LoopFlow, scope: Scope): void => {
  const top = flowTop(ctx)
  if (top !== null && top === f) {
    ctx.flowFrames.pop()
  }
  if (f.active) {
    if (ctx.sink.count() > f.errors) {
      flowImpose(ctx, f, scope, f.widened)
    } else {
      if (f.kind !== "do" && !flowWithin(f.realBack, f.imposed)) {
        flowFail(ctx, f, "a state at a way back to the head")
      }
      if (!flowWithin(f.realBreaks, f.breaks)) {
        flowFail(ctx, f, "a state at a `break`")
      }
      const after = flowMeet(f.after, f.widened)
      if (!flowDead(after)) {
        flowImpose(ctx, f, scope, after)
      }
    }
  }
  if (getenv("NISH_LOOP_FLOW_TRACE") !== null) {
    console.error(
      `loop-flow: ${ctx.source.path}@${f.stmt.start} ${f.kind} tracked=${f.locals.length} untracked=${f.untracked} iterations=${f.iterations} ${f.status}`
    )
  }
}
