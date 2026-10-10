// Whole-program compilation for stage1 (stage0's `src/compilation.ts`,
// docs/wp14-selfhost.md milestone S5).
//
// A `Compilation` owns every module of one program:
//
//   1. **Load.** Parse the entry file and, transitively, everything it
//      imports. Each file is parsed exactly once, keyed by its resolved path,
//      so an import cycle simply terminates. Every module declares its names
//      as it is parsed (pass 1a); once the whole graph is read, each binds the
//      enums and aliases it imports and then collects its signatures (pass 1).
//      That is what makes cycles legal: no body is checked until every
//      module's exports are known, and no signature until every module's enums
//      and aliases are.
//   2. **Check.** Bind each import to the exporter's signature (pass 1b),
//      close the reachable-struct set once every module is bound, reject the
//      symbol clashes that would fail at link time, then check bodies (pass 2).
//   3. **Emit.** Run the attribute analysis over *all* modules, so the purity,
//      escape and pointer facts are program-wide, then emit one module of IR
//      per source module. An imported function appears as a `declare` carrying
//      exactly the attributes its exporter's `define` does.
//
// **Module identity is the real path; the name is the first spelling.**
// `byPath` keys a module on `identityOf` its path: the file the operating
// system opens under that spelling, with every symbolic link resolved, as
// Node's resolver and `tsc` (`preserveSymlinks: false`) both answer it. So
// `./types.ts`, `types.ts`, `/abs/types.ts` and `link/types.ts` are one file
// and load once, while `far/../types.ts` is whatever file `far/..` really
// leads to. A module's *name* — its IR header, its output stem, the file its
// diagnostics cite — is the path it was first loaded under, and an import's
// name is its specifier resolved against the *name the importer was given*,
// so no emitted byte moves with the directory the compiler was run from.
// That is what D4 still means here: the driver asks the platform one question
// it needs to tell two spellings apart, and its output depends only on the
// command line. For an entry named relatively, which is how every caller
// names it, the names are the cwd-relative ones stage0 printed, which is what
// lets the IR headers match.
//
// **The name is a second string, and it is the one in the IR.** For a module
// reached by a path the name is that path as it was first spelled. A module
// reached by a *package* specifier is found through the compiler's own
// package root — `<dir of argv[0]>/..` — so its path depends on how the
// compiler was invoked rather than on anything about the program (WP19 §A7's
// third bullet). Its identity is still built from that path, because a file
// still has to be opened; its name is its path inside the package, which is
// what stage0 has always written.
//
// The one thing this driver does not do is decide where the output goes: it
// answers with the IR text per module and the stem each module's file should
// use, and `src/compile.ts` writes them. There is no `mkdir` here (D4).

import { analyzeFunctions, AnalysisUnit, FactsTable } from "./attributes"
import { arenaBlockFindings, arenaLoopFindings } from "./escape"
import { portabilityFindings } from "./portability"
import { Checker } from "./checker"
import { Diagnostic, DiagnosticSink, Edit, SourceFile } from "./diagnostics"
import { codeFor } from "./codes"
import { emitProgram } from "./emit"
import { StringMap, StringSet } from "./map"
import {
  isBuiltinSpecifier,
  isNishSourceModule,
  nishModuleExports,
  SECRET_SPECIFIER,
  unsafeModule,
} from "./nish-modules"
import { N_CONSTRUCTOR, Node } from "./nodes"
import { Options } from "./options"
import { layoutInlineArrays } from "./inline-arrays"
import { proveCallSiteRanges } from "./ranges"
import { reportUncheckedIndexSites } from "./unsafe-migrate"
import { PanicSite, panicsJson, reportDeniedPanics, resolvePanicSites } from "./panics"
import { arenaJson } from "./arena-report"
import {
  allCapabilities,
  CAPABILITY_COUNT,
  capabilityIndex,
  capabilityName,
  capabilityNames,
  everyCapabilityName,
  optInCapabilities,
} from "./capabilities"
import { functionIndex, witnessChain } from "./capability-report"
import {
  PACKAGE_ROOT_SEGMENT,
  packageDirOf,
  packageNameOf,
  parseBareSpecifier,
  ROOT_PACKAGE,
} from "./packages"
import { ParentTable } from "./parents"
import { Parser } from "./parser"
import {
  CheckedProgram,
  EnumInfo,
  FunctionSig,
  ImportBinding,
  STRUCT_CLASS,
  StructRegistry,
  StructTemplateInfo,
} from "./program"
import {
  basename,
  basenameWithout,
  dirname,
  joinPath,
  normalizePath,
  relativePath,
  resolveModule,
  resolvePath,
} from "./paths"
import {
  BUILTIN_SCHEME,
  CLI,
  LANGUAGE,
  PACKAGE_CONDITION,
  packageConditionFor,
  STD_PREFIX,
  VERSION,
} from "./branding"
import {
  ENGINE_TOO_OLD,
  ENGINE_UNREADABLE,
  MANIFEST_FOUND,
  MANIFEST_NOT_NISH,
  MANIFEST_OTHER_MODE,
  manifestEngineCheck,
  manifestEngineRange,
  manifestMalformedAt,
  manifestCapabilities,
  manifestNish,
  manifestNoPanic,
  manifestVersion,
  ManifestList,
  NishManifest,
  nishExportEntry,
} from "./manifest"
import {
  COLLECTIONS_SPECIFIER,
  isStdModuleName,
  SECRET_STD_SPECIFIER,
  stdModuleName,
  stdModuleNames,
  stdModulePath,
} from "./std-modules"
import {
  allocationWarning,
  arenaMessage,
  escapeMessage,
  parallelBodyOf,
  reachesDstMessage,
  reduceMessage,
  resultMessage,
  scopeFindings,
  sharedWriteMessage,
  taskArgumentMessage,
  taskArrowMessage,
  threadsModuleName,
} from "./parallel"
import { RuntimeTable } from "./runtime"
import { exposeMessages } from "./secret"
import { splitByte } from "./strings"
import { TypeTable } from "./types"
import { columnOf, lineOf } from "./lexer"
import { validate } from "./validator"
import { buildModeOf, hostVisible, isWasmBuild } from "./visibility"
import { CheckContext, NUMBER_MODE_F64 } from "./context"

const SLASH: i32 = 47

/**
 * How many directories the `node_modules` walk visits before it gives up
 * (`Compilation.findPackageDir`).
 *
 * Something has to end a relative walk, because it cannot recognise the
 * filesystem root: `/..` is `/`, so each step past the root re-asks what the
 * root already answered and the loop would never stop. 256 levels above the
 * importing directory is two orders of magnitude past any working directory a
 * compiler is run in, and it keeps a failed resolution instant — the spelled
 * paths get longer as the walk climbs, and probing to PATH_MAX's worth of them
 * costs about 1.8 s of kernel time where this costs a few milliseconds. What is
 * left outside it is a package above a directory 256 deep, which needs the
 * `cwd` builtin WP19 §A3 keeps out rather than a bigger number.
 */
const PACKAGE_WALK_LIMIT: i32 = 256

/**
 * What resolving one specifier answers: the file, the name that file carries,
 * the package it is in when the specifier says, and the diagnostic when it says
 * nothing that resolves (WP21 S2).
 *
 * `name` differs from `path` only for a package specifier, where the path is
 * the compiler's own install and the name is the module's place inside the
 * package (WP19 §A7). `packageName` is `""` when the specifier does not state a
 * package — a relative import stays wherever its path puts it — and
 * `packages.ts` reads it off the path for those. `error` is `""` when the
 * resolution worked; an error value rather than a throw, because the language
 * has no exceptions and the caller has a sink to report into either way.
 */
export interface ResolvedModule {
  path: string
  name: string
  packageName: string
  error: string
}

/**
 * Where one package of the program is: the directory its manifest was read
 * from, as the resolver spelled it, the real directory that is its identity,
 * and the manifest's version, which is what a reader tells two copies apart by.
 */
export class PackageCopy {
  name: string
  dir: string
  realDir: string
  /** The directory its modules are named under: `dir`, or `realDir` spelled like it when a link is in the way. */
  namedDir: string
  version: string

  constructor(name: string, dir: string, realDir: string, namedDir: string, version: string) {
    this.name = name
    this.dir = dir
    this.realDir = realDir
    this.namedDir = namedDir
    this.version = version
  }
}

/** One source module: its identity, its tree, and the checker that owns it. */
export class ModuleUnit {
  /**
   * The resolved path, as the first import or root to reach the file spelled
   * it: the file that was opened, and what `byPath` is keyed on through
   * `identityOf`. It is the name as well for every module
   * reached by a path — which is all of them but a package's.
   */
  path: string
  /**
   * The name in the IR header, the `DIFile`, the diagnostics and the output
   * path when there is no `-o`: `path` for an ordinary module, and the module's
   * place inside its package for one reached by a package specifier
   * (`std/text.ts`). `source.path` is this string, which is how it reaches
   * every one of those (WP19 §A7).
   */
  name: string
  source: SourceFile
  file: Node
  nodeCount: i32
  /** The entry module; the only one allowed to declare `export function main`. */
  isEntry: boolean
  /** Phase 0 refused it: nothing after that ran on it, and nothing it imports was loaded. */
  refused: boolean
  /** Pass 1a or pass 1 reported something here, so what it imports goes unreported (`settleLoad`). */
  signaturesFailed: boolean
  /**
   * The package this module belongs to (WP21 S1, `src/packages.ts`); `""` for
   * the root package, which is where every module of a single-package program
   * lives. Derived from `name`, which is the same string stage0 derives it
   * from, so the two compilers put a module in the same package (WP19 §A3) —
   * and a package specifier states it outright anyway, which is every module
   * whose name is not its path.
   */
  packageName: string
  checker: Checker
  parents: ParentTable
  /** Specifier text -> index into `Compilation.modules`, for this importer. */
  resolved: StringMap
  /**
   * The identity and the name of every module this one asked `discover` for,
   * in import order, whether or not it parsed: the edges `settleLoad` walks.
   */
  importedIdentities: string[]
  importedNames: string[]

  constructor(
    path: string,
    name: string,
    source: SourceFile,
    file: Node,
    nodeCount: i32,
    isEntry: boolean,
    checker: Checker,
    packageName: string
  ) {
    this.path = path
    this.name = name
    this.source = source
    this.file = file
    this.nodeCount = nodeCount
    this.isEntry = isEntry
    this.packageName = packageName
    this.checker = checker
    this.parents = new ParentTable(file, nodeCount)
    this.resolved = new StringMap()
    this.refused = false
    this.signaturesFailed = false
    this.importedIdentities = []
    this.importedNames = []
  }
}

/** One module's IR, with the stem its `.ll` file should be named after and the module's name. */
export class EmittedModule {
  stem: string
  ir: string
  /** `ModuleUnit.name`: what `-o <file.ll>` lists when there is more than one. */
  name: string

  constructor(stem: string, ir: string, name: string) {
    this.stem = stem
    this.ir = ir
    this.name = name
  }
}

/** The performance warnings whose finding is memory that stays allocated after nothing can reach it (`--deny-retention`). */
const isRetentionCode = (code: string): boolean =>
  code === "NL9002" || code === "NL9003" || code === "NL9011" || code === "NL9016"

/**
 * Whether a performance warning is a deprecated flag's (NL9014, NL9015;
 * `Compilation.reportDeprecatedFlags`). `nish run` prints these and no other
 * performance warning: the rest is advice about the IR, and a deprecation is
 * about the command line the script is run with.
 */
export const isDeprecationWarning = (warning: Diagnostic): boolean => {
  const code = codeFor("performance", warning.text)
  return code === "NL9014" || code === "NL9015"
}

