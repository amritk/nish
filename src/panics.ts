// Panic sites: every place a compiled program can stop with exit 1 that its
// author did not write as `process.exit`, with the kind of check behind it and
// whether the checker proved that check away (docs/LANGUAGE.md, "Panic sites").
//
// **The sites mirror the emitter, not the source.** A site exists exactly
// where the emitter writes a check that can fail, or a call into the runtime
// that exits on failure, and it is proven exactly where the emitter leaves the
// check out because a proof table said it could. The candidates are recorded
// by the attribute walk (`FactCollector` in `src/attributes.ts`), beside the
// line that already tells the fixpoint the same construct reaches a
// `noreturn` callee, so the two lists are written from one reading of each
// construct and cannot drift: the walk runs after `proveCallSiteRanges`, so
// every proof it reads is the one the emitter will read.
//
// Two departures from the emitter, both in the direction of saying more:
//
//   - `--unchecked-indexing` is not a proof. It drops the check and makes an
//     out-of-range index undefined behaviour instead of a panic, so a site it
//     dropped is still recorded, and still unproven.
//   - A call to a function that may panic is a site of the caller (`call`),
//     resolved here as a fixpoint over the attribute pass's own call graph
//     (`FunctionFacts.callees`) rather than a second one.
//
// Out of memory is listed (`oom`, at each arena allocation the escape analysis
// places) but never counts: no source-level guard removes it. Nor does an
// `unchecked` site, a `nish:unsafe` `uncheckedGet` or `uncheckedSet`: it
// cannot panic, and the import its module must write is the visible opt-in to
// the undefined behaviour an index out of range would be. Stack overflow
// is not a site at all: it has no runtime handler and no check in the IR.
// Signed overflow is a site (`overflow`) at every checked `+ - *`, negation and
// step, proven where the bounds walk proved the result fits and the emitter
// writes `nsw` instead of the check; under `--wrapping`, and for the
// `nish:unsafe` `wrapping*` calls, nothing is checked and nothing is listed.

import { AnalysisUnit, FactsTable, FunctionFacts } from "./attributes"
import { unwrapBoundsParens } from "./bounds"
import { DiagnosticSink, SourceFile } from "./diagnostics"
import { StringSet } from "./map"
import { isNetExport, netRangeBuffer } from "./nish-modules"
import { N_BINARY, N_CALL, N_IDENT, N_INDEX, N_MEMBER, Node } from "./nodes"
import { CheckedProgram, FunctionSig } from "./program"
import { addJsonQuoted, StringBuilder } from "./strings"
import { TypeTable, isUnsigned } from "./types"

// The kinds. The number is internal and never reused, so a kind added later
// takes the next one wherever docs/LANGUAGE.md lists it; the name
// `panicKindName` answers is the contract `--emit-panics` writes.
export const PANIC_INDEX: i32 = 0
export const PANIC_POP: i32 = 1
export const PANIC_SLICE: i32 = 2
export const PANIC_DIVIDE: i32 = 3
export const PANIC_RANGE: i32 = 4
export const PANIC_ARRAY_LENGTH: i32 = 5
const PANIC_PANIC: i32 = 6
export const PANIC_EXPECT: i32 = 7
const PANIC_IO_EXIT: i32 = 8
export const PANIC_PARALLEL_LENGTH: i32 = 9
export const PANIC_CALL: i32 = 10
const PANIC_OOM: i32 = 11
/**
 * `uncheckedGet` and `uncheckedSet` from `nish:unsafe`: no check, so nothing
 * panics, but nothing is proven either, and an index out of range is
 * undefined behaviour. Listed so that a reader can find every one, and
 * allowed, as `oom` is: a call is accepted only through a `nish:unsafe`
 * import (`unsafeImportMessage` in `src/builtins.ts`), and that import at the
 * top of its module is the opt-in the no-panic scope asks for.
 */
const PANIC_UNCHECKED: i32 = 12
export const PANIC_OVERFLOW: i32 = 13

