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
// **Module identity is the resolved path, and it stays relative.**
// `src/compilation.ts` resolves against `process.cwd()` and then prints a
// cwd-relative name; stage1 has no working directory (D4), so a module's
// identity is its specifier resolved against the *name the importer was given*.
// For an entry named relatively — which is how every caller names it — the two
// agree string for string, which is what lets the IR headers match.
//
// The one thing this driver does not do is decide where the output goes: it
// answers with the IR text per module and the stem each module's file should
// use, and `self/compile.ts` writes them. There is no `mkdir` here (D4).

import { analyzeFunctions, AnalysisUnit, FactsTable } from "./attributes";
import { Checker } from "./checker";
import { DiagnosticSink, SourceFile } from "./diagnostics";
import { emitProgram } from "./emit";
import { StringMap } from "./map";
import { N_CONSTRUCTOR, Node } from "./nodes";
import { Options } from "./options";
import { packageDirOf, packageNameOf, ROOT_PACKAGE } from "./packages";
import { ParentTable } from "./parents";
import { Parser } from "./parser";
import { CheckedProgram, FunctionSig, STRUCT_CLASS, StructRegistry } from "./program";
import { basenameWithout, dirname, relativePath, resolveModule } from "./paths";
import { RuntimeTable } from "./runtime";
import { splitByte } from "./strings";
import { TypeTable } from "./types";
import { validate } from "./validator";

const SLASH: i32 = 47;

/** One source module: its identity, its tree, and the checker that owns it. */
export class ModuleUnit {
  /** The resolved path, which is the module's identity and the name in its IR header. */
  path: string;
  source: SourceFile;
  file: Node;
  nodeCount: i32;
  /** The entry module; the only one allowed to declare `export function main`. */
  isEntry: boolean;
  /**
   * The package this module belongs to (WP21 S1, `self/packages.ts`); `""` for
   * the root package, which is where every module of a single-package program
   * lives. Derived from `path`, which is the module's identity and the name in
   * its IR header — the same string stage0 derives it from, so the two
   * compilers put a module in the same package (WP19 §A3).
   */
  packageName: string;
  checker: Checker;
  parents: ParentTable;
  /** Specifier text -> index into `Compilation.modules`, for this importer. */
  resolved: StringMap;