export class Compilation {
  opts: Options
  /** Shared by every module, so a type id means one thing across the program. */
  table: TypeTable
  sink: DiagnosticSink
  runtime: RuntimeTable
  /** Load order: entry first, then imports depth-first. */
  modules: ModuleUnit[]
  /** `identityOf` a module's resolved path -> index into `modules`. */
  byPath: StringMap
  /**
   * Package name -> index into `packageCopies`: the one directory each package
   * of the program is compiled from, so a second directory for a name already
   * seen is refused rather than compiled as a second copy (#198).
   */
  packageIndex: StringMap
  packageCopies: PackageCopy[]
  /**
   * The working directory as an absolute path, or `""` when it cannot be
   * resolved. It is read for two things: `identityOf`'s fallback, and
   * spelling a linked package's real directory the way the walk that found
   * it was spelled — relative, when the program was named relatively
   * (`resolveBareSpecifier`). No other name reads it, so no output path,
   * header or diagnostic of a program without links moves with the directory
   * the compiler was run from (WP19 §A3).
   *
   * The fallback is for a path `realpathSync` cannot answer, which is a file
   * that is not there — and loading one fails whatever it is keyed on. When
   * this is `""` as well the key is the spelling normalised, which still
   * makes `./types.ts` and `types.ts` meet.
   */
  workingDir: string
  /**
   * The root file `load` could not read, or `""`. A root has no importer to
   * point at, so the failure is not a diagnostic with a span; the driver owns
   * the wording and the stream, which is how it can answer `--json` with the
   * object stage0 answers with (`src/compile.ts`).
   */
  unreadableRoot: string
  /**
   * The whole-program attribute fixpoint, once it has been computed.
   * `analyze()` memoises it here for the reason stage0's `src/compilation.ts` memoises
   * its own: the emitter needs it and so does the `--emit-checked` dump, and
   * the fixpoint is the most expensive thing either of them asks for.
   */
  facts: FactsTable | null
  /** How many diagnostics Phase 0 reported, over every module loaded so far. */
  validationErrors: i32
  /**
   * `--emit-ast` is answered from the parsed and validated modules, and stage0
   * reaches its dump before it looks at anything pass 1 recorded — so a pass 1
   * refusal must not stop the load here either. Phase 0 still does: stage0's
   * validator throws, and a program it refuses prints no tree on either side.
   */
  dumpOnly: boolean
  /** The analysis units the fixpoint ran over, in `modules` order. */
  analysisUnits: AnalysisUnit[]
  /**
   * The package directory the entry lives in, and so the one that *is* the
   * root package (WP21 S1). A module sharing it is the program's own code and
   * carries no symbol prefix; a module under some other `node_modules/<name>`
   * is a dependency and carries that package's.
   */
  rootPackageDir: string
  /**
   * Per module, in `modules` order: whether it is in the no-panic scope, by
   * `--deny-panics` (every module of the root package) or by the root
   * package's `"nish".noPanic` (`readNoPanic`).
   */
  panicScope: boolean[]
  /**
   * WP36: the root package's `"nish".capabilities` policy as masks, read by
   * `readCapabilityPolicy`: what its `allow` grants (every bit when it has no
   * `allow`, so the command line's allowlist intersects with it by `&`) and
   * what its `deny` refuses.
   */
  manifestAllow: i32
  manifestDeny: i32

  constructor(opts: Options) {
    this.opts = opts
    this.table = new TypeTable()
    this.table.json = opts.json
    this.sink = new DiagnosticSink()
    this.runtime = new RuntimeTable()
    this.modules = []
    this.byPath = new StringMap()
    this.packageIndex = new StringMap()
    this.packageCopies = []
    const cwd = realpathSync(".")
    this.workingDir = cwd === null ? "" : cwd
    this.unreadableRoot = ""
    this.facts = null
    this.analysisUnits = []
    this.rootPackageDir = ""
    this.panicScope = []
    this.manifestAllow = -1
    this.manifestDeny = 0
    this.validationErrors = 0
    this.dumpOnly = false
  }

  entry(): ModuleUnit {
    return this.modules[0]
  }

  /**
   * Which package a module is in (WP21 S1). Everything that shares the entry's
   * package directory is the root package — for an ordinary program that is
   * "no package directory at all", so every module of it is — and everything
   * under some other `node_modules/<name>` is that package.
   *
   * Comparing directories rather than names is what stops a compiler invoked
   * on a file that is itself inside `node_modules/<pkg>` from treating its own
   * entry as one of its dependencies.
   *
   * A path with no `node_modules/<name>` in it may still be inside a package:
   * one reached through a link is named by its real directory, which a
   * workspace keeps anywhere (`node_modules/foo -> ../packages/foo`). So such
   * a path is first looked for under the real directory of every package the
   * program has resolved, the deepest first, and only when none holds it is
   * it the root package's. Without that, a linked package's own relative
   * imports joined the root package and clashed with it.
   */
  packageOf(modulePath: string): string {
    const dir = packageDirOf(modulePath)
    if (dir.length > 0) {
      return dir === this.rootPackageDir ? ROOT_PACKAGE : packageNameOf(modulePath)
    }
    let found = ROOT_PACKAGE
    let depth = 0
    for (const copy of this.packageCopies) {
      if (copy.namedDir.length > depth && modulePath.startsWith(`${copy.namedDir}/`)) {
        found = copy.name
        depth = copy.namedDir.length
      }
    }
    return found
  }

  /**
   * Which file `path` is, as the key `byPath` files a module under: its real
   * path, every symbolic link on the way resolved, exactly as Node and `tsc`
   * (`preserveSymlinks: false`) identify a module. A command line may name a
   * file `./types.ts`, by its absolute path, or through a linked directory,
   * while an import of it resolves to `types.ts`; keyed on the spelling those
   * were two modules of one file, which then clashed with themselves (NL3028)
   * or emitted one `.ll` twice (#198). The first spelling to load stays the
   * module's path and name.
   *
   * `path` is handed over as spelled rather than normalised first, because
   * normalising is lexical and a link is not: with `far` a link to
   * `elsewhere/inner`, `far/../types.ts` opens `elsewhere/types.ts`, and
   * collapsing it to `types.ts` would make a second file the first one and
   * skip it. A path `realpathSync` cannot answer is a file that is not there,
   * whose load fails whatever it is keyed on, so it keeps the lexical key.
   */
  identityOf(path: string): string {
    const real = realpathSync(path)
    return real === null ? resolvePath(this.workingDir, path) : real
  }

  /**
   * Load `path` and everything it imports. Answers false when a file could not
   * be read or a module failed to parse or Phase 0. A module's own errors are
   * in the sink; a *root* that could not be opened is in `unreadableRoot`,
   * because it has no span and no importer to report it against.
   *
   * Call it once per root: the second and later ones are modules nothing
   * imports, and a path already loaded answers true without reparsing.
   *
   * Three steps, each over every module the root brings in before the next
   * starts. `discover` parses the import graph, sweeps each module with Phase 0
   * and declares its names (pass 1a); `bindTypeImports` binds the enums and
   * aliases each one imports; then pass 1 collects the signatures. Pass 1 used
   * to run as each module was parsed, before anything it imports had been
   * read, so a name it imported was resolved provisionally as a class — which
   * an enum or an alias, having no layout, cannot stand in for. A module an
   * earlier root loaded is already through all three, so a later root's
   * modules may bind to it.
   */
  load(path: string, name: string, packageOverride: string): boolean {
    const first = this.modules.length
    const firstDiagnostic = this.sink.count()
    const filesBefore = this.sink.fileOrder.size()
    const discovered = this.discover(path, name, packageOverride)
    if (this.modules.length === first) {
      return discovered // already loaded, unreadable, or it did not parse
    }
    let i = first
    while (i < this.modules.length) {
      const unit = this.modules[i]
      if (!unit.refused) {
        // Beside `imports`, as `check` builds them for pass 1b, with `null`
        // for a builtin and for a specifier that did not reach a loaded module.
        const targets: (CheckedProgram | null)[] = []
        for (const imp of unit.checker.program.imports) {
          const index = isBuiltinSpecifier(imp.specifier) ? -1 : unit.resolved.get(imp.specifier, -1)
          targets.push(index < 0 ? null : this.modules[index].checker.program)
        }
        unit.checker.bindTypeImports(targets)
      }
      i = i + 1
    }
    i = first
    while (i < this.modules.length) {
      const unit = this.modules[i]
      if (!unit.refused) {
        const before = this.sink.count()
        unit.checker.collectSignatures() // pass 1
        // Only what it reported against itself: an imported alias is resolved
        // in its own module, so a broken one is that module's diagnostic, and
        // the walk has to reach that module to keep it.
        let k = before
        while (k < this.sink.count() && !unit.signaturesFailed) {
          unit.signaturesFailed = this.sink.items[k].source === unit.source
          k = k + 1
        }
      }
      i = i + 1
    }
    // A load that reported nothing has nothing to drop or reorder, and every
    // parse or Phase 0 failure reports, so `discovered` is already the answer.
    if (this.sink.count() === firstDiagnostic) {
      return discovered
    }
    return this.settleLoad(first, firstDiagnostic, filesBefore)
  }

  /**
   * Make the report the one a load that ran pass 1 module by module made.
   *
   * That load did not read what a module imports once the module's own
   * signatures had failed: a duplicate function in the entry hid an imported
   * module's refusals (`tests/link/main_in_import`). `discover` has to read
   * them before any signature exists, so the modules that load would never
   * have reached are found again by walking the import edges from the root in
   * the order it did, and their diagnostics are dropped. The walk also gives
   * the order that load mentioned files in, which is the report's order
   * (`DiagnosticSink.compare`), so the files first mentioned during this call
   * are ranked by it rather than by when each was mentioned here. Answers
   * whether a module it would have loaded failed to parse or Phase 0.
   */
  settleLoad(first: i32, firstDiagnostic: i32, filesBefore: i32): boolean {
    const seen: boolean[] = []
    let i = 0
    while (i < this.modules.length) {
      seen.push(i < first)
      i = i + 1
    }
    const reached: string[] = []
    const loaded = this.reach(first, seen, reached)
    const reachedNames = new StringSet()
    for (const reachedName of reached) {
      reachedNames.add(reachedName)
    }
    const kept: Diagnostic[] = []
    i = 0
    while (i < this.sink.items.length) {
      const item = this.sink.items[i]
      if (i < firstDiagnostic || reachedNames.has(item.source.path)) {
        kept.push(item)
      }
      i = i + 1
    }
    this.sink.items = kept
    const order = new StringMap()
    i = 0
    while (i < filesBefore) {
      order.set(this.sink.fileOrder.keyAt(i), i)
      i = i + 1
    }
    for (const reachedName of reached) {
      if (this.sink.fileOrder.has(reachedName) && !order.has(reachedName)) {
        order.set(reachedName, order.size())
      }
    }
    this.sink.fileOrder = order
    return loaded
  }

  /**
   * One module of `settleLoad`'s walk, and then what it imports, depth first:
   * `false` when a module the walk reaches did not parse or was refused by
   * Phase 0. A module whose signatures failed is reached, and the walk stops
   * there, as the load it reproduces did (`dumpOnly` excepted, which read on).
   */
  reach(index: i32, seen: boolean[], reached: string[]): boolean {
    const unit = this.modules[index]
    seen[index] = true
    reached.push(unit.name)
    if (unit.refused) {
      return false
    }
    if (unit.signaturesFailed && !this.dumpOnly) {
      return true
    }
    let loaded = true
    let k = 0
    while (k < unit.importedIdentities.length) {
      const target = this.byPath.get(unit.importedIdentities[k], -1)
      if (target < 0) {
        reached.push(unit.importedNames[k]) // it did not parse, and its errors are the report
        loaded = false
      } else if (target < seen.length && !seen[target] && !this.reach(target, seen, reached)) {
        loaded = false
      }
      k = k + 1
    }
    return loaded
  }

