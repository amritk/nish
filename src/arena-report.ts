// The arena placement report: `--emit-arena <file.json>`.
//
// Every allocation site of every function, with where its memory goes. The
// placements are decisions the escape analysis (`src/escape.ts`) and the
// attribute fixpoint (`src/attributes.ts`) have already made and the emitter
// follows; this module only reads them back, in the order the emitter applies
// them, so the report and the IR cannot disagree. It changes no byte of the IR.
//
// The answer is about the site's own function. `unscoped` means that nothing in
// this function releases the memory: it lives as long as the memory of whoever
// called the function, which a scope in a caller may still release, and which
// in `main` is the rest of the run. That is the placement a long-running
// program reads the report for (docs/LANGUAGE.md, "Arena placement").

import { AnalysisUnit, CallSite, FactsTable, FunctionFacts, LoopScope } from "./attributes"
import { isBuiltinConversion } from "./bounds"
import { builtinNameOf, dottedName, isAssignmentOperator, unwrapParens } from "./emit-util"
import {
  ArenaFinding,
  FLOW_LEAKS,
  FLOW_LOCAL,
  FLOW_RETURNED,
  isArenaUsing,
  isLoopKind,
  keptUntil,
  loopKeptReason,
  loopScopeOf,
  reclaimsReturnedString,
} from "./escape"
import { StringMap, StringSet } from "./map"
import { Node, NodeKind } from "./nodes"
import { CheckedProgram, FunctionSig } from "./program"
import { StringBuilder, addJsonQuoted } from "./strings"
import { TypeTable } from "./types"

/** No scope of the walk encloses the node: the function's own placement decides. */
const SCOPE_NONE: i32 = 0
/** The node is inside the body of a loop whose every pass is released (`LoopScope.scoped`). */
const SCOPE_PASS: i32 = 1
/** The node follows a `using a = arena()` in its block, which releases it when the block ends. */
const SCOPE_BLOCK: i32 = 2

/** One allocation site, in the order the walk meets it, which is source order. */
class ArenaSite {
  node: Node
  kind: string
  placement: string
  /** The callee's name as a diagnostic spells it, for a `call` or a `builtin`; empty otherwise. */
  callee: string
  /** The scopes around the site, which say where an accumulating site piles up and whether anything bounds it. */
  around: Around
  /** The user function a `call` site calls, or null: what `dropOf` is asked about. */
  target: FunctionSig | null
  /** What the callee leaves behind, once `pilesUp` has found the site piles up only for that. */
  drop: DropOrigin | null
  /**
   * The site runs on every pass of a loop whose pass does not release it, and
   * its memory is unreachable before the placement's release, so it piles up
   * pass after pass until then: the end of the function for `function`, the
   * end of the run for `unscoped` in `main`. The question a long-running
   * program asks first.
   */
  accumulates: boolean
  /**
   * A call whose callee returns nothing of the arena's (no `CallSite`): a site
   * only when the callee leaves a temporary behind (`dropOf`), and dropped
   * from the report otherwise.
   */
  plain: boolean

  constructor(
    node: Node,
    kind: string,
    placement: string,
    callee: string,
    accumulates: boolean,
    around: Around
  ) {
    this.node = node
    this.kind = kind
    this.placement = placement
    this.callee = callee
    this.accumulates = accumulates
    this.around = around
    this.target = null
    this.plain = false
    this.drop = null
  }
}

/**
 * The scopes the walk is inside at a node: the innermost scoped pass and
 * `using a = arena()` block around it, which are where memory goes back, and
 * the innermost loop since then whose pass releases nothing, around which a
 * site's memory piles up. `unbounded` lists the loops between the node and
 * that release, innermost last, that have nothing bounding their passes
 * (`boundedPasses`): unless a site leaves every one of them, nothing bounds its
 * pile (NL9018).
 */
class Around {
  pass: LoopScope | null
  block: Node | null
  /** The innermost loop around the node whose pass does not release it, or null: the node does not run pass after pass. */
  loop: Node | null
  /** `loop`'s scope, when it has an entry in `f.loopScopes`. */
  loopScope: LoopScope | null
  /** The loops since the release whose passes nothing bounds, outermost first. */
  unbounded: Node[]

  constructor(
    pass: LoopScope | null,
    block: Node | null,
    loop: Node | null,
    loopScope: LoopScope | null,
    unbounded: Node[]
  ) {
    this.pass = pass
    this.block = block
    this.loop = loop
    this.loopScope = loopScope
    this.unbounded = unbounded
  }
}

/**
 * The walk over one function. The three tables are the function's facts keyed
 * by node id, so each node of the body is asked about once: whether it bumps
 * the arena itself (and with which flow), whether its value escapes, and
 * whether it is a call whose memory comes from a callee.
 */
class ArenaWalk {
  program: CheckedProgram
  facts: FactsTable
  sig: FunctionSig
  f: FunctionFacts
  /** The flow of each `arenaNodes` site, or -1 for a node that is not one. */
  arenaFlow: i32[]
  escapes: boolean[]
  calls: (CallSite | null)[]
  /** Whether every call to this function releases what it leaves, but its returned string (`nish_arena_keep`). */
  reclaimed: boolean
  sites: ArenaSite[]
  unit: AnalysisUnit
  /** The type table, or null when nothing asks whether a pile is bounded. */
  table: TypeTable | null
  /** What the program's functions leave behind in their callers' memory. */
  drops: CalleeDrops

  constructor(
    unit: AnalysisUnit,
    facts: FactsTable,
    sig: FunctionSig,
    f: FunctionFacts,
    table: TypeTable | null,
    drops: CalleeDrops
  ) {
    const program = unit.program
    this.unit = unit
    this.drops = drops
    this.program = program
    this.table = table
    this.facts = facts
    this.sig = sig
    this.f = f
    const count = f.stackSites.length
    this.arenaFlow = new Array<i32>(count)
    this.escapes = new Array<boolean>(count)
    this.calls = new Array<CallSite | null>(count)
    let i = 0
    while (i < count) {
      this.arenaFlow[i] = -1
      i = i + 1
    }
    let k = 0
    while (k < f.arenaNodes.length) {
      this.arenaFlow[f.arenaNodes[k].id] = f.arenaFlows[k]
      k = k + 1
    }
    for (const node of f.escapingNodes) {
      this.escapes[node.id] = true
    }
    for (const call of f.callSites) {
      this.calls[call.node.id] = call
    }
    this.reclaimed = reclaimsReturnedString(sig, facts)
    this.sites = []
  }
}

/**
 * Where memory the function itself holds goes, once no pass and no block
 * encloses it: the order is the emitter's. A function with an arena scope
 * releases everything when it returns. Without one, a value it returns goes to
 * the caller; a function every caller reclaims releases the rest at each call;
 * a value stored into memory older than the function lives as long as that
 * memory; and anything else is `unscoped`.
 */
const framePlacement = (walk: ArenaWalk, flow: i32, escapes: boolean): string => {
  if (walk.f.arenaScope) {
    return "function"
  }
  if (flow === FLOW_RETURNED) {
    return "returned"
  }
  if (walk.reclaimed) {
    return "caller"
  }
  if (flow === FLOW_LEAKS && escapes) {
    return "kept"
  }
  return "unscoped"
}

/** The placement of a site at `node` whose memory is not a stack slot. */
const placementAt = (walk: ArenaWalk, scope: i32, flow: i32, escapes: boolean): string => {
  if (scope === SCOPE_PASS) {
    return "pass"
  }
  if (scope === SCOPE_BLOCK) {
    return "block"
  }
  return framePlacement(walk, flow, escapes)
}

