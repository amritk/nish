/**
 * Whole-program compilation (WP5).
 *
 * A `Compilation` owns every module of one program:
 *
 *   1. Load: parse the root file(s) and, transitively, everything they
 *      import. Each file is parsed exactly once (keyed by absolute path), so
 *      import cycles simply terminate. Signatures are collected as soon as a
 *      module is parsed (checker pass 1), which is what makes cycles legal:
 *      no body is checked until every module's exports are known.
 *   2. Check: bind imports to the exporters' signatures (pass 1b), reject
 *      symbol clashes that would fail at link time, then check bodies (pass 2).
 *   3. Emit: run the attribute analysis over *all* modules so purity/escape
 *      facts are program-wide, then emit one `.ll` per module. Imported
 *      functions appear as `declare`s carrying the exporter's attributes.
 *
 * The first root is the entry module; only it may declare
 * `export function main`, which the emitter wraps in a C `main`.
 *
 * Module resolution: specifiers must be relative (`./x`, `../y/z`); `.ts` is
 * optional (`./x.js` is also accepted and mapped to `./x.ts`, matching the
 * TypeScript convention); the path is resolved against the importing file.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CheckedProgram, Checker, FunctionSig, ImportBinding, StructInfo } from "./checker/index.js";
import { isNishSpecifier } from "./checker/nish-modules.js";
import { FunctionFacts, analyzeFunctions } from "./codegen/attributes.js";
import { emitProgram } from "./codegen/emitter.js";
import { CompileError, DiagnosticSink } from "./diagnostics.js";
import { ROOT_PACKAGE, packageDirOf, packageNameOf } from "./packages.js";
import { parseSource } from "./parser.js";
import { validateSyntax } from "./validator.js";
import { CompilerOptions, DEFAULT_OPTIONS } from "./types.js";
import { CLI, STD_PREFIX } from "./branding.js";
import { STD_DIR, stdModuleNames } from "./std-modules.js";
import { PKG_ROOT } from "./version.js";

export interface ModuleUnit {
  /** Absolute path: the module's identity. */
  path: string;
  /** Name in diagnostics and the IR header: as given for roots, cwd-relative for imports. */
  fileName: string;
  /**
   * The package this module belongs to (WP21 S1, `src/packages.ts`); `""` for
   * the root package, which is where every module of a single-package program
   * lives. Derived from `fileName` rather than from `path`, because that is
   * the name stage1 keys on too and the emitted IR must not depend on the
   * directory the compiler ran in (WP19 §A3).
   */
  packageName: string;
  sourceFile: ts.SourceFile;
  /** The first root; the only module allowed to declare `export function main`. */
  isEntry: boolean;
  checker: Checker;
  /** Specifier text -> module it resolves to, for this importer. */
  resolved: Map<string, ModuleUnit>;
}

export interface EmittedModule {
  unit: ModuleUnit;
  ir: string;
}

/**
 * Phase A for one file, with the Phase 0 validator slot: the forbidden-syntax
 * sweep (WP0, `src/validator.ts`) runs between parsing and checking, i.e.
 * right here, before the module's signatures are collected. With a `sink`
 * every syntax error, or else every forbidden construct, of the file is
 * reported before the phase throws; without one the first is thrown.
 */
export function parseModule(fileName: string, sourceText: string, sink?: DiagnosticSink): ts.SourceFile {
  const ast = parseSource(fileName, sourceText, sink); // Phase A
  validateSyntax(ast, sink); // Phase 0: forbidden-syntax sweep, hard fail
  sink?.throwIfErrors();
  return ast;
}

