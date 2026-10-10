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
import { builtinNameOf, dottedName } from "./emit-util"
import { FLOW_LEAKS, FLOW_RETURNED, isArenaUsing, loopScopeOf, reclaimsReturnedString } from "./escape"
import {
  N_ARRAY,
  N_ARROW,
  N_BINARY,
  N_BLOCK,
  N_CALL,
  N_DO,
  N_FOR,
  N_FOR_OF,
  N_IDENT,
  N_MEMBER,
  N_NEW,
  N_OBJECT,
  N_TEMPLATE,
  N_WHILE,
  Node,
} from "./nodes"
import { CheckedProgram, FunctionSig } from "./program"
import { StringBuilder, addJsonQuoted } from "./strings"

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

  constructor(node: Node, kind: string, placement: string, callee: string, accumulates: boolean) {
    this.node = node
    this.kind = kind
    this.placement = placement
    this.callee = callee
    this.accumulates = accumulates
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

  constructor(program: CheckedProgram, facts: FactsTable, sig: FunctionSig, f: FunctionFacts) {
    this.program = program
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
  if (node.kind === N_NEW) {
    const callee = node.children[0]
    return callee.text === "Array" ? "array" : "new"
  }
  if (node.kind === N_OBJECT) {
    return "object"
  }
  if (node.kind === N_ARRAY) {
    return "array"
  }
  if (node.kind === N_TEMPLATE || node.kind === N_BINARY) {
    return "string"
  }
  if (node.kind === N_CALL) {
    if (dottedName(node.children[0]) === "console.log") {
      return "print"
    }
    const callee = node.children[0]
    if (callee.kind === N_MEMBER && callee.text === "push") {
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
  if (node.kind !== N_CALL) {
    return ""
  }
  const callee = node.children[0]
  if (callee.kind === N_MEMBER) {
    return callee.text
  }
  return callee.kind === N_IDENT ? builtinNameOf(program, node) : dottedName(callee)
}

/**
 * Record `node` if it is a site, with the placement `scope` gives it. `growing`
 * says the innermost loop around it releases nothing per pass, so its memory
 * piles up until the placement's release; a stack slot is reused every pass,
 * so it never does.
 */
const visitSite = (walk: ArenaWalk, node: Node, scope: i32, growing: boolean): void => {
  if (node.id >= walk.arenaFlow.length) {
    return
  }
  if (walk.f.stackSites[node.id]) {
    walk.sites.push(new ArenaSite(node, siteKind(node), "stack", "", false))
    return
  }
  const call = walk.calls[node.id]
  if (call !== null) {
    const callee = walk.facts.get(call.callee)
    const name = callee === null ? call.callee : callee.sourceName
    const placement = placementAt(walk, scope, call.flow, call.escapes)
    walk.sites.push(new ArenaSite(node, "call", placement, name, growing && isGarbage(placement)))
    return
  }
  const flow = walk.arenaFlow[node.id]
  if (flow < 0) {
    return
  }
  const kind = siteKind(node)
  const name = kind === "builtin" ? builtinName(walk.program, node) : ""
  const placement = placementAt(walk, scope, flow, walk.escapes[node.id])
  walk.sites.push(new ArenaSite(node, kind, placement, name, growing && isGarbage(placement)))
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

const isLoopNode = (node: Node): boolean =>
  node.kind === N_FOR || node.kind === N_FOR_OF || node.kind === N_WHILE || node.kind === N_DO

/**
 * The walk, which carries the innermost scope around each node the way the
 * emitter opens them: a scoped pass for a loop's body, and a block from its
 * `using a = arena()` to its end. It carries `growing` beside it: a node runs
 * on every pass of a loop that does not release it. A loop's head, its
 * condition and its update, runs every pass outside the bracket its body
 * takes; a `for` initialiser and a `for...of` iterable run once, before it. A
 * lifted arrow is a function of its own and is listed as one.
 */
const walkNode = (
  walk: ArenaWalk,
  program: CheckedProgram,
  node: Node,
  scope: i32,
  growing: boolean
): void => {
  if (node.kind === N_ARROW) {
    return
  }
  visitSite(walk, node, scope, growing)
  const isLoop = isLoopNode(node)
  const loop: LoopScope | null = isLoop ? loopScopeOf(walk.f, node) : null
  let inner = scope
  let innerGrowing = growing
  let i = 0
  while (i < node.children.length) {
    const child = node.children[i]
    if (node.kind === N_BLOCK && isArenaUsing(program, child)) {
      inner = SCOPE_BLOCK
      innerGrowing = false
    }
    // A `for` initialiser and a `for...of` iterable run once, before the first pass.
    const once = (node.kind === N_FOR && i === 0) || (node.kind === N_FOR_OF && i === 1)
    if (!isLoop || once) {
      walkNode(
        walk,
        program,
        child,
        node.kind === N_BLOCK ? inner : scope,
        node.kind === N_BLOCK ? innerGrowing : growing
      )
    } else if (loop !== null && child === loop.body && loop.scoped) {
      walkNode(walk, program, child, SCOPE_PASS, false)
    } else {
      // The body of a loop whose pass nothing releases, or the head of any
      // loop: an enclosing scope still releases it, but only once this loop
      // is done, so it piles up until then.
      walkNode(walk, program, child, scope, true)
    }
    i = i + 1
  }
}

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
      const walk = new ArenaWalk(program, facts, sig, f)
      walkNode(walk, program, body, SCOPE_NONE, false)
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