/** The name a kind is written as in `--emit-panics`. */
const panicKindName = (kind: i32): string => {
  switch (kind) {
    case PANIC_INDEX:
      return "index"
    case PANIC_POP:
      return "pop"
    case PANIC_SLICE:
      return "slice"
    case PANIC_DIVIDE:
      return "divide"
    case PANIC_RANGE:
      return "range"
    case PANIC_ARRAY_LENGTH:
      return "array-length"
    case PANIC_PANIC:
      return "panic"
    case PANIC_EXPECT:
      return "expect"
    case PANIC_IO_EXIT:
      return "io-exit"
    case PANIC_PARALLEL_LENGTH:
      return "parallel-length"
    case PANIC_CALL:
      return "call"
    case PANIC_UNCHECKED:
      return "unchecked"
    case PANIC_OVERFLOW:
      return "overflow"
    default:
      return "oom"
  }
}

/**
 * One place a function can panic.
 *
 * A `call` (and a `parallel-length`, which is a call into `parallelMapInto`
 * whose panic is the length check in `std/threads.ts`) is recorded at every
 * call as a candidate and kept only when the callee turns out to be able to
 * panic; `reaches` is then the first site the callee can panic at, followed
 * through as many calls as it takes, which is what a reader needs to find it.
 */
export class PanicSite {
  node: Node
  /** The module the site is written in, for a diagnostic that points at it from another. */
  source: SourceFile
  /** The LLVM symbol of the function the site is in. */
  fn: string
  /** The callee's symbol, for a `call` or a `parallel-length`; `""` otherwise. */
  callee: string
  /** For a kept `call` or `parallel-length`: the first site its callee reaches. */
  reaches: PanicSite | null
  kind: i32
  /** The checker proved the check cannot fail, and the emitter left it out. */
  proven: boolean
  /**
   * Where the body reaches the site at run time, among its own: the walk
   * numbers a node's sites after its operands' (`FactCollector.orderSites`),
   * so `f(x) + 1` and `1 + f(x)` both call `f` before they add. -1 for a
   * check the prologue makes, before the body. The listing is in source
   * order; this decides only which site a function reaches first.
   */
  order: i32

  constructor(node: Node, source: SourceFile, kind: i32, fn: string, proven: boolean, callee: string) {
    this.node = node
    this.source = source
    this.fn = fn
    this.callee = callee
    this.reaches = null
    this.kind = kind
    this.proven = proven
    this.order = -1
  }
}

/** Whether `site` is a call whose site-ness is the callee's to decide. */
const isCallSite = (site: PanicSite): boolean =>
  site.kind === PANIC_CALL || site.kind === PANIC_PARALLEL_LENGTH

/**
 * Whether `site` is listed but never counts: out of memory, which no guard
 * removes, and an `unchecked` access, which its module's `nish:unsafe` import
 * opted into.
 */
const isAllowed = (site: PanicSite): boolean => site.kind === PANIC_OOM || site.kind === PANIC_UNCHECKED

/** Whether `site`, by itself, can stop the program: unproven, and not allowed. */
const panicsHere = (site: PanicSite): boolean => !site.proven && !isAllowed(site) && !isCallSite(site)

/**
 * The kind a builtin called by `name` panics with, or -1 when it cannot: the
 * name as the attribute pass resolves it (`readFileSync`, `crypto.getRandomValues`,
 * a `nish:` import's builtin). The io builtins exit inside the runtime
 * (`nish_io_fail`, `nish_entropy_fail`), so they have no check in the IR to
 * mirror; their non-exiting twins (`readFileSyncOrNull`) are not sites.
 */
export const builtinPanicKind = (name: string): i32 => {
  if (name === "panic") {
    return PANIC_PANIC
  }
  if (
    name === "readFileSync" ||
    name === "writeFileSync" ||
    name === "appendFileSync" ||
    name === "crypto.getRandomValues"
  ) {
    return PANIC_IO_EXIT
  }
  if (name === "uncheckedGet" || name === "uncheckedSet") {
    return PANIC_UNCHECKED
  }
  // `netRead` and its siblings check the range of their buffer the way
  // `dst.set(src, at)` does, through the slice panic (`emitNetCall`).
  if (isNetExport(name) && netRangeBuffer(name) >= 0) {
    return PANIC_SLICE
  }
  return -1
}

/** Order `sites` by position, keeping the walk's order between sites at one offset. */
const sortByPosition = (sites: PanicSite[]): void => {
  let i = 1
  while (i < sites.length) {
    const site = sites[i]
    let j = i - 1
    while (j >= 0 && sites[j].node.start > site.node.start) {
      sites[j + 1] = sites[j]
      j = j - 1
    }
    sites[j + 1] = site
    i = i + 1
  }
}