  constructor(
    path: string,
    source: SourceFile,
    file: Node,
    nodeCount: i32,
    isEntry: boolean,
    checker: Checker,
    packageName: string
  ) {
    this.path = path;
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

/** One module's IR, with the stem its `.ll` file should be named after. */
export class EmittedModule {
  stem: string;
  ir: string;

  constructor(stem: string, ir: string) {
    this.stem = stem;
    this.ir = ir;
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
  /** Resolved path -> index into `modules`. */
  byPath: StringMap;
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
    this.sink = new DiagnosticSink();
    this.runtime = new RuntimeTable();
    this.modules = [];
    this.byPath = new StringMap();
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
   */
  packageOf(modulePath: string): string {
    if (packageDirOf(modulePath) === this.rootPackageDir) {
      return ROOT_PACKAGE;
    }
    return packageNameOf(modulePath);
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
  load(path: string): boolean {
    const at = this.byPath.get(path, -1);
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
    const source = new SourceFile(path, text);
    const parser = new Parser(source);
    const file = parser.parseSourceFile();
    for (const diagnostic of parser.diagnostics) {
      writeError(`${diagnostic.message()}\n`);
    }
    if (parser.diagnostics.length > 0) {
      return false;
    }
    const isEntry = this.modules.length === 0;
    if (isEntry) {
      this.rootPackageDir = packageDirOf(path);
    }
    const packageName = this.packageOf(path);
    const checker = new Checker(
      this.table,
      source,
      file,
      isEntry,
      parser.nodeCount,
      this.sink,
      this.opts.numberMode,
      !this.opts.nsw,
      packageName
    );
    const unit = new ModuleUnit(path, source, file, parser.nodeCount, isEntry, checker, packageName);
    this.byPath.set(path, this.modules.length);
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
      if (unit.resolved.has(imp.specifier)) {
        continue;
      }
      const target = resolveModule(dir, imp.specifier);
      if (readFileSyncOrNull(target) === null) {
        // At the module specifier, where stage0 points
        // (`imp.node.moduleSpecifier` in `src/compilation.ts`).
        checker.ctx.errorAtSpecifier(
          imp.decl,
          `Cannot find module \`${imp.specifier}\` (looked for ${target})`
        );
        checker.ctx.errored = false;
        continue;
      }
      if (signaturesFailed) {
        continue; // resolved, and deliberately not loaded: see above
      }
      // A module that fails to load is reported and the others still load;
      // `check` stops before binding anything.
      if (!this.load(target)) {
        ok = false;
      } else {
        unit.resolved.set(imp.specifier, this.byPath.get(target, -1));
      }
    }
    return ok;
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
    for (const unit of this.modules) {
      const targets: CheckedProgram[] = [];
      for (const imp of unit.checker.program.imports) {
        const index = unit.resolved.get(imp.specifier, -1);
        targets.push(this.modules[index].checker.program);
      }
      unit.checker.bindImports(targets);
    }
    // After every module is bound, so a struct reached through a chain of
    // modules does not depend on the order they were bound in.
    const declared = this.declaredStructs();
    for (const unit of this.modules) {
      unit.checker.closeReachableStructs(declared);
    }
    this.rejectSymbolClashes();
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
    for (const unit of this.modules) {
      unit.checker.drainInstantiations();
    }
    return !this.sink.hasErrors();
  }

  /** Every class and interface declared anywhere in the program, by name. */
  declaredStructs(): StructRegistry {
    const declared = new StructRegistry();
    const owners = new StringMap();
    const ownerPackages: string[] = [];
    for (const unit of this.modules) {
      for (const info of unit.checker.program.structList) {
        if (info.origin === unit.source) {
          const seen = owners.get(info.name, -1);
          if (seen < 0) {
            owners.set(info.name, ownerPackages.length);
            ownerPackages.push(unit.packageName);
          } else if (ownerPackages[seen] !== unit.packageName) {
            // WP21 S1 stops at functions. A struct's identity is still its
            // bare name -- `%struct.<name>`, and type equality compares names
            // -- so two packages that both declare `Node` would be silently
            // treated as declaring one type. Say so, in the words
            // docs/wp21-packages.md section 7 uses, rather than letting the
            // layouts merge.
            const what = info.kind === STRUCT_CLASS ? "Class" : "Interface";
            const here = describePackage(unit.packageName);
            const there = describePackage(ownerPackages[seen]);
            const at = info.decl.children[0];
            this.sink.report(
              unit.source,
              at.start,
              at.end,
              `${what} \`${info.name}\` is declared in package ${there} and again in package ${here}; a class or interface name is still program-wide, so two packages cannot both declare one`
            );
          }
          declared.add(info);
        }
      }
    }
    return declared;
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
   */
  rejectSymbolClashes(): void {
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
        const symbol = unit.checker.program.symbolPrefix + template.sourceName;
        const at = owners.get(symbol, -1);
        if (at < 0) {
          owners.set(symbol, ownerSigs.length);
          ownerSigs.push(null);
          ownerModules.push(unit);
          continue;
        }
        this.sink.report(
          unit.source,
          template.decl.children[0].start,
          template.decl.children[0].end,
          `Generic function \`${template.sourceName}\` is also defined in ${ownerModules[at].path}; a function ` +
            "name must be unique across the program, and an instantiation is named after its template"
        );
      }
      for (const sig of unit.checker.program.functions) {
        if (!sig.definedIn(unit.source)) {
          continue; // an imported signature is the exporter's symbol, not a second one
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
          message = `Function \`main\` in ${unit.path} collides with the entry wrapper \`@main\` that ${previousModule.path} needs; rename it`;
        } else {
          message = clashMessage(sig, previousSig, previousModule.path, unit.packageName);
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

  /** Program-wide attribute analysis, then one IR module per source module. */
  emit(): EmittedModule[] {
    const facts = this.analyze();
    const units = this.analysisUnits;
    const stems = this.outputStems();
    const out: EmittedModule[] = [];
    let i = 0;
    while (i < this.modules.length) {
      out.push(new EmittedModule(stems[i], emitProgram(units[i], this.table, this.opts, this.runtime, facts)));
      i = i + 1;
    }
    return out;
  }

  /**
   * The file stem per module: its basename normally, and — when two modules
   * share one — its path relative to the entry's directory with the separators
   * turned into `_`, so `-o <dir>/` never overwrites a module.
   */
  outputStems(): string[] {
    const counts = new StringMap();
    for (const unit of this.modules) {
      const base = basenameWithout(unit.path, ".ts");
      counts.set(base, counts.get(base, 0) + 1);
    }
    const root = dirname(this.entry().path);
    const stems: string[] = [];
    for (const unit of this.modules) {
      const base = basenameWithout(unit.path, ".ts");
      if (counts.get(base, 0) === 1) {
        stems.push(base);
        continue;
      }
      const parts: string[] = [];
      for (const segment of splitByte(relativePath(root, unit.path), SLASH)) {
        if (segment !== "." && segment !== "..") {
          parts.push(segment);
        }
      }
      const joined = parts.join("_");
      stems.push(joined.endsWith(".ts") ? joined.substring(0, joined.length - 3) : joined);
    }
    return stems;
  }
}

/** The node a symbol-clash diagnostic points at: the name, or the declaration. */
function nameNode(sig: FunctionSig): Node {
  return sig.decl.kind === N_CONSTRUCTOR ? sig.decl : sig.decl.children[0];
}

/** How a diagnostic names a package: the program's own has no name to give. */
function describePackage(packageName: string): string {
  return packageName === ROOT_PACKAGE ? "the program itself" : `\`${packageName}\``;
}

/**
 * The wording of a duplicate-symbol rejection (WP21 S1).
 *
 * Two spellings of one rule, and the split is not decoration: in a program of
 * one package "unique across the program" is the whole truth and is the
 * sentence this compiler has always printed, while in a program of several it
 * would be wrong -- the point of package-scoped symbols is that the *other*
 * package may use the name freely. Each spelling is written out in full rather
 * than assembled from a shared fragment, because a diagnostic's literal run is
 * what `scripts/gen-diagnostic-codes.mjs` keys its stable `NL` code on.
 */
function clashMessage(sig: FunctionSig, previous: FunctionSig, previousFile: string, packageName: string): string {
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
}