  /**
   * Read, parse and register one module. `name` is what the module is called
   * in its IR header, its diagnostics and its output path — the path itself
   * for everything but a package module, whose path is this compiler's install
   * and whose name is its place inside the package (WP19 §A7).
   * `packageOverride` is the package it belongs to when the specifier that
   * reached it already says, and `""` when the path is what decides. Only a
   * `nish/` import says: the standard library is package `nish` wherever the
   * compiler was installed, and reading it off the path would answer `nish`
   * from `node_modules/nish/std/` and the *root* package from a checkout — so
   * one program would compile installed and collide in a checkout, which is
   * the clash `packages.ts` exists to prevent.
   */
  discover(path: string, name: string, packageOverride: string): boolean {
    const identity = this.identityOf(path)
    const at = this.byPath.get(identity, -1)
    if (at >= 0) {
      return true
    }
    const text = readFileSyncOrNull(path)
    if (text === null) {
      // A root has no importer to point at, so this is not a diagnostic with a
      // span. Record it and let the driver report it in whichever shape was
      // asked for; an *import* that cannot be read is reported below, against
      // the specifier that named it.
      this.unreadableRoot = path
      return false
    }
    const source = new SourceFile(name, text)
    const parser = new Parser(source)
    const file = parser.parseSourceFile()
    // Recorded rather than printed, because the stream and the shape are the
    // driver's to choose. Printed here, a parser refusal was the human report
    // whatever the command line said, so `--json` answered a program stage1's
    // grammar cannot read with an exit status, an empty stdout and text on a
    // stream the contract says is empty — the one thing `docs/LANGUAGE.md`
    // promises `--json` never does.
    for (const diagnostic of parser.diagnostics) {
      this.sink.add(diagnostic)
    }
    if (parser.diagnostics.length > 0) {
      return false
    }
    const isEntry = this.modules.length === 0
    if (isEntry) {
      this.rootPackageDir = packageDirOf(name)
    }
    const packageName = packageOverride.length > 0 ? packageOverride : this.packageOf(name)
    // `--unchecked-indexing` and `--wrapping` reach the entry package and
    // nothing else: a dependency, and the `nish/` library, which is package
    // `nish` wherever it is installed, keep every check and every `nsw` their
    // authors compiled them with. What a program means to leave unchecked
    // beyond its own modules it says at the call, through `nish:unsafe`.
    const ownPackage = packageName === ROOT_PACKAGE
    const checker = new Checker(
      this.table,
      source,
      file,
      isEntry,
      parser.nodeCount,
      this.sink,
      this.opts.numberMode,
      this.opts.wrapping && ownPackage,
      this.opts.uncheckedIndexing && ownPackage,
      this.opts.strictExports,
      packageName
    )
    checker.ctx.wasm = isWasmBuild(this.opts)
    const unit = new ModuleUnit(path, name, source, file, parser.nodeCount, isEntry, checker, packageName)
    // WP29 P1 (wp20 §8c.3): a program that imports `nish/threads` is compiled
    // with `--threads`, because every worker a region starts bumps an arena of
    // its own. It is a soundness requirement rather than a default: the rules
    // in `src/parallel.ts` leave arena allocation out of a shared write only
    // because the arena is thread-local. A program that does not import it is
    // compiled exactly as it was.
    if (packageName === CLI && name === threadsModuleName()) {
      this.opts.threads = true
    }
    this.byPath.set(identity, this.modules.length)
    this.modules.push(unit)

    // Phase 0 before pass 1a, so what is forbidden by design is refused before
    // the checker can report it as merely unsupported. The count around it is
    // what `--emit-ast` reads: stage0 answers that flag from the parsed and
    // *validated* modules and never checks anything, so a Phase 0 refusal
    // stops the dump there and a pass 1 diagnostic — which stage0 has not
    // reached — does not (`src/compile.ts`, WP19 §A3).
    const beforeValidation = this.sink.count()
    validate(checker.ctx, file)
    const failedValidation = this.sink.count() > beforeValidation
    this.validationErrors = this.validationErrors + (this.sink.count() - beforeValidation)
    if (failedValidation) {
      // Phase 0 refused the file, and that ends the compilation rather than
      // going on to pass 1: stage0's validator `throw`s out of `load` and the
      // driver reports the one diagnostic (stage0's `src/validator.ts`, `fail`). Going
      // on meant the checker refused `any` a second time, from the annotation
      // resolver, for one `any` in the source (WP19 §A3).
      unit.refused = true
      return false
    }
    const beforeNames = this.sink.count()
    checker.declareNames() // pass 1a, which also validates the import syntax
    // Pass 1a refused something in this module. Its specifiers are still
    // *resolved* — a missing module is reported either way — but the modules
    // that do exist are not loaded, so nothing they would have said is
    // reported: stage0 stops at what this module got wrong, and a duplicate
    // function in the entry hides an imported module's own refusals
    // (`tests/link/main_in_import` in f64 mode, `tests/link/missing_module`
    // for the half that still reports). A refusal in pass 1 proper is found
    // only once everything is loaded, and `settleLoad` drops what this would
    // have hidden. `--emit-ast` is exempt: it prints the tree of every module
    // it managed to read, and stage0 reaches that dump before it looks at
    // anything pass 1 recorded.
    unit.signaturesFailed = this.sink.count() > beforeNames
    const signaturesFailed = unit.signaturesFailed && !this.dumpOnly
    const dir = dirname(path)
    let ok = true
    // There is one binding per imported name, and `unit.resolved` only learns a
    // specifier that resolved, so `import { x, y } from "dep"` used to report a
    // package or module that is not there once per name (#434). The bindings
    // of one statement are pushed together (`src/declarations.ts`), so the
    // statement that last failed is the only one whose siblings can follow.
    let failedDecl: Node | null = null
    for (const imp of checker.program.imports) {
      // A builtin module has no file behind it; pass 1b binds it instead.
      if (isBuiltinSpecifier(imp.specifier)) {
        continue
      }
      if (unit.resolved.has(imp.specifier)) {
        continue
      }
      // A one-slot memo, sound only while `collectImports` pushes a statement's bindings contiguously.
      if (failedDecl !== null && failedDecl === imp.decl) {
        continue
      }
      const found = this.resolveSpecifier(dir, imp.specifier)
      if (found.error.length > 0) {
        // At the module specifier, where stage0 points
        // (`imp.node.moduleSpecifier` in stage0's `src/compilation.ts`).
        const fix: Edit[] = checker.ctx.errored
          ? []
          : fsSpecifierFix(checker.ctx, checker.program.imports, imp)
        if (fix.length > 0) {
          // The span `errorAtSpecifier` reports: the literal, quotes and all.
          checker.ctx.sink.reportFix(checker.ctx.source, fix[0].start - 1, fix[0].end + 1, found.error, fix)
        } else {
          checker.ctx.errorAtSpecifier(imp.decl, found.error)
        }
        checker.ctx.errored = false
        failedDecl = imp.decl
        continue
      }
      const target = found.path
      if (readFileSyncOrNull(target) === null) {
        checker.ctx.errorAtSpecifier(
          imp.decl,
          imp.specifier.startsWith(STD_PREFIX)
            ? `Module \`${imp.specifier}\` is not part of the standard library (it has: ${stdModuleNames()})`
            : `Cannot find module \`${imp.specifier}\` (looked for ${target})`
        )
        checker.ctx.errored = false
        failedDecl = imp.decl
        continue
      }
      if (signaturesFailed) {
        continue // resolved, and deliberately not loaded: see above
      }
      // A module that fails to load is reported and the others still load;
      // `check` stops before binding anything.
      const targetIdentity = this.identityOf(target)
      unit.importedIdentities.push(targetIdentity)
      unit.importedNames.push(found.name)
      if (!this.discover(target, found.name, found.packageName)) {
        ok = false
      } else {
        unit.resolved.set(imp.specifier, this.byPath.get(targetIdentity, -1))
      }
    }
    return ok
  }

  /**
   * The file one import specifier names, and the package it puts that file in.
   *
   * Four forms, in the order they are recognised: `nish:x` is a builtin and
   * never reaches here; `nish/x` is the standard library beside this compiler
   * and is package `nish` wherever it was installed; `./x` and `../x` are
   * files, and say nothing about a package; anything else is a bare specifier
   * and is a package (WP21 S2).
   */
  resolveSpecifier(dir: string, specifier: string): ResolvedModule {
    if (isNishSourceModule(specifier)) {
      // `nish:secret` is a builtin module with source behind it
      // (`src/nish-modules.ts`): the library's `std/secret.ts`, in package
      // `nish`, which is what the rules of `src/secret.ts` recognise it by.
      const root = this.opts.packageRoot.length > 0 ? this.opts.packageRoot : "."
      const secretModule: ResolvedModule = {
        path: stdModulePath(root, SECRET_STD_SPECIFIER),
        name: stdModuleName(SECRET_STD_SPECIFIER),
        packageName: CLI,
        error: "",
      }
      return secretModule
    }
    if (specifier === SECRET_STD_SPECIFIER) {
      // One spelling for one module: the rules are the builtin module's, so it
      // is imported by the builtin module's name.
      const spelled: ResolvedModule = {
        path: "",
        name: "",
        packageName: "",
        error: `\`${SECRET_STD_SPECIFIER}\` is the builtin module \`${SECRET_SPECIFIER}\`: import \`Secret\`, \`secret\`, \`expose\`, \`exposeWith\` and \`wipe\` from \`${SECRET_SPECIFIER}\``,
      }
      return spelled
    }
    if (specifier.startsWith(STD_PREFIX)) {
      const name = specifier.substring(STD_PREFIX.length)
      if (name.length > 0 && !isStdModuleName(name)) {
        // Refused before it is resolved, because what is wrong with it is the
        // name rather than the file: a specifier that climbs out of the package
        // is named by where that package happens to sit, so the same program
        // would carry a different `; ModuleID` under every install (§A7).
        const escaped: ResolvedModule = {
          path: "",
          name: "",
          packageName: "",
          error: `Module \`${specifier}\` climbs out of the standard library; a \`${STD_PREFIX}\` specifier names a module inside it, so no segment may be empty or begin with a \`.\``,
        }
        return escaped
      }
      // Two strings, deliberately: the path says where the file is on *this*
      // install and the name says where the module is in the package, and only
      // the second one reaches the IR (§A7's third bullet).
      //
      // A driver that never looked for its package — the `--emit-checked`
      // dump entries the stage1 oracles build (`src/dump-checked.ts`) — is
      // answered from the working directory. Without it `/std/<name>.ts` was
      // asked for, and a corpus program importing the library could not be
      // dumped at all. `compile.ts` always hands over a root, so the command
      // never reaches this: a `std/` in whatever directory it was started in
      // is not the library (docs/security/cli.md, CLI-2).
      const std: ResolvedModule = {
        path: stdModulePath(this.libraryRoot(), specifier),
        name: stdModuleName(specifier),
        packageName: CLI,
        error: "",
      }
      return std
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolvedPath = resolveModule(dir, specifier)
      const relative: ResolvedModule = {
        path: resolvedPath,
        name: resolvedPath,
        packageName: "",
        error: "",
      }
      return relative
    }
    return this.resolveBareSpecifier(dir, specifier)
  }

