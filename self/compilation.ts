// Whole-program compilation for stage1 (`src/compilation.ts`,
// docs/wp14-selfhost.md milestone S5).
//
// A `Compilation` owns every module of one program:
//
//   1. **Load.** Parse the entry file and, transitively, everything it
//      imports. Each file is parsed exactly once, keyed by its resolved path,
//      so an import cycle simply terminates. Signatures are collected as soon
//      as a module is parsed (pass 1), which is what makes cycles legal: no
//      body is checked until every module's exports are known.
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
// use, and `self/compile.ts` writes them. There is no `mkdir` here (D4).

import { analyzeFunctions, AnalysisUnit, FactsTable } from "./attributes";
import { arenaLoopFindings } from "./escape";
import { Checker } from "./checker";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { emitProgram } from "./emit";
import { StringMap, StringSet } from "./map";
import { isNishSpecifier } from "./nish_modules";
import { N_CONSTRUCTOR, Node } from "./nodes";
import { Options } from "./options";
import {
  PACKAGE_ROOT_SEGMENT,
  packageDirOf,
  packageNameOf,
  parseBareSpecifier,
  ROOT_PACKAGE,
} from "./packages";
import { ParentTable } from "./parents";
import { Parser } from "./parser";
import { CheckedProgram, FunctionSig, STRUCT_CLASS, StructRegistry, StructTemplateInfo } from "./program";
import {
  basename,
  basenameWithout,
  dirname,
  joinPath,
  normalizePath,
  relativePath,
  resolveModule,
  resolvePath,
} from "./paths";
import { CLI, LANGUAGE, PACKAGE_CONDITION, packageConditionFor, STD_PREFIX, VERSION } from "./branding";
import {
  ENGINE_TOO_OLD,
  ENGINE_UNREADABLE,
  MANIFEST_FOUND,
  MANIFEST_NOT_NISH,
  MANIFEST_OTHER_MODE,
  manifestEngineCheck,
  manifestEngineRange,
  manifestMalformedAt,
  manifestVersion,
  nishExportEntry,
} from "./manifest";
import { COLLECTIONS_SPECIFIER, isStdModuleName, stdModuleName, stdModuleNames, stdModulePath } from "./std_modules";
import {
  allocationWarning,
  arenaMessage,
  escapeMessage,
  parallelBodyOf,
  reachesDstMessage,
  reduceMessage,
  resultMessage,
  sharedWriteMessage,
  threadsModuleName,
} from "./parallel";
import { RuntimeTable } from "./runtime";
import { splitByte } from "./strings";
import { TypeTable } from "./types";
import { columnOf, lineOf } from "./lexer";
import { validate } from "./validator";
import { NUMBER_MODE_F64 } from "./context";

const SLASH: i32 = 47;

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
const PACKAGE_WALK_LIMIT: i32 = 256;

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
  path: string;
  name: string;
  packageName: string;
  error: string;
}

/**
 * Where one package of the program is: the directory its manifest was read
 * from, as the resolver spelled it, the real directory that is its identity,
 * and the manifest's version, which is what a reader tells two copies apart by.
 */
export class PackageCopy {
  name: string;
  dir: string;
  realDir: string;
  /** The directory its modules are named under: `dir`, or `realDir` spelled like it when a link is in the way. */
  namedDir: string;
  version: string;

  constructor(name: string, dir: string, realDir: string, namedDir: string, version: string) {
    this.name = name;
    this.dir = dir;
    this.realDir = realDir;
    this.namedDir = namedDir;
    this.version = version;
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
  path: string;
  /**
   * The name in the IR header, the `DIFile`, the diagnostics and the output
   * path when there is no `-o`: `path` for an ordinary module, and the module's
   * place inside its package for one reached by a package specifier
   * (`std/text.ts`). `source.path` is this string, which is how it reaches
   * every one of those (WP19 §A7).
   */
  name: string;
  source: SourceFile;
  file: Node;
  nodeCount: i32;
  /** The entry module; the only one allowed to declare `export function main`. */
  isEntry: boolean;
  /**
   * The package this module belongs to (WP21 S1, `self/packages.ts`); `""` for
   * the root package, which is where every module of a single-package program
   * lives. Derived from `name`, which is the same string stage0 derives it
   * from, so the two compilers put a module in the same package (WP19 §A3) —
   * and a package specifier states it outright anyway, which is every module
   * whose name is not its path.
   */
  packageName: string;
  checker: Checker;
  parents: ParentTable;
  /** Specifier text -> index into `Compilation.modules`, for this importer. */
  resolved: StringMap;

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
    this.path = path;
    this.name = name;
    this.source = source;
    this.file = file;
    this.nodeCount = nodeCount;
    this.isEntry = isEntry;
    this.packageName = packageName;
    this.checker = checker;
    this.parents = new ParentTable(file, nodeCount);
    this.resolved = new StringMap();
  }
}

/** One module's IR, with the stem its `.ll` file should be named after and the module's name. */
export class EmittedModule {
  stem: string;
  ir: string;
  /** `ModuleUnit.name`: what `-o <file.ll>` lists when there is more than one. */
  name: string;

  constructor(stem: string, ir: string, name: string) {
    this.stem = stem;
    this.ir = ir;
    this.name = name;
  }
}