/** `sites` in the order the body reaches them (`PanicSite.order`), as a new list. */
const inEvaluationOrder = (sites: PanicSite[]): PanicSite[] => {
  const out: PanicSite[] = []
  for (const site of sites) {
    out.push(site)
  }
  let i = 1
  while (i < out.length) {
    const site = out[i]
    let j = i - 1
    while (j >= 0 && out[j].order > site.order) {
      out[j + 1] = out[j]
      j = j - 1
    }
    out[j + 1] = site
    i = i + 1
  }
  return out
}

/**
 * Settle every function's sites, once, after the attribute fixpoint: drop the
 * calls into functions that cannot panic, follow the rest to the site they
 * reach, add the out-of-memory sites, and store each module's list on its
 * `CheckedProgram` in function order.
 *
 * May-panic is a fixpoint over `FunctionFacts.callees`, the graph the
 * attribute pass already built and propagates `callsNoReturn` over. It is not
 * `callsNoReturn` itself, which `process.exit` sets too, and which an
 * `--unchecked-indexing` build clears for the checks it drops.
 */
export const resolvePanicSites = (units: AnalysisUnit[], facts: FactsTable): void => {
  const ordered: PanicSite[][] = []
  const reach: (PanicSite | null)[] = []
  for (const f of facts.list) {
    sortByPosition(f.panicSites)
    ordered.push(inEvaluationOrder(f.panicSites))
    reach.push(null)
  }
  const may = mayPanicSet(facts, ordered)
  // A function reaches the first of its sites, in the order the body reaches
  // them, that panics by itself or calls a function that may panic, and then
  // what that callee reaches. A function is settled once its answer is known
  // and waits while a call before it is into a function not yet settled. When
  // nothing settles, every waiting function waits on a cycle of calls, and the
  // first of them in function order that can settles by passing over its
  // calls into functions not yet settled; the rest of its cycle then reach
  // what it reaches. It terminates because each pass settles at least one
  // function, from null to a site, and no function is settled twice.
  let settling = true
  while (settling) {
    let settled = false
    let i = 0
    while (i < facts.list.length && i < ordered.length && i < reach.length && i < may.length) {
      if (may[i] && reach[i] === null) {
        const found = firstPanic(facts, may, reach, ordered[i], facts.list[i], false)
        if (found !== null) {
          reach[i] = found
          settled = true
        }
      }
      i = i + 1
    }
    i = 0
    while (!settled && i < facts.list.length && i < ordered.length && i < reach.length && i < may.length) {
      if (may[i] && reach[i] === null) {
        const found = firstPanic(facts, may, reach, ordered[i], facts.list[i], true)
        if (found !== null) {
          reach[i] = found
          settled = true
        }
      }
      i = i + 1
    }
    settling = settled
  }
  for (const unit of units) {
    const program = unit.program
    program.panicSites = []
    for (const sig of program.functions) {
      const f = listedFacts(program, facts, sig)
      if (f !== null) {
        keepSites(program, facts, reach, sig, f)
      }
    }
  }
}

/**
 * Which functions may panic: one with a site that panics by itself, and one
 * that calls such a function, to a fixpoint. A function only ever joins the
 * set, so it settles.
 */
const mayPanicSet = (facts: FactsTable, ordered: PanicSite[][]): boolean[] => {
  const may: boolean[] = []
  for (const sites of ordered) {
    let here = false
    for (const site of sites) {
      if (panicsHere(site)) {
        here = true
      }
    }
    may.push(here)
  }
  let changed = true
  while (changed) {
    changed = false
    let i = 0
    while (i < facts.list.length && i < ordered.length && i < may.length) {
      if (!may[i] && callsMayPanic(facts, may, ordered[i], facts.list[i])) {
        may[i] = true
        changed = true
      }
      i = i + 1
    }
  }
  return may
}

/** Whether `f` calls a function in `may`, by a recorded call or as a callee no call names. */
const callsMayPanic = (facts: FactsTable, may: boolean[], sites: PanicSite[], f: FunctionFacts): boolean => {
  for (const site of sites) {
    if (isCallSite(site) && mayPanicAt(facts, may, site.callee)) {
      return true
    }
  }
  let c = 0
  while (c < f.callees.size()) {
    if (mayPanicAt(facts, may, f.callees.at(c))) {
      return true
    }
    c = c + 1
  }
  return false
}