  /**
   * `import { blake3 } from "@scope/hash"` (WP21 S2, `docs/wp21-packages.md`
   * §5b, §6).
   *
   * Node's algorithm, and deliberately not a resolver of our own: npm already
   * owns the registry, the lockfile and the layout. What is ours is the
   * condition — `nish`, or its mode-qualified spelling — and reading the
   * `exports` map here rather than delegating is what makes a package that
   * offers no Nish source fail saying so, which a resolver that only answers
   * "unresolved" could never do.
   *
   * The package is **stated** here rather than read back off the resolved path:
   * this is the code that found the manifest, so it is the code that knows
   * which package the file is in.
   */
  resolveBareSpecifier(dir: string, specifier: string): ResolvedModule {
    const failed: ResolvedModule = { path: "", name: "", packageName: "", error: "" }
    const parsed = parseBareSpecifier(specifier)
    if (parsed === null) {
      // Pass 1 refuses a specifier that is neither relative nor a package name,
      // so reaching here with one is a broken invariant rather than a user
      // error. The sink is not the place for it and neither is a panic in a
      // resolver, so it answers the same "cannot find" the caller reports.
      failed.error = `Cannot find package \`${specifier}\`; no \`${PACKAGE_ROOT_SEGMENT}\` directory above the importing module has it`
      return failed
    }
    const foundDir = this.findPackageDir(dir, parsed.name)
    if (foundDir === null) {
      failed.error = `Cannot find package \`${parsed.name}\`; no \`${PACKAGE_ROOT_SEGMENT}\` directory above the importing module has it`
      return failed
    }
    // A package is its real directory, as it is to Node's resolver, so one
    // package reached through links (pnpm's layout) is one package, and its
    // own dependencies are looked for beside where it really is. The spelling
    // the walk found is kept unless a link is in the way, so a program with no
    // links names every module as before; through a link the real directory
    // is spelled the way the walk was, relative to the working directory when
    // that was relative, so a name never carries where the checkout sits.
    const identity = this.identityOf(foundDir)
    let packageDir = foundDir
    if (this.workingDir.length > 0 && identity !== resolvePath(this.workingDir, foundDir)) {
      packageDir = foundDir.startsWith("/") ? identity : relativePath(this.workingDir, identity)
    }
    const manifestPath = joinPath([packageDir, "package.json"])
    const manifest = readFileSyncOrNull(manifestPath)
    const mode = this.opts.numberMode === NUMBER_MODE_F64 ? "f64" : "i32"
    const otherMode = mode === "f64" ? "i32" : "f64"
    // `findPackageDir` only answers a directory whose manifest it could read, so
    // the null here is a file that vanished between the two reads. It takes the
    // same route as a manifest with nothing in it for us, which is the honest
    // answer: this compiler found no Nish entry point in that package.
    const text = manifest === null ? "" : manifest
    // One package name at two real directories is two copies of it (npm's
    // duplicates, or §7's diamond), and a program compiles one copy of a
    // package: refused in words, where it used to be refused by accident as a
    // symbol clash between the copies.
    const version = manifestVersion(text)
    const seen = this.packageIndex.get(parsed.name, -1)
    if (seen < 0) {
      this.packageIndex.set(parsed.name, this.packageCopies.length)
      this.packageCopies.push(new PackageCopy(parsed.name, foundDir, identity, packageDir, version))
    } else if (this.packageCopies[seen].realDir !== identity) {
      const first = this.packageCopies[seen]
      failed.error = `Package \`${parsed.name}\` is at two places, ${first.dir} (${describeVersion(first.version)}) and ${foundDir} (${describeVersion(version)}): ${LANGUAGE} compiles one copy of a package per program, so every import of it has to reach the same directory`
      return failed
    }
    // The floor is checked before the entry point, and whether or not there is
    // one: a package that names a newer compiler has said this one should not
    // be trusted with its source, and a file that happens to resolve does not
    // change that (`docs/wp21-packages.md` §6).
    const engine = manifestEngineCheck(text, PACKAGE_CONDITION, VERSION)
    if (engine === ENGINE_TOO_OLD) {
      failed.error = `Package \`${parsed.name}\` needs a newer compiler: its \`engines.${PACKAGE_CONDITION}\` asks for \`${manifestEngineRange(text, PACKAGE_CONDITION)}\` and this is ${CLI} ${VERSION}`
      return failed
    }
    if (engine === ENGINE_UNREADABLE) {
      failed.error = `Package \`${parsed.name}\` declares \`engines.${PACKAGE_CONDITION}\` as \`${manifestEngineRange(text, PACKAGE_CONDITION)}\`, which is not a range this compiler reads: the one it accepts is a floor, \`>=X.Y.Z\` or \`>=X.Y\``
      return failed
    }
    const entry = nishExportEntry(
      text,
      parsed.subpath,
      packageConditionFor(mode),
      PACKAGE_CONDITION,
      packageConditionFor(otherMode)
    )
    if (entry.status !== MANIFEST_FOUND) {
      // Each cause is named in its own words and carries its own code, which is
      // §6's point: a bare import that fails at the package boundary should say
      // what is missing, not read like a module-not-found the consumer typed.
      //
      // A manifest that is not JSON comes first, because the narrow scan stops
      // at the break and everything it did not see — a condition after it, or
      // the whole `exports` — makes each answer below a guess about text it
      // never read. It is only asked once resolution has failed: a manifest the
      // scan got a file out of compiles, as it did under S2. A manifest that
      // vanished between the two reads is not malformed, only gone, and takes
      // the general answer at the bottom.
      const brokenAt = manifest === null ? -1 : manifestMalformedAt(text)
      if (brokenAt >= 0) {
        failed.error = `Package \`${parsed.name}\` has a malformed manifest: ${manifestPath}:${lineOf(text, brokenAt)}:${columnOf(text, brokenAt)} is not well-formed JSON, so this compiler could not read an entry point out of it`
        return failed
      }
      if (entry.status === MANIFEST_OTHER_MODE) {
        failed.error = `Package \`${parsed.name}\` supports ${LANGUAGE} in ${otherMode} mode only: its \`exports\` offers \`${packageConditionFor(otherMode)}\` for \`${parsed.subpath}\` and neither \`${packageConditionFor(mode)}\` nor \`${PACKAGE_CONDITION}\`, and this program is compiling in ${mode} (\`--number-mode ${mode}\`)`
        return failed
      }
      // The second clause keeps S2's sentence and adds the cause, so the
      // message a reader of S2 learned still matches: it says what this
      // compiler came away with, then why.
      if (entry.status === MANIFEST_NOT_NISH) {
        failed.error = `Package \`${parsed.name}\` has no ${LANGUAGE} entry point: its \`exports\` gave this compiler no file to compile for \`${parsed.subpath}\`, because that entry declares none of the conditions this compiler compiles source from (\`${PACKAGE_CONDITION}\`, \`${packageConditionFor(mode)}\`, \`${packageConditionFor(otherMode)}\`)`
        return failed
      }
      // What is left: no `exports` at all, no key for this subpath, or a value
      // `manifest.ts` does not follow. The second clause says what this
      // compiler came away with rather than what the package declares, because
      // the mode-qualified condition outranks the plain one (§10a): a manifest
      // whose `nish-i32` names something that is not a file never reaches its
      // perfectly good `nish` row, and a sentence about what the `exports`
      // declares would send its author to a line that is correct.
      failed.error = `Package \`${parsed.name}\` has no ${LANGUAGE} entry point: its \`exports\` gave this compiler no file to compile for \`${parsed.subpath}\``
      return failed
    }
    const target = entry.target
    // The manifest may name a file that is not there, which is the package's
    // own mistake and not the consumer's — but it is still a module that could
    // not be found, so the caller reports it as one.
    //
    // The name is the path, unlike the standard library's: the walk that found
    // this package started at the importing module's own name and never left
    // the program being compiled, so the answer already says as much about the
    // compiler's install as the importer's own name does, which is nothing
    // (§A7's third bullet is about the compiler's package root, and this walk
    // does not use it). Through a link it is under the real directory, spelled
    // as above.
    const resolvedPath = joinPath([packageDir, target])
    const resolved: ResolvedModule = {
      path: resolvedPath,
      name: resolvedPath,
      packageName: parsed.name,
      error: "",
    }
    return resolved
  }

  /**
   * The directory of package `name` as Node would find it: `node_modules/<name>`
   * with a `package.json` in it, in `from` or in any directory above it.
   *
   * A directory whose last segment is already `node_modules` is stepped over
   * rather than searched, which is Node's rule and stops
   * `node_modules/node_modules/<name>` from ever being looked for.
   *
   * The walk has to reach every directory stage0 reaches, because a program
   * one compiler resolves and the other does not is a program that compiles
   * with one compiler and not the other. Both walks are driven by the importing
   * module's *name*, the one string both compilers hold for it (WP19 §A3); here
   * that name is usually relative — `nish main.ts` run in `proj/src` gives `.`
   * — so above `.` the walk is spelled with `..` rather than computed by
   * `dirname` (`parentDirectory`), and `proj/node_modules` beside
   * `proj/src/main.ts`, which is the ordinary npm layout, is found by both.
   */
  findPackageDir(from: string, name: string): string | null {
    // Normalised first so that the `..` segments a relative walk produces are
    // the only ones in the path, which is what `parentDirectory` reads.
    let dir = normalizePath(from)
    let steps = 0
    let searching = true
    while (searching) {
      if (basename(dir) !== PACKAGE_ROOT_SEGMENT) {
        const candidate = joinPath([dir, PACKAGE_ROOT_SEGMENT, name])
        if (readFileSyncOrNull(joinPath([candidate, "package.json"])) !== null) {
          return candidate
        }
      }
      const parent = parentDirectory(dir)
      if (parent.length === 0 || steps >= PACKAGE_WALK_LIMIT) {
        searching = false
      } else {
        dir = parent
        steps = steps + 1
      }
    }
    return null
  }

  /**
   * Passes 1b and 2 over every module. Each phase runs to completion over
   * every module and then the errors are answered together: a broken signature
   * never reaches body checking and a broken body never reaches the emitter.
   */
  check(): boolean {
    if (this.sink.hasErrors()) {
      return false // pass 1 and module resolution ran during load
    }
    // Before anything records: a `noPanic` list turns the recording on.
    const manifest = this.rootManifest()
    const nish = this.readRootNish(manifest)
    this.readNoPanic(manifest, nish)
    this.readCapabilityPolicy(manifest, nish)
    this.rejectCollectionsClash()
    if (this.sink.hasErrors()) {
      return false
    }
    for (const unit of this.modules) {
      const targets: CheckedProgram[] = []
      for (const imp of unit.checker.program.imports) {
        // A builtin module has no file behind it, so there is nothing to look
        // up; the entry keeps the array the same length as `imports` and
        // `bindImport` routes on the specifier before it reads one.
        const index = isBuiltinSpecifier(imp.specifier) ? -1 : unit.resolved.get(imp.specifier, -1)
        targets.push(index < 0 ? unit.checker.program : this.modules[index].checker.program)
      }
      unit.checker.bindImports(targets)
    }
    // WP18 G7: `Box<i32>` in a signature annotation, where `Box` is imported.
    // Pass 1 could only write the request down — it runs before any import but
    // an enum or an alias is bound — and it is made here, once every module
    // can answer one and can resolve its own imports while doing so.
    for (const unit of this.modules) {
      unit.checker.makeDeferredInstantiations()
    }
    // After every module is bound, so a struct reached through a chain of
    // modules does not depend on the order they were bound in.
    const clashed = new StringSet()
    const declared = this.declaredStructs(clashed)
    for (const unit of this.modules) {
      unit.checker.closeReachableStructs(declared)
    }
    this.rejectSymbolClashes(clashed)
    if (this.sink.hasErrors()) {
      return false
    }
    // `process.argv` is legal anywhere in a program that has an entry point, so
    // every module needs to know whether the entry declares `main` before its
    // bodies are checked.
    const hasMain = this.entry().checker.program.entryMain !== null
    for (const unit of this.modules) {
      unit.checker.ctx.entryHasMain = hasMain
    }
    // Constants fold once every module has its signatures, because an
    // initialiser may name a constant imported from a module checked later.
    for (const unit of this.modules) {
      unit.checker.foldConstants()
    }
    for (const unit of this.modules) {
      unit.checker.checkBodies()
    }
    if (this.sink.hasErrors()) {
      return false
    }
    // Pass 3 (WP18): every instantiation the bodies asked for, to a fixed
    // point. Per module in load order, because an instantiation is checked by
    // the module that declares its template, in that module's scope.
    //
    // The sweep repeats because G7 let a request cross a module boundary in
    // either direction: draining one module's queue checks bodies that ask
    // other modules for instantiations, including modules already drained this
    // sweep, and those bodies ask in turn. It ends because the set of
    // (template, tuple) pairs only grows and the caps in `src/generics.ts`
    // bound it.
    let working = true
    while (working) {
      working = false
      for (const unit of this.modules) {
        if (unit.checker.drainInstantiations()) {
          working = true
        }
      }
    }
    this.rejectInstantiatedStructClashes()
    if (this.sink.hasErrors()) {
      return false
    }
    // WP15 §2.4: what every call site proves for its callee's parameters. It
    // needs every body checked, instantiations included, and the attribute
    // analysis below reads the proofs it adds.
    // Which of them a host may also call is the build's to say (`hostVisible`).
    const contexts: CheckContext[] = []
    const programs: CheckedProgram[] = []
    for (const unit of this.modules) {
      contexts.push(unit.checker.ctx)
      programs.push(unit.checker.program)
    }
    const mode = buildModeOf(this.opts, programs)
    // Which array fields live inside their objects (`src/inline-arrays.ts`).
    // Every body has to be checked to know, and everything after this reads
    // the layout it settles: the ranges, the attribute facts, the emitter.
    layoutInlineArrays(contexts, mode)
    proveCallSiteRanges(contexts, mode, this.opts.rangeReference)
    this.reportArenaLoops()
    this.denyRetention()
    this.reportDeprecatedFlags()
    this.reportUncheckedIndexSites(programs)
    this.checkParallel()
    this.keyEnumsBySymbol()
    if (this.sink.hasErrors()) {
      return false
    }
    // Every panic site, settled once the proofs above are committed and the
    // fixpoint `reportArenaLoops` paid for has its call graph (`src/panics.ts`).
    if (this.opts.recordsPanics()) {
      const facts = this.analyze()
      resolvePanicSites(this.analysisUnits, facts)
      this.denyPanicSites(facts)
      if (this.sink.hasErrors()) {
        return false
      }
    }
    this.refuseCapabilities()
    if (this.sink.hasErrors()) {
      return false
    }
    if (this.opts.warnPortability) {
      this.reportPortability()
    }
    return true
  }

