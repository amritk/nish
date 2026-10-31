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
import {
  argumentCapabilities,
  builtinCapability,
  CAPABILITY_COUNT,
  capabilityIndex,
  capabilityName,
  capabilityNames,
  isDeterministic,
} from "./capabilities"
import { Compilation, ModuleUnit } from "./compilation"
import { builtinNameOf } from "./emit-util"
import { StringMap } from "./map"
import { ROOT_PACKAGE } from "./packages"
import { isStdModule } from "./std-modules"
import { dirname, relativePath, resolvePath } from "./paths"
import { N_ARRAY, N_CALL, N_IDENT, N_STRING, Node } from "./nodes"
import { SourceFile } from "./diagnostics"
import { CheckedProgram, FunctionSig } from "./program"
import { siteReportEntry, sitesOf } from "./panics"
import { compareStrings, jsonQuote, splitByte } from "./strings"

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
 * Every function the program defines, by symbol, with the report's path of
 * the module it is defined in: what a witness chain is followed through, since
 * a chain names its next hop by symbol. `moduleMasks` is each module's set,
 * the union over the functions defined in it, in `modules` order, and
 * `moduleStarts` where its functions begin in `sigs`: a module's functions
 * are pushed together, so they run to the next module's start.
 */
export class FunctionIndex {
  bySymbol: StringMap
  sigs: FunctionSig[]
  sigModules: i32[]
  paths: string[]
  moduleMasks: i32[]
  moduleStarts: i32[]

  constructor() {
    this.bySymbol = new StringMap()
    this.sigs = []
    this.sigModules = []
    this.paths = []
    this.moduleMasks = []
    this.moduleStarts = []
  }
}

export const functionIndex = (compilation: Compilation, facts: FactsTable): FunctionIndex => {
  const index = new FunctionIndex()
  const root = dirname(compilation.entry().path)
  let m = 0
  for (const unit of compilation.modules) {
    const program = unit.checker.program
    let mask = 0
    index.moduleStarts.push(index.sigs.length)
    for (const sig of program.functions) {
      if (sig.definedIn(program.source)) {
        mask = mask | capsOf(facts, sig)
        if (index.bySymbol.get(sig.name, -1) < 0) {
          index.bySymbol.set(sig.name, index.sigs.length)
          index.sigs.push(sig)
          index.sigModules.push(m)
        }
      }
    }
    index.paths.push(modulePath(compilation, root, unit))
    index.moduleMasks.push(mask)
    m = m + 1
  }
  return index
}

/**
 * One call of a witness chain: the function that makes it, where, and what it
 * calls, as the report prints them. `source` and `site` are the call itself,
 * which is where a refusal for the capability is spanned
 * (`Compilation.refuseCapabilities`); null only when the facts have no site.
 */
export class WitnessHop {
  caller: string
  at: string
  calls: string
  source: SourceFile | null
  site: Node | null

  constructor(caller: string, at: string, calls: string, source: SourceFile | null, site: Node | null) {
    this.caller = caller
    this.at = at
    this.calls = calls
    this.source = source
    this.site = site
  }
}

/**
 * The witness chain of capability `c` from `sig`, one call per hop: each hop
 * is one call nearer the builtin, so it ends within `dist` hops, and the bound
 * only guards that promise. The last hop calls the builtin, or the
 * `declare function`, itself. Empty when `sig` does not reach `c`.
 */