export class Compilation {
  opts: Options;
  /** Shared by every module, so a type id means one thing across the program. */
  table: TypeTable;
  sink: DiagnosticSink;
  runtime: RuntimeTable;
  /** Load order: entry first, then imports depth-first. */
  modules: ModuleUnit[];
  /** `identityOf` a module's resolved path -> index into `modules`. */
  byPath: StringMap;
  /**
   * Package name -> index into `packageCopies`: the one directory each package
   * of the program is compiled from, so a second directory for a name already
   * seen is refused rather than compiled as a second copy (#198).
   */
  packageIndex: StringMap;
  packageCopies: PackageCopy[];
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
  workingDir: string;
  /**
   * The root file `load` could not read, or `""`. A root has no importer to
   * point at, so the failure is not a diagnostic with a span; the driver owns
   * the wording and the stream, which is how it can answer `--json` with the
   * object stage0 answers with (`self/compile.ts`).
   */
  unreadableRoot: string;
  /**
   * The whole-program attribute fixpoint, once it has been computed.
   * `analyze()` memoises it here for the reason `src/compilation.ts` memoises
   * its own: the emitter needs it and so does the `--emit-checked` dump, and
   * the fixpoint is the most expensive thing either of them asks for.
   */
  facts: FactsTable | null;
  /** How many diagnostics Phase 0 reported, over every module loaded so far. */
  validationErrors: i32;
  /**
   * `--emit-ast` is answered from the parsed and validated modules, and stage0
   * reaches its dump before it looks at anything pass 1 recorded — so a pass 1
   * refusal must not stop the load here either. Phase 0 still does: stage0's
   * validator throws, and a program it refuses prints no tree on either side.
   */
  dumpOnly: boolean;
  /** The analysis units the fixpoint ran over, in `modules` order. */
  analysisUnits: AnalysisUnit[];
  /**
   * The package directory the entry lives in, and so the one that *is* the
   * root package (WP21 S1). A module sharing it is the program's own code and
   * carries no symbol prefix; a module under some other `node_modules/<name>`
   * is a dependency and carries that package's.
   */
  rootPackageDir: string;

  constructor(opts: Options) {
    this.opts = opts;
    this.table = new TypeTable();
    this.table.json = opts.json;
    this.sink = new DiagnosticSink();
    this.runtime = new RuntimeTable();
    this.modules = [];
    this.byPath = new StringMap();
    this.packageIndex = new StringMap();
    this.packageCopies = [];
    const cwd = realpathSync(".");
    this.workingDir = cwd === null ? "" : cwd;
    this.unreadableRoot = "";
    this.facts = null;
    this.analysisUnits = [];
    this.rootPackageDir = "";
    this.validationErrors = 0;
    this.dumpOnly = false;
  }

  entry(): ModuleUnit {
    return this.modules[0];
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
    const dir = packageDirOf(modulePath);
    if (dir.length > 0) {
      return dir === this.rootPackageDir ? ROOT_PACKAGE : packageNameOf(modulePath);
    }
    let found = ROOT_PACKAGE;
    let depth = 0;
    for (const copy of this.packageCopies) {
      if (copy.namedDir.length > depth && modulePath.startsWith(`${copy.namedDir}/`)) {
        found = copy.name;
        depth = copy.namedDir.length;
      }
    }
    return found;
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
    const real = realpathSync(path);
    return real === null ? resolvePath(this.workingDir, path) : real;
  }