/** What a site allocates, as the report names it, and the callee a call names. */
const siteKind = (node: Node): string => {
  if (node.kind === NodeKind.New) {
    const callee = node.children[0]
    return callee.text === "Array" ? "array" : "new"
  }
  if (node.kind === NodeKind.Object) {
    return "object"
  }
  if (node.kind === NodeKind.Array) {
    return "array"
  }
  if (node.kind === NodeKind.Template || node.kind === NodeKind.Binary) {
    return "string"
  }
  if (node.kind === NodeKind.Call) {
    if (dottedName(node.children[0]) === "console.log") {
      return "print"
    }
    const callee = node.children[0]
    if (callee.kind === NodeKind.Member && callee.text === "push") {
      return "push"
    }
    return "builtin"
  }
  return "builtin"
}

/**
 * The builtin a `builtin` site calls: a method by its name (`parts.join` is
 * `join`), and a plain identifier by the builtin the checker bound, so a
 * `nish:` import renamed on the way in still reads as what it allocates.
 */
const builtinName = (program: CheckedProgram, node: Node): string => {
  if (node.kind !== NodeKind.Call) {
    return ""
  }
  const callee = node.children[0]
  if (callee.kind === NodeKind.Member) {
    return callee.text
  }
  return callee.kind === NodeKind.Ident ? builtinNameOf(program, node) : dottedName(callee)
}

/**
 * Record `node` if it is a site, with the placement `scope` gives it. When the
 * innermost loop around it releases nothing per pass (`around.loop`), its
 * memory piles up until the placement's release; a stack slot is reused every
 * pass, so it never does.
 */
const visitSite = (walk: ArenaWalk, node: Node, scope: i32, around: Around): void => {
  if (node.id >= walk.arenaFlow.length) {
    return
  }
  const growing = around.loop !== null
  if (walk.f.stackSites[node.id]) {
    walk.sites.push(new ArenaSite(node, siteKind(node), "stack", "", false, around))
    return
  }
  const call = walk.calls[node.id]
  if (call !== null) {
    const callee = walk.facts.get(call.callee)
    const name = callee === null ? call.callee : callee.sourceName
    const placement = placementAt(walk, scope, call.flow, call.escapes)
    const site = new ArenaSite(node, "call", placement, name, growing && isGarbage(placement), around)
    site.target = userCallee(walk.program, node)
    walk.sites.push(site)
    return
  }
  const flow = walk.arenaFlow[node.id]
  if (flow < 0) {
    // A call whose result holds nothing of the arena's may still leave a
    // temporary behind in this function's memory: kept as a site only if so.
    const target = userCallee(walk.program, node)
    if (target !== null) {
      const placement = placementAt(walk, scope, FLOW_LOCAL, false)
      const site = new ArenaSite(
        node,
        "call",
        placement,
        target.sourceName,
        growing && isGarbage(placement),
        around
      )
      site.target = target
      site.plain = true
      walk.sites.push(site)
    }
    return
  }
  const kind = siteKind(node)
  const name = kind === "builtin" ? builtinName(walk.program, node) : ""
  const placement = placementAt(walk, scope, flow, walk.escapes[node.id])
  walk.sites.push(new ArenaSite(node, kind, placement, name, growing && isGarbage(placement), around))
}

/** The function of the program `node` calls or constructs with, or null: a builtin, a `declare function`, or not a call. */
const userCallee = (program: CheckedProgram, node: Node): FunctionSig | null => {
  if (node.kind !== NodeKind.Call && node.kind !== NodeKind.New) {
    return null
  }
  const sig = program.nodeCallees[node.id]
  return sig === null || sig.foreign() ? null : sig
}

/**
 * Whether memory with this placement is unreachable before it is released, so
 * that a site running pass after pass piles up garbage. A `returned` or `kept`
 * value is memory the program holds on to — an array it fills and hands back,
 * a field it stores — so it is not counted, even where an overwritten field
 * leaves the old value behind: the report says only what the facts prove.
 */
const isGarbage = (placement: string): boolean =>
  placement === "pass" ||
  placement === "block" ||
  placement === "function" ||
  placement === "caller" ||
  placement === "unscoped"

/**
 * The walk, which carries the innermost scope around each node the way the
 * emitter opens them: a scoped pass for a loop's body, and a block from its
 * `using a = arena()` to its end. It carries `around` beside it, whose `loop`
 * says a node runs on every pass of a loop that does not release it. A loop's
 * head, its condition and its update, runs every pass outside the bracket its
 * body takes; a `for` initialiser and a `for...of` iterable run once, before
 * it. A lifted arrow is a function of its own and is listed as one.
 */
const walkNode = (walk: ArenaWalk, program: CheckedProgram, node: Node, scope: i32, around: Around): void => {
  if (node.kind === NodeKind.Arrow) {
    return
  }
  visitSite(walk, node, scope, around)
  const isLoop = isLoopKind(node)
  const loop: LoopScope | null = isLoop ? loopScopeOf(walk.f, node) : null
  let inner = scope
  let innerAround = around
  const grown = isLoop ? growingAround(walk, node, loop, around) : around
  let i = 0
  while (i < node.children.length) {
    const child = node.children[i]
    if (node.kind === NodeKind.Block && isArenaUsing(program, child)) {
      inner = SCOPE_BLOCK
      innerAround = new Around(around.pass, child, null, null, [])
    }
    // A `for` initialiser and a `for...of` iterable run once, before the first pass.
    const once = (node.kind === NodeKind.For && i === 0) || (node.kind === NodeKind.ForOf && i === 1)
    if (!isLoop || once) {
      walkNode(
        walk,
        program,
        child,
        node.kind === NodeKind.Block ? inner : scope,
        node.kind === NodeKind.Block ? innerAround : around
      )
    } else if (loop !== null && child === loop.body && loop.scoped) {
      walkNode(walk, program, child, SCOPE_PASS, new Around(loop, around.block, null, null, []))
    } else {
      // The body of a loop whose pass nothing releases, or the head of any
      // loop: an enclosing scope still releases it, but only once this loop
      // is done, so it piles up until then, and only a count of its passes
      // bounds how much.
      walkNode(walk, program, child, scope, grown)
    }
    i = i + 1
  }
}

/** `around` inside `node`, a loop whose pass releases nothing of what `around` holds. */
const growingAround = (walk: ArenaWalk, node: Node, loop: LoopScope | null, around: Around): Around => {
  if (walk.table === null || boundedPasses(walk.unit, walk.facts, node)) {
    return new Around(around.pass, around.block, node, loop, around.unbounded)
  }
  const unbounded: Node[] = []
  for (const outer of around.unbounded) {
    unbounded.push(outer)
  }
  unbounded.push(node)
  return new Around(around.pass, around.block, node, loop, unbounded)
}

/**
 * True when what `loop`'s own header reads bounds its passes, so NL9018 stays
 * silent for it. A `for...of` is bounded unless its body can extend the
 * collection it walks (`bodyExtendsWalked`).
 * A `while`, `do` or `for` is bounded when its condition, read as a
 * top-level `&&` chain, has an ordering comparison among its conjuncts and
 * reads nothing a pass could decide at run time beyond its locals, fields and
 * constants (`readsOnly`). A call to any function of the program or of `std/`
 * makes it unbounded: `while (poll())`, `while (k < n && poll())`. So do no
 * condition at all, a top-level `||`, and a chain of equalities or flags. A
 * comparison whose operand the body never moves still counts as a bound.
 */
const boundedPasses = (unit: AnalysisUnit, facts: FactsTable, loop: Node): boolean => {
  if (loop.kind === NodeKind.ForOf) {
    return !bodyExtendsWalked(unit, facts, loop)
  }
  // `while`: condition, body; `do`: body, condition; `for`: initializer, condition, ...
  const condition = loop.kind === NodeKind.While ? loop.children[0] : loop.children[1]
  if (condition.kind === NodeKind.Empty || !readsOnly(unit.program, condition)) {
    return false
  }
  return comparesInChain(condition)
}