export const witnessChain = (
  index: FunctionIndex,
  facts: FactsTable,
  sig: FunctionSig,
  c: i32
): WitnessHop[] => {
  const chain: WitnessHop[] = []
  const f = facts.get(sig.name)
  if (f === null || (f.caps & (1 << c)) === 0) {
    return chain
  }
  let current: FunctionFacts | null = f
  let hopSig: FunctionSig = sig
  const limit = c < f.capDist.length ? f.capDist[c] + 1 : 0
  while (current !== null && chain.length < limit && c < current.capDist.length) {
    const site: Node | null = c < current.capSite.length ? current.capSite[c] : null
    const via: string = c < current.capVia.length ? current.capVia[c] : ""
    const dist: i32 = current.capDist[c]
    const home = index.bySymbol.get(hopSig.name, -1)
    const origin = hopSig.origin
    let where = ""
    if (site !== null && origin !== null && home >= 0 && home < index.sigModules.length) {
      const hm = index.sigModules[home]
      const hopPath = hm >= 0 && hm < index.paths.length ? index.paths[hm] : ""
      where = `${hopPath}:${origin.lineOf(site.start)}:${origin.columnOf(site.start)}`
    }
    const callee: i32 = dist > 0 ? index.bySymbol.get(via, -1) : -1
    const next: FunctionFacts | null = callee >= 0 ? facts.get(via) : null
    const nextSig = callee >= 0 && callee < index.sigs.length ? index.sigs[callee] : hopSig
    chain.push(new WitnessHop(hopSig.sourceName, where, callee >= 0 ? nextSig.sourceName : via, origin, site))
    current = next
    hopSig = nextSig
  }
  return chain
}

/**
 * The capabilities a dependency reaches only when the root package grants
 * them (docs/wp40-dependency-capabilities.md): the ones that step outside
 * what the language checks, that reach another machine or program, or that
 * read or change the files. Every other capability a dependency reaches
 * without a word.
 */
export const gatedCapabilities = (): i32 =>
  (1 << capabilityIndex("ffi")) |
  (1 << capabilityIndex("fs.read")) |
  (1 << capabilityIndex("fs.write")) |
  (1 << capabilityIndex("net")) |
  (1 << capabilityIndex("process.spawn")) |
  (1 << capabilityIndex("unsafe"))

/**
 * The program's dependencies -- every package but the root and the standard
 * library, asked by where a module was resolved (`isLibrary`) -- in name
 * order. `packageOf` is each module's place in `names`, in `modules` order,
 * or -1 for one of the root's or the library's. `masks` is each one's set
 * once `dependencyMasks` has filled it in.
 */
export class DependencyReach {
  names: string[]
  masks: i32[]
  packageOf: i32[]

  constructor() {
    this.names = []
    this.masks = []
    this.packageOf = []
  }
}

/** The program's dependencies, with no set yet: read off the modules alone, so asking costs no analysis. */
export const dependencyPackages = (compilation: Compilation): DependencyReach => {
  const reach = new DependencyReach()
  const ties: string[] = []
  const order: i32[] = []
  for (const unit of compilation.modules) {
    if (
      !isLibrary(compilation, unit) &&
      unit.packageName !== ROOT_PACKAGE &&
      reach.names.indexOf(unit.packageName) < 0
    ) {
      order.push(reach.names.length)
      reach.names.push(unit.packageName)
      reach.masks.push(0)
      ties.push("")
    }
  }
  sortTogether(reach.names, ties, order)
  for (const unit of compilation.modules) {
    reach.packageOf.push(isLibrary(compilation, unit) ? -1 : reach.names.indexOf(unit.packageName))
  }
  return reach
}

/**
 * Each dependency's set: the union over every function its modules define,
 * so what it reaches through the standard library or another dependency is
 * its own.
 */
export const dependencyMasks = (reach: DependencyReach, index: FunctionIndex): void => {
  let m = 0
  while (m < reach.packageOf.length && m < index.moduleMasks.length) {
    const p = reach.packageOf[m]
    if (p >= 0 && p < reach.masks.length) {
      reach.masks[p] = reach.masks[p] | index.moduleMasks[m]
    }
    m = m + 1
  }
}

/**
 * The witness chain of capability `c` from the first function of dependency
 * `p`, in source order (its modules by path, each one's functions as
 * declared), that reaches it: what a refusal of the dependency is spanned at
 * and names. Empty when none does.
 */