  /**
   * Settle the no-panic scope: every module of the root package under
   * `--deny-panics`, and each module the root package's `"nish".noPanic`
   * names. The manifest is the `package.json` nearest above the entry, and an
   * entry is a path relative to it. One that names no module of the program is
   * refused where it is written (NL3031): a typo would otherwise leave the
   * module it meant outside the scope, and the build would say nothing.
   */
  readNoPanic(source: SourceFile | null, nish: NishManifest | null): void {
    this.panicScope = []
    for (const unit of this.modules) {
      this.panicScope.push(this.opts.denyPanics && unit.packageName === ROOT_PACKAGE)
    }
    if (source === null || nish === null) {
      return
    }
    const dir = dirname(source.path)
    const list = manifestNoPanic(source.text, nish.noPanicAt)
    let k = 0
    while (k < list.entries.length) {
      const entry = list.entries[k]
      const at = this.byPath.get(this.identityOf(joinPath([dir, entry])), -1)
      if (at >= 0 && at < this.panicScope.length) {
        this.panicScope[at] = true
        this.opts.noPanicListed = true
      } else {
        this.sink.report(
          source,
          list.offsets[k],
          k < list.ends.length ? list.ends[k] : list.offsets[k] + 1,
          `\`noPanic\` names \`${entry}\`, which is no module of this program: an entry is the path of a ` +
            "module the program compiles, relative to the `package.json` that lists it, and one that names " +
            "nothing would leave the module it meant outside the scope without a word"
        )
      }
      k = k + 1
    }
  }

  /**
   * The root package's manifest, the `package.json` nearest above the entry,
   * spelled from the entry's path, or null when there is none: where
   * `"nish".noPanic` and `"nish".capabilities` are read.
   */
  rootManifest(): SourceFile | null {
    if (this.modules.length === 0) {
      return null
    }
    const dir = this.manifestDirAbove(this.entry().path)
    if (dir === null) {
      return null
    }
    const manifestPath = joinPath([dir, "package.json"])
    const text = readFileSyncOrNull(manifestPath)
    return text === null ? null : new SourceFile(manifestPath, text)
  }

  /**
   * The root package's `"nish"` field, read strictly (`manifestNish`), or null
   * when there is no manifest or the field is refused: it is one object,
   * written once, whose only keys are `noPanic` and `capabilities`, and
   * anything else is NL3036 where `package.json` writes it, so that nothing
   * the reader cannot vouch for is honoured, a policy least of all.
   */
  readRootNish(source: SourceFile | null): NishManifest | null {
    if (source === null) {
      return null
    }
    const nish = manifestNish(source.text, PACKAGE_CONDITION)
    if (nish.problem.length === 0) {
      return nish
    }
    this.sink.report(
      source,
      nish.problemStart,
      nish.problemEnd,
      `${nish.problem}: the root package's \`${PACKAGE_CONDITION}\` field is one object, written once, whose keys are \`noPanic\` and \`capabilities\`, each written once`
    )
    return null
  }

  /**
   * WP36: the root package's `"nish": { "capabilities": { "allow", "deny" } }`
   * (docs/wp36-capability-policy.md §3), as `manifestAllow` and
   * `manifestDeny`. Everything it cannot honour is refused where
   * `package.json` writes it, so that a typo never quietly widens the policy:
   * the wrong shape (NL3032), a name that is no capability (NL3033), `unsafe`
   * under `allow` (NL3034), and a capability under both (NL3035).
   */
  readCapabilityPolicy(source: SourceFile | null, nish: NishManifest | null): void {
    if (source === null || nish === null) {
      return
    }
    const policy = manifestCapabilities(source.text, nish.capabilitiesAt)
    if (policy.problem.length > 0) {
      this.sink.report(
        source,
        policy.problemStart,
        policy.problemEnd,
        `${policy.problem}: the root package's \`${PACKAGE_CONDITION}.capabilities\` is an object with an \`allow\` list, a \`deny\` list or both, each an array of capability names`
      )
      return
    }
    const allow = this.policyListMask(source, policy.allow, true)
    const deny = this.policyListMask(source, policy.deny, false)
    const both = allow & deny
    if (both !== 0) {
      // Spanned at the `deny` entry, the second word on the capability.
      const name = capabilityNames(both)[0]
      const k = policy.deny.entries.indexOf(name)
      const at = k >= 0 && k < policy.deny.offsets.length ? policy.deny.offsets[k] : 0
      const end = k >= 0 && k < policy.deny.ends.length ? policy.deny.ends[k] : at + 1
      this.sink.report(
        source,
        at,
        end,
        `\`${name}\` is both allowed and denied in the root package's capability policy; a policy says one or the other`
      )
      return
    }
    this.manifestAllow = policy.allowGiven ? allow : -1
    this.manifestDeny = deny
  }

  /** One `allow` or `deny` list of the root package's policy as a mask, refusing each entry that names no capability. */
  policyListMask(source: SourceFile, list: ManifestList, allow: boolean): i32 {
    const names = everyCapabilityName()
    const unsafe = unsafeModule()
    let mask = 0
    let k = 0
    while (k < list.entries.length && k < list.offsets.length) {
      const entry = list.entries[k]
      const at = list.offsets[k]
      const end = k < list.ends.length ? list.ends[k] : at + 1
      const index = capabilityIndex(entry)
      if (index < 0) {
        this.sink.report(
          source,
          at,
          end,
          `\`${entry}\` is no capability: a policy names capabilities as \`--emit-capabilities\` reports them, one of ${names}`
        )
      } else if (allow && (optInCapabilities() & (1 << index)) !== 0) {
        this.sink.report(
          source,
          at,
          end,
          `\`unsafe\` cannot be allowed: importing \`${unsafe}\` is the opt-in to it, so a policy can only deny it`
        )
      } else {
        mask = mask | (1 << index)
      }
      k = k + 1
    }
    return mask
  }

  /**
   * WP36: refuse what the program reaches beyond the capability policy
   * (docs/wp36-capability-policy.md §1): `--deny` and the root package's
   * `deny` refuse a capability outright, and `--allow` and its `allow`, each
   * an allowlist when given, refuse every capability they do not list but
   * `unsafe`, whose opt-in is the import. What is judged is every function
   * outside code can call (`hostVisible`), so no build mode lets a denied
   * capability through: `main` in a closed `--link` build, and every
   * host-visible function of every module in an open one. One error per refused capability, in the fixed order, spanned at the
   * first call of its witness chain and naming the whole chain, so the reader
   * sees how the program got there. Nothing here moves a byte of the IR: a
   * program it accepts is the one the build compiles anyway.
   */
  refuseCapabilities(): void {
    const allow = this.opts.allowCapabilities & this.manifestAllow
    const deny = this.opts.denyCapabilities | this.manifestDeny
    const refused = deny | (~allow & ~optInCapabilities() & allCapabilities())
    if (refused === 0 || this.modules.length === 0) {
      return
    }
    const facts = this.analyze()
    const index = functionIndex(this, facts)
    // Every function code this compiler did not see may call, in every module:
    // `main` alone in a closed `--link` build, and each host-visible export
    // (every function, under `--no-strict-exports`) in an open one -- a
    // library, a sidecar, a wasm module or IR for someone else to link.
    const programs: CheckedProgram[] = []
    for (const unit of this.modules) {
      programs.push(unit.checker.program)
    }
    const mode = buildModeOf(this.opts, programs)
    // `main` first, so a program's refusal names it wherever it is declared.
    const main = this.entry().checker.program.entryMain
    const judged: FunctionSig[] = []
    let mainName = ""
    if (main !== null) {
      judged.push(main)
      mainName = main.name
    }
    for (const program of programs) {
      for (const sig of program.functions) {
        if (
          sig.name !== mainName &&
          sig.definedIn(program.source) &&
          hostVisible(mode, sig.exported, false)
        ) {
          judged.push(sig)
        }
      }
    }
    let c = 0
    while (c < CAPABILITY_COUNT) {
      if ((refused & (1 << c)) !== 0) {
        for (const sig of judged) {
          const chain = witnessChain(index, facts, sig, c)
          const source: SourceFile | null = chain.length > 0 ? chain[0].source : null
          const site: Node | null = chain.length > 0 ? chain[0].site : null
          if (source !== null && site !== null) {
            const hops: string[] = []
            for (const hop of chain) {
              hops.push(`${hop.at} calls ${hop.calls}`)
            }
            this.reportRefusal(source, site, sig, c, hops)
            break
          }
        }
      }
      c = c + 1
    }
  }

  /**
   * The capability refusal of `sig` at `site`. A method of its own because the
   * report keeps the message, so everything building it is kept too, and the
   * loop above is told so once rather than for each call it makes.
   */
  reportRefusal(source: SourceFile, site: Node, sig: FunctionSig, c: i32, hops: string[]): void {
    this.sink.report(
      source,
      site.start,
      site.end,
      `\`${sig.sourceName}\` reaches \`${capabilityName(c)}\`, which the capability policy does not grant (${this.refusedBy(c)}); the chain that reaches it: ${hops.join(", ")}`
    )
  }

  /** Which part of the policy refuses capability `c`, as the refusal names it: the first of the four that does. */
  refusedBy(c: i32): string {
    const bit = 1 << c
    if ((this.opts.denyCapabilities & bit) !== 0) {
      return `\`--deny ${capabilityName(c)}\``
    }
    if ((this.manifestDeny & bit) !== 0) {
      return "the root package's `deny`"
    }
    if ((this.opts.allowCapabilities & bit) === 0) {
      return `\`--allow ${capabilityNames(this.opts.allowCapabilities).join(",")}\` does not list it`
    }
    return "the root package's `allow` does not list it"
  }

  /**
   * The directory of the `package.json` nearest above `path`, spelled from
   * `path` (so a diagnostic in it reads as the entry was named), or null. The
   * walk ends where a parent is the directory itself, the top of the tree.
   */
  manifestDirAbove(path: string): string | null {
    let dir = dirname(normalizePath(path))
    let steps = 0
    while (steps < PACKAGE_WALK_LIMIT) {
      if (readFileSyncOrNull(joinPath([dir, "package.json"])) !== null) {
        return dir
      }
      const parent = parentDirectory(dir)
      if (parent.length === 0 || this.identityOf(parent) === this.identityOf(dir)) {
        return null
      }
      dir = parent
      steps = steps + 1
    }
    return null
  }

  /**
   * Refuse what can still panic in the no-panic scope (`reportDeniedPanics`),
   * and take back the WP15 section 8 warning that a refused index or range
   * entry keeps its check: the error already names the guard, and an author
   * told the same thing twice reads two problems.
   */
  denyPanicSites(facts: FactsTable): void {
    let any = false
    for (const scoped of this.panicScope) {
      any = any || scoped
    }
    if (!any) {
      return
    }
    const refused = reportDeniedPanics(this.analysisUnits, this.panicScope, facts, this.table, this.sink)
    if (refused.length === 0) {
      return
    }
    const kept: Diagnostic[] = []
    for (const warning of this.sink.warnings) {
      if (!restatedBy(warning, refused)) {
        kept.push(warning)
      }
    }
    this.sink.warnings = kept
  }

  /**
   * `--deny-retention`: each arena-retention warning in a module of the root
   * package becomes an error. The four rules are the ones whose finding is
   * memory nothing can reach that stays allocated: quadratic string building
   * (NL9002), an allocation dropped by an assignment (NL9003), a loop over a
   * call that leaves its memory behind (NL9011) and an allocation dropped on
   * every pass (NL9016). The error keeps the warning's text, which names the
   * rewrite, and its code, so a reader sees which rule refused the build. A
   * dependency's warnings stay warnings, as its panic sites stay outside the
   * no-panic scope: the program's author cannot change that code.
   *
   * Run after `reportArenaLoops`, the last of the four to be found, and the
   * warning it restates is dropped so the line is said once.
   */
  denyRetention(): void {
    if (!this.opts.denyRetention) {
      return
    }
    const kept: Diagnostic[] = []
    for (const warning of this.sink.warnings) {
      const code = codeFor("performance", warning.text)
      if (isRetentionCode(code) && this.inRootPackage(warning.source)) {
        this.sink.report(
          warning.source,
          warning.start,
          warning.end,
          `\`--deny-retention\` refuses this ${code} finding, because the arena memory it describes stays ` +
            `allocated after nothing in the program can reach it any more: ${warning.text}`
        )
      } else {
        kept.push(warning)
      }
    }
    this.sink.warnings = kept
  }