/** True when `call` is a numeric conversion builtin, which reads nothing but its argument. */
const isPureConversion = (program: CheckedProgram, call: Node): boolean =>
  isBuiltinConversion(program, call, "toI32") ||
  isBuiltinConversion(program, call, "toI64") ||
  isBuiltinConversion(program, call, "toU8") ||
  isBuiltinConversion(program, call, "toU16") ||
  isBuiltinConversion(program, call, "toU32") ||
  isBuiltinConversion(program, call, "toU64") ||
  isBuiltinConversion(program, call, "toF32") ||
  isBuiltinConversion(program, call, "toF64")

/**
 * True when `expr` reads only locals, fields (`.length` among them) and
 * constants, through operators and the numeric conversions: no call of the
 * program's or `std/`'s, no allocation, no element read, no assignment.
 */
const readsOnly = (program: CheckedProgram, expr: Node): boolean => {
  const kind = expr.kind
  if (
    kind === NodeKind.Ident ||
    kind === NodeKind.Number ||
    kind === NodeKind.Bigint ||
    kind === NodeKind.String ||
    kind === NodeKind.True ||
    kind === NodeKind.False ||
    kind === NodeKind.Null ||
    kind === NodeKind.This
  ) {
    return true
  }
  if (kind === NodeKind.Member || kind === NodeKind.Paren) {
    return readsOnly(program, expr.children[0])
  }
  if (kind === NodeKind.Unary) {
    return expr.text !== "++" && expr.text !== "--" && readsOnly(program, expr.children[0])
  }
  if (kind === NodeKind.Binary) {
    return (
      !isAssignmentOperator(expr.text) &&
      readsOnly(program, expr.children[0]) &&
      readsOnly(program, expr.children[1])
    )
  }
  if (kind === NodeKind.Conditional) {
    return (
      readsOnly(program, expr.children[0]) &&
      readsOnly(program, expr.children[1]) &&
      readsOnly(program, expr.children[2])
    )
  }
  if (kind === NodeKind.Call && isPureConversion(program, expr)) {
    return readsOnly(program, expr.children[1].children[0])
  }
  return false
}

/** The methods that add an element or an entry to the receiver they are called on. */
const extendsReceiver = (name: string): boolean =>
  name === "push" || name === "unshift" || name === "splice" || name === "set" || name === "add"

/**
 * True when `a` and `b` name the same collection: the same local, `this`, or
 * the same field path off the same base (`log.items`, `this.queue.items`).
 */
const sameWalked = (program: CheckedProgram, a: Node, b: Node): boolean => {
  const x = unwrapParens(a)
  const y = unwrapParens(b)
  if (x.kind !== y.kind) {
    return false
  }
  if (x.kind === NodeKind.This) {
    return true
  }
  if (x.kind === NodeKind.Ident) {
    if (x.text !== y.text) {
      return false
    }
    const lx = program.nodeLocals[x.id]
    const ly = program.nodeLocals[y.id]
    if (lx === null || ly === null) {
      return lx === null && ly === null
    }
    return lx === ly
  }
  if (x.kind === NodeKind.Member) {
    return x.text === y.text && sameWalked(program, x.children[0], y.children[0])
  }
  return false
}

/**
 * True when the `for...of` `loop`'s body can extend the collection it walks:
 * somewhere in the body the same walked expression (`sameWalked`) has an
 * element or entry added to it (`push`, `unshift`, `splice`, `set`, `add`, or a
 * write through `walked[k]`), is passed to a call or a `new` whose callee may
 * resize an array (`calleeMayResize`), or is assigned or
 * stored (an assignment's target or value, a declaration's initializer, an
 * array or object literal's element). Only those uses count; a call that
 * resizes some other array leaves the walk bounded.
 */
const bodyExtendsWalked = (unit: AnalysisUnit, facts: FactsTable, loop: Node): boolean =>
  extendsIn(unit, facts, loop.children[2], unwrapParens(loop.children[1]))

const extendsIn = (unit: AnalysisUnit, facts: FactsTable, node: Node, walked: Node): boolean => {
  if (
    node.kind === walked.kind &&
    sameWalked(unit.program, node, walked) &&
    extendingUse(unit, facts, node)
  ) {
    return true
  }
  for (const child of node.children) {
    if (extendsIn(unit, facts, child, walked)) {
      return true
    }
  }
  return false
}

/** True when the use `node` of the walked collection may add to it or hand it to code that may. */
const extendingUse = (unit: AnalysisUnit, facts: FactsTable, node: Node): boolean => {
  let use = node
  let parent = unit.parents.parentOf(use)
  while (parent !== null && parent.kind === NodeKind.Paren) {
    use = parent
    parent = unit.parents.parentOf(use)
  }
  if (parent === null) {
    return false
  }
  if (parent.kind === NodeKind.Member) {
    const call = unit.parents.parentOf(parent)
    return (
      extendsReceiver(parent.text) &&
      call !== null &&
      call.kind === NodeKind.Call &&
      call.children[0] === parent
    )
  }
  if (parent.kind === NodeKind.Index) {
    return parent.children[0] === use && assigned(unit, parent)
  }
  if (parent.kind === NodeKind.List) {
    const call = unit.parents.parentOf(parent)
    return (
      call !== null &&
      ((call.kind === NodeKind.Call && call.children[1] === parent) ||
        (call.kind === NodeKind.New && call.children[2] === parent)) &&
      calleeMayResize(unit.program, facts, call)
    )
  }
  if (parent.kind === NodeKind.Binary) {
    return isAssignmentOperator(parent.text)
  }
  if (parent.kind === NodeKind.Unary) {
    return parent.text === "++" || parent.text === "--"
  }
  if (parent.kind === NodeKind.VarDecl) {
    return parent.children[2] === use
  }
  return (
    parent.kind === NodeKind.Array || parent.kind === NodeKind.Property || parent.kind === NodeKind.Spread
  )
}

/**
 * True when the callee of `call` may resize an array (`resizesArray`, which
 * holds what its own callees do), so the collection handed to it may grow.
 * A call through a function reference (`refCalls`) may reach anything, so it
 * counts. Any other unresolved callee is a builtin, and of those only the
 * spawns append to an array they are handed, their `stdout` and `stderr`
 * (`isResizeCall`).
 */
const calleeMayResize = (program: CheckedProgram, facts: FactsTable, call: Node): boolean => {
  const callee = program.nodeCallees[call.id]
  if (callee === null) {
    // A call through a function reference is bound at run time: whatever it reaches is unknown.
    for (const through of program.refCalls) {
      if (through === call) {
        return true
      }
    }
    const name = builtinNameOf(program, call)
    return name === "spawnPiped" || name === "spawnPipedWithin"
  }
  const calleeFacts = facts.get(callee.name)
  return calleeFacts === null || calleeFacts.resizesArray
}

/** True when `node` is the target of an assignment or an update. */
const assigned = (unit: AnalysisUnit, node: Node): boolean => {
  const parent = unit.parents.parentOf(node)
  if (parent === null) {
    return false
  }
  if (parent.kind === NodeKind.Binary && isAssignmentOperator(parent.text) && parent.children[0] === node) {
    return true
  }
  return parent.kind === NodeKind.Unary && (parent.text === "++" || parent.text === "--")
}

/** True when the top-level `&&` chain of `condition` has an ordering comparison (`<`, `<=`, `>`, `>=`) as a conjunct. */
const comparesInChain = (condition: Node): boolean => {
  const e = unwrapParens(condition)
  if (e.kind !== NodeKind.Binary) {
    return false
  }
  if (e.text === "&&") {
    return comparesInChain(e.children[0]) || comparesInChain(e.children[1])
  }
  return e.text === "<" || e.text === "<=" || e.text === ">" || e.text === ">="
}