export const dependencyWitness = (
  index: FunctionIndex,
  facts: FactsTable,
  reach: DependencyReach,
  p: i32,
  c: i32
): WitnessHop[] => {
  const paths: string[] = []
  const ties: string[] = []
  const order: i32[] = []
  let m = 0
  while (m < reach.packageOf.length && m < index.paths.length) {
    if (reach.packageOf[m] === p) {
      paths.push(index.paths[m])
      ties.push("")
      order.push(m)
    }
    m = m + 1
  }
  sortTogether(paths, ties, order)
  for (const at of order) {
    let k = at < index.moduleStarts.length ? index.moduleStarts[at] : index.sigs.length
    const end = at + 1 < index.moduleStarts.length ? index.moduleStarts[at + 1] : index.sigs.length
    while (k < end && k < index.sigs.length) {
      const chain = witnessChain(index, facts, index.sigs[k], c)
      if (chain.length > 0 && chain[0].source !== null && chain[0].site !== null) {
        return chain
      }
      k = k + 1
    }
  }
  return []
}

/**
 * A string literal a dependency hands a builtin where the compiler can read
 * what the call reaches: a file builtin's path, a spawn's program (the first
 * element of its `argv` literal) or a `nish:net` call's host. `cap` is the
 * builtin's capability, `module` the module's place in `modules`, and `site`
 * the literal, which a refusal is spanned at.
 */
export class LiteralReach {
  value: string
  builtin: string
  site: Node
  cap: i32
  module: i32

  constructor(cap: i32, value: string, builtin: string, module: i32, site: Node) {
    this.cap = cap
    this.value = value
    this.builtin = builtin
    this.module = module
    this.site = site
  }
}

/**
 * Which arguments of builtin `name`, whose capability is `c`, name what it
 * reaches, a bit per position: a file builtin's path (both of `renameSync`'s),
 * a spawn's `argv`, and a `nish:net` call's host or socket path. `kill`,
 * `waitPid` and the priority calls name no program, so they have none.
 */
const reachArguments = (name: string, c: i32): i32 => {
  if (c === capabilityIndex("fs.read") || c === capabilityIndex("fs.write")) {
    return name === "renameSync" ? 3 : 1
  }
  if (c === capabilityIndex("process.spawn")) {
    return name === "spawnSync" ||
      name === "spawnSyncTo" ||
      name === "spawn" ||
      name === "spawnPiped" ||
      name === "spawnWithFds"
      ? 1
      : 0
  }
  if (c === capabilityIndex("net")) {
    if (name === "netAddress") {
      return 2
    }
    return name === "tcpListen" ||
      name === "tcpListenFlags" ||
      name === "udpBind" ||
      name === "unixListen" ||
      name === "unixListenMode" ||
      name === "unixConnect"
      ? 1
      : 0
  }
  return 0
}

/**
 * Every literal a module of a dependency hands a builtin that reaches an
 * argument capability (`LiteralReach`), in source order, module by module. A
 * builtin call is found as the attribute pass finds one: a plain identifier
 * no user function of that name answers. A computed argument, or a template,
 * is nothing the compiler can read, and is left to the sandbox.
 */
export const literalReaches = (compilation: Compilation, reach: DependencyReach): LiteralReach[] => {
  const out: LiteralReach[] = []
  const args = argumentCapabilities()
  let m = 0
  while (m < compilation.modules.length && m < reach.packageOf.length) {
    if (reach.packageOf[m] >= 0) {
      const unit = compilation.modules[m]
      const program = unit.checker.program
      const stack: Node[] = [unit.file]
      while (stack.length > 0) {
        const node = stack[stack.length - 1]
        stack.pop()
        let k = node.children.length - 1
        while (k >= 0) {
          stack.push(node.children[k])
          k = k - 1
        }
        if (
          node.kind === N_CALL &&
          node.children[0].kind === N_IDENT &&
          program.nodeCallees[node.id] === null
        ) {
          const name = builtinNameOf(program, node)
          const c = builtinCapability(name)
          const positions = c >= 0 && (args & (1 << c)) !== 0 ? reachArguments(name, c) : 0
          const given = node.children[1].children
          let a = 0
          while (a < given.length && a < 2) {
            if ((positions & (1 << a)) !== 0) {
              let literal = given[a]
              if (c === capabilityIndex("process.spawn")) {
                literal =
                  literal.kind === N_ARRAY && literal.children.length > 0 ? literal.children[0] : literal
              }
              if (literal.kind === N_STRING) {
                out.push(new LiteralReach(c, literal.text, name, m, literal))
              }
            }
            a = a + 1
          }
        }
      }
    }
    m = m + 1
  }
  return out
}

