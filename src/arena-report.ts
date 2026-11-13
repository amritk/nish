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

import { AnalysisUnit, CallSite, FactsTable, FunctionFacts, isCountedLoop, LoopScope } from "./attributes"
import { builtinNameOf, dottedName } from "./emit-util"
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
  /**
   * The site runs on every pass of a loop whose pass does not release it, and
   * its memory is unreachable before the placement's release, so it piles up
   * pass after pass until then: the end of the function for `function`, the
   * end of the run for `unscoped` in `main`. The question a long-running
   * program asks first.
   */
  accumulates: boolean
  /** The scopes around the site, which say where an accumulating site piles up and whether anything bounds it. */
  around: Around

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
  }
}

/**
 * The scopes the walk is inside at a node: the innermost scoped pass and
 * `using a = arena()` block around it, which are where memory goes back, and
 * the innermost loop since then whose pass releases nothing, around which a
 * site's memory piles up. `unbounded` says some loop between the node and that
 * release has nothing bounding its passes (`boundedPasses`), so nothing bounds
 * the pile (NL9018).
 */
class Around {
  pass: LoopScope | null
  block: Node | null
  /** The innermost loop around the node whose pass does not release it, or null: the node does not run pass after pass. */
  loop: Node | null
  /** `loop`'s scope, when it has an entry in `f.loopScopes`. */
  loopScope: LoopScope | null
  unbounded: boolean

  constructor(
    pass: LoopScope | null,
    block: Node | null,
    loop: Node | null,
    loopScope: LoopScope | null,
    unbounded: boolean
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
  /** The type table `isCountedLoop` reads, or null when nothing asks whether a pile is bounded. */
  table: TypeTable | null

  constructor(
    unit: AnalysisUnit,
    facts: FactsTable,
    sig: FunctionSig,
    f: FunctionFacts,
    table: TypeTable | null
  ) {
    const program = unit.program
    this.unit = unit
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
    walk.sites.push(new ArenaSite(node, "call", placement, name, growing && isGarbage(placement), around))
    return
  }
  const flow = walk.arenaFlow[node.id]
  if (flow < 0) {
    return
  }
  const kind = siteKind(node)
  const name = kind === "builtin" ? builtinName(walk.program, node) : ""
  const placement = placementAt(walk, scope, flow, walk.escapes[node.id])
  walk.sites.push(new ArenaSite(node, kind, placement, name, growing && isGarbage(placement), around))
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
      innerAround = new Around(around.pass, child, null, null, false)
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
      walkNode(walk, program, child, SCOPE_PASS, new Around(loop, around.block, null, null, false))
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
  const table = walk.table
  const bounded = table === null || boundedPasses(walk, table, node)
  return new Around(around.pass, around.block, node, loop, around.unbounded || !bounded)
}

/**
 * True when something the program holds bounds how many passes `loop` runs: it
 * is counted (`isCountedLoop`), it walks a collection (`for...of`), or its
 * condition compares with `<`, `<=`, `>` or `>=`, the scan of a length or a
 * budget. What is left runs for as long as the program decides at run time:
 * `while (true)`, `for (;;)`, `while (poll())`, `while (event !== DONE)`.
 */
const boundedPasses = (walk: ArenaWalk, table: TypeTable, loop: Node): boolean => {
  if (loop.kind === NodeKind.ForOf || isCountedLoop(walk.unit, table, loop, walk.facts)) {
    return true
  }
  if (loop.kind === NodeKind.While) {
    return comparesOrder(loop.children[0])
  }
  return (loop.kind === NodeKind.Do || loop.kind === NodeKind.For) && comparesOrder(loop.children[1])
}

/** True when `condition`, or a conjunct of it, is an ordering comparison. */
const comparesOrder = (condition: Node): boolean => {
  if (condition.kind === NodeKind.Paren) {
    return comparesOrder(condition.children[0])
  }
  if (condition.kind !== NodeKind.Binary) {
    return false
  }
  const op = condition.text
  if (op === "&&") {
    return comparesOrder(condition.children[0]) || comparesOrder(condition.children[1])
  }
  return op === "<" || op === "<=" || op === ">" || op === ">="
}

/** The scopes around a function's body: none. */
const outsideLoops = (): Around => new Around(null, null, null, null, false)

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
  const out = new StringBuilder()
  out.add('{"functions":[')
  let first = true
  for (const unit of units) {
    const program = unit.program
    for (const sig of program.functions) {
      const f: FunctionFacts | null =
        sig.definedIn(program.source) && !sig.foreign() ? facts.get(sig.name) : null
      const body = sig.body()
      if (f === null || body === null) {
        continue
      }
      const walk = new ArenaWalk(unit, facts, sig, f, null)
      walkNode(walk, program, body, SCOPE_NONE, outsideLoops())
      out.add(first ? "\n" : ",\n")
      first = false
      out.add('{"name":')
      addJsonQuoted(out, sig.sourceName)
      out.add(',"symbol":')
      addJsonQuoted(out, sig.name)
      out.add(',"module":')
      addJsonQuoted(out, program.source.path)
      out.add(`,"line":${program.source.lineOf(sig.decl.start)},"sites":[`)
      let comma = false
      for (const site of walk.sites) {
        out.add(comma ? "," : "")
        comma = true
        const source = program.source
        out.add(`{"kind":"${site.kind}","line":${source.lineOf(site.node.start)}`)
        out.add(`,"column":${source.columnOf(site.node.start)},"placement":"${site.placement}"`)
        if (site.callee.length > 0) {
          out.add(',"callee":')
          addJsonQuoted(out, site.callee)
        }
        out.add(site.accumulates ? ',"accumulates":true}' : "}")
      }
      out.add("]}")
    }
  }
  out.add("\n]}\n")
  return out.toText()
}

