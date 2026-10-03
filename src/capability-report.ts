// The capability report (docs/wp35-capabilities.md §5): the JSON
// `--emit-capabilities <file.json>` writes and the one line
// `nish run --capabilities` prints, both read off the masks and witnesses the
// attribute fixpoint settled (`FunctionFacts.caps`, `src/attributes.ts`).
//
// Nothing here decides a capability; it only lays out what the fixpoint found,
// in an order that does not depend on how the program was loaded. That order
// is the report's contract, and `tests/nish/cli.ts` checks it byte for byte:
// keys always in the same order, capability lists in the fixed order of
// `src/capabilities.ts`, packages, modules and functions sorted, and every path
// relative to the entry's directory so the file reads the same from any
// checkout. Each function also carries its `"panics"`, the sites
// `src/panics.ts` settled for it, written with the same relative paths.
//
// Each quoted name is pushed onto the report as a piece of its own rather than
// spliced into a template: spliced, the quoted copy is garbage as soon as the
// larger string is built, and in a loop that is memory every pass leaves
// behind (the NL9011 performance warning); pushed, it is part of the report.

import { FactsTable, FunctionFacts } from "./attributes"
import { CLI } from "./branding"
import { CAPABILITY_COUNT, capabilityName, capabilityNames, isDeterministic } from "./capabilities"
import { Compilation, ModuleUnit } from "./compilation"
import { StringMap } from "./map"
import { ROOT_PACKAGE } from "./packages"
import { isStdModule } from "./std-modules"
import { dirname, relativePath } from "./paths"
import { Node } from "./nodes"
import { CheckedProgram, FunctionSig } from "./program"
import { siteReportEntry, sitesOf } from "./panics"
import { compareStrings, jsonQuote } from "./strings"

/** How the root package is named in the report: it has no name of its own. */
const ROOT_NAME: string = "<root>"

/**
 * Whether `unit` is a standard-library module, asked by where it was resolved
 * (`isStdModule`) rather than by its package name: a dependency may itself be
 * called `nish`, and nothing refuses one.
 */
const isLibrary = (compilation: Compilation, unit: ModuleUnit): boolean =>
  isStdModule(compilation.libraryRoot(), unit.name, unit.path)

/**
 * The report's name for a module: its path from the entry's directory, or,
 * for a standard-library module, the package-relative name its diagnostics
 * carry (`std/threads.ts`), which says nothing about where the compiler is
 * installed.
 */
const modulePath = (compilation: Compilation, root: string, unit: ModuleUnit): string =>
  isLibrary(compilation, unit) ? unit.name : relativePath(root, unit.path)

/** The facts' mask for `sig`, or 0 when the fixpoint has none for it. */
const capsOf = (facts: FactsTable, sig: FunctionSig): i32 => {
  const f = facts.get(sig.name)
  return f === null ? 0 : f.caps
}

/**
 * The program's capabilities: the entry's closure, which is `main`'s when the
 * entry declares one and the union over the entry module's exported functions
 * when it is a library (docs/wp35-capabilities.md §4).
 */
const programCapabilities = (compilation: Compilation, facts: FactsTable): i32 => {
  const entry = compilation.entry()
  const main = entry.checker.program.entryMain
  if (main !== null) {
    return capsOf(facts, main)
  }
  let mask = 0
  for (const sig of entry.checker.program.functions) {
    if (sig.exported && sig.definedIn(entry.checker.program.source)) {
      mask = mask | capsOf(facts, sig)
    }
  }
  return mask
}

/**
 * Sort `order` by `keys`, then by `ties`, moving all three lists together: an
 * insertion sort, because the lists are a program's packages, one package's
 * modules or one module's exports, and are short.
 */
const sortTogether = (keys: string[], ties: string[], order: i32[]): void => {
  let i = 1
  while (i < keys.length && i < ties.length && i < order.length) {
    let j = i
    while (j >= 1 && j < keys.length && j < ties.length && j < order.length) {
      const byKey = compareStrings(keys[j - 1], keys[j])
      if (byKey < 0 || (byKey === 0 && compareStrings(ties[j - 1], ties[j]) <= 0)) {
        break
      }
      const key = keys[j]
      keys[j] = keys[j - 1]
      keys[j - 1] = key
      const tie = ties[j]
      ties[j] = ties[j - 1]
      ties[j - 1] = tie
      const at = order[j]
      order[j] = order[j - 1]
      order[j - 1] = at
      j = j - 1
    }
    i = i + 1
  }
}

/**
 * A set's names as the inside of a JSON array, in the fixed order. The names
 * are the set's own constants, which need no escaping, so this allocates
 * nothing but what it stores.
 */
const pushNames = (out: string[], mask: i32): void => {
  let first = true
  let c = 0
  while (c < CAPABILITY_COUNT) {
    if ((mask & (1 << c)) !== 0) {
      if (!first) {
        out.push(", ")
      }
      out.push('"')
      out.push(capabilityName(c))
      out.push('"')
      first = false
    }
    c = c + 1
  }
}