/**
 * Whether `host` is an address `nish:net` takes as it is (`netAddress`): four
 * dotted decimal parts of at most 255, or an IPv6 address, which is hex
 * digits, colons and, for a mapped IPv4 tail, dots, with two colons at least.
 */
export const numericHost = (host: string): boolean => {
  if (host.indexOf(":") >= 0) {
    let colons = 0
    let i = 0
    while (i < host.length) {
      const code = host.charCodeAt(i)
      const hex = (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70)
      if (!hex && code !== 58 && code !== 46) {
        return false
      }
      colons = colons + (code === 58 ? 1 : 0)
      i = i + 1
    }
    return colons >= 2
  }
  const parts = splitByte(host, 46)
  if (parts.length !== 4) {
    return false
  }
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return false
    }
    let value = 0
    let i = 0
    while (i < part.length) {
      const code = part.charCodeAt(i)
      if (code < 48 || code > 57) {
        return false
      }
      value = value * 10 + (code - 48)
      i = i + 1
    }
    if (value > 255) {
      return false
    }
  }
  return true
}

/**
 * The real path of the program `name` names, as `posix_spawnp` would find it
 * when the build runs, or null: a name with a `/` is a path from `base`, and
 * a bare one the first executable file of that name in a `PATH` directory
 * (an empty entry is the working directory, as POSIX has it).
 */
export const findProgram = (name: string, base: string): string | null => {
  if (name.indexOf("/") >= 0) {
    return executableFile(resolvePath(base, name))
  }
  const path = getenv("PATH")
  for (const dir of splitByte(path === null ? "/usr/bin:/bin" : path, 58)) {
    const found = executableFile(`${dir.length === 0 ? "." : dir}/${name}`)
    if (found !== null) {
      return found
    }
  }
  return null
}

/**
 * The real path of `path` when it is an executable file, or null. The
 * question goes to `/bin/sh` running `test -x`, as `distrustOf` in compile.ts
 * asks its own, rather than to `isExecutableSync`: that builtin is refused on
 * a wasm32 build, and `src/` is also the web compiler. The shell is named by
 * absolute path and `real` reaches it as an operand, never as script text; a
 * probe that cannot start answers null.
 */
const executableFile = (path: string): string | null => {
  const real = realpathSync(path)
  if (real === null || isDirectorySync(real)) {
    return null
  }
  const probe: string[] = ["/bin/sh", "-c", 'test -x "$1"', "sh", real]
  return spawnSyncTo(probe, "/dev/null", "/dev/null") === 0 ? real : null
}

/** The little-endian unsigned value of `count` bytes of `bytes` at `at`, or -1 past the end. */
const littleEndian = (bytes: u8[], at: i32, count: i32): i32 => {
  if (at < 0 || at + count > bytes.length) {
    return -1
  }
  let value = 0
  let k = count - 1
  while (k >= 0) {
    value = value * 256 + toI32(bytes[at + k])
    k = k - 1
  }
  return value
}

/**
 * The real path of the file the kernel runs `program` through, or null when
 * there is none: a 64-bit ELF's `PT_INTERP`, the dynamic loader, or a
 * script's `#!` line's program. An exec allowlist holds both, since the
 * kernel opens that file for execution too (docs/wp37-os-sandbox.md §2a).
 */