/** Whether the function called `name` may panic; false for a runtime symbol. */
const mayPanicAt = (facts: FactsTable, may: boolean[], name: string): boolean => {
  const at = facts.indexOf(name)
  return at >= 0 && at < may.length && may[at]
}

/**
 * The first site `f` reaches that can panic, given the functions settled so
 * far: its own unproven check, or what a call into a function that may panic
 * reaches, whichever the body reaches first. A callee no recorded call names
 * (a routed `nish/map` method) is reached after them, in the order the walk
 * met the callees. Null while a call before the answer is into a function not
 * yet settled, unless `passOver`, which passes over such a call instead.
 */
const firstPanic = (
  facts: FactsTable,
  may: boolean[],
  reach: (PanicSite | null)[],
  sites: PanicSite[],
  f: FunctionFacts,
  passOver: boolean
): PanicSite | null => {
  for (const site of sites) {
    if (panicsHere(site)) {
      return site
    }
    if (isCallSite(site) && mayPanicAt(facts, may, site.callee)) {
      const found = reachOf(facts, reach, site.callee)
      if (found !== null) {
        return found
      }
      if (!passOver) {
        return null
      }
    }
  }
  let c = 0
  while (c < f.callees.size()) {
    const callee = f.callees.at(c)
    if (mayPanicAt(facts, may, callee)) {
      const found = reachOf(facts, reach, callee)
      if (found !== null) {
        return found
      }
      if (!passOver) {
        return null
      }
    }
    c = c + 1
  }
  return null
}

/** What the function called `name` can panic at first, or null: none, or a runtime symbol. */
const reachOf = (facts: FactsTable, reach: (PanicSite | null)[], name: string): PanicSite | null => {
  const at = facts.indexOf(name)
  return at >= 0 && at < reach.length ? reach[at] : null
}

/** The facts of a function `--emit-panics` lists: one with a body, defined in `program`. */
const listedFacts = (program: CheckedProgram, facts: FactsTable, sig: FunctionSig): FunctionFacts | null =>
  sig.definedIn(program.source) && !sig.foreign() ? facts.get(sig.name) : null

/**
 * `f`'s settled sites onto `program.panicSites`. A callee that may panic but
 * that no recorded call names — a routed `nish/map` method, called by the
 * code the table is lowered to rather than by a call in the body — is a `call`
 * at the function itself, so that the list never claims less than the graph.
 */
const keepSites = (
  program: CheckedProgram,
  facts: FactsTable,
  reach: (PanicSite | null)[],
  sig: FunctionSig,
  f: FunctionFacts
): void => {
  const sites: PanicSite[] = []
  const named = new StringSet()
  for (const site of f.panicSites) {
    if (!isCallSite(site)) {
      sites.push(site)
      continue
    }
    const found = reachOf(facts, reach, site.callee)
    if (found !== null) {
      site.reaches = found
      sites.push(site)
      named.add(site.callee)
    }
  }
  let c = 0
  while (c < f.callees.size()) {
    const callee = f.callees.at(c)
    const found = reachOf(facts, reach, callee)
    if (found !== null && !named.has(callee)) {
      const site = new PanicSite(sig.decl, program.source, PANIC_CALL, sig.name, false, callee)
      site.reaches = found
      sites.push(site)
      named.add(callee)
    }
    c = c + 1
  }
  for (const node of f.arenaNodes) {
    sites.push(new PanicSite(node, program.source, PANIC_OOM, sig.name, false, ""))
  }
  sortByPosition(sites)
  for (const site of sites) {
    program.panicSites.push(site)
  }
}

/**
 * The `--emit-panics` file: every function the program defines with a body,
 * in module and declaration order, one per line, and its sites in source
 * order. The keys and their order are a contract, like `--json`'s:
 *
 *   {"name","symbol","module","line","panics":[...]}
 *
 * and per site `{"kind","line","column"}` followed by `"proven"` for a check,
 * `"proven","callee"` for a `parallel-length`, `"callee","via"` for a `call`
 * (`via` is the kind of the site the callee reaches) and `"allowed":true` for
 * an `oom` and an `unchecked`. `symbol` is the function's LLVM name, which is how a reader finds
 * it in the IR; `callee` is the callee's name as a diagnostic spells it.
 */
