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
// places) but never counts: no source-level guard removes it. Stack overflow
// is not a site at all: it has no runtime handler and no check in the IR.
// Signed overflow is a site (`overflow`) at every checked `+ - *`, negation and
// step, proven where the bounds walk proved the result fits and the emitter
// writes `nsw` instead of the check; under `--wrapping`, and for the
// `nish:unsafe` `wrapping*` calls, nothing is checked and nothing is listed.

import { AnalysisUnit, FactsTable, FunctionFacts } from "./attributes"
import { StringSet } from "./map"
import { isNetExport, netRangeBuffer } from "./nish-modules"
import { Node } from "./nodes"
import { CheckedProgram, FunctionSig } from "./program"
import { addJsonQuoted, StringBuilder } from "./strings"

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
export const PANIC_OVERFLOW: i32 = 12

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
  /** The LLVM symbol of the function the site is in. */
  fn: string
  /** The callee's symbol, for a `call` or a `parallel-length`; `""` otherwise. */
  callee: string
  /** For a kept `call` or `parallel-length`: the first site its callee reaches. */
  reaches: PanicSite | null
  kind: i32
  /** The checker proved the check cannot fail, and the emitter left it out. */
  proven: boolean

  constructor(node: Node, kind: i32, fn: string, proven: boolean, callee: string) {
    this.node = node
    this.fn = fn
    this.callee = callee
    this.reaches = null
    this.kind = kind
    this.proven = proven
  }
}

/** Whether `site` is a call whose site-ness is the callee's to decide. */
const isCallSite = (site: PanicSite): boolean =>
  site.kind === PANIC_CALL || site.kind === PANIC_PARALLEL_LENGTH

/** Whether `site`, by itself, can stop the program: unproven, and not out of memory. */
const panicsHere = (site: PanicSite): boolean => !site.proven && site.kind !== PANIC_OOM && !isCallSite(site)

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
  const reach: (PanicSite | null)[] = []
  for (const f of facts.list) {
    sortByPosition(f.panicSites)
    let first: PanicSite | null = null
    for (const site of f.panicSites) {
      if (first === null && panicsHere(site)) {
        first = site
      }
    }
    reach.push(first)
  }
  // A function reaches what its first callee that may panic reaches, in the
  // order the walk met the callees, which is the order the body calls them.
  let changed = true
  while (changed) {
    changed = false
    let i = 0
    while (i < facts.list.length && i < reach.length) {
      if (reach[i] === null) {
        const found = firstReached(facts, reach, facts.list[i])
        if (found !== null) {
          reach[i] = found
          changed = true
        }
      }
      i = i + 1
    }
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

/** What the function called `name` can panic at first, or null: none, or a runtime symbol. */
const reachOf = (facts: FactsTable, reach: (PanicSite | null)[], name: string): PanicSite | null => {
  const at = facts.indexOf(name)
  return at >= 0 && at < reach.length ? reach[at] : null
}

/** What the first callee of `f` that may panic reaches, or null. */
const firstReached = (facts: FactsTable, reach: (PanicSite | null)[], f: FunctionFacts): PanicSite | null => {
  let c = 0
  while (c < f.callees.size()) {
    const found = reachOf(facts, reach, f.callees.at(c))
    if (found !== null) {
      return found
    }
    c = c + 1
  }
  return null
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
      const site = new PanicSite(sig.decl, PANIC_CALL, sig.name, false, callee)
      site.reaches = found
      sites.push(site)
      named.add(callee)
    }
    c = c + 1
  }
  for (const node of f.arenaNodes) {
    sites.push(new PanicSite(node, PANIC_OOM, sig.name, false, ""))
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
 * an `oom`. `symbol` is the function's LLVM name, which is how a reader finds
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
  if (site.kind === PANIC_OOM) {
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