  /**
   * Load `path` and everything it imports. Answers false when a file could not
   * be read or a module failed to parse. A module's own errors are in the
   * sink; a *root* that could not be opened is in `unreadableRoot`, because it
   * has no span and no importer to report it against.
   *
   * Call it once per root: the second and later ones are modules nothing
   * imports, and a path already loaded answers true without reparsing.
   */
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
  load(path: string, name: string, packageOverride: string): boolean {
    const identity = this.identityOf(path);
    const at = this.byPath.get(identity, -1);
    if (at >= 0) {
      return true;
    }
    const text = readFileSyncOrNull(path);
    if (text === null) {
      // A root has no importer to point at, so this is not a diagnostic with a
      // span. Record it and let the driver report it in whichever shape was
      // asked for; an *import* that cannot be read is reported below, against
      // the specifier that named it.
      this.unreadableRoot = path;
      return false;
    }
    const source = new SourceFile(name, text);
    const parser = new Parser(source);
    const file = parser.parseSourceFile();
    // Recorded rather than printed, because the stream and the shape are the
    // driver's to choose. Printed here, a parser refusal was the human report
    // whatever the command line said, so `--json` answered a program stage1's
    // grammar cannot read with an exit status, an empty stdout and text on a
    // stream the contract says is empty — the one thing `docs/LANGUAGE.md`
    // promises `--json` never does.
    for (const diagnostic of parser.diagnostics) {
      this.sink.add(diagnostic);
    }
    if (parser.diagnostics.length > 0) {
      return false;
    }
    const isEntry = this.modules.length === 0;
    if (isEntry) {
      this.rootPackageDir = packageDirOf(name);
    }
    const packageName = packageOverride.length > 0 ? packageOverride : this.packageOf(name);
    const checker = new Checker(
      this.table,
      source,
      file,
      isEntry,
      parser.nodeCount,
      this.sink,
      this.opts.numberMode,
      !this.opts.nsw,
      this.opts.uncheckedIndexing,
      this.opts.strictExports,
      packageName
    );
    const unit = new ModuleUnit(path, name, source, file, parser.nodeCount, isEntry, checker, packageName);
    // WP29 P1 (wp20 §8c.3): a program that imports `nish/threads` is compiled
    // with `--threads`, because every worker a region starts bumps an arena of
    // its own. It is a soundness requirement rather than a default: the rules
    // in `self/parallel.ts` leave arena allocation out of a shared write only
    // because the arena is thread-local. A program that does not import it is
    // compiled exactly as it was.
    if (packageName === CLI && name === threadsModuleName()) {
      this.opts.threads = true;
    }
    this.byPath.set(identity, this.modules.length);
    this.modules.push(unit);

    // Phase 0 before pass 1, so what is forbidden by design is refused before
    // the checker can report it as merely unsupported. The count around it is
    // what `--emit-ast` reads: stage0 answers that flag from the parsed and
    // *validated* modules and never checks anything, so a Phase 0 refusal
    // stops the dump there and a pass 1 diagnostic — which stage0 has not
    // reached — does not (`self/compile.ts`, WP19 §A3).
    const beforeValidation = this.sink.count();
    validate(checker.ctx, file);
    const failedValidation = this.sink.count() > beforeValidation;
    this.validationErrors = this.validationErrors + (this.sink.count() - beforeValidation);
    if (failedValidation) {
      // Phase 0 refused the file, and that ends the compilation rather than
      // going on to pass 1: stage0's validator `throw`s out of `load` and the
      // driver reports the one diagnostic (`src/validator.ts`, `fail`). Going
      // on meant the checker refused `any` a second time, from the annotation
      // resolver, for one `any` in the source (WP19 §A3).
      return false;
    }
    const beforeSignatures = this.sink.count();
    checker.collectSignatures(); // pass 1, which also validates the import syntax
    // Pass 1 refused something in this module. Its specifiers are still
    // *resolved* — a missing module is reported either way — but the modules
    // that do exist are not loaded, so nothing they would have said is
    // reported: stage0 stops at what this module got wrong, and a duplicate
    // function in the entry hides an imported module's own refusals
    // (`tests/link/main_in_import` in f64 mode, `tests/link/missing_module`
    // for the half that still reports). `--emit-ast` is exempt: it prints the
    // tree of every module it managed to read, and stage0 reaches that dump
    // before it looks at anything pass 1 recorded.
    const signaturesFailed = this.sink.count() > beforeSignatures && !this.dumpOnly;
    const dir = dirname(path);
    let ok = true;
    for (const imp of checker.program.imports) {
      // A builtin module has no file behind it; pass 1b binds it instead.
      if (isNishSpecifier(imp.specifier)) {
        continue;
      }
      if (unit.resolved.has(imp.specifier)) {
        continue;
      }
      const found = this.resolveSpecifier(dir, imp.specifier);
      if (found.error.length > 0) {
        // At the module specifier, where stage0 points
        // (`imp.node.moduleSpecifier` in `src/compilation.ts`).
        checker.ctx.errorAtSpecifier(imp.decl, found.error);
        checker.ctx.errored = false;
        continue;
      }
      const target = found.path;
      if (readFileSyncOrNull(target) === null) {
        checker.ctx.errorAtSpecifier(
          imp.decl,
          imp.specifier.startsWith(STD_PREFIX)
            ? `Module \`${imp.specifier}\` is not part of the standard library (it has: ${stdModuleNames()})`
            : `Cannot find module \`${imp.specifier}\` (looked for ${target})`
        );
        checker.ctx.errored = false;
        continue;
      }
      if (signaturesFailed) {
        continue; // resolved, and deliberately not loaded: see above
      }
      // A module that fails to load is reported and the others still load;
      // `check` stops before binding anything.
      if (!this.load(target, found.name, found.packageName)) {
        ok = false;
      } else {
        unit.resolved.set(imp.specifier, this.byPath.get(this.identityOf(target), -1));
      }
    }
    return ok;
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
    if (specifier.startsWith(STD_PREFIX)) {
      const name = specifier.substring(STD_PREFIX.length);
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
        };
        return escaped;
      }
      // Two strings, deliberately: the path says where the file is on *this*
      // install and the name says where the module is in the package, and only
      // the second one reaches the IR (§A7's third bullet).
      //
      // A driver that never looked for its package — the `--emit-checked`
      // dump entries the stage1 oracles build (`self/dump_checked.ts`) — is
      // answered from the working directory, which is the last place
      // `compile.ts` looks too. Without it `/std/<name>.ts` was asked for, and
      // a corpus program importing the library could not be dumped at all.
      const root = this.opts.packageRoot.length > 0 ? this.opts.packageRoot : ".";
      const std: ResolvedModule = {
        path: stdModulePath(root, specifier),
        name: stdModuleName(specifier),
        packageName: CLI,
        error: "",
      };
      return std;
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolvedPath = resolveModule(dir, specifier);
      const relative: ResolvedModule = {
        path: resolvedPath,
        name: resolvedPath,
        packageName: "",
        error: "",
      };
      return relative;
    }
    return this.resolveBareSpecifier(dir, specifier);
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
    const failed: ResolvedModule = { path: "", name: "", packageName: "", error: "" };
    const parsed = parseBareSpecifier(specifier);
    if (parsed === null) {
      // Pass 1 refuses a specifier that is neither relative nor a package name,
      // so reaching here with one is a broken invariant rather than a user
      // error. The sink is not the place for it and neither is a panic in a
      // resolver, so it answers the same "cannot find" the caller reports.
      failed.error = `Cannot find package \`${specifier}\`; no \`${PACKAGE_ROOT_SEGMENT}\` directory above the importing module has it`;
      return failed;
    }
    const foundDir = this.findPackageDir(dir, parsed.name);
    if (foundDir === null) {
      failed.error = `Cannot find package \`${parsed.name}\`; no \`${PACKAGE_ROOT_SEGMENT}\` directory above the importing module has it`;
      return failed;
    }
    // A package is its real directory, as it is to Node's resolver, so one
    // package reached through links (pnpm's layout) is one package, and its
    // own dependencies are looked for beside where it really is. The spelling
    // the walk found is kept unless a link is in the way, so a program with no
    // links names every module as before; through a link the real directory
    // is spelled the way the walk was, relative to the working directory when
    // that was relative, so a name never carries where the checkout sits.
    const identity = this.identityOf(foundDir);
    let packageDir = foundDir;
    if (this.workingDir.length > 0 && identity !== resolvePath(this.workingDir, foundDir)) {
      packageDir = foundDir.startsWith("/") ? identity : relativePath(this.workingDir, identity);
    }
    const manifestPath = joinPath([packageDir, "package.json"]);
    const manifest = readFileSyncOrNull(manifestPath);
    const mode = this.opts.numberMode === NUMBER_MODE_F64 ? "f64" : "i32";
    const otherMode = mode === "f64" ? "i32" : "f64";
    // `findPackageDir` only answers a directory whose manifest it could read, so
    // the null here is a file that vanished between the two reads. It takes the
    // same route as a manifest with nothing in it for us, which is the honest
    // answer: this compiler found no Nish entry point in that package.
    const text = manifest === null ? "" : manifest;
    // One package name at two real directories is two copies of it (npm's
    // duplicates, or §7's diamond), and a program compiles one copy of a
    // package: refused in words, where it used to be refused by accident as a
    // symbol clash between the copies.
    const version = manifestVersion(text);
    const seen = this.packageIndex.get(parsed.name, -1);
    if (seen < 0) {
      this.packageIndex.set(parsed.name, this.packageCopies.length);
      this.packageCopies.push(new PackageCopy(parsed.name, foundDir, identity, packageDir, version));
    } else if (this.packageCopies[seen].realDir !== identity) {
      const first = this.packageCopies[seen];
      failed.error = `Package \`${parsed.name}\` is at two places, ${first.dir} (${describeVersion(first.version)}) and ${foundDir} (${describeVersion(version)}): ${LANGUAGE} compiles one copy of a package per program, so every import of it has to reach the same directory`;
      return failed;
    }
    // The floor is checked before the entry point, and whether or not there is
    // one: a package that names a newer compiler has said this one should not
    // be trusted with its source, and a file that happens to resolve does not
    // change that (`docs/wp21-packages.md` §6).
    const engine = manifestEngineCheck(text, PACKAGE_CONDITION, VERSION);
    if (engine === ENGINE_TOO_OLD) {
      failed.error = `Package \`${parsed.name}\` needs a newer compiler: its \`engines.${PACKAGE_CONDITION}\` asks for \`${manifestEngineRange(text, PACKAGE_CONDITION)}\` and this is ${CLI} ${VERSION}`;
      return failed;
    }
    if (engine === ENGINE_UNREADABLE) {
      failed.error = `Package \`${parsed.name}\` declares \`engines.${PACKAGE_CONDITION}\` as \`${manifestEngineRange(text, PACKAGE_CONDITION)}\`, which is not a range this compiler reads: the one it accepts is a floor, \`>=X.Y.Z\` or \`>=X.Y\``;
      return failed;
    }
    const entry = nishExportEntry(
      text,
      parsed.subpath,
      packageConditionFor(mode),
      PACKAGE_CONDITION,
      packageConditionFor(otherMode)
    );
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
      const brokenAt = manifest === null ? -1 : manifestMalformedAt(text);
      if (brokenAt >= 0) {
        failed.error = `Package \`${parsed.name}\` has a malformed manifest: ${manifestPath}:${lineOf(text, brokenAt)}:${columnOf(text, brokenAt)} is not well-formed JSON, so this compiler could not read an entry point out of it`;
        return failed;
      }
      if (entry.status === MANIFEST_OTHER_MODE) {
        failed.error = `Package \`${parsed.name}\` supports ${LANGUAGE} in ${otherMode} mode only: its \`exports\` offers \`${packageConditionFor(otherMode)}\` for \`${parsed.subpath}\` and neither \`${packageConditionFor(mode)}\` nor \`${PACKAGE_CONDITION}\`, and this program is compiling in ${mode} (\`--number-mode ${mode}\`)`;
        return failed;
      }
      // The second clause keeps S2's sentence and adds the cause, so the
      // message a reader of S2 learned still matches: it says what this
      // compiler came away with, then why.
      if (entry.status === MANIFEST_NOT_NISH) {
        failed.error = `Package \`${parsed.name}\` has no ${LANGUAGE} entry point: its \`exports\` gave this compiler no file to compile for \`${parsed.subpath}\`, because that entry declares none of the conditions this compiler compiles source from (\`${PACKAGE_CONDITION}\`, \`${packageConditionFor(mode)}\`, \`${packageConditionFor(otherMode)}\`)`;
        return failed;
      }
      // What is left: no `exports` at all, no key for this subpath, or a value
      // `manifest.ts` does not follow. The second clause says what this
      // compiler came away with rather than what the package declares, because
      // the mode-qualified condition outranks the plain one (§10a): a manifest
      // whose `nish-i32` names something that is not a file never reaches its
      // perfectly good `nish` row, and a sentence about what the `exports`
      // declares would send its author to a line that is correct.
      failed.error = `Package \`${parsed.name}\` has no ${LANGUAGE} entry point: its \`exports\` gave this compiler no file to compile for \`${parsed.subpath}\``;
      return failed;
    }
    const target = entry.target;
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
    const resolvedPath = joinPath([packageDir, target]);
    const resolved: ResolvedModule = {
      path: resolvedPath,
      name: resolvedPath,
      packageName: parsed.name,
      error: "",
    };
    return resolved;
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
    let dir = normalizePath(from);
    let steps = 0;
    let searching = true;
    while (searching) {
      if (basename(dir) !== PACKAGE_ROOT_SEGMENT) {
        const candidate = joinPath([dir, PACKAGE_ROOT_SEGMENT, name]);
        if (readFileSyncOrNull(joinPath([candidate, "package.json"])) !== null) {
          return candidate;
        }
      }
      const parent = parentDirectory(dir);
      if (parent.length === 0 || steps >= PACKAGE_WALK_LIMIT) {
        searching = false;
      } else {
        dir = parent;
        steps = steps + 1;
      }
    }
    return null;
  }

  /**
   * Passes 1b and 2 over every module. Each phase runs to completion over
   * every module and then the errors are answered together: a broken signature
   * never reaches body checking and a broken body never reaches the emitter.
   */
  check(): boolean {
    if (this.sink.hasErrors()) {
      return false; // pass 1 and module resolution ran during load
    }
    this.rejectCollectionsClash();
    if (this.sink.hasErrors()) {
      return false;
    }
    for (const unit of this.modules) {
      const targets: CheckedProgram[] = [];
      for (const imp of unit.checker.program.imports) {
        // A builtin module has no file behind it, so there is nothing to look
        // up; the entry keeps the array the same length as `imports` and
        // `bindImport` routes on the specifier before it reads one.
        const index = isNishSpecifier(imp.specifier) ? -1 : unit.resolved.get(imp.specifier, -1);
        targets.push(index < 0 ? unit.checker.program : this.modules[index].checker.program);
      }
      unit.checker.bindImports(targets);
    }
    // WP18 G7: `Box<i32>` in a signature annotation, where `Box` is imported.
    // Pass 1 could only write the request down — it runs as each module is
    // parsed, long before any import is bound — and it is made here, once every
    // module can answer one and can resolve its own imports while doing so.
    for (const unit of this.modules) {
      unit.checker.makeDeferredInstantiations();
    }
    // After every module is bound, so a struct reached through a chain of
    // modules does not depend on the order they were bound in.
    const clashed = new StringSet();
    const declared = this.declaredStructs(clashed);
    for (const unit of this.modules) {
      unit.checker.closeReachableStructs(declared);
    }
    this.rejectSymbolClashes(clashed);
    if (this.sink.hasErrors()) {
      return false;
    }
    // `process.argv` is legal anywhere in a program that has an entry point, so
    // every module needs to know whether the entry declares `main` before its
    // bodies are checked.
    const hasMain = this.entry().checker.program.entryMain !== null;
    for (const unit of this.modules) {
      unit.checker.ctx.entryHasMain = hasMain;
    }
    // Constants fold once every module has its signatures, because an
    // initialiser may name a constant imported from a module checked later.
    for (const unit of this.modules) {
      unit.checker.foldConstants();
    }
    for (const unit of this.modules) {
      unit.checker.checkBodies();
    }
    if (this.sink.hasErrors()) {
      return false;
    }
    // Pass 3 (WP18): every instantiation the bodies asked for, to a fixed
    // point. Per module in load order, because an instantiation is checked by
    // the module that declares its template, in that module's scope.
    //
    // The sweep repeats because G7 let a request cross a module boundary in
    // either direction: draining one module's queue checks bodies that ask
    // other modules for instantiations, including modules already drained this
    // sweep, and those bodies ask in turn. It ends because the set of
    // (template, tuple) pairs only grows and the caps in `self/generics.ts`
    // bound it.
    let working = true;
    while (working) {
      working = false;
      for (const unit of this.modules) {
        if (unit.checker.drainInstantiations()) {
          working = true;
        }
      }
    }
    this.rejectInstantiatedStructClashes();
    if (this.sink.hasErrors()) {
      return false;
    }
    this.reportArenaLoops();
    this.checkParallel();
    return !this.sink.hasErrors();
  }

  /**
   * WP32 (docs/wp32-map.md §4.2): one module declares a `Map` or `Set` of its
   * own and another names the global one. Each module's own is legal by itself
   * — it shadows the global, as it does under `tsc` — but a class name is
   * program-wide (NL3028), so the two classes would be one struct type and one
   * set of method symbols. Refused at the declaration, naming the module that
   * uses the global, once per declaring module and name.
   */
  rejectCollectionsClash(): void {
    for (const user of this.modules) {
      const at = user.checker.program.namesCollections;
      if (at === null) {
        continue;
      }
      for (const unit of this.modules) {
        const program = unit.checker.program;
        if (unit === user || program.isCollections()) {
          continue;
        }
        this.reportCollectionClash(unit, "Map", user);
        this.reportCollectionClash(unit, "Set", user);
      }
      return;
    }
  }

  /** The refusal for one name, when `unit` declares it and `user` was given the global. */
  reportCollectionClash(unit: ModuleUnit, name: string, user: ModuleUnit): void {
    let imported = false;
    for (const imp of user.checker.program.imports) {
      if (imp.localName === name && imp.specifier === COLLECTIONS_SPECIFIER) {
        imported = true;
      }
    }
    const at = declarationNameOf(unit.checker.program, name);
    if (!imported || at === null) {
      return;
    }
    this.sink.report(
      unit.source,
      at.start,
      at.end,
      `\`${name}\` is declared here and ${user.name} uses the global \`${name}\`; a class or interface name is program-wide, so one program cannot have both (rename this one)`
    );
  }

  /**
   * WP29 P1: every `parallelMapInto` and `parallelReduce` call, against the
   * rules that make its region safe on several threads (`self/parallel.ts`).
   * They ask the whole-program facts about the body, so they run here, after
   * the fixpoint `reportArenaLoops` has already paid for, and each refusal is
   * reported at the call that asked for the region. A call the rules admit
   * whose body allocates gets NL9012 there instead (`allocationWarning`).
   */
  checkParallel(): void {
    const facts = this.analyze();
    for (const unit of this.modules) {
      const program = unit.checker.program;
      for (const call of program.parallelCalls) {
        const sig = call.sig;
        const instance = sig.instance;
        const fn = parallelBodyOf(sig);
        if (instance === null || fn === null) {
          continue;
        }
        // `U` for a map, `T` for a reduce: the last type argument either way.
        const result = instance.typeArgs[instance.typeArgs.length - 1];
        const args = call.node.children[1].children;
        const identity = args.length > 2 ? args[2] : call.node;
        const messages: string[] = [];
        messages.push(resultMessage(this.table, sig, fn, result));
        messages.push(reachesDstMessage(this.table, program, sig, fn));
        messages.push(sharedWriteMessage(sig, fn, facts));
        messages.push(arenaMessage(sig, fn, facts));
        messages.push(escapeMessage(sig, fn, facts));
        messages.push(reduceMessage(sig, fn, identity, program.source.text.substring(identity.start, identity.end)));
        let refused = false;
        for (const message of messages) {
          if (message.length > 0) {
            this.sink.report(program.source, call.node.start, call.node.end, message);
            refused = true;
          }
        }
        // A body the rules admit may still allocate, recycled per element
        // (`scopeParallelBodies`); that costs every element, and it is said once
        // the call is known to compile.
        const warning = allocationWarning(this.table, sig, fn, result, facts);
        if (!refused && warning.length > 0) {
          this.sink.reportPerformance(program.source, call.node.start, call.node.end, warning);
        }
      }
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
    const facts = this.analyze();
    for (const unit of this.analysisUnits) {
      for (const finding of arenaLoopFindings(unit, facts)) {
        this.sink.reportPerformance(unit.program.source, finding.node.start, finding.node.end, finding.message);
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
    const owners = new StringMap();
    const ownerPackages: string[] = [];
    // `<package> <name>` -> the path of the first module of that package to
    // own the instantiation, as in `declaredStructs`.
    const packageOwners = new StringMap();
    const packageOwnerPaths: string[] = [];
    const reported = new StringSet();
    for (const unit of this.modules) {
      for (const instance of unit.checker.program.structInstantiationList) {
        // The module that declares the template owns every instantiation of
        // it, whoever the annotation was written by.
        if (instance.template.origin !== unit.source) {
          continue;
        }
        const name = instance.info.name;
        // A template is one declaration in one module, so its module's path and
        // its own name name it uniquely -- which is the object identity stage0
        // keys this set on.
        const templateKey = `${unit.path}#${instance.template.sourceName}`;
        const key = `${unit.packageName} ${name}`;
        const inPackage = packageOwners.get(key, -1);
        if (inPackage < 0) {
          packageOwners.set(key, packageOwnerPaths.length);
          packageOwnerPaths.push(unit.name);
        } else if (inPackage < packageOwnerPaths.length) {
          // Its own package's first owner before anybody's, so that a clash
          // inside one package is named as one even when another package
          // owned the name before either module.
          const first = packageOwnerPaths[inPackage];
          if (reported.add(templateKey)) {
            this.reportTemplateClash(unit, instance.template, first);
          }
          continue;
        }
        const seen = owners.get(name, -1);
        if (seen < 0) {
          owners.set(name, ownerPackages.length);
          ownerPackages.push(unit.packageName);
          continue;
        }
        // Not this package's first, which was compared above, so another's.
        if (!reported.add(templateKey)) {
          continue;
        }
        const at = instance.template.decl.children[0];
        const what = instance.info.kind === STRUCT_CLASS ? "Class" : "Interface";
        const here = describePackage(unit.packageName);
        const there = describePackage(ownerPackages[seen]);
        this.sink.report(
          unit.source,
          at.start,
          at.end,
          `${what} \`${this.table.typeName(instance.info.type)}\` is declared in package ${there} and again in package ${here}; a class or interface name is still program-wide, so two packages cannot both declare one`
        );
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
    const declared = new StructRegistry();
    const owners = new StringMap();
    const ownerPackages: string[] = [];
    const ownerPaths: string[] = [];
    // `<package> <name>` -> the path of the first module of that package to
    // declare the name. A space cannot occur in either half.
    const packageOwners = new StringMap();
    const packageOwnerPaths: string[] = [];
    const reportedTemplates = new StringSet();
    for (const unit of this.modules) {
      for (const info of unit.checker.program.structList) {
        if (info.origin !== unit.source) {
          continue;
        }
        declared.add(info);
        // Already refused where it was declared, for its `$`; compared here it
        // would clash with the instantiation it is spelled like, in words
        // that name the instantiation rather than what was written.
        if (info.instance === null && isInstantiationName(info.name)) {
          continue;
        }
        const what = info.kind === STRUCT_CLASS ? "Class" : "Interface";
        const at = info.decl.children[0];
        const key = `${unit.packageName} ${info.name}`;
        const inPackage = packageOwners.get(key, -1);
        if (inPackage < 0) {
          packageOwners.set(key, packageOwnerPaths.length);
          packageOwnerPaths.push(unit.name);
        } else if (inPackage < packageOwnerPaths.length) {
          // The range test, and reading the path before any call, let the
          // prover drop the check.
          const first = packageOwnerPaths[inPackage];
          const instance = info.instance;
          if (instance === null) {
            this.sink.report(
              unit.source,
              at.start,
              at.end,
              `${what} \`${this.table.typeName(info.type)}\` is also declared in ${first}; a class or interface name must be unique across the program whether or not it is exported, because a struct type is identified by its name alone`
            );
          } else if (reportedTemplates.add(`${unit.path}#${instance.template.sourceName}`)) {
            this.reportTemplateClash(unit, instance.template, first);
          }
          clashed.add(info.name);
          continue;
        }
        const seen = owners.get(info.name, -1);
        if (seen < 0) {
          owners.set(info.name, ownerPackages.length);
          ownerPackages.push(unit.packageName);
          ownerPaths.push(unit.name);
        } else if (ownerPackages[seen] !== unit.packageName) {
          const here = describePackage(unit.packageName);
          const there = describePackage(ownerPackages[seen]);
          this.sink.report(
            unit.source,
            at.start,
            at.end,
            `${what} \`${this.table.typeName(info.type)}\` is declared in package ${there} and again in package ${here}; a class or interface name is still program-wide, so two packages cannot both declare one`
          );
        }
      }
    }
    return declared;
  }

  /**
   * The refusal of a generic class or interface that another module of its
   * package also declares, at the later template's name. It is the sentence
   * `rejectSymbolClashes` writes for a generic function, with the noun
   * changed: the same rule one level up.
   */
  reportTemplateClash(unit: ModuleUnit, template: StructTemplateInfo, first: string): void {
    const at = template.decl.children[0];
    const kindWord = template.kind === STRUCT_CLASS ? "class" : "interface";
    this.sink.report(
      unit.source,
      at.start,
      at.end,
      `Generic ${kindWord} \`${template.sourceName}\` is also declared in ${first}; a class or interface name must be unique across the program, and an instantiation is named after its template`
    );
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
    const owners = new StringMap();
    const ownerSigs: (FunctionSig | null)[] = [];
    const ownerModules: ModuleUnit[] = [];
    const entry = this.entry();
    if (entry.checker.program.entryMain !== null) {
      owners.set("main", ownerSigs.length);
      ownerSigs.push(null);
      ownerModules.push(entry);
    }
    for (const unit of this.modules) {
      // A template's instantiations are named after it (`identity$i32`), so two
      // modules declaring the same generic would produce the same symbols. The
      // template's own name is what has to be unique, and it is checked here
      // with the functions because the rule is the same rule (WP18 §3b).
      //
      // Keyed by the *package-scoped* symbol, like every other entry in this
      // map. An instantiation carries its package's prefix (`self/generics.ts`,
      // `instantiate`), so `pkg_a.identity$i32` and `identity$i32` are two
      // symbols and two packages may each keep a private `identity<T>` exactly
      // as they may each keep a private `helper()`.
      for (const template of unit.checker.program.templateList) {
        // An imported template is the exporter's declaration, not a second one
        // (WP18 G7) — the same guard the loop below applies to an imported
        // signature.
        if (template.origin !== unit.source) {
          continue;
        }
        const symbol = unit.checker.program.symbolPrefix + template.sourceName;
        const at = owners.get(symbol, -1);
        if (at < 0) {
          owners.set(symbol, ownerSigs.length);
          ownerSigs.push(null);
          ownerModules.push(unit);
          continue;
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
        );
      }
      for (const sig of unit.checker.program.functions) {
        if (!sig.definedIn(unit.source)) {
          continue; // an imported signature is the exporter's symbol, not a second one
        }
        const owner = sig.owner;
        if (owner !== null && clashed.has(owner.name)) {
          continue;
        }
        const at = owners.get(sig.name, -1);
        if (at < 0) {
          owners.set(sig.name, ownerSigs.length);
          ownerSigs.push(sig);
          ownerModules.push(unit);
          continue;
        }
        const previousSig = ownerSigs[at];
        const previousModule = ownerModules[at];
        let message = "";
        if (previousSig === null) {
          message = `Function \`main\` in ${unit.name} collides with the entry wrapper \`@main\` that ${previousModule.name} needs; rename it`;
        } else {
          message = clashMessage(this.table, sig, previousSig, previousModule.name, unit.name, unit.packageName);
        }
        // Reported, not thrown: every clash is listed.
        const at2 = nameNode(sig);
        this.sink.report(unit.source, at2.start, at2.end, message);
      }
    }
  }

  /**
   * The whole-program attribute fixpoint, computed once per compilation.
   * `emit()` reads it, and so does `--emit-checked`, whose dump prints the
   * facts of every function the way `src/dump.ts` prints them; running it
   * twice would be the most expensive thing this class does twice.
   */
  analyze(): FactsTable {
    const done = this.facts;
    if (done !== null) {
      return done;
    }
    const units: AnalysisUnit[] = [];
    for (const unit of this.modules) {
      units.push(new AnalysisUnit(unit.checker.program, unit.parents));
    }
    // The entry wrapper initialises `process.argv` when any module reads it.
    for (const unit of this.modules) {
      if (unit.checker.program.usesArgv) {
        this.entry().checker.program.usesArgv = true;
      }
    }
    const facts = analyzeFunctions(units, this.table, this.opts, this.runtime);
    this.analysisUnits = units;
    this.facts = facts;
    return facts;
  }

  /**
   * WP32: the index of `std/collections.ts` in `modules`, or -1 when no module
   * named `Map` or `Set`. It is checked like any module and writes no `.ll`:
   * what a module uses of it is emitted into that module (docs/wp32-map.md §4.1).
   */
  libraryIndex(): i32 {
    let i = 0;
    while (i < this.modules.length) {
      if (this.modules[i].checker.program.isCollections()) {
        return i;
      }
      i = i + 1;
    }
    return -1;
  }

  /** Whether `unit` writes a `.ll` of its own: every module but the collections library. */
  writesOutput(unit: ModuleUnit): boolean {
    return !unit.checker.program.isCollections();
  }

  /** Program-wide attribute analysis, then one IR module per source module. */
  emit(): EmittedModule[] {
    const facts = this.analyze();
    const units = this.analysisUnits;
    const stems = this.outputStems();
    const library = this.libraryIndex();
    const out: EmittedModule[] = [];
    let i = 0;
    let written = 0;
    while (i < this.modules.length && i < units.length) {
      const unit = this.modules[i];
      if (this.writesOutput(unit)) {
        let copies: AnalysisUnit | null = null;
        if (library >= 0 && library < units.length) {
          copies = units[library];
        }
        const ir = emitProgram(units[i], this.table, this.opts, this.runtime, facts, copies);
        out.push(new EmittedModule(written < stems.length ? stems[written] : unit.name, ir, unit.name));
        written = written + 1;
      }
      i = i + 1;
    }
    return out;
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
    const counts = new StringMap();
    for (const unit of this.modules) {
      if (!this.writesOutput(unit)) {
        continue;
      }
      const base = basenameWithout(unit.path, ".ts");
      counts.set(base, counts.get(base, 0) + 1);
    }
    const root = dirname(this.entry().path);
    const taken = new StringSet();
    const stems: string[] = [];
    for (const unit of this.modules) {
      if (!this.writesOutput(unit)) {
        continue;
      }
      const base = basenameWithout(unit.path, ".ts");
      const stem = counts.get(base, 0) === 1 ? base : pathStem(root, unit.path);
      let free = stem;
      let n = 2;
      while (taken.has(free)) {
        free = `${stem}_${n}`;
        n = n + 1;
      }
      taken.add(free);
      stems.push(free);
    }
    return stems;
  }
}

/** The name node of `program`'s own declaration of the type `name`, or `null` (WP32). */
const declarationNameOf = (program: CheckedProgram, name: string): Node | null => {
  const struct = program.struct(name);
  if (struct !== null && struct.origin === program.source) {
    return struct.decl.children[0];
  }
  const template = program.structTemplate(name);
  if (template !== null && template.origin === program.source) {
    return template.decl.children[0];
  }
  const alias = program.alias(name);
  if (alias !== null) {
    return alias.decl.children[0];
  }
  const declared = program.enumNamed(name);
  return declared === null ? null : declared.decl.children[0];
};

/**
 * `path` relative to `root`, with every `.` and `..` segment dropped and the
 * rest joined with `_`: the stem of a module whose basename another module
 * shares (`Compilation.outputStems`).
 */
const pathStem = (root: string, path: string): string => {
  const parts: string[] = [];
  for (const segment of splitByte(relativePath(root, path), SLASH)) {
    if (segment !== "." && segment !== "..") {
      parts.push(segment);
    }
  }
  const joined = parts.join("_");
  return joined.endsWith(".ts") ? joined.substring(0, joined.length - 3) : joined;
};

/**
 * The directory above `dir`, or `""` when there is none left to visit — and the
 * twin of `parentDirectory` in `src/compilation.ts`, step for step, because the
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
    const parent = dirname(dir);
    return parent === dir ? "" : parent; // `/` is the top of an absolute walk
  }
  if (dir === ".") {
    return "..";
  }
  // In a normalised relative path every `..` leads, so a trailing one means
  // the path is nothing but parent steps and the next level is one more.
  if (dir === ".." || dir.endsWith("/..")) {
    return `${dir}/..`;
  }
  return dirname(dir);
};

/** The node a symbol-clash diagnostic points at: the name, or the declaration. */
const nameNode = (sig: FunctionSig): Node => sig.decl.kind === N_CONSTRUCTOR ? sig.decl : sig.decl.children[0];

/** Whether a struct name is spelled like an instantiation's (`Box$i32`). */
const isInstantiationName = (name: string): boolean => name.indexOf("$") >= 0;

/** How a diagnostic names a package copy's version: a manifest may declare none. */
const describeVersion = (version: string): string => version.length > 0 ? version : "no version";

/** How a diagnostic names a package: the program's own has no name to give. */
const describePackage = (packageName: string): string => packageName === ROOT_PACKAGE ? "the program itself" : `\`${packageName}\``;

/**
 * The wording of a duplicate-symbol rejection (WP21 S1).
 *
 * Two spellings of each rule, and the split is not decoration: in a program of
 * one package "unique across the program" is the whole truth and is the
 * sentence this compiler has always printed, while in a program of several it
 * would be wrong -- the point of package-scoped symbols is that the *other*
 * package may use the name freely. Each spelling is written out in full rather
 * than assembled from a shared fragment, because a diagnostic's literal run is
 * what its stable `NL` code in `self/codes.ts` is keyed on.
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
  const owner = sig.owner;
  if (owner !== null) {
    const member = sig.decl.kind === N_CONSTRUCTOR
      ? "is declared with a constructor"
      : `declares method \`${sig.decl.children[0].text}\``;
    const both = `Class \`${table.typeName(owner.type)}\` ${member} in both ${previousFile} and ${file}`;
    if (packageName === ROOT_PACKAGE) {
      return `${both}; a constructor or method is named after its class, so two classes that share a name anywhere in the program cannot both declare it, whether or not either is exported; rename one of the classes`;
    }
    return `${both}; a constructor or method is named after its class, so two classes that share a name within one package cannot both declare it, whether or not either is exported; rename one of the classes`;
  }
  const where = `\`${sig.sourceName}\` is also defined in ${previousFile}`;
  if (sig.exported && previous.exported) {
    if (packageName === ROOT_PACKAGE) {
      return `Exported function ${where}; exported names must be unique across the program`;
    }
    return `Exported function ${where}; exported names must be unique within the package that declares them`;
  }
  if (packageName === ROOT_PACKAGE) {
    return `Function ${where}; a function name must be unique across the program whether or not it is exported, because the whole-program attribute analysis is keyed by symbol name`;
  }
  return `Function ${where}; a function name must be unique within its own package whether or not it is exported, because the whole-program attribute analysis is keyed by the package-scoped symbol`;
};