export const panicsJson = (units: AnalysisUnit[], facts: FactsTable): string => {
  const out = new StringBuilder()
  out.add('{"functions":[')
  let first = true
  for (const unit of units) {
    const program = unit.program
    let at = 0
    for (const sig of program.functions) {
      if (listedFacts(program, facts, sig) === null) {
        continue
      }
      out.add(first ? "\n" : ",\n")
      first = false
      out.add('{"name":')
      addJsonQuoted(out, sig.sourceName)
      out.add(',"symbol":')
      addJsonQuoted(out, sig.name)
      out.add(',"module":')
      addJsonQuoted(out, program.source.path)
      out.add(`,"line":${program.source.lineOf(sig.decl.start)},"panics":[`)
      let comma = false
      while (at < program.panicSites.length && program.panicSites[at].fn === sig.name) {
        out.add(comma ? "," : "")
        comma = true
        siteJson(out, program, facts, program.panicSites[at])
        at = at + 1
      }
      out.add("]}")
    }
  }
  out.add("\n]}\n")
  return out.toText()
}

/** One site's object, in the key order `panicsJson` documents. */
const siteJson = (out: StringBuilder, program: CheckedProgram, facts: FactsTable, site: PanicSite): void => {
  const source = program.source
  out.add(`{"kind":"${panicKindName(site.kind)}","line":${source.lineOf(site.node.start)}`)
  out.add(`,"column":${source.columnOf(site.node.start)}`)
  if (isAllowed(site)) {
    out.add(',"allowed":true}')
    return
  }
  if (site.kind !== PANIC_CALL) {
    out.add(`,"proven":${site.proven ? "true" : "false"}`)
  }
  if (isCallSite(site)) {
    const callee = facts.get(site.callee)
    out.add(',"callee":')
    addJsonQuoted(out, callee === null ? site.callee : callee.sourceName)
  }
  const reaches = site.reaches
  if (site.kind === PANIC_CALL && reaches !== null) {
    out.add(`,"via":"${panicKindName(reaches.kind)}"`)
  }
  out.add("}")
}

/** The settled sites of the function whose symbol is `fn`, in source order. */
export const sitesOf = (program: CheckedProgram, fn: string): PanicSite[] => {
  const out: PanicSite[] = []
  for (const site of program.panicSites) {
    if (site.fn === fn) {
      out.push(site)
    }
  }
  return out
}

/**
 * One site as the capability report writes it (`src/capability-report.ts`):
 * the keys `--emit-panics` writes, in its order, but with the position as one
 * `"at": "path:line:col"` in the path the report gives the module, and
 * spaced the way the report's witnesses are.
 */
export const siteReportEntry = (site: PanicSite, path: string, facts: FactsTable): string => {
  const out = new StringBuilder()
  const source = site.source
  out.add(`{ "kind": "${panicKindName(site.kind)}", "at": `)
  addJsonQuoted(out, `${path}:${source.lineOf(site.node.start)}:${source.columnOf(site.node.start)}`)
  if (isAllowed(site)) {
    out.add(', "allowed": true }')
    return out.toText()
  }
  if (site.kind !== PANIC_CALL) {
    out.add(`, "proven": ${site.proven ? "true" : "false"}`)
  }
  if (isCallSite(site)) {
    const callee = facts.get(site.callee)
    out.add(', "callee": ')
    addJsonQuoted(out, callee === null ? site.callee : callee.sourceName)
  }
  const reaches = site.reaches
  if (site.kind === PANIC_CALL && reaches !== null) {
    out.add(`, "via": "${panicKindName(reaches.kind)}"`)
  }
  out.add(" }")
  return out.toText()
}

// ---- The no-panic scope (`--deny-panics`, `"nish".noPanic`) --------------------------

/**
 * Refuse every site that can still panic in a module of the no-panic scope:
 * `inScope[k]` says whether `units[k]` is in it. A site of the module's own is
 * NL2457, naming its kind and, where a proof the checker makes would remove
 * it, the guard that gives the proof. A call is refused only when its callee
 * is outside the scope (NL2458), because a callee inside it has its own sites
 * refused where they are written, and a second error at every call into it
 * would say the same thing again. Out of memory and `unchecked` are never
 * refused (`isAllowed`): no guard in the source removes the one, and the
 * other's `nish:unsafe` import is the opt-in.
 *
 * Answers the sites it refused, so that the driver can take back a
 * performance warning about the same check: the error already says it.
 */