  /** Whether `source` is a module of the root package, the program's own code. */
  inRootPackage(source: SourceFile): boolean {
    for (const unit of this.modules) {
      if (unit.source === source) {
        return unit.packageName === ROOT_PACKAGE
      }
    }
    return false
  }

  /** Every module's enum table, keyed for the emitter now that no name is resolved (`CheckedProgram.keyEnumsBySymbol`). */
  keyEnumsBySymbol(): void {
    const every: EnumInfo[] = []
    for (const unit of this.modules) {
      for (const info of unit.checker.program.enumList) {
        if (info.origin === unit.source) {
          every.push(info)
        }
      }
    }
    if (every.length === 0) {
      return
    }
    for (const unit of this.modules) {
      unit.checker.program.keyEnumsBySymbol(every)
    }
  }

  /**
   * WP32 (docs/wp32-map.md §4.2): one module declares a `Map` or `Set` of its
   * own and another names the global one. Each module's own is legal by itself
   * — it shadows the global, as it does under `tsc` — but a class name is
   * program-wide (NL3028), so the two classes would be one struct type and one
   * set of method symbols. Refused at the declaration, naming the first module
   * that uses the global, once per declaring module and name. Using it means
   * importing it from `nish/collections`, which the implicit import and an
   * explicit one both are.
   */
  rejectCollectionsClash(): void {
    for (const unit of this.modules) {
      if (!unit.checker.program.isCollections()) {
        this.reportCollectionClash(unit, "Map")
        this.reportCollectionClash(unit, "Set")
      }
    }
  }

  /** The refusal for one name, when `unit` declares it and another module uses the global. */
  reportCollectionClash(unit: ModuleUnit, name: string): void {
    const at = declarationNameOf(unit.checker.program, name)
    if (at === null) {
      return
    }
    let user: ModuleUnit | null = null
    for (const other of this.modules) {
      if (user === null && other !== unit && importsCollection(other.checker.program, name)) {
        user = other
      }
    }
    if (user === null) {
      return
    }
    this.sink.report(
      unit.source,
      at.start,
      at.end,
      `\`${name}\` is declared here and ${user.name} uses the global \`${name}\`; a class or interface name is program-wide, so one program cannot have both (rename this one)`
    )
  }

  /**
   * WP29 P1: every `parallelMapInto` and `parallelReduce` call, against the
   * rules that make its region safe on several threads (`src/parallel.ts`).
   * They ask the whole-program facts about the body, so they run here, after
   * the fixpoint `reportArenaLoops` has already paid for, and each refusal is
   * reported at the call that asked for the region. A call the rules admit
   * whose body allocates gets NL9012 there instead (`allocationWarning`).
   */
  checkParallel(): void {
    const facts = this.analyze()
    this.checkScopes(facts)
    this.checkSecrets(facts)
    for (const unit of this.modules) {
      const program = unit.checker.program
      for (const call of program.parallelCalls) {
        const sig = call.sig
        const instance = sig.instance
        const fn = parallelBodyOf(sig)
        if (instance === null || fn === null) {
          continue
        }
        // `U` for a map, `T` for a reduce: the last type argument either way.
        const result = instance.typeArgs[instance.typeArgs.length - 1]
        const args = call.node.children[1].children
        const identity = args.length > 2 ? args[2] : call.node
        const messages: string[] = []
        messages.push(resultMessage(this.table, sig, fn, result))
        messages.push(reachesDstMessage(this.table, program, sig, fn))
        messages.push(sharedWriteMessage(sig, fn, facts))
        messages.push(arenaMessage(sig, fn, facts))
        messages.push(escapeMessage(sig, fn, facts))
        messages.push(
          reduceMessage(sig, fn, identity, program.source.text.substring(identity.start, identity.end))
        )
        let refused = false
        for (const message of messages) {
          if (message.length > 0) {
            this.sink.report(program.source, call.node.start, call.node.end, message)
            refused = true
          }
        }
        // A body the rules admit may still allocate, recycled per element
        // (`scopeParallelBodies`); that costs every element, and it is said once
        // the call is known to compile.
        const warning = allocationWarning(this.table, sig, fn, result, facts)
        if (!refused && warning.length > 0) {
          this.sink.reportPerformance(program.source, call.node.start, call.node.end, warning)
        }
      }
    }
  }

  /**
   * `nish:secret`: the function every `expose` and `exposeWith` runs reaches
   * no I/O and no C, keeps nothing of the value, writes nothing it is handed,
   * and declares a result that holds no `Secret` (`exposeMessages`). Those are
   * questions about the function's whole closure, so they are asked of the
   * same facts the parallel rules read, at the call that ran it.
   */
  checkSecrets(facts: FactsTable): void {
    for (const unit of this.modules) {
      const program = unit.checker.program
      for (const call of program.exposeCalls) {
        for (const message of exposeMessages(this.table, facts, this.runtime, call.sig)) {
          this.sink.report(program.source, call.node.start, call.node.end, message)
        }
      }
    }
  }

  /**
   * WP29 P2: every scope is joined, because none can leave the block that
   * declares it (`scopeFindings`), and every task is one that may run beside
   * the others: the rules a data-parallel body is held to, less the ones about
   * an element's arena, which a task does not share (`src/parallel.ts`). And
   * nothing a `using a = arena()` block allocates outlives the block
   * (`arenaBlockFindings`, escape.ts), which needs the same facts.
   */
  checkScopes(facts: FactsTable): void {
    for (const unit of this.analysisUnits) {
      for (const finding of arenaBlockFindings(unit, this.table, facts)) {
        this.sink.report(unit.program.source, finding.node.start, finding.node.end, finding.message)
      }
    }
    const programs: CheckedProgram[] = []
    for (const unit of this.modules) {
      programs.push(unit.checker.program)
    }
    for (const unit of this.modules) {
      const program = unit.checker.program
      for (const finding of scopeFindings(programs, program, this.table, facts)) {
        this.sink.report(program.source, finding.node.start, finding.node.end, finding.message)
      }
      for (const call of program.spawnCalls) {
        const fn = parallelBodyOf(call.sig)
        if (fn === null) {
          continue
        }
        const messages: string[] = []
        messages.push(fn.lifted ? taskArrowMessage() : "")
        messages.push(taskArgumentMessage(this.table, call.sig))
        messages.push(resultMessage(this.table, call.sig, fn, fn.returnType))
        messages.push(sharedWriteMessage(call.sig, fn, facts))
        messages.push(arenaMessage(call.sig, fn, facts))
        for (const message of messages) {
          if (message.length > 0) {
            this.sink.report(program.source, call.node.start, call.node.end, message)
          }
        }
      }
    }
  }

  /**
   * `--unchecked-indexing` and `--wrapping` are deprecated: each still reaches
   * the entry package's own modules (`discover`), and each says so once per
   * compilation, at the top of the entry module, naming the `nish:unsafe`
   * functions that state the same decision at the site it is about. A
   * performance warning rather than a portability one, because that class is
   * on by default, so the deprecation is read by whoever still passes the flag;
   * `--no-warn-performance` silences it with the rest.
   */
  reportDeprecatedFlags(): void {
    if (this.modules.length === 0) {
      return
    }
    const entry = this.modules[0].source
    const reach =
      "is deprecated and reaches only the modules of the entry package, never a dependency or the standard library: call"
    if (this.opts.uncheckedIndexing) {
      this.sink.reportPerformance(
        entry,
        0,
        0,
        `--unchecked-indexing ${reach} \`uncheckedGet\` and \`uncheckedSet\` from \`${unsafeModule()}\` where an index is meant to go unchecked: \`${CLI} --fix\` rewrites each site; then drop the flag`
      )
    }
    if (this.opts.wrapping) {
      this.sink.reportPerformance(
        entry,
        0,
        0,
        `--wrapping ${reach} \`wrappingAdd\`, \`wrappingSub\` and \`wrappingMul\` from \`${unsafeModule()}\` where an operation is meant to wrap`
      )
    }
  }

  /**
   * NL7002: each site `--unchecked-indexing` leaves unchecked, as a
   * deprecation of its own with the `nish:unsafe` rewrite that states the
   * same decision there (`src/unsafe-migrate.ts`). NL9014 says the flag is
   * deprecated once; these say where it still decides something, at the place
   * a fix can edit. Read here, beside it, because the per-site proofs are
   * final once `proveCallSiteRanges` has run.
   */
  reportUncheckedIndexSites(programs: CheckedProgram[]): void {
    if (this.opts.uncheckedIndexing) {
      reportUncheckedIndexSites(programs, this.table, this.sink)
    }
  }

  /**
   * The one performance warning that needs the whole-program facts: a loop
   * over a call that leaves arena memory behind, in a function that gets no
   * automatic scope (`arenaLoopFindings`, escape.ts). It is reported here, at
   * the end of checking, so that it reaches the report with every other
   * warning, which the driver prints before it emits anything. The analysis is
   * the one `emit` runs, memoised by `analyze`, so it is not paid twice.
   */
  reportArenaLoops(): void {
    const facts = this.analyze()
    for (const unit of this.analysisUnits) {
      for (const finding of arenaLoopFindings(unit, facts)) {
        this.sink.reportPerformance(
          unit.program.source,
          finding.node.start,
          finding.node.end,
          finding.message
        )
      }
    }
  }

  /**
   * The WP33 portability warnings (`src/portability.ts`), under
   * `--warn-portability` only. Last in `check`, after every error is in, so a
   * program that does not compile is never walked; over the analysis units
   * `reportArenaLoops` has already built, because they carry the parent links
   * a row reads.
   */
  reportPortability(): void {
    for (const unit of this.analysisUnits) {
      for (const finding of portabilityFindings(unit, this.table, this.opts)) {
        this.sink.reportPortability(
          unit.program.source,
          finding.node.start,
          finding.node.end,
          finding.message
        )
      }
    }
  }