export class Compilation {
  /** Load order: entry first, then roots and imports depth-first. */
  readonly modules: ModuleUnit[] = [];
  private readonly byPath = new Map<string, ModuleUnit>();
  readonly opts: CompilerOptions;
  /**
   * Every error of the program (WP10). The phases below recover where they
   * can and `check()` throws between phases once anything was reported, so
   * pass 2 never runs over broken signatures and the emitter never sees a
   * poisoned program.
   */
  readonly sink = new DiagnosticSink();
  private checked = false;
  private facts?: Map<string, FunctionFacts>;
  /**
   * The package directory the entry lives in, and so the one that *is* the
   * root package (WP21 S1). Set by the first `addRoot`; a module sharing it is
   * the program's own code and carries no prefix, and a module under some
   * other `node_modules/<name>` is a dependency and carries that package's.
   */
  private rootPackageDir = "";

  constructor(options: Partial<CompilerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  get entry(): ModuleUnit {
    if (this.modules.length === 0) throw new Error("Compilation has no modules");
    return this.modules[0];
  }

  /** Add a root file (the first one is the entry). `sourceText` defaults to the file's contents. */
  addRoot(fileName: string, sourceText?: string): ModuleUnit {
    const isEntry = this.modules.length === 0;
    if (isEntry) this.rootPackageDir = packageDirOf(fileName);
    return this.load(path.resolve(fileName), fileName, sourceText, isEntry);
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
  private packageOf(fileName: string): string {
    const dir = packageDirOf(fileName);
    return dir === this.rootPackageDir ? ROOT_PACKAGE : packageNameOf(fileName);
  }

  private load(
    absPath: string,
    fileName: string,
    sourceText: string | undefined,
    isEntry: boolean,
    /**
     * The package the module belongs to, when the specifier that reached it
     * already says. Only a `nish/` import does: the standard library is
     * package `nish` wherever the compiler was installed, and deriving that
     * from the path would answer `nish` from `node_modules/nish/std/` and the
     * *root* package from a checkout — so the same program would compile
     * installed and collide in a checkout, which is the clash `packages.ts`
     * exists to make impossible.
     */
    packageOverride?: string
  ): ModuleUnit {
    const existing = this.byPath.get(absPath);
    if (existing) return existing;

    const text = sourceText ?? fs.readFileSync(absPath, "utf8");
    const sourceFile = parseModule(fileName, text, this.sink);
    const packageName = packageOverride ?? this.packageOf(fileName);
    const checker = new Checker(sourceFile, this.opts, { isEntry, packageName, sink: this.sink });
    const unit: ModuleUnit = {
      path: absPath,
      fileName,
      packageName,
      sourceFile,
      isEntry,
      checker,
      resolved: new Map(),
    };
    this.byPath.set(absPath, unit);
    this.modules.push(unit);

    checker.collectSignatures(); // pass 1: also validates the import syntax
    for (const imp of checker.program.imports) {
      // A builtin module has no file behind it; pass 1b binds it instead.
      if (isNishSpecifier(imp.specifier)) continue;
      if (unit.resolved.has(imp.specifier)) continue;
      // A missing module is reported and the others still load; `check()` stops before binding.
      this.sink.recover(() => {
        const target = this.resolveSpecifier(unit, imp);
        unit.resolved.set(
          imp.specifier,
          this.load(
            target,
            importedName(unit, target),
            undefined,
            false,
            imp.specifier.startsWith(STD_PREFIX) ? CLI : undefined
          )
        );
      });
    }
    return unit;
  }

  private resolveSpecifier(importer: ModuleUnit, imp: ImportBinding): string {
    if (imp.specifier.startsWith(STD_PREFIX)) return this.resolveStdSpecifier(importer, imp);
    let resolved = path.resolve(path.dirname(importer.path), imp.specifier);
    if (resolved.endsWith(".js")) resolved = resolved.slice(0, -3) + ".ts";
    else if (!resolved.endsWith(".ts")) resolved += ".ts";
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new CompileError(
        // Named from the importer, as `importedName` names one that *is* found:
        // a diagnostic about a missing file should not depend on the directory
        // the compiler was run from any more than the IR does (WP19 §A3).
        `Cannot find module \`${imp.specifier}\` (looked for ${importedName(importer, resolved)})`,
        imp.node.moduleSpecifier,
        importer.sourceFile
      );
    }
    return resolved;
  }

  /**
   * `nish/text` -> `std/text.ts` beside this compiler.
   *
   * The standard library is *source*, not a builtin: the module is compiled
   * into the program that imports it and reaches the emitter like any other,
   * which is the whole of `docs/wp21-packages.md` §3. So this answers a path
   * and everything downstream is the ordinary module path — the only thing
   * that differs from `./text` is where the file is looked for.
   *
   * It is looked for beside the compiler rather than through `node_modules`,
   * and that is the one deliberate narrowing of §5b: for the compiler's *own*
   * package there is exactly one right answer — the `std/` that shipped with
   * this binary — and no version of it can be skewed against the compiler
   * reading it, because the two are one package. A third-party bare specifier
   * is still refused, and gaining one is what WP21 is for.
   *
   * The diagnostic lists the library rather than the path it tried, for the
   * reason the missing-module one is phrased against the importer: where the
   * compiler is installed is not a fact about the program.
   */
  private resolveStdSpecifier(importer: ModuleUnit, imp: ImportBinding): string {
    const name = imp.specifier.slice(STD_PREFIX.length);
    const resolved = path.join(PKG_ROOT, STD_DIR, `${name}.ts`);
    if (name.length > 0 && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    throw new CompileError(
      `Module \`${imp.specifier}\` is not part of the standard library (it has: ${stdModuleNames().join(", ")})`,
      imp.node.moduleSpecifier,
      importer.sourceFile
    );
  }

  /**
   * Passes 1b and 2 over every module. Each phase runs to completion over
   * every module, then the collected errors (if any) are thrown together: a
   * broken signature never reaches body checking, a broken body never reaches
   * the emitter.
   */
  check(): void {
    if (this.checked) return;
    this.sink.throwIfErrors(); // pass 1 (signatures, module resolution) ran during load
    for (const unit of this.modules) {
      unit.checker.bindImports((imp) => unit.resolved.get(imp.specifier)!.checker.program);
    }
    // After every module is bound, so that a struct reached through a chain of
    // modules does not depend on the order they were bound in.
    const declared = this.declaredStructs();
    for (const unit of this.modules) unit.checker.closeReachableStructs(declared);
    this.rejectSymbolClashes();
    this.sink.throwIfErrors();
    // `process.argv` (WP7) is legal anywhere in a program that has an entry point, so every
    // module needs to know whether the entry declares `main` before its bodies are checked.
    const hasMain = this.entry.checker.program.entryMain !== undefined;
    for (const unit of this.modules) unit.checker.entryHasMain = hasMain;
    for (const unit of this.modules) unit.checker.checkBodies();
    this.sink.throwIfErrors();
    // Pass 3 (WP18): every instantiation the bodies asked for, to a fixed
    // point. It runs per module in load order because an instantiation is
    // checked by the module that declares its template, in that module's scope.
    for (const unit of this.modules) unit.checker.drainInstantiations();
    this.sink.throwIfErrors();
    this.checked = true;
  }

  /**
   * Every class and interface declared anywhere in the program, by name. A
   * struct name is already a program-wide symbol (`%struct.<name>` and
   * `@<name>.method`), so a collision is a broken program either way and the
   * first declaration wins here.
   */
  private declaredStructs(): Map<string, StructInfo> {
    const declared = new Map<string, StructInfo>();
    const owner = new Map<string, ModuleUnit>();
    for (const unit of this.modules) {
      for (const info of unit.checker.program.structs.values()) {
        if (info.decl.getSourceFile() !== unit.sourceFile) continue;
        const first = owner.get(info.name);
        if (first === undefined) {
          owner.set(info.name, unit);
          declared.set(info.name, info);
          continue;
        }
        // WP21 S1 stops at functions. A struct's identity is still its bare
        // name — `%struct.<name>`, and `StaticType` equality compares names —
        // so two packages that both declare `Node` would be silently treated
        // as declaring one type. Say so, in the words `docs/wp21-packages.md`
        // §7 uses, rather than letting the layouts merge.
        // TODO(WP21 §7): package-scoped struct layouts, and the diagnostic for
        // two versions of one package meeting in a diamond, are that stage's.
        if (first.packageName !== unit.packageName) {
          this.sink.report(
            new CompileError(
              `${info.kind === "class" ? "Class" : "Interface"} \`${info.name}\` is declared in package ${describePackage(first.packageName)} and again in package ${describePackage(unit.packageName)}; a class or interface name is still program-wide, so two packages cannot both declare one`,
              info.decl.name ?? info.decl,
              unit.sourceFile
            )
          );
        }
      }
    }
    return declared;
  }

  /**
   * A function's *symbol* must be unique across the whole program, exported or
   * not, and the entry wrapper reserves `main` as well.
   *
   * Two reasons, and only the first goes away with `internal` linkage: an
   * external symbol is global to the link, so a duplicate is a duplicate
   * definition; and `analyzeFunctions` keys the whole-program fact fixpoint by
   * `FunctionSig.name` (`src/codegen/attributes.ts`), so two functions sharing
   * a symbol would share one set of facts and each would be emitted with the
   * other's attributes. That is a miscompile, not a link error, which is why
   * this check does not consult `--strict-exports`: `internal` linkage buys
   * inlining and dead-stripping, not a second namespace.
   *
   * WP21 S1 is what turned "name" into "symbol" in that paragraph. A symbol
   * carries its package's prefix, so the *name* now has to be unique only
   * within its package — which is what lets two packages each keep a private
   * `helper()` — while the check itself is unchanged, because two packages can
   * no longer produce one symbol from one name. A program of one package is
   * every program that existed before packages did, and for it the rule, the
   * message and the emitted symbol are all exactly what they were.
   */
  private rejectSymbolClashes(): void {
    const owners = new Map<string, { unit: ModuleUnit; sig?: FunctionSig }>();
    const entry = this.entry;
    if (entry.checker.program.entryMain) owners.set("main", { unit: entry });

    for (const unit of this.modules) {
      // A template's instantiations are named after it (`identity$i32`), so two
      // modules declaring the same generic would produce the same symbols. The
      // template's own name is what has to be unique, and it is checked here
      // with the functions because the rule is the same rule (WP18 §3b).
      //
      // Keyed by the *package-scoped* symbol, like every other entry in this
      // map. An instantiation carries its package's prefix (`checker/index.ts`,
      // `instantiate`), so `pkg_a.identity$i32` and `identity$i32` are two
      // symbols and two packages may each keep a private `identity<T>` exactly
      // as they may each keep a private `helper()`. Keying this loop by the
      // bare name while the loop below keys by the symbol would put two
      // different namespaces in one map, and would refuse a root `dup` beside
      // a `pkg_a` `dup<T>` that cannot collide with it.
      for (const template of unit.checker.program.templates.values()) {
        const symbol = unit.checker.program.symbolPrefix + template.sourceName;
        const prev = owners.get(symbol);
        if (!prev) {
          owners.set(symbol, { unit });
          continue;
        }
        this.sink.report(
          new CompileError(
            `Generic function \`${template.sourceName}\` is also defined in ${prev.unit.fileName}; a function ` +
              "name must be unique across the program, and an instantiation is named after its template",
            template.nameNode,
            unit.sourceFile
          )
        );
      }
      for (const sig of unit.checker.program.functions) {
        const prev = owners.get(sig.name);
        if (!prev) {
          owners.set(sig.name, { unit, sig });
          continue;
        }
        const message = !prev.sig
          ? `Function \`main\` in ${unit.fileName} collides with the entry wrapper \`@main\` that ${prev.unit.fileName} needs; rename it`
          : clashMessage(sig, prev.sig, prev.unit.fileName, unit.packageName);
        // Constructors have no name node. Reported, not thrown: every clash is listed.
        this.sink.report(new CompileError(message, sig.decl.name ?? sig.decl, unit.sourceFile));
      }
    }
  }

  /** Program-wide attribute analysis (`src/codegen/attributes.ts`), computed once after checking. */
  analyze(): Map<string, FunctionFacts> {
    this.check();
    if (!this.facts) {
      const programs: CheckedProgram[] = this.modules.map((m) => m.checker.program);
      // The entry wrapper initialises `process.argv` when any module of the program reads it (WP7).
      if (programs.some((p) => p.usesArgv)) this.entry.checker.program.usesArgv = true;
      this.facts = analyzeFunctions(programs, this.opts);
    }
    return this.facts;
  }

  /** Program-wide attribute analysis, then one IR module per source module. */
  emit(): EmittedModule[] {
    const facts = this.analyze();
    return this.modules.map((unit) => ({ unit, ir: emitProgram(unit.checker.program, this.opts, facts) }));
  }

  /**
   * Output stem per module (`<basename>` normally). When two modules share a
   * basename, those use their path relative to the entry's directory with
   * separators turned into `_`, so `-o dir/` never overwrites a module.
   */
  outputStems(): Map<ModuleUnit, string> {
    const counts = new Map<string, number>();
    for (const m of this.modules) {
      const base = path.basename(m.path, ".ts");
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    const root = path.dirname(this.entry.path);
    const stems = new Map<ModuleUnit, string>();
    for (const m of this.modules) {
      const base = path.basename(m.path, ".ts");
      if ((counts.get(base) ?? 0) === 1) {
        stems.set(m, base);
        continue;
      }
      const rel = path.relative(root, m.path).replace(/\.ts$/, "");
      stems.set(
        m,
        rel
          .split(/[\\/]/)
          .filter((seg) => seg !== "." && seg !== "..")
          .join("_")
      );
    }
    return stems;
  }
}

/**
 * The name an imported module carries — in its IR header, its `DIFile` and its
 * diagnostics — which is the specifier resolved against **the name the importer
 * was given**, not against the working directory.
 *
 * The difference shows only when a caller names the entry absolutely, and then
 * it is the whole difference: cwd-relative naming makes the emitted IR depend
 * on where the compiler was run from, and it made the two compilers disagree
 * about `ModuleID`, `source_filename` and `-g`'s `DIFile` on every multi-module
 * program a build system compiles by absolute path (WP19 §A3, 12,209 rows of
 * `--parity`). stage1 has no working directory to relativise against and is not
 * going to grow one for this — `runtime.c` has eight bytes left of its 4 KB
 * budget — so the rule that survives is the one that needs no cwd, which is
 * also the one that makes a build reproducible. Named relatively, as every
 * caller in this repository names it, the answer is what it always was.
 */
function importedName(importer: ModuleUnit, target: string): string {
  const rel = path.relative(path.dirname(importer.path), target);
  return path.join(path.dirname(importer.fileName), rel);
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
 * would be wrong — the point of package-scoped symbols is that the *other*
 * package may use the name freely. Each spelling is written out in full rather
 * than assembled from a shared fragment, because a diagnostic's literal run is
 * what `scripts/gen-diagnostic-codes.mjs` keys its stable `NL` code on.
 */
function clashMessage(
  sig: FunctionSig,
  previous: FunctionSig,
  previousFile: string,
  packageName: string
): string {
  const where = `\`${sig.sourceName}\` is also defined in ${previousFile}`;
  if (sig.exported && previous.exported) {
    return packageName === ROOT_PACKAGE
      ? `Exported function ${where}; exported names must be unique across the program`
      : `Exported function ${where}; exported names must be unique within the package that declares them`;
  }
  return packageName === ROOT_PACKAGE
    ? `Function ${where}; a function name must be unique across the program whether or not it is exported, because the whole-program attribute analysis is keyed by symbol name`
    : `Function ${where}; a function name must be unique within its own package whether or not it is exported, because the whole-program attribute analysis is keyed by the package-scoped symbol`;
}