export const reportDeniedPanics = (
  units: AnalysisUnit[],
  inScope: boolean[],
  facts: FactsTable,
  table: TypeTable,
  sink: DiagnosticSink
): PanicSite[] => {
  const refused: PanicSite[] = []
  const scoped = new StringSet()
  // The programs in scope, read once: `inScope` is in step with `units`.
  const programs: CheckedProgram[] = []
  let k = 0
  for (const unit of units) {
    if (k < inScope.length && inScope[k]) {
      programs.push(unit.program)
    }
    k = k + 1
  }
  for (const program of programs) {
    for (const sig of program.functions) {
      if (listedFacts(program, facts, sig) !== null) {
        scoped.add(sig.name)
      }
    }
  }
  for (const program of programs) {
    for (const site of program.panicSites) {
      if (refuseSite(program, facts, table, scoped, site, sink)) {
        refused.push(site)
      }
    }
  }
  return refused
}

/** Report `site` when it can panic in the scope; whether it did. */
const refuseSite = (
  program: CheckedProgram,
  facts: FactsTable,
  table: TypeTable,
  scoped: StringSet,
  site: PanicSite,
  sink: DiagnosticSink
): boolean => {
  if (site.proven || isAllowed(site)) {
    return false
  }
  const node = site.node
  const reaches = site.reaches
  if (site.kind === PANIC_CALL) {
    if (reaches === null || scoped.has(site.callee)) {
      return false
    }
    const callee = facts.get(site.callee)
    const name = callee === null ? site.callee : callee.sourceName
    const at = `${reaches.source.path}:${reaches.source.lineOf(reaches.node.start)}:${reaches.source.columnOf(reaches.node.start)}`
    sink.report(
      program.source,
      node.start,
      node.end,
      `This call to \`${name}\` may panic: it reaches the \`${panicKindName(reaches.kind)}\` site at ${at}, ` +
        "outside the no-panic scope this call is in, where nothing the caller proves can remove it: call a " +
        "function that cannot panic, or make the call from a module outside the scope"
    )
    return true
  }
  // A `parallelMapInto` is kept only when its body can panic, which is the length check.
  if (site.kind === PANIC_PARALLEL_LENGTH && reaches === null) {
    return false
  }
  sink.report(
    program.source,
    node.start,
    node.end,
    `\`${panicKindName(site.kind)}\` may panic here, and a module in the no-panic scope (\`--deny-panics\` or ` +
      `\`noPanic\`) may keep no panic site but out of memory: ${siteAdvice(program, table, site)}`
  )
  return true
}

/** The source name of the local a bare identifier binds, or `""`. */
const siteLocalName = (program: CheckedProgram, expr: Node): string => {
  const e = unwrapBoundsParens(expr)
  if (e.kind !== N_IDENT) {
    return ""
  }
  const local = program.nodeLocals[e.id]
  return local === null ? "" : local.name
}

/** The builtin a call names, through a `nish:` import's local name; else a method's or a function's as written. */
const calledName = (program: CheckedProgram, call: Node): string => {
  if (call.kind !== N_CALL) {
    return ""
  }
  const builtin = program.nodeBuiltins[call.id]
  if (builtin.length > 0) {
    return builtin
  }
  const callee = unwrapBoundsParens(call.children[0])
  return callee.kind === N_MEMBER || callee.kind === N_IDENT ? callee.text : ""
}

/**
 * What fails at `site`, and what removes it. The index, range and divisor
 * guards are the ones `src/bounds.ts` reads, worded as the WP15 section 8
 * warnings word them, so an author is told one way of writing each; a kind
 * no proof removes says so and names the twin that does not panic.
 */