// ---- The unbounded-pass diagnostic (NL9018) -----------------------------------------------
//
// A performance warning read off the sites `--emit-arena` marks
// `"accumulates":true`, so the warning and the audit file cannot disagree. Of
// those, it keeps the ones nothing bounds: some loop between the site and the
// scope that releases its memory has no count, collection or ordering
// comparison bounding its passes (`boundedPasses`). That is the shape of a request loop that builds a
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
 * bounds. A site on one of the lines in `named`, which another retention
 * warning of the module already reports, is left to that warning.
 */
export const unboundedPassFindings = (
  unit: AnalysisUnit,
  table: TypeTable,
  facts: FactsTable,
  named: i32[]
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
    const walk = new ArenaWalk(unit, facts, sig, f, table)
    walkNode(walk, program, body, SCOPE_NONE, outsideLoops())
    if (instance !== null) {
      program.leaveInstance()
    }
    const loops: UnboundedLoop[] = []
    for (const site of walk.sites) {
      if (pilesUp(walk, site) && named.indexOf(program.source.lineOf(site.node.start)) < 0) {
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
 * it was given allocates nothing.
 */
const pilesUp = (walk: ArenaWalk, site: ArenaSite): boolean => {
  if (!site.accumulates || !site.around.unbounded || site.kind === "push") {
    return false
  }
  const id = site.node.id
  const call = walk.calls[id]
  if (call === null) {
    return walk.arenaFlow[id] === FLOW_LOCAL && !walk.escapes[id]
  }
  const callee = walk.facts.get(call.callee)
  return (
    callee !== null && callee.netAllocates && callee.contained && call.flow === FLOW_LOCAL && !call.escapes
  )
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
  return new ArenaFinding(
    node,
    `this loop keeps what each pass allocates ${until}, because ${reason}, and nothing bounds how many passes it ` +
      `runs, so ${what}${more} up for as long as it runs. Move the per-pass work that builds it into a block ` +
      "inside the loop body that opens with `using a = arena()`, which the compiler refuses if anything allocated " +
      "there could outlive the block"
  )
}

/** The site the warning names first, in words, by its `--emit-arena` kind. */
const sitePhrase = (program: CheckedProgram, site: ArenaSite): string => {
  const line = program.source.lineOf(site.node.start)
  if (site.kind === "call") {
    return `what \`${site.callee}\` leaves behind on line ${line}`
  }
  if (site.kind === "builtin") {
    return `what \`${site.callee}\` allocates on line ${line}`
  }
  if (site.kind === "print") {
    return `what printing on line ${line} allocates`
  }
  return `the ${site.kind === "new" ? "object" : site.kind} built on line ${line}`
}