  /**
   * WP18 G5 + WP21 section 9c: the struct-name rule, one pass later.
   *
   * `Holder$i32` is a program-wide name exactly as `Node` is, so two packages
   * that both declare `Holder<T>` and both instantiate it at `i32` produce two
   * different `%struct.Holder$i32`. `declaredStructs` catches that when both
   * instantiations came from a *signature*, because it runs before bodies are
   * checked; an instantiation a body asked for does not exist yet then, so the
   * set is only final here.
   *
   * It has to be caught rather than left: the second module's registration
   * replaces the layout the first one's objects were built with, so a field
   * read through an imported signature lands on the wrong offset. That is a
   * miscompile, not a link error.
   *
   * Two modules of one package clash for the same reason and are refused here
   * too. Packages are what make `Holder` and `Holder` two names in
   * `rejectSymbolClashes`; they make no difference at all to `Holder$i32`,
   * which is a program-wide `%struct` name and a program-wide method symbol
   * whichever package asked for it. A declared `class Holder` in two modules of
   * one package is caught before bodies, by `declaredStructs`, and so is a
   * generic one that a signature instantiated; the generic spelling has no
   * layout until an instantiation exists, and no symbol either, so one only a
   * body instantiated reached the emitter unremarked and produced two
   * different `%struct.Holder$i32` and an invalid redefinition of
   * `@Holder$i32.constructor`, with no diagnostic at all
   * (`tests/link/generic_class_clash`).
   *
   * One message per template rather than per instantiation: two modules that
   * both declare `Holder<T>` and both use it at `i32` and at `string` have made
   * one mistake, not two.
   */
  rejectInstantiatedStructClashes(): void {
    const owners = new StringMap()
    const ownerPackages: string[] = []
    // `<package> <name>` -> the path of the first module of that package to
    // own the instantiation, as in `declaredStructs`.
    const packageOwners = new StringMap()
    const packageOwnerPaths: string[] = []
    const reported = new StringSet()
    for (const unit of this.modules) {
      for (const instance of unit.checker.program.structInstantiationList) {
        // The module that declares the template owns every instantiation of
        // it, whoever the annotation was written by.
        if (instance.template.origin !== unit.source) {
          continue
        }
        const name = instance.info.name
        // A template is one declaration in one module, so its module's path and
        // its own name name it uniquely -- which is the object identity stage0
        // keys this set on.
        const templateKey = `${unit.path}#${instance.template.sourceName}`
        const key = `${unit.packageName} ${name}`
        const inPackage = packageOwners.get(key, -1)
        if (inPackage < 0) {
          packageOwners.set(key, packageOwnerPaths.length)
          packageOwnerPaths.push(unit.name)
        } else if (inPackage < packageOwnerPaths.length) {
          // Its own package's first owner before anybody's, so that a clash
          // inside one package is named as one even when another package
          // owned the name before either module.
          const first = packageOwnerPaths[inPackage]
          if (reported.add(templateKey)) {
            this.reportTemplateClash(unit, instance.template, first)
          }
          continue
        }
        const seen = owners.get(name, -1)
        if (seen < 0) {
          owners.set(name, ownerPackages.length)
          ownerPackages.push(unit.packageName)
          continue
        }
        // Not this package's first, which was compared above, so another's.
        if (!reported.add(templateKey)) {
          continue
        }
        const at = instance.template.decl.children[0]
        const what = instance.info.kind === STRUCT_CLASS ? "Class" : "Interface"
        const here = describePackage(unit.packageName)
        const there = describePackage(ownerPackages[seen])
        this.sink.report(
          unit.source,
          at.start,
          at.end,
          `${what} \`${this.table.typeName(instance.info.type)}\` is declared in package ${there} and again in package ${here}; a class or interface name is still program-wide, so two packages cannot both declare one`
        )
      }
    }
  }

  /**
   * Every class and interface declared anywhere in the program, by name, and
   * the refusal of a name declared twice.
   *
   * A struct's identity is its bare name -- `%struct.<name>`, and type equality
   * compares type ids interned by name -- so two declarations of `Base` are one
   * type to everything after this point, whichever modules and packages they
   * sit in and whether or not either is exported. Left alone, a value of one is
   * accepted where the other is expected and its fields are read at the other's
   * offsets, with no diagnostic (#193). So the second declaration is refused,
   * once per name per module, naming the module that declared it first.
   *
   * Across packages the words are docs/wp21-packages.md section 7's, for a
   * declared struct and an instantiation alike. Inside one package a second
   * instantiation of one name is refused at its template, once, in the words
   * `rejectInstantiatedStructClashes` uses for one a body asked for later,
   * because the mistake is the template's name.
   *
   * A declaration is compared with the first one of its name in its own
   * package before the first one anywhere, so that two modules of one package
   * are refused as one package's mistake even when a third package declared the
   * name before either of them. Every name refused inside one package goes into
   * `clashed`, so that `rejectSymbolClashes` does not report the constructor or
   * method the two classes share as a second mistake: it is the same one.
   *
   * A declared name with a `$` in it is left out: pass 1 has refused it
   * already (`rejectDollarInSymbolName`), because it is spelled like an
   * instantiation's.
   */
  declaredStructs(clashed: StringSet): StructRegistry {
    const declared = new StructRegistry()
    const owners = new StringMap()
    const ownerPackages: string[] = []
    const ownerPaths: string[] = []
    // `<package> <name>` -> the path of the first module of that package to
    // declare the name. A space cannot occur in either half.
    const packageOwners = new StringMap()
    const packageOwnerPaths: string[] = []
    const reportedTemplates = new StringSet()
    for (const unit of this.modules) {
      for (const info of unit.checker.program.structList) {
        if (info.origin !== unit.source) {
          continue
        }
        declared.add(info)
        // Already refused where it was declared, for its `$`; compared here it
        // would clash with the instantiation it is spelled like, in words
        // that name the instantiation rather than what was written.
        if (info.instance === null && isInstantiationName(info.name)) {
          continue
        }
        const what = info.kind === STRUCT_CLASS ? "Class" : "Interface"
        const at = info.decl.children[0]
        const key = `${unit.packageName} ${info.name}`
        const inPackage = packageOwners.get(key, -1)
        if (inPackage < 0) {
          packageOwners.set(key, packageOwnerPaths.length)
          packageOwnerPaths.push(unit.name)
        } else if (inPackage < packageOwnerPaths.length) {
          // The range test, and reading the path before any call, let the
          // prover drop the check.
          const first = packageOwnerPaths[inPackage]
          const instance = info.instance
          if (instance === null) {
            this.sink.report(
              unit.source,
              at.start,
              at.end,
              `${what} \`${this.table.typeName(info.type)}\` is also declared in ${first}; a class or interface name must be unique across the program whether or not it is exported, because a struct type is identified by its name alone`
            )
          } else if (reportedTemplates.add(`${unit.path}#${instance.template.sourceName}`)) {
            this.reportTemplateClash(unit, instance.template, first)
          }
          clashed.add(info.name)
          continue
        }
        const seen = owners.get(info.name, -1)
        if (seen < 0) {
          owners.set(info.name, ownerPackages.length)
          ownerPackages.push(unit.packageName)
          ownerPaths.push(unit.name)
        } else if (ownerPackages[seen] !== unit.packageName) {
          const here = describePackage(unit.packageName)
          const there = describePackage(ownerPackages[seen])
          this.sink.report(
            unit.source,
            at.start,
            at.end,
            `${what} \`${this.table.typeName(info.type)}\` is declared in package ${there} and again in package ${here}; a class or interface name is still program-wide, so two packages cannot both declare one`
          )
        }
      }
    }
    return declared
  }

  /**
   * The refusal of a generic class or interface that another module of its
   * package also declares, at the later template's name. It is the sentence
   * `rejectSymbolClashes` writes for a generic function, with the noun
   * changed: the same rule one level up.
   */
  reportTemplateClash(unit: ModuleUnit, template: StructTemplateInfo, first: string): void {
    const at = template.decl.children[0]
    const kindWord = template.kind === STRUCT_CLASS ? "class" : "interface"
    this.sink.report(
      unit.source,
      at.start,
      at.end,
      `Generic ${kindWord} \`${template.sourceName}\` is also declared in ${first}; a class or interface name must be unique across the program, and an instantiation is named after its template`
    )
  }

  /**
   * A function's *symbol* must be unique across the program whether or not it
   * is exported, and the entry wrapper reserves `main` as well. An external
   * symbol is global to the link, and even an `internal` one reaches
   * `analyzeFunctions`, which keys the whole-program fact fixpoint by that
   * symbol: a duplicate would make two functions share one set of attributes,
   * so this check does not consult `--strict-exports`.
   *
   * WP21 S1 is what turned "name" into "symbol" there. A symbol carries its
   * package's prefix, so the *name* has to be unique only within its package,
   * which is what lets two packages each keep a private `helper()`; the check
   * itself is unchanged, because two packages can no longer make one symbol
   * out of one name. A program of one package is every program that existed
   * before packages did, and for it the rule, the message and the emitted
   * symbol are all exactly what they were.
   *
   * A constructor or method of a class in `clashed` is skipped: `declaredStructs`
   * has already refused the second class, and the member the two share is a
   * consequence of that one mistake rather than a second one. The bare name is
   * enough of a key, because a member symbol carries its package's prefix, so
   * only two classes of one package can share one.
   */
  rejectSymbolClashes(clashed: StringSet): void {
    const owners = new StringMap()
    const ownerSigs: (FunctionSig | null)[] = []
    const ownerModules: ModuleUnit[] = []
    const entry = this.entry()
    if (entry.checker.program.entryMain !== null) {
      owners.set("main", ownerSigs.length)
      ownerSigs.push(null)
      ownerModules.push(entry)
    }
    for (const unit of this.modules) {
      // A template's instantiations are named after it (`identity$i32`), so two
      // modules declaring the same generic would produce the same symbols. The
      // template's own name is what has to be unique, and it is checked here
      // with the functions because the rule is the same rule (WP18 §3b).
      //
      // Keyed by the *package-scoped* symbol, like every other entry in this
      // map. An instantiation carries its package's prefix (`src/generics.ts`,
      // `instantiate`), so `pkg_a.identity$i32` and `identity$i32` are two
      // symbols and two packages may each keep a private `identity<T>` exactly
      // as they may each keep a private `helper()`.
      for (const template of unit.checker.program.templateList) {
        // An imported template is the exporter's declaration, not a second one
        // (WP18 G7) — the same guard the loop below applies to an imported
        // signature.
        if (template.origin !== unit.source) {
          continue
        }
        const symbol = unit.checker.program.symbolPrefix + template.sourceName
        const at = owners.get(symbol, -1)
        if (at < 0) {
          owners.set(symbol, ownerSigs.length)
          ownerSigs.push(null)
          ownerModules.push(unit)
          continue
        }
        // One template literal rather than a concatenation: the code generator
        // keys a rule on the longest literal run of its message, and split at
        // the `+` the longest run was "` is also defined in ", which the three
        // whole-program duplicate messages also contain.
        this.sink.report(
          unit.source,
          template.decl.children[0].start,
          template.decl.children[0].end,
          `Generic function \`${template.sourceName}\` is also defined in ${ownerModules[at].name}; a function name must be unique across the program, and an instantiation is named after its template`
        )
      }
      for (const sig of unit.checker.program.functions) {
        if (!sig.definedIn(unit.source)) {
          continue // an imported signature is the exporter's symbol, not a second one
        }
        const owner = sig.owner
        if (owner !== null && clashed.has(owner.name)) {
          continue
        }
        const at = owners.get(sig.name, -1)
        if (at < 0) {
          owners.set(sig.name, ownerSigs.length)
          ownerSigs.push(sig)
          ownerModules.push(unit)
          continue
        }
        const previousSig = ownerSigs[at]
        const previousModule = ownerModules[at]
        let message = ""
        if (previousSig === null) {
          message = `Function \`main\` in ${unit.name} collides with the entry wrapper \`@main\` that ${previousModule.name} needs; rename it`
        } else {
          message = clashMessage(
            this.table,
            sig,
            previousSig,
            previousModule.name,
            unit.name,
            unit.packageName
          )
        }
        // Reported, not thrown: every clash is listed.
        const at2 = nameNode(sig)
        this.sink.report(unit.source, at2.start, at2.end, message)
      }
    }
  }

  /**
   * The whole-program attribute fixpoint, computed once per compilation.
   * `emit()` reads it, and so does `--emit-checked`, whose dump prints the
   * facts of every function the way stage0's `src/dump.ts` prints them; running it
   * twice would be the most expensive thing this class does twice.
   */
  analyze(): FactsTable {
    const done = this.facts
    if (done !== null) {
      return done
    }
    const units: AnalysisUnit[] = []
    for (const unit of this.modules) {
      units.push(new AnalysisUnit(unit.checker.program, unit.parents))
    }
    // The entry wrapper initialises `process.argv` when any module reads it.
    for (const unit of this.modules) {
      if (unit.checker.program.usesArgv) {
        this.entry().checker.program.usesArgv = true
      }
    }
    const facts = analyzeFunctions(units, this.table, this.opts, this.runtime)
    this.analysisUnits = units
    this.facts = facts
    return facts
  }

  /** The `--emit-panics` file, from the sites `check` settled (`panicsJson`). */
  panicsText(): string {
    const facts = this.analyze() // fills `analysisUnits` when nothing has yet
    return panicsJson(this.analysisUnits, facts)
  }

  /** The `--emit-arena` file: every allocation site and its placement (`arenaJson`). */
  arenaText(): string {
    const facts = this.analyze()
    return arenaJson(this.analysisUnits, facts)
  }

  /** The directory `nish/<module>` resolves under: the package root, or the working directory without one. */
  libraryRoot(): string {
    return this.opts.packageRoot.length > 0 ? this.opts.packageRoot : "."
  }