const siteAdvice = (program: CheckedProgram, table: TypeTable, site: PanicSite): string => {
  const node = site.node
  switch (site.kind) {
    case PANIC_INDEX:
      return indexAdvice(program, node)
    case PANIC_POP: {
      const holder = siteLocalName(program, unwrapBoundsParens(node.children[0]).children[0])
      const xs = holder.length > 0 ? holder : "xs"
      const what =
        holder.length > 0
          ? `\`${xs}\` is not proven to hold an element here`
          : "this array is not proven to hold an element here"
      return `${what}, and \`pop\` panics on an empty one: guard it with a test that reaches the call — \`if (${xs}.length > 0)\` proves it`
    }
    case PANIC_SLICE:
      return sliceAdvice(program, node)
    case PANIC_DIVIDE:
      return divideAdvice(program, table, node)
    case PANIC_RANGE:
      return rangeAdvice(program, table, site)
    case PANIC_ARRAY_LENGTH:
      return (
        "`new Array` checks a length of this type before it allocates: give the length a type that needs no " +
        "check — `u8`, `u16` or a range starting at 0, `integer<0, N>` — or write it as a literal"
      )
    case PANIC_PANIC:
      return "`panic` stops the program, and no proof removes a call to it: return a `Result` and let the caller decide"
    case PANIC_EXPECT:
      return "`expect` panics on an `Err`: hand the error on with `orReturn`, or supply a value with `unwrapOr`"
    case PANIC_IO_EXIT:
      return ioExitAdvice(program, node)
    case PANIC_PARALLEL_LENGTH:
      return (
        "`parallelMapInto` panics when `dst` is shorter than `src`, and no proof removes that check yet: make " +
        "the call from a module outside the scope"
      )
    case PANIC_OVERFLOW:
      return overflowAdvice(program, table, node)
    default:
      // `oom` and `unchecked` are allowed (`isAllowed`) and never refused.
      return ""
  }
}

/** The guard for an element access or a `charCodeAt`, and for the second check of a compound store. */
const indexAdvice = (program: CheckedProgram, node: Node): string => {
  if (node.kind === N_BINARY) {
    return (
      "a compound store checks its index again after its right side, which may resize the array, and no " +
      "proof survives that call: compute the right side into a local first"
    )
  }
  let receiver = node
  let index = node
  if (node.kind === N_INDEX) {
    receiver = node.children[0]
    index = node.children[1]
  } else {
    receiver = unwrapBoundsParens(node.children[0]).children[0]
    index = node.children[1].children[0]
  }
  const holder = siteLocalName(program, receiver)
  const name = siteLocalName(program, index)
  const xs = holder.length > 0 ? holder : "xs"
  const i = name.length > 0 ? name : "i"
  const what =
    name.length > 0 && holder.length > 0
      ? `\`${i}\` is not proven to be in range for \`${xs}\` here`
      : "this index is not proven to be in range here"
  const unchecked = program.uncheckedIndexing
    ? " (`--unchecked-indexing` removes the check without proving it, which makes an access out of range undefined behaviour rather than a proven one)"
    : ""
  return (
    `${what}${unchecked}: guard it with a test that reaches the access — ` +
    `\`if (${i} >= 0 && ${i} < ${xs}.length)\` proves both ends, and an unsigned index needs only the upper one`
  )
}

/** A `slice`, an array `set` or a socket call whose buffer range is checked: no proof removes any of them. */
const sliceAdvice = (program: CheckedProgram, node: Node): string => {
  const name = calledName(program, node)
  if (name === "slice") {
    return "`slice` panics when its range is outside the string, and no proof removes that check yet: `substring` clamps the range instead"
  }
  return `\`${name}\` panics when its range is outside its buffer, and no proof removes that check yet: make the call from a module outside the scope`
}

/**
 * A signed operation not proven to fit: bound it so the bounds walk proves it,
 * or, where it is meant to wrap, say so with an unsigned type of its width or
 * the drop-in `nish:unsafe` form of its operator, which is never checked.
 */
const overflowAdvice = (program: CheckedProgram, table: TypeTable, node: Node): string => {
  const op = node.text
  const type = program.nodeTypes[node.children[0].id]
  const signed = type >= 0 ? table.typeName(table.baseOf(type)) : "i32"
  const unsigned = signed === "i64" ? "u64" : "u32"
  return (
    `this \`${op}\` is not proven to fit \`${signed}\` here, and a signed overflow panics: bound its operands with a ` +
    "test the checker reads — a loop below a length or a limit, or a guard on the value — so the result is proven to fit, " +
    `or, if it is meant to wrap, compute in \`${unsigned}\` or write it as \`${wrappingForm(node)}\` from \`nish:unsafe\``
  )
}