/** The scopes around a function's body: none. */
const outsideLoops = (): Around => new Around(null, null, null, null, [])

/**
 * The `--emit-arena` file: every function the program defines with a body, in
 * module order and, in a module, in declaration order followed by the
 * instantiations of its generic functions, one per line, and its sites in
 * source order.
 * The keys and their order are a contract, like `--emit-panics`':
 *
 *   {"name","symbol","module","line","sites":[...]}
 *
 * and per site `{"kind","line","column","placement"}`, followed by `"callee"`
 * for a `call` (the user function whose memory it receives) and a `builtin`,
 * and `"accumulates":true` for a site whose memory piles up pass after pass.
 * A generic function is listed once per instantiation, under its own symbol.
 */
export const arenaJson = (units: AnalysisUnit[], facts: FactsTable): string => {
  const drops = new CalleeDrops(units, facts)
  const listed: ListedFunction[] = []
  for (const unit of units) {
    const program = unit.program
    for (const sig of program.functions) {
      const f: FunctionFacts | null =
        sig.definedIn(program.source) && !sig.foreign() ? facts.get(sig.name) : null
      const body = sig.body()
      if (f === null || body === null) {
        continue
      }
      const instance = sig.instance
      if (instance !== null) {
        program.enterInstance(instance)
      }
      const walk = new ArenaWalk(unit, facts, sig, f, null, drops)
      walkNode(walk, program, body, SCOPE_NONE, outsideLoops())
      if (instance !== null) {
        program.leaveInstance()
      }
      listed.push(new ListedFunction(sig, unit, walk.sites))
    }
  }
  const reached = reachedFromPasses(drops, listed)
  const out = new StringBuilder()
  out.add('{"functions":[')
  let first = true
  for (const entry of listed) {
    const sig = entry.sig
    const source = entry.unit.program.source
    const inherits = reached.has(sig.name)
    out.add(first ? "\n" : ",\n")
    first = false
    out.add('{"name":')
    addJsonQuoted(out, sig.sourceName)
    out.add(',"symbol":')
    addJsonQuoted(out, sig.name)
    out.add(',"module":')
    addJsonQuoted(out, source.path)
    out.add(`,"line":${source.lineOf(sig.decl.start)},"sites":[`)
    let comma = false
    for (const site of entry.sites) {
      if (!reported(drops, site)) {
        continue
      }
      out.add(comma ? "," : "")
      comma = true
      out.add(`{"kind":"${site.kind}","line":${source.lineOf(site.node.start)}`)
      out.add(`,"column":${source.columnOf(site.node.start)},"placement":"${site.placement}"`)
      if (site.callee.length > 0) {
        out.add(',"callee":')
        addJsonQuoted(out, site.callee)
      }
      const accumulates =
        site.accumulates || (inherits && site.placement === "unscoped" && leftBehind(drops, entry, site.node))
      out.add(accumulates ? ',"accumulates":true}' : "}")
    }
    out.add("]}")
  }
  out.add("\n]}\n")
  return out.toText()
}

// ---- What a callee leaves behind ------------------------------------------------------------
//
// A function with no scope of its own leaves the temporaries it drops in its
// caller's memory: a string it builds and hands to a function that copies it,
// for one. When the call is in a pass that releases nothing, they pile up
// there exactly as the pass's own would, however deep the call chain that
// builds them. This is the summary the walk asks at a call: one answer per
// function, worked out the first time a call that could pile up asks for it.

/** The site where a function leaves a temporary behind, the function holding it, and how the warning names it. */
class DropOrigin {
  node: Node
  /** The site's `--emit-arena` kind: `string`, `object`, `builtin`, `call`, ... */
  kind: string
  /** The builtin or the user function a `builtin` or `call` site names; empty otherwise. */
  callee: string
  /** The function the site is in. */
  holder: FunctionSig
  unit: AnalysisUnit
  /** True when `holder` is not the root package's, so the warning cannot ask for a block inside it. */
  theirs: boolean

  constructor(
    node: Node,
    kind: string,
    callee: string,
    holder: FunctionSig,
    unit: AnalysisUnit,
    theirs: boolean
  ) {
    this.node = node
    this.kind = kind
    this.callee = callee
    this.holder = holder
    this.unit = unit
    this.theirs = theirs
  }
}

/** `CalleeDrops.state`: the function's answer is being worked out, so a call back into it answers "nothing". */
const DROPS_PENDING: i32 = -1
/** `CalleeDrops.state`: the function leaves nothing behind. */
const DROPS_NONE: i32 = -2
/** `CalleeDrops.state`: not asked yet. */
const DROPS_UNKNOWN: i32 = -3
/**
 * `CalleeDrops.state`: answered "nothing" while a function it calls back into
 * was still being worked out (`CalleeDrops.depth` holds the shallowest one), so
 * the answer stands only once that function's does.
 */
const DROPS_DEFERRED: i32 = -4

/** The memo of `dropOf`, over every module of the program, since a callee may be in any of them. */
export class CalleeDrops {
  units: AnalysisUnit[]
  facts: FactsTable
  /**
   * Per module of `units`, true when it is not the root package's (the
   * standard library, a dependency). Empty, as `--emit-arena` leaves it, when
   * every module is the program's own.
   */
  theirs: boolean[]
  /** Symbol -> the index in `units` of the module that defines it, filled on first use. */
  homes: StringMap
  homesBuilt: boolean
  /** Symbol -> a `DROPS_*` state, or the index of its origin in `origins`. */
  state: StringMap
  origins: DropOrigin[]
  /**
   * Symbol -> how many `dropOf` calls enclose it while it is `DROPS_PENDING`,
   * or the shallowest pending one it read while it is `DROPS_DEFERRED`.
   */
  depth: StringMap
  /** The `DROPS_DEFERRED` symbols, in the order they were answered. */
  deferred: string[]
  /** How many `dropOf` calls are being worked out. */
  level: i32
  /** The shallowest pending call the current one has read, or its own level when none. */
  low: i32

  constructor(units: AnalysisUnit[], facts: FactsTable) {
    this.units = units
    this.facts = facts
    this.theirs = []
    this.homes = new StringMap()
    this.homesBuilt = false
    this.state = new StringMap()
    this.origins = []
    this.depth = new StringMap()
    this.deferred = []
    this.level = 0
    this.low = 0
  }
}

/** The index in `drops.units` of the module that defines `sig`, or -1. */
const homeOf = (drops: CalleeDrops, sig: FunctionSig): i32 => {
  if (!drops.homesBuilt) {
    drops.homesBuilt = true
    let u = 0
    while (u < drops.units.length) {
      const program = drops.units[u].program
      for (const defined of program.functions) {
        if (defined.definedIn(program.source) && !defined.foreign()) {
          drops.homes.set(defined.name, u)
        }
      }
      u = u + 1
    }
  }
  return drops.homes.get(sig.name, -1)
}

/**
 * Where `sig` leaves a temporary in its caller's memory on a call, or null
 * when it leaves none. It does when it answers no memory (`returnsScalar`: a
 * function that answers memory hands what it allocates to its caller, whose
 * line it is, as `--explain-memory` reads it), has no scope of its own, its
 * callers do not reclaim it, it does not manage the arena itself, and in its
 * body, outside every scoped pass and `using a = arena()` block (`freeIn`),
 * it allocates something it neither returns nor stores, calls a function that
 * returns such a temporary (`netAllocates`, `contained`) and drops it, or calls
 * a function that leaves one behind itself, and does so on every call that
 * returns, or on every call handed one value of a parameter (`onEveryCall`).
 * A temporary built only on some calls (an error message, a table built on
 * first use, a step of a handshake) is not charged to each pass, while a
 * handler for one kind of event still is. A call back into a function still
 * being worked out answers null, so recursion settles on the other paths; a
 * null that rests on such a call is kept only once that function's answer is
 * null too, and is asked again when it is not (`settle`).
 */