/**
 * Write the whole report for a compilation that has checked to `file`. It runs
 * the attribute fixpoint if nothing has yet (`analyze` is memoised, so the emit
 * that follows does not run it again). The caller has made the directory.
 */
export const writeCapabilityReport = (compilation: Compilation, file: string): void => {
  const facts = compilation.analyze()
  const root = dirname(compilation.entry().path)
  const modules = compilation.modules

  // Every function the program defines, by symbol, with its module: what a
  // witness chain is followed through, since a chain names its next hop by
  // symbol. A module's mask is the union over the functions defined in it.
  const bySymbol = new StringMap()
  const sigs: FunctionSig[] = []
  const sigModules: i32[] = []
  const paths: string[] = []
  const moduleMasks: i32[] = []
  let m = 0
  for (const unit of modules) {
    const program = unit.checker.program
    let mask = 0
    for (const sig of program.functions) {
      if (sig.definedIn(program.source)) {
        mask = mask | capsOf(facts, sig)
        if (bySymbol.get(sig.name, -1) < 0) {
          bySymbol.set(sig.name, sigs.length)
          sigs.push(sig)
          sigModules.push(m)
        }
      }
    }
    paths.push(modulePath(compilation, root, unit))
    moduleMasks.push(mask)
    m = m + 1
  }

  // Packages, sorted with the root first and the rest by name. A module's
  // group is its package, except that the standard library is a group of its
  // own whatever a dependency calls itself: ` nish/` is no package's name,
  // because npm puts a `/` only in a scoped name, which starts with `@`.
  const unitGroups: string[] = []
  for (const unit of modules) {
    if (isLibrary(compilation, unit)) {
      unitGroups.push(` ${CLI}/`)
    } else {
      unitGroups.push(unit.packageName === ROOT_PACKAGE ? "" : ` ${unit.packageName}`)
    }
  }
  const packageKeys: string[] = []
  const packageTies: string[] = []
  const packageNames: string[] = []
  const packageOrder: i32[] = []
  let u = 0
  while (u < modules.length && u < unitGroups.length) {
    const group = unitGroups[u]
    const label = group === ` ${CLI}/` ? CLI : modules[u].packageName
    if (packageKeys.indexOf(group) < 0) {
      packageOrder.push(packageNames.length)
      packageNames.push(label)
      packageKeys.push(group)
      packageTies.push("")
    }
    u = u + 1
  }
  sortTogether(packageKeys, packageTies, packageOrder)

  const program = programCapabilities(compilation, facts)
  const out: string[] = []
  out.push("{\n")
  out.push('  "version": 1,\n')
  out.push('  "entry": ')
  out.push(jsonQuote(modulePath(compilation, root, compilation.entry())))
  out.push(",\n")
  out.push(`  "deterministic": ${isDeterministic(program) ? "true" : "false"},\n`)
  out.push('  "capabilities": [')
  pushNames(out, program)
  out.push("],\n")
  out.push('  "packages": [\n')
  let p = 0
  while (p < packageOrder.length && p < packageKeys.length) {
    const at = packageOrder[p]
    const name = at >= 0 && at < packageNames.length ? packageNames[at] : ""
    const key = packageKeys[p]
    // This package's modules, by path.
    const inPackage: i32[] = []
    const modulePaths: string[] = []
    const pathTies: string[] = []
    let packageMask = 0
    let k = 0
    while (k < unitGroups.length && k < paths.length && k < moduleMasks.length) {
      // Read before the pushes below, which end what the loop's test proved.
      const inThis = unitGroups[k] === key
      const path = paths[k]
      const mask = moduleMasks[k]
      if (inThis) {
        inPackage.push(k)
        modulePaths.push(path)
        pathTies.push("")
        packageMask = packageMask | mask
      }
      k = k + 1
    }
    sortTogether(modulePaths, pathTies, inPackage)
    out.push("    {\n")
    out.push('      "name": ')
    out.push(jsonQuote(name === ROOT_PACKAGE ? ROOT_NAME : name))
    out.push(",\n")
    out.push('      "capabilities": [')
    pushNames(out, packageMask)
    out.push("],\n")
    out.push('      "modules": [\n')
    const units: ModuleUnit[] = []
    const unitMasks: i32[] = []
    for (const mi of inPackage) {
      if (mi >= 0 && mi < modules.length && mi < moduleMasks.length) {
        const mask = moduleMasks[mi]
        units.push(modules[mi])
        unitMasks.push(mask)
      }
    }
    let q = 0
    while (q < units.length && q < unitMasks.length && q < modulePaths.length) {
      const unitProgram = units[q].checker.program
      const unitPath = modulePaths[q]
      const unitMask = unitMasks[q]
      // This module's exports, every instantiation of one included, by name.
      const listed: FunctionSig[] = []
      const names: string[] = []
      const symbols: string[] = []
      const order: i32[] = []
      for (const sig of unitProgram.functions) {
        if (sig.exported && sig.definedIn(unitProgram.source)) {
          order.push(listed.length)
          listed.push(sig)
          names.push(sig.sourceName)
          symbols.push(sig.name)
        }
      }
      sortTogether(names, symbols, order)
      const sorted: FunctionSig[] = []
      for (const si of order) {
        if (si >= 0 && si < listed.length) {
          sorted.push(listed[si])
        }
      }
      out.push("        {\n")
      out.push('          "path": ')
      out.push(jsonQuote(unitPath))
      out.push(",\n")
      out.push('          "capabilities": [')
      pushNames(out, unitMask)
      out.push("],\n")
      out.push(sorted.length === 0 ? '          "functions": []\n' : '          "functions": [\n')
      let s = 0
      while (s < sorted.length) {
        const sig = sorted[s]
        const f = facts.get(sig.name)
        const mask = f === null ? 0 : f.caps
        out.push("            {\n")
        out.push('              "name": ')
        out.push(jsonQuote(sig.sourceName))
        out.push(",\n")
        out.push(`              "exported": ${sig.exported ? "true" : "false"},\n`)
        out.push('              "capabilities": [')
        pushNames(out, mask)
        out.push("],\n")
        if (f === null || mask === 0) {
          out.push('              "witnesses": {},\n')
        } else {
          out.push('              "witnesses": {\n')
          let first = true
          let c = 0
          while (c < CAPABILITY_COUNT) {
            if ((mask & (1 << c)) !== 0) {
              out.push(first ? "                " : ",\n                ")
              out.push(`"${capabilityName(c)}": [\n`)
              first = false
              // The chain, one call per line: each hop is one call nearer the
              // builtin, so it ends within `dist` hops, and the bound only
              // guards that promise. The last hop calls the builtin, or the
              // `declare function`, itself.
              let current: FunctionFacts | null = f
              let hopSig: FunctionSig = sig
              let hops = 0
              const limit = c < f.capDist.length ? f.capDist[c] + 1 : 0
              while (current !== null && hops < limit && c < current.capDist.length) {
                const site: Node | null = c < current.capSite.length ? current.capSite[c] : null
                const via: string = c < current.capVia.length ? current.capVia[c] : ""
                const dist: i32 = current.capDist[c]
                const home = bySymbol.get(hopSig.name, -1)
                const origin = hopSig.origin
                let where = ""
                if (site !== null && origin !== null && home >= 0 && home < sigModules.length) {
                  const hm = sigModules[home]
                  const hopPath = hm >= 0 && hm < paths.length ? paths[hm] : ""
                  where = `${hopPath}:${origin.lineOf(site.start)}:${origin.columnOf(site.start)}`
                }
                const callee: i32 = dist > 0 ? bySymbol.get(via, -1) : -1
                const next: FunctionFacts | null = callee >= 0 ? facts.get(via) : null
                const nextSig = callee >= 0 && callee < sigs.length ? sigs[callee] : hopSig
                const calls = callee >= 0 ? nextSig.sourceName : via
                out.push('                  { "function": ')
                out.push(jsonQuote(hopSig.sourceName))
                out.push(', "at": ')
                out.push(jsonQuote(where))
                out.push(', "calls": ')
                out.push(jsonQuote(calls))
                out.push(next !== null ? " },\n" : " }\n")
                current = next
                hopSig = nextSig
                hops = hops + 1
              }
              out.push("                ]")
            }
            c = c + 1
          }
          out.push("\n              },\n")
        }
        pushPanics(out, unitProgram, sig, unitPath, facts)
        out.push(s < sorted.length - 1 ? "            },\n" : "            }\n")
        s = s + 1
      }
      if (sorted.length > 0) {
        out.push("          ]\n")
      }
      out.push(q < units.length - 1 ? "        },\n" : "        }\n")
      q = q + 1
    }
    out.push("      ]\n")
    out.push(p < packageOrder.length - 1 ? "    },\n" : "    }\n")
    p = p + 1
  }
  out.push("  ]\n")
  out.push("}\n")
  writeFileSync(file, out.join(""))
}

/**
 * A function's panic sites (docs/LANGUAGE.md, "Panic sites"), one per line,
 * from the list `Compilation.check` settled: what the function can stop the
 * program at, beside what it can reach.
 */
const pushPanics = (
  out: string[],
  program: CheckedProgram,
  sig: FunctionSig,
  path: string,
  facts: FactsTable
): void => {
  const sites = sitesOf(program, sig.name)
  if (sites.length === 0) {
    out.push('              "panics": []\n')
    return
  }
  out.push('              "panics": [\n')
  let k = 0
  for (const site of sites) {
    out.push("                ")
    out.push(siteReportEntry(site, path, facts))
    out.push(k < sites.length - 1 ? ",\n" : "\n")
    k = k + 1
  }
  out.push("              ]\n")
}

/**
 * The one line `--capabilities` prints on stderr: the program's set in the
 * fixed order, or `none`, and whether that set is deterministic.
 */
export const capabilitySummary = (compilation: Compilation): string => {
  const program = programCapabilities(compilation, compilation.analyze())
  const names = capabilityNames(program)
  const listed = names.length === 0 ? "none" : names.join(", ")
  return `capabilities: ${listed} (${isDeterministic(program) ? "deterministic" : "not deterministic"})`
}