/** The `nish:unsafe` call that computes what the operator at `node` computes, wrapping, spelled for `x` and `y`. */
const wrappingForm = (node: Node): string => {
  const op = node.text
  if (node.kind !== N_BINARY) {
    if (op === "++") {
      return "x = wrappingAdd(x, 1)"
    }
    return op === "--" ? "x = wrappingSub(x, 1)" : "wrappingSub(0, x)"
  }
  let fn = "wrappingAdd"
  if (op === "*" || op === "*=") {
    fn = "wrappingMul"
  } else if (op === "-" || op === "-=") {
    fn = "wrappingSub"
  }
  return op.length === 2 ? `x = ${fn}(x, y)` : `${fn}(x, y)`
}

/** The guard a divisor needs: not zero, and for a signed division not `-1` either. */
const divideAdvice = (program: CheckedProgram, table: TypeTable, node: Node): string => {
  const name = siteLocalName(program, node.children[1])
  const d = name.length > 0 ? name : "d"
  const left = program.nodeTypes[node.children[0].id]
  const unsigned = left >= 0 && isUnsigned(table.baseOf(left))
  const what = name.length > 0 ? `the divisor \`${d}\`` : "the divisor"
  const bind = name.length > 0 ? "" : "bind it to a local and "
  if (unsigned) {
    return `${what} may be 0 here: ${bind}guard it with a test that reaches the division — \`if (${d} !== 0)\` proves it`
  }
  return (
    `${what} may be 0 here, or -1 with a dividend that may be the minimum: ` +
    `${bind}guard it with a test that reaches the division — \`if (${d} !== 0 && ${d} !== -1)\` proves it, and so does \`${d} > 0\``
  )
}

/** The NL9013 guard for a value entering a range, and what to do where no guard proves one. */
const rangeAdvice = (program: CheckedProgram, table: TypeTable, site: PanicSite): string => {
  const node = site.node
  if (isPrologueSite(program, site)) {
    return (
      "an exported function checks a ranged parameter on entry, because a caller outside the program may " +
      "pass anything, and no proof removes that check: take an `i32` and enter the range in the body, behind a guard"
    )
  }
  const stored = program.nodeCoercions[node.id] < 0
  const at = stored ? node.children[0] : node
  const range = program.nodeTypes[at.id]
  const spelled = table.typeName(range)
  if (stored) {
    const target = siteLocalName(program, at)
    const what = target.length > 0 ? `the value written to \`${target}\`` : "the value written back"
    return (
      `${what} is not proven to lie in ${spelled} here: declare the counter \`i32\` and give the range to ` +
      "the value that is used, where a guard proves it"
    )
  }
  const lo = table.rangeLo(range)
  const hi = table.rangeHi(range)
  const name = siteLocalName(program, node)
  if (name.length === 0 || (lo !== 0 && lo !== -2147483648)) {
    return (
      `this value is not proven to lie in ${spelled} here: bind it to an \`i32\` local and guard that local, ` +
      "for a range that starts at 0 or at the minimum, or enter it from a value whose type already lies in the range"
    )
  }
  let guard = `${name} >= 0 && ${name} <= ${hi}`
  if (lo !== 0) {
    guard = `${name} <= ${hi}`
  } else if (hi === 2147483647) {
    guard = `${name} >= 0`
  }
  return `\`${name}\` is not proven to lie in ${spelled} here: guard it with a test that reaches it — \`if (${guard})\` proves it`
}

/** Whether `site` is the check an exported function makes of its ranged parameters, recorded at its declaration. */
const isPrologueSite = (program: CheckedProgram, site: PanicSite): boolean => {
  for (const sig of program.functions) {
    if (sig.name === site.fn) {
      return sig.decl === site.node
    }
  }
  return false
}

/** The io builtins exit inside the runtime; one of them has a twin that answers `null` instead. */
const ioExitAdvice = (program: CheckedProgram, node: Node): string => {
  const name = calledName(program, node)
  if (name === "readFileSync") {
    return "`readFileSync` exits when the file cannot be read: call `readFileSyncOrNull`, which answers `null` instead"
  }
  if (name === "crypto.getRandomValues" || name === "getRandomValues") {
    return "`crypto.getRandomValues` exits when the system cannot supply entropy, and has no twin that answers instead: draw it in a module outside the scope"
  }
  return `\`${name}\` exits when the file cannot be written, and has no twin that answers instead: write it from a module outside the scope`
}