  /**
   * WP32: the modules that write no `.ll` and are copied into each module that
   * uses them instead: `std/collections.ts`, once a module names `Map` or
   * `Set`, and `std/secret.ts`, once one imports `nish:secret`. Each is
   * checked like any module; what a module uses of it is emitted into that
   * module (docs/wp32-map.md §4.1).
   */
  libraryUnits(units: AnalysisUnit[]): AnalysisUnit[] {
    const out: AnalysisUnit[] = []
    let i = 0
    while (i < this.modules.length && i < units.length) {
      const program = this.modules[i].checker.program
      if (program.isCollections() || program.isSecretLibrary()) {
        out.push(units[i])
      }
      i = i + 1
    }
    return out
  }

  /** Whether `unit` writes a `.ll` of its own: every module but `std/collections.ts`, `std/map.ts` and `std/secret.ts`. */
  writesOutput(unit: ModuleUnit): boolean {
    return !unit.checker.program.writesNoOutput()
  }

  /** Program-wide attribute analysis, then one IR module per source module. */
  emit(): EmittedModule[] {
    const facts = this.analyze()
    const units = this.analysisUnits
    const stems = this.outputStems()
    const copies: AnalysisUnit[] = this.libraryUnits(units)
    const out: EmittedModule[] = []
    let i = 0
    while (i < this.modules.length && i < units.length && i < stems.length) {
      // Read before the calls, which end the length facts.
      const unit = this.modules[i]
      const analysed = units[i]
      const stem = stems[i]
      if (this.writesOutput(unit)) {
        out.push(
          new EmittedModule(
            stem,
            emitProgram(analysed, this.table, this.opts, this.runtime, facts, copies),
            unit.name
          )
        )
      }
      i = i + 1
    }
    return out
  }

  /**
   * The file stem per module: its basename normally, and — when two modules
   * share one — its path relative to the entry's directory with the separators
   * turned into `_`. Whatever that still leaves shared, a later module takes
   * the first free `<stem>_<n>` from 2 up, so `-o <dir>/` never writes two
   * modules to one file.
   *
   * **The path, deliberately, and not the name.** A package module's name is
   * package-relative now, so stemming from it would make `std/text.ts` answer
   * `std_text` under every install instead of climbing out to wherever the
   * compiler sits — which is the better answer and is *not* this change: the
   * fallback drops every `.` and `..` segment before joining, on both sides.
   *
   * **Why a counter is needed at all.** That drop is lossy, so two modules
   * whose paths differ only by a climb, or by a link followed by `..`
   * (`identityOf`), meet on one stem, and the second used to overwrite the
   * first silently (`docs/wp19-stage0-retirement.md` §5a item 5, #198).
   */
  outputStems(): string[] {
    const counts = new StringMap()
    for (const unit of this.modules) {
      if (!this.writesOutput(unit)) {
        continue
      }
      const base = basenameWithout(unit.path, ".ts")
      counts.set(base, counts.get(base, 0) + 1)
    }
    const root = dirname(this.entry().path)
    const taken = new StringSet()
    const stems: string[] = []
    for (const unit of this.modules) {
      // One entry per module, `""` for one that writes no `.ll` (WP32).
      if (!this.writesOutput(unit)) {
        stems.push("")
        continue
      }
      const base = basenameWithout(unit.path, ".ts")
      const stem = counts.get(base, 0) === 1 ? base : pathStem(root, unit.path)
      let free = stem
      let n = 2
      while (taken.has(free)) {
        free = `${stem}_${n}`
        n = n + 1
      }
      taken.add(free)
      stems.push(free)
    }
    return stems
  }
}

/** Whether `program` uses the global `name`: it imports it from `nish/collections`, implicitly or not (WP32). */
const importsCollection = (program: CheckedProgram, name: string): boolean => {
  for (const imp of program.imports) {
    if (imp.importedName === name && imp.specifier === COLLECTIONS_SPECIFIER) {
      return true
    }
  }
  return false
}

/** The name node of `program`'s own declaration of the type `name`, or `null` (WP32). */
const declarationNameOf = (program: CheckedProgram, name: string): Node | null => {
  const struct = program.struct(name)
  if (struct !== null && struct.origin === program.source) {
    return struct.decl.children[0]
  }
  const template = program.structTemplate(name)
  if (template !== null && template.origin === program.source) {
    return template.decl.children[0]
  }
  const alias = program.ownAlias(name)
  if (alias !== null) {
    return alias.decl.children[0]
  }
  const declared = program.ownEnum(name)
  return declared === null ? null : declared.decl.children[0]
}

/**
 * `path` relative to `root`, with every `.` and `..` segment dropped and the
 * rest joined with `_`: the stem of a module whose basename another module
 * shares (`Compilation.outputStems`).
 */
const pathStem = (root: string, path: string): string => {
  const parts: string[] = []
  for (const segment of splitByte(relativePath(root, path), SLASH)) {
    if (segment !== "." && segment !== "..") {
      parts.push(segment)
    }
  }
  const joined = parts.join("_")
  return joined.endsWith(".ts") ? joined.substring(0, joined.length - 3) : joined
}

/**
 * The directory above `dir`, or `""` when there is none left to visit — and the
 * twin of `parentDirectory` in stage0's `src/compilation.ts`, step for step, because the
 * two compilers have to visit the same directories in the same order.
 *
 * `dirname` answers this for an absolute path and stops at `/`. For a relative
 * one it stops at `.`, and it is wrong above that: `dirname("..")` is `.`, back
 * the way we came. So above `.` the walk is spelled — one more `..` per level —
 * and the operating system resolves those against the working directory. That
 * is how a compiler with no `cwd` builtin (WP19 §A3) searches the directories
 * above the one it was run in.
 *
 * What the spelling gives up it now gives up on both sides: `..` names a
 * directory without naming it, so an ancestor above the name's own root that is
 * itself called `node_modules` cannot be recognised and is searched rather than
 * stepped over. stage0 used to read that name off an absolute path and refuse
 * the package — a program that compiled with one compiler and not the other —
 * so its walk is driven by the module's name now too (`docs/wp21-packages.md`
 * §10a, `tests/link/package_doubled`).
 */
const parentDirectory = (dir: string): string => {
  if (dir.length > 0 && dir.charCodeAt(0) === SLASH) {
    const parent = dirname(dir)
    return parent === dir ? "" : parent // `/` is the top of an absolute walk
  }
  if (dir === ".") {
    return ".."
  }
  // In a normalised relative path every `..` leads, so a trailing one means
  // the path is nothing but parent steps and the next level is one more.
  if (dir === ".." || dir.endsWith("/..")) {
    return `${dir}/..`
  }
  return dirname(dir)
}

/** Whether `warning` says a check survives inside one of the `refused` sites, which the error says already. */
const restatedBy = (warning: Diagnostic, refused: PanicSite[]): boolean => {
  const text = warning.text
  if (
    text.indexOf("is not proven to be in range for") < 0 &&
    text.indexOf("so entering the range keeps its check") < 0
  ) {
    return false
  }
  for (const site of refused) {
    if (warning.source === site.source && warning.start >= site.node.start && warning.end <= site.node.end) {
      return true
    }
  }
  return false
}

/** The node a symbol-clash diagnostic points at: the name, or the declaration. */
const nameNode = (sig: FunctionSig): Node =>
  sig.decl.kind === N_CONSTRUCTOR ? sig.decl : sig.decl.children[0]

/** Whether a struct name is spelled like an instantiation's (`Box$i32`). */
const isInstantiationName = (name: string): boolean => name.indexOf("$") >= 0

/** How a diagnostic names a package copy's version: a manifest may declare none. */
const describeVersion = (version: string): string => (version.length > 0 ? version : "no version")

/** How a diagnostic names a package: the program's own has no name to give. */
const describePackage = (packageName: string): string =>
  packageName === ROOT_PACKAGE ? "the program itself" : `\`${packageName}\``

/**
 * The wording of a duplicate-symbol rejection (WP21 S1).
 *
 * Two spellings of each rule, and the split is not decoration: in a program of
 * one package "unique across the program" is the whole truth and is the
 * sentence this compiler has always printed, while in a program of several it
 * would be wrong -- the point of package-scoped symbols is that the *other*
 * package may use the name freely. Each spelling is written out in full rather
 * than assembled from a shared fragment, because a diagnostic's literal run is
 * what its stable `NL` code in `src/codes.ts` is keyed on.
 *
 * A constructor or method is a symbol named after its class, so two classes
 * that share a name collide here when both declare the same member. That
 * sentence names the class and both files rather than the symbol
 * `Base.constructor`, which is not a name the reader wrote (#174). Since #193 two
 * same-named classes of one package -- declared ones, or two templates'
 * instantiations -- are refused by `declaredStructs` before their members are
 * looked at, and only such a pair can share a member symbol, so no program
 * reaches it today; it stays as the wording of a rule that still holds, and its
 * codes stay reserved.
 */
const clashMessage = (
  table: TypeTable,
  sig: FunctionSig,
  previous: FunctionSig,
  previousFile: string,
  file: string,
  packageName: string
): string => {
  const owner = sig.owner
  if (owner !== null) {
    const member =
      sig.decl.kind === N_CONSTRUCTOR
        ? "is declared with a constructor"
        : `declares method \`${sig.decl.children[0].text}\``
    const both = `Class \`${table.typeName(owner.type)}\` ${member} in both ${previousFile} and ${file}`
    if (packageName === ROOT_PACKAGE) {
      return `${both}; a constructor or method is named after its class, so two classes that share a name anywhere in the program cannot both declare it, whether or not either is exported; rename one of the classes`
    }
    return `${both}; a constructor or method is named after its class, so two classes that share a name within one package cannot both declare it, whether or not either is exported; rename one of the classes`
  }
  const where = `\`${sig.sourceName}\` is also defined in ${previousFile}`
  if (sig.exported && previous.exported) {
    if (packageName === ROOT_PACKAGE) {
      return `Exported function ${where}; exported names must be unique across the program`
    }
    return `Exported function ${where}; exported names must be unique within the package that declares them`
  }
  if (packageName === ROOT_PACKAGE) {
    return `Function ${where}; a function name must be unique across the program whether or not it is exported, because the whole-program attribute analysis is keyed by symbol name`
  }
  return `Function ${where}; a function name must be unique within its own package whether or not it is exported, because the whole-program attribute analysis is keyed by the package-scoped symbol`
}

/**
 * The fix for `import { readFileSync } from "fs"` when no package `fs` loads
 * (NL3015): the specifier becomes `"nish:fs"`, the builtin module that exports
 * the same functions under the same names, so every call means what Node's
 * `fs` would have done with it. Empty, so no fix, for any other specifier, and
 * when any name the statement imports is not one `nish:fs` exports, because
 * the rewrite would only trade this error for that one. The edit replaces the
 * two letters inside the quotes, whichever quotes they are.
 */
const fsSpecifierFix = (ctx: CheckContext, imports: ImportBinding[], imp: ImportBinding): Edit[] => {
  const edits: Edit[] = []
  if (imp.specifier !== "fs") {
    return edits
  }
  const builtin = `${BUILTIN_SCHEME}fs`
  if (!exportsAllOf(builtin, imports, imp.decl)) {
    return edits
  }
  // The closing quote is the last one in the statement: attributes after the
  // specifier are refused before any module is resolved (NL1057).
  const text = ctx.source.text
  let close = imp.decl.end - 1
  while (close >= 0 && close > imp.decl.start && close < text.length && !isQuote(text.charCodeAt(close))) {
    close = close - 1
  }
  const quote = text.substring(close, close + 1)
  if (close - 3 <= imp.decl.start || text.substring(close - 3, close + 1) !== `${quote}fs${quote}`) {
    return edits
  }
  edits.push(ctx.edit(close - 2, close, builtin))
  return edits
}

/**
 * Whether the builtin module `specifier` exports every name the `import`
 * statement `decl` imports. Read off the list `nishModuleExports` prints
 * rather than asked of `nishExport` name by name, because that allocates the
 * export it answers into memory no pass of the loop could give back.
 */
const exportsAllOf = (specifier: string, imports: ImportBinding[], decl: Node): boolean => {
  const listed = `, ${nishModuleExports(specifier)}, `
  for (const other of imports) {
    if (other.decl === decl && listed.indexOf(`, ${other.importedName}, `) < 0) {
      return false
    }
  }
  return true
}

/** A `"` or a `'`, the two quotes a module specifier is written in. */
const isQuote = (byte: i32): boolean => byte === 34 || byte === 39