const dropOf = (drops: CalleeDrops, sig: FunctionSig): DropOrigin | null => {
  const known = drops.state.get(sig.name, DROPS_UNKNOWN)
  if (known >= 0 && known < drops.origins.length) {
    return drops.origins[known]
  }
  if (known === DROPS_PENDING || known === DROPS_DEFERRED) {
    const at = drops.depth.get(sig.name, 0)
    if (at < drops.low) {
      drops.low = at
    }
    return null
  }
  if (known !== DROPS_UNKNOWN) {
    return null
  }
  const mine = drops.level
  const outer = drops.low
  const mark = drops.deferred.length
  drops.state.set(sig.name, DROPS_PENDING)
  drops.depth.set(sig.name, mine)
  drops.level = mine + 1
  drops.low = mine
  const origin = findDrop(drops, sig)
  const low = drops.low
  drops.level = mine
  drops.low = low < outer ? low : outer
  if (origin !== null) {
    drops.state.set(sig.name, drops.origins.length)
    drops.origins.push(origin)
    settle(drops, mark, DROPS_UNKNOWN)
  } else if (low >= mine) {
    drops.state.set(sig.name, DROPS_NONE)
    settle(drops, mark, DROPS_NONE)
  } else {
    drops.state.set(sig.name, DROPS_DEFERRED)
    drops.depth.set(sig.name, low)
    drops.deferred.push(sig.name)
  }
  return origin
}

/**
 * Gives every function deferred since `mark` the state `to`: `DROPS_NONE` once
 * the call they rested on answers null as well, `DROPS_UNKNOWN` (asked again
 * on its next call) once it answers a site.
 */
const settle = (drops: CalleeDrops, mark: i32, to: i32): void => {
  let k = mark
  while (k < drops.deferred.length) {
    drops.state.set(drops.deferred[k], to)
    k = k + 1
  }
  while (drops.deferred.length > mark) {
    drops.deferred.pop()
  }
}

const findDrop = (drops: CalleeDrops, sig: FunctionSig): DropOrigin | null => {
  const facts = drops.facts
  const f: FunctionFacts | null = sig.foreign() ? null : facts.get(sig.name)
  const body = sig.body()
  if (f === null || body === null || !f.returnsScalar || !f.netAllocates || f.arenaScope || f.managesArena) {
    return null
  }
  if (reclaimsReturnedString(sig, facts)) {
    return null
  }
  const home = homeOf(drops, sig)
  if (home < 0 || home >= drops.units.length) {
    return null
  }
  const unit = drops.units[home]
  const theirs = home < drops.theirs.length && drops.theirs[home]
  const program = unit.program
  const instance = sig.instance
  if (instance !== null) {
    program.enterInstance(instance)
  }
  let origin: DropOrigin | null = null
  let k = 0
  while (origin === null && k < f.arenaNodes.length) {
    const node = f.arenaNodes[k]
    if (f.arenaFlows[k] === FLOW_LOCAL && !f.stackSites[node.id] && !escapesIn(f, node)) {
      const kind = siteKind(node)
      if (kind !== "push" && onEveryCall(unit, body, node) && freeIn(unit, facts, f, body, node)) {
        origin = new DropOrigin(
          node,
          kind,
          kind === "builtin" ? builtinName(program, node) : "",
          sig,
          unit,
          theirs
        )
      }
    }
    k = k + 1
  }
  for (const call of f.callSites) {
    const callee = facts.get(call.callee)
    if (
      origin === null &&
      callee !== null &&
      callee.netAllocates &&
      callee.contained &&
      call.flow === FLOW_LOCAL &&
      !call.escapes &&
      onEveryCall(unit, body, call.node) &&
      freeIn(unit, facts, f, body, call.node)
    ) {
      origin = new DropOrigin(call.node, "call", callee.sourceName, sig, unit, theirs)
    }
  }
  // The calls are asked about once this instance is left: `enterInstance` does not nest.
  const calls: FunctionSig[] = []
  if (origin === null) {
    freeCalls(unit, facts, f, body, body, calls)
  }
  if (instance !== null) {
    program.leaveInstance()
  }
  for (const callee of calls) {
    if (origin === null) {
      origin = dropOf(drops, callee)
    }
  }
  return origin
}

/** True when `node` is one of `f`'s escaping sites: its value outlives the function other than by its return. */
const escapesIn = (f: FunctionFacts, node: Node): boolean => {
  for (const escaping of f.escapingNodes) {
    if (escaping === node) {
      return true
    }
  }
  return false
}

/**
 * The functions of the program that `node`, in `body`, calls where `freeIn`
 * and `onEveryCall` hold, into `out`.
 */
const freeCalls = (
  unit: AnalysisUnit,
  facts: FactsTable,
  f: FunctionFacts,
  body: Node,
  node: Node,
  out: FunctionSig[]
): void => {
  if (node.kind === NodeKind.Arrow && node !== body) {
    return
  }
  const callee = userCallee(unit.program, node)
  if (callee !== null && onEveryCall(unit, body, node) && freeIn(unit, facts, f, body, node)) {
    out.push(callee)
  }
  for (const child of node.children) {
    freeCalls(unit, facts, f, body, child, out)
  }
}

/**
 * True when `node` runs on every call of the function whose body is `body`
 * that returns, or on every such call handed one value of a parameter: nothing
 * between them branches (either side of a `?:`, the right of `&&`, `||` or
 * `??`, the passes of a loop, a `try`'s handlers, an arm of an `if` or a
 * `switch` other than one that dispatches on a parameter, `dispatches`), and
 * no statement before it in an enclosing block can leave the function
 * (`mayLeave`).
 */
const onEveryCall = (unit: AnalysisUnit, body: Node, node: Node): boolean => {
  const fn = unit.parents.parentOf(body)
  const params = paramListOf(fn)
  let at = node
  while (at !== body) {
    const parent = unit.parents.parentOf(at)
    if (parent === null || parent.kind === NodeKind.Arrow || parent.kind === NodeKind.FunctionDecl) {
      return false
    }
    const index = childIndex(parent, at)
    switch (parent.kind) {
      case NodeKind.If:
      case NodeKind.Switch:
        if (
          index !== 0 &&
          !dispatches(unit.program, params, parent.kind === NodeKind.If, parent.children[0])
        ) {
          return false
        }
        break
      case NodeKind.Conditional:
      case NodeKind.Try:
        if (index !== 0) {
          return false
        }
        break
      case NodeKind.Binary:
        if (index !== 0 && (parent.text === "&&" || parent.text === "||" || parent.text === "??")) {
          return false
        }
        break
      case NodeKind.While:
        if (index !== 0) {
          return false
        }
        break
      case NodeKind.For:
        if (index !== 0) {
          return false
        }
        break
      case NodeKind.ForOf:
        if (index !== 1) {
          return false
        }
        break
      case NodeKind.Do:
        return false
      case NodeKind.Block:
        for (const statement of parent.children) {
          if (statement === at) {
            break
          }
          if (mayLeave(statement, false)) {
            return false
          }
        }
        break
      default:
        break
    }
    at = parent
  }
  return true
}

/** The parameter list of `fn`, a function's node: a constructor's comes first, every other kind's second. */
const paramListOf = (fn: Node | null): Node | null => {
  if (fn === null || fn.children.length === 0) {
    return null
  }
  if (fn.kind === NodeKind.Constructor) {
    return fn.children[0]
  }
  return fn.children.length < 2 ? null : fn.children[1]
}