export const programInterpreter = (program: string): string | null => {
  const bytes = readFileBytesSync(program)
  if (bytes === null || bytes.length < 4) {
    return null
  }
  if (bytes[0] === 35 && bytes[1] === 33) {
    let at = 2
    while (at < bytes.length && (bytes[at] === 32 || bytes[at] === 9)) {
      at = at + 1
    }
    const from = at
    while (at < bytes.length && bytes[at] !== 32 && bytes[at] !== 9 && bytes[at] !== 10) {
      at = at + 1
    }
    return at > from ? executableFile(String.fromBytes(bytes, from, at)) : null
  }
  if (
    bytes[0] !== 127 ||
    bytes[1] !== 69 ||
    bytes[2] !== 76 ||
    bytes[3] !== 70 ||
    littleEndian(bytes, 4, 2) !== 258
  ) {
    return null
  }
  const table = littleEndian(bytes, 32, 4)
  const size = littleEndian(bytes, 54, 2)
  const count = littleEndian(bytes, 56, 2)
  let k = 0
  while (table >= 0 && size > 0 && k < count) {
    const header = table + k * size
    if (littleEndian(bytes, header, 4) === 3) {
      const from = littleEndian(bytes, header + 8, 4)
      const length = littleEndian(bytes, header + 32, 4)
      if (from < 0 || length <= 1 || from + length > bytes.length) {
        return null
      }
      return realpathSync(String.fromBytes(bytes, from, from + length - 1))
    }
    k = k + 1
  }
  return null
}

/**
 * What the root package reaches itself (WP40 §2a): the union of the
 * capabilities its functions, and the library functions they call, exercise
 * directly, following no call into a dependency. A capability the root does
 * not reach itself is reached only through the dependencies, so their
 * argument grants are all the sandbox has to allow of it.
 */
export const rootReach = (
  compilation: Compilation,
  facts: FactsTable,
  index: FunctionIndex,
  reach: DependencyReach
): i32 => {
  const seen = new StringMap()
  const todo: FunctionSig[] = []
  let k = 0
  while (k < index.sigs.length && k < index.sigModules.length) {
    const m = index.sigModules[k]
    if (
      m < compilation.modules.length &&
      compilation.modules[m].packageName === ROOT_PACKAGE &&
      reach.packageOf[m] < 0
    ) {
      if (!isLibrary(compilation, compilation.modules[m])) {
        seen.set(index.sigs[k].name, 1)
        todo.push(index.sigs[k])
      }
    }
    k = k + 1
  }
  let mask = 0
  while (todo.length > 0) {
    const sig = todo[todo.length - 1]
    todo.pop()
    const f = facts.get(sig.name)
    if (f === null) {
      continue
    }
    let c = 0
    while (c < CAPABILITY_COUNT && c < f.capDist.length) {
      if ((f.caps & (1 << c)) !== 0 && f.capDist[c] === 0) {
        mask = mask | (1 << c)
      }
      c = c + 1
    }
    for (const callee of f.capCallees) {
      const at = index.bySymbol.get(callee, -1)
      if (at >= 0 && at < index.sigs.length && at < index.sigModules.length && seen.get(callee, 0) === 0) {
        const m = index.sigModules[at]
        if (m < reach.packageOf.length && reach.packageOf[m] < 0) {
          seen.set(callee, 1)
          todo.push(index.sigs[at])
        }
      }
    }
  }
  return mask
}

/**
 * Write the whole report for a compilation that has checked to `file`. It runs
 * the attribute fixpoint if nothing has yet (`analyze` is memoised, so the emit
 * that follows does not run it again). The caller has made the directory.
 *
 * `cpu` is the `--cpu` level, or the empty string for the baseline. A level
 * adds a `"cpu"` key after `"entry"`, so a reader of the report knows the
 * binary needs that CPU; a baseline report has no key and stays byte for byte
 * what it was before the flag existed (docs/LANGUAGE.md, "The CPU level").
 */
export const writeCapabilityReport = (compilation: Compilation, file: string, cpu: string): void => {
  const facts = compilation.analyze()
  const root = dirname(compilation.entry().path)
  const modules = compilation.modules

  const index = functionIndex(compilation, facts)
  const paths = index.paths
  const moduleMasks = index.moduleMasks

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
  if (cpu.length > 0) {
    out.push('  "cpu": ')
    out.push(jsonQuote(cpu))
    out.push(",\n")
  }
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
              const chain = witnessChain(index, facts, sig, c)
              let h = 0
              for (const hop of chain) {
                out.push('                  { "function": ')
                out.push(jsonQuote(hop.caller))
                out.push(', "at": ')
                out.push(jsonQuote(hop.at))
                out.push(', "calls": ')
                out.push(jsonQuote(hop.calls))
                out.push(h < chain.length - 1 ? " },\n" : " }\n")
                h = h + 1
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