/**
 * True when `test` picks a branch by a parameter's value alone: an `if`
 * condition `p === K` or `p !== K`, or a `switch` on `p`, where `p` names one of
 * the function's `params` and `K` is a literal or a constant's name. A handler
 * that answers one kind of event is that; a branch on a field or on what a call
 * answers (a step of a state machine, an error check) is not.
 */
const dispatches = (program: CheckedProgram, params: Node | null, isIf: boolean, test: Node): boolean => {
  if (params === null) {
    return false
  }
  if (!isIf) {
    return isParam(params, test)
  }
  if (test.kind !== NodeKind.Binary || (test.text !== "===" && test.text !== "!==")) {
    return false
  }
  const left = test.children[0]
  const right = test.children[1]
  return (
    (isParam(params, left) && isConstant(program, params, right)) ||
    (isParam(params, right) && isConstant(program, params, left))
  )
}

/** True when `node` is a bare name of one of `params`. */
const isParam = (params: Node, node: Node): boolean => {
  if (node.kind !== NodeKind.Ident) {
    return false
  }
  for (const param of params.children) {
    if (param.kind === NodeKind.Param && param.children[0].text === node.text) {
      return true
    }
  }
  return false
}

/**
 * True when `node` is a literal, a name that is neither one of `params` nor a
 * `let`, or a member of a name that is no local at all: an enum's, a module
 * constant's, a namespace's.
 */
const isConstant = (program: CheckedProgram, params: Node, node: Node): boolean => {
  if (node.kind === NodeKind.Number || node.kind === NodeKind.String) {
    return true
  }
  if (node.kind === NodeKind.Ident) {
    const local = program.nodeLocals[node.id]
    return !isParam(params, node) && (local === null || !local.mutable)
  }
  return (
    node.kind === NodeKind.Member &&
    node.children[0].kind === NodeKind.Ident &&
    !isParam(params, node.children[0]) &&
    program.nodeLocals[node.children[0].id] === null
  )
}

/**
 * True when running `node` may leave the function before the statement after
 * it: a `return` or `throw` under it, or a `break` or `continue` that no loop
 * or `switch` under it takes (`nested` says one does). An arrow is another
 * function, and a labelled jump is counted wherever it is.
 */
const mayLeave = (node: Node, nested: boolean): boolean => {
  switch (node.kind) {
    case NodeKind.Arrow:
      return false
    case NodeKind.Return:
    case NodeKind.Throw:
      return true
    case NodeKind.Break:
    case NodeKind.Continue:
      return !nested || node.text.length > 0
    default:
      break
  }
  const inner = nested || isLoopKind(node) || node.kind === NodeKind.Switch
  for (const child of node.children) {
    if (mayLeave(child, inner)) {
      return true
    }
  }
  return false
}

/**
 * True when `node` is a call that ends the program, `panic` or `process.exit`
 * (unbound, so a function of the program's own by either name does not count):
 * what is built for it is never left behind for a later pass.
 */
const endsProgram = (program: CheckedProgram, node: Node): boolean => {
  if (node.kind !== NodeKind.Call || program.nodeCallees[node.id] !== null) {
    return false
  }
  const callee = node.children[0]
  const name = callee.kind === NodeKind.Member ? dottedName(callee) : builtinName(program, node)
  return name === "panic" || name === "process.exit"
}

/**
 * True when `block` ends the program after its statement `at` on every path
 * that does not throw: a later statement is a call `endsProgram` names, and
 * neither `at` nor a statement between them can leave the block first. A
 * message built in a statement of its own before `panic(message)` is that.
 */
const endsAfter = (program: CheckedProgram, block: Node, at: Node): boolean => {
  let after = false
  for (const statement of block.children) {
    if (after) {
      if (
        statement.kind === NodeKind.ExprStmt &&
        statement.children.length > 0 &&
        endsProgram(program, statement.children[0])
      ) {
        return true
      }
      if (mayLeave(statement, false)) {
        return false
      }
    } else if (statement === at) {
      if (mayLeave(statement, false)) {
        return false
      }
      after = true
    }
  }
  return false
}

/**
 * True when what `node` allocates stays in the memory of whoever called the
 * function whose body is `body`: no scoped pass and no `using a = arena()`
 * block of the function's releases it first, and it is not built for a call
 * that ends the program (`endsProgram`), or before one that ends it
 * (`endsAfter`). A site under a loop of the
 * function's own whose passes nothing bounds is not counted: it is that loop's
 * pile, which NL9018 names at the loop, not the caller's.
 */
const freeIn = (unit: AnalysisUnit, facts: FactsTable, f: FunctionFacts, body: Node, node: Node): boolean => {
  const program = unit.program
  let at = node
  while (at !== body) {
    const parent = unit.parents.parentOf(at)
    if (parent === null || parent.kind === NodeKind.Arrow || parent.kind === NodeKind.FunctionDecl) {
      return false
    }
    if (endsProgram(program, parent)) {
      return false
    }
    if (parent.kind === NodeKind.Block) {
      if (endsAfter(program, parent, at)) {
        return false
      }
      for (const statement of parent.children) {
        if (statement === at) {
          break
        }
        if (isArenaUsing(program, statement)) {
          return false
        }
      }
    } else if (isLoopKind(parent)) {
      const index = childIndex(parent, at)
      const once =
        (parent.kind === NodeKind.For && index === 0) || (parent.kind === NodeKind.ForOf && index === 1)
      if (!once) {
        const scope = loopScopeOf(f, parent)
        if ((scope !== null && scope.scoped && at === scope.body) || !boundedPasses(unit, facts, parent)) {
          return false
        }
      }
    }
    at = parent
  }
  return true
}

/**
 * The functions `--emit-arena` marks as reached from a pass that releases
 * nothing: the callee of every accumulating `call` site that leaves something
 * behind (`dropOf`), and from each of those the callees of its `unscoped` call
 * sites that leave something and that NL9018's rule charges to every call
 * (`leftBehind`), at any depth. Their `unscoped` sites that rule charges pile
 * up in that pass's memory, so the report marks them too.
 */
const reachedFromPasses = (drops: CalleeDrops, listed: ListedFunction[]): StringSet => {
  const index = new StringMap()
  let i = 0
  while (i < listed.length) {
    index.set(listed[i].sig.name, i)
    i = i + 1
  }
  const reached = new StringSet()
  const work: string[] = []
  for (const entry of listed) {
    for (const site of entry.sites) {
      const target = site.target
      if (site.accumulates && target !== null && dropOf(drops, target) !== null && reached.add(target.name)) {
        work.push(target.name)
      }
    }
  }
  let w = 0
  while (w < work.length) {
    const at = index.get(work[w], -1)
    w = w + 1
    if (at >= 0 && at < listed.length) {
      const entry = listed[at]
      for (const site of entry.sites) {
        const target = site.target
        if (
          site.placement === "unscoped" &&
          target !== null &&
          dropOf(drops, target) !== null &&
          leftBehind(drops, entry, site.node) &&
          reached.add(target.name)
        ) {
          work.push(target.name)
        }
      }
    }
  }
  return reached
}

/**
 * True when `node`, a site of `entry`'s, is left in the memory of whoever calls
 * it on every call that returns, by the rule `findDrop` applies to its own
 * sites (`onEveryCall`, `freeIn`).
 */
const leftBehind = (drops: CalleeDrops, entry: ListedFunction, node: Node): boolean => {
  const sig = entry.sig
  const f: FunctionFacts | null = sig.foreign() ? null : drops.facts.get(sig.name)
  const body = sig.body()
  if (f === null || body === null) {
    return false
  }
  const instance = sig.instance
  if (instance !== null) {
    entry.unit.program.enterInstance(instance)
  }
  const left = onEveryCall(entry.unit, body, node) && freeIn(entry.unit, drops.facts, f, body, node)
  if (instance !== null) {
    entry.unit.program.leaveInstance()
  }
  return left
}

/** True when `site` belongs in the report: a plain call only when its callee leaves something behind. */
const reported = (drops: CalleeDrops, site: ArenaSite): boolean => {
  const target = site.target
  return !site.plain || (target !== null && dropOf(drops, target) !== null)
}

/** One function `--emit-arena` lists, and its sites. */
class ListedFunction {
  sig: FunctionSig
  unit: AnalysisUnit
  sites: ArenaSite[]

  constructor(sig: FunctionSig, unit: AnalysisUnit, sites: ArenaSite[]) {
    this.sig = sig
    this.unit = unit
    this.sites = sites
  }
}

// ---- The unbounded-pass diagnostic (NL9018) -----------------------------------------------
//
// A performance warning read off the sites `--emit-arena` marks
// `"accumulates":true`; every site it names is one the audit file marks. Of
// those, it keeps the ones nothing bounds: some loop between the site and the
// scope that releases its memory has nothing in its header bounding its passes
// (`boundedPasses`). That is the shape of a request loop that builds a
// temporary per request: the pile grows for as long as the program serves.

/** One loop the warning names, and the sites it keeps that nothing bounds. */
class UnboundedLoop {
  first: ArenaSite
  more: i32

  constructor(first: ArenaSite) {
    this.first = first
    this.more = 0
  }
}

/**
 * The NL9018 warnings of one module: one per loop whose pass releases nothing,
 * at that loop, for the accumulating sites inside it that nothing
 * bounds. `named` holds where the module's other retention warnings start; a
 * site one of them already reports is left to that warning (`reportedElsewhere`).
 */
export const unboundedPassFindings = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  named: i32[],
  drops: CalleeDrops
): ArenaFinding[] => {
  const out: ArenaFinding[] = []
  const program = unit.program
  const entry = program.entryMain
  for (const sig of program.functions) {
    const f: FunctionFacts | null =
      sig.definedIn(program.source) && !sig.foreign() ? facts.get(sig.name) : null
    const body = sig.body()
    if (f === null || body === null) {
      continue
    }
    const instance = sig.instance
    if (instance !== null) {
      program.enterInstance(instance)
    }
    const walk = new ArenaWalk(unit, facts, sig, f, table, drops)
    walkNode(walk, program, body, SCOPE_NONE, outsideLoops())
    if (instance !== null) {
      program.leaveInstance()
    }
    const loops: UnboundedLoop[] = []
    for (const site of walk.sites) {
      if (pilesUp(walk, site) && !reportedElsewhere(unit, site.node, named)) {
        noteUnbounded(loops, site)
      }
    }
    for (const loop of loops) {
      // A generic function's instances share its loops: it is named once.
      if (!namedAlready(out, loopId(loop.first))) {
        out.push(unboundedFinding(walk, entry !== null && entry === sig, loop))
      }
    }
  }
  return out
}

/**
 * Whether `site` is one the warning names: it accumulates, nothing bounds it,
 * and what it allocates is a temporary the pass drops, so a `using a = arena()`
 * block around it would be accepted. Growing an array is not counted: the
 * buffers a `push` outgrows add up to less than the array it fills, which the
 * program still holds, so they grow with what it keeps and not with its
 * passes. A call is a site of `--emit-arena` for the memory its callee may hand
 * over, but only a callee that leaves memory behind (`netAllocates`) and stores
 * none of it (`contained`) adds to the pile: an accessor that returns a pointer
 * it was given allocates nothing. Any call, whatever it returns, also adds to
 * it when its callee drops a temporary it built, itself or at any depth below
 * (`dropOf`), though it stores other memory: the block then belongs in the
 * callee, around the work that builds it.
 */
const pilesUp = (walk: ArenaWalk, site: ArenaSite): boolean => {
  if (!site.accumulates || site.kind === "push" || leavesUnbounded(walk.unit, site)) {
    return false
  }
  const id = site.node.id
  if (site.kind !== "call") {
    return walk.arenaFlow[id] === FLOW_LOCAL && !walk.escapes[id]
  }
  const call = walk.calls[id]
  if (call !== null) {
    const callee = walk.facts.get(call.callee)
    if (
      callee !== null &&
      callee.netAllocates &&
      callee.contained &&
      call.flow === FLOW_LOCAL &&
      !call.escapes
    ) {
      return true
    }
  }
  // A callee that stores some of what it allocates is not `contained`, but the
  // temporaries it drops on the way, at any depth, are this pass's all the same.
  const target = site.target
  site.drop = target === null ? null : dropOf(walk.drops, target)
  return site.drop !== null
}

/**
 * True when `site` leaves every loop around it whose passes nothing bounds, up
 * to where its memory is released, so each runs it at most once per entry and
 * only bounded loops multiply it. Leaving the innermost loop is not enough: an
 * unlabelled `break` from a `for...of` inside a `while (poll())` still runs the
 * site once per pass of the `while`.
 */
const leavesUnbounded = (unit: AnalysisUnit, site: ArenaSite): boolean => {
  for (const loop of site.around.unbounded) {
    if (!leavesLoop(unit, site.node, loop)) {
      return false
    }
  }
  return true
}

/**
 * True when every path from `node` to the end of `loop`'s pass leaves the
 * loop: a `return`, a `throw`, a `break` whose own loop is this one, or a
 * labelled `break` out of this loop or one around it.
 * Such a site runs at most once each time the loop is entered, so nothing it
 * allocates piles up pass after pass. A `continue`, or falling through to the
 * next pass, does not leave. The climb answers false at a `switch`, a `try` or
 * another loop between the site and `loop`, whose control it does not follow.
 */
const leavesLoop = (unit: AnalysisUnit, node: Node, loop: Node): boolean => {
  let at = node
  let parent = unit.parents.parentOf(at)
  while (parent !== null && parent !== loop) {
    const kind = parent.kind
    if (kind === NodeKind.Return || kind === NodeKind.Throw) {
      return true
    }
    if (
      isLoopKind(parent) ||
      kind === NodeKind.Switch ||
      kind === NodeKind.Try ||
      kind === NodeKind.Arrow ||
      kind === NodeKind.FunctionDecl
    ) {
      return false
    }
    if (kind === NodeKind.Block) {
      const rest = restLeaves(unit, parent.children, childIndex(parent, at) + 1, loop)
      if (rest === REST_LEAVES) {
        return true
      }
      if (rest === REST_CONTINUES) {
        return false
      }
    } else if (kind === NodeKind.If && parent.children[0] === at) {
      // From the condition, a branch runs next: a `continue` in either one is a path to the next pass.
      if (mustLeave(unit, parent, loop)) {
        return true
      }
      if (mayContinue(parent.children[1], true) || mayContinue(parent.children[2], true)) {
        return false
      }
    }
    at = parent
    parent = unit.parents.parentOf(at)
  }
  return false
}

/** The statements after a site leave the loop on every path. */
const REST_LEAVES: i32 = 1
/** A `continue` among them may start the next pass, so the site's path can reach it. */
const REST_CONTINUES: i32 = 2
/** Some path runs off their end into whatever follows the block. */
const REST_FALLS: i32 = 0

/** The position of `child` among `parent`'s children. */
const childIndex = (parent: Node, child: Node): i32 => {
  let i = 0
  while (i < parent.children.length && parent.children[i] !== child) {
    i = i + 1
  }
  return i
}

/**
 * Where the statements of `list` from `from` on go: `REST_LEAVES` when they
 * leave `loop` on every path, `REST_CONTINUES` when one may reach its next
 * pass by a `continue`, and `REST_FALLS` when a path runs off their end.
 */
const restLeaves = (unit: AnalysisUnit, list: Node[], from: i32, loop: Node): i32 => {
  let i = 0
  for (const statement of list) {
    if (i >= from) {
      if (mayContinue(statement, true)) {
        return REST_CONTINUES
      }
      if (mustLeave(unit, statement, loop)) {
        return REST_LEAVES
      }
    }
    i = i + 1
  }
  return REST_FALLS
}

/** True when every path through `statement` leaves `loop` and none reaches its next pass. */
const mustLeave = (unit: AnalysisUnit, statement: Node, loop: Node): boolean => {
  const kind = statement.kind
  if (kind === NodeKind.Return || kind === NodeKind.Throw) {
    return true
  }
  if (kind === NodeKind.Break) {
    return statement.text === "" ? breaksOut(unit, statement, loop) : labelsAround(unit, loop, statement.text)
  }
  if (kind === NodeKind.Block) {
    return restLeaves(unit, statement.children, 0, loop) === REST_LEAVES
  }
  if (kind === NodeKind.If) {
    return (
      !mayContinue(statement.children[0], true) &&
      mustLeave(unit, statement.children[1], loop) &&
      mustLeave(unit, statement.children[2], loop)
    )
  }
  return false
}

/** True when the unlabelled `brk` ends `loop` itself: the innermost loop around it, with no `switch` it would end first. */
const breaksOut = (unit: AnalysisUnit, brk: Node, loop: Node): boolean => {
  let at = unit.parents.parentOf(brk)
  while (at !== null) {
    if (isLoopKind(at)) {
      return at === loop
    }
    if (at.kind === NodeKind.Switch || at.kind === NodeKind.Arrow || at.kind === NodeKind.FunctionDecl) {
      return false
    }
    at = unit.parents.parentOf(at)
  }
  return false
}

/** True when a `label:` names `loop` or a statement around it, so `break label` leaves `loop`. */
const labelsAround = (unit: AnalysisUnit, loop: Node, label: string): boolean => {
  let at = unit.parents.parentOf(loop)
  while (at !== null) {
    if (at.kind === NodeKind.Labeled && at.text === label) {
      return true
    }
    at = unit.parents.parentOf(at)
  }
  return false
}

/**
 * True when `node` holds a `continue` that may start the next pass of the loop
 * around it: an unlabelled one outside any loop of its own (`direct`), or any
 * labelled one. A lifted arrow is a function of its own.
 */
const mayContinue = (node: Node, direct: boolean): boolean => {
  if (node.kind === NodeKind.Continue) {
    return direct || node.text !== ""
  }
  if (node.kind === NodeKind.Arrow || node.kind === NodeKind.FunctionDecl) {
    return false
  }
  const inner = direct && !isLoopKind(node)
  for (const child of node.children) {
    if (mayContinue(child, inner)) {
      return true
    }
  }
  return false
}

/** Count `site` under the loop it piles up around, or start that loop's entry. */
const noteUnbounded = (loops: UnboundedLoop[], site: ArenaSite): void => {
  for (const loop of loops) {
    if (loopId(loop.first) === loopId(site)) {
      loop.more = loop.more + 1
      return
    }
  }
  loops.push(new UnboundedLoop(site))
}

/** The id of the loop `site` piles up around, or -1 outside every loop. */
const loopId = (site: ArenaSite): i32 => {
  const loop = site.around.loop
  return loop === null ? -1 : loop.id
}

/**
 * True when another retention warning starts where `node` or an expression or
 * statement holding it starts: NL9002, NL9003 and NL9016 sit on the target of
 * the assignment whose value the site is, NL9011 on the call. The climb stops
 * at the loop or block around the site, so a site that merely shares a line
 * with a warning is still reported, and one written on the line after its
 * assignment's target is not reported twice.
 */
const reportedElsewhere = (unit: AnalysisUnit, node: Node, named: i32[]): boolean => {
  let at: Node | null = node
  while (at !== null) {
    const kind = at.kind
    if (
      kind === NodeKind.Block ||
      kind === NodeKind.While ||
      kind === NodeKind.Do ||
      kind === NodeKind.For ||
      kind === NodeKind.ForOf
    ) {
      return false
    }
    if (named.indexOf(at.start) >= 0) {
      return true
    }
    at = unit.parents.parentOf(at)
  }
  return false
}

const namedAlready = (out: ArenaFinding[], id: i32): boolean => {
  for (const finding of out) {
    if (finding.node.id === id) {
      return true
    }
  }
  return false
}

/** The warning for one loop: where its passes' memory goes back, why no pass releases it, and the rewrite. */
const unboundedFinding = (walk: ArenaWalk, isMain: boolean, loop: UnboundedLoop): ArenaFinding => {
  const around = loop.first.around
  const node = around.loop
  if (node === null) {
    return new ArenaFinding(loop.first.node, "")
  }
  const until = keptUntil(walk.unit, walk.f, isMain, around.pass, around.block)
  const scope = around.loopScope
  // A scoped loop keeps only what its condition or update allocates.
  let reason = "nothing proves that what a pass allocated is unreachable once it ends"
  if (scope !== null) {
    reason = scope.scoped
      ? "it is in the loop's condition or update, which run outside the scope each pass takes"
      : loopKeptReason(walk.unit, walk.facts, scope)
  }
  const what = sitePhrase(walk.program, loop.first)
  const more =
    loop.more === 0 ? " piles" : ` and ${loop.more} more allocation${loop.more === 1 ? "" : "s"} pile`
  const drop = loop.first.drop
  if (drop !== null) {
    const holder = drop.holder.sourceName
    const source = drop.unit.program.source
    const of = source === walk.program.source ? "" : ` of ${source.path}`
    const built = phraseOf(source.lineOf(drop.node.start), drop.kind, drop.callee)
    if (drop.theirs) {
      return new ArenaFinding(
        node,
        `this loop keeps what each pass allocates ${until}, because ${reason}, and nothing bounds how many ` +
          `passes it runs, so ${what} (${built}${of}, in \`${holder}\`)${more} up for as long as it runs. ` +
          `\`${holder}\` is not this program's code: move the per-pass work that calls it into a block inside ` +
          "the loop body that opens with `using a = arena()`, which the compiler refuses if anything allocated " +
          "there could outlive the block"
      )
    }
    return new ArenaFinding(
      node,
      `this loop keeps what each pass allocates ${until}, because ${reason}, and nothing bounds how many passes ` +
        `it runs, so ${what} (${built}${of}, in \`${holder}\`)${more} up for as long as it runs. Move the work ` +
        `that builds it into a block inside \`${holder}\` that opens with \`using a = arena()\`, which the ` +
        "compiler refuses if anything allocated there could outlive the block"
    )
  }
  return new ArenaFinding(
    node,
    `this loop keeps what each pass allocates ${until}, because ${reason}, and nothing bounds how many passes it ` +
      `runs, so ${what}${more} up for as long as it runs. Move the per-pass work that builds it into a block ` +
      "inside the loop body that opens with `using a = arena()`, which the compiler refuses if anything allocated " +
      "there could outlive the block"
  )
}

/** The site the warning names first, in words, by its `--emit-arena` kind. */
const sitePhrase = (program: CheckedProgram, site: ArenaSite): string =>
  phraseOf(program.source.lineOf(site.node.start), site.kind, site.callee)

/** A site of `kind` on `line`, in words; `callee` is the function or builtin a `call` or `builtin` names. */
const phraseOf = (line: i32, kind: string, callee: string): string => {
  if (kind === "call") {
    return `what \`${callee}\` leaves behind on line ${line}`
  }
  if (kind === "builtin") {
    return `what \`${callee}\` allocates on line ${line}`
  }
  if (kind === "print") {
    return `what printing on line ${line} allocates`
  }
  return `the ${kind === "new" ? "object" : kind} built on line ${line}`
}
