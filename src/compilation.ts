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
 * Module resolution: a relative specifier (`./x`, `../y/z`) is resolved against
 * the importing file, with `.ts` optional (`./x.js` is also accepted and mapped
 * to `./x.ts`, matching the TypeScript convention). A *bare* specifier is a
 * package (WP21 S2): `node_modules/<name>` is looked for in each directory up
 * from the importer, and the file is the one its `package.json` offers for the
 * `nish` export condition — source, because source is the distribution format
 * for an Nish consumer (`docs/wp21-packages.md` §2, §3). `nish:x` is a builtin
 * and resolves to no file at all; `nish/x` is the standard library beside this
 * compiler.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CheckedProgram, Checker, FunctionSig, ImportBinding, StructInfo } from "./checker/index.js";
import { StructTemplateInfo } from "./checker/generics.js";
import { isNishSpecifier } from "./checker/nish-modules.js";
import { FunctionFacts, analyzeFunctions } from "./codegen/attributes.js";
import { emitProgram } from "./codegen/emitter.js";
import { CompileError, DiagnosticSink } from "./diagnostics.js";
import {
  BareSpecifier,
  PACKAGE_ROOT_SEGMENT,
  ROOT_PACKAGE,
  packageDirOf,
  packageNameOf,
  parseBareSpecifier,
} from "./packages.js";
import { parseSource } from "./parser.js";
import { validateSyntax } from "./validator.js";
import { CompilerOptions, DEFAULT_OPTIONS } from "./types.js";
import { CLI, LANGUAGE, PACKAGE_CONDITION, STD_PREFIX, packageConditionFor } from "./branding.js";
import { nishExportTarget } from "./manifest.js";
import { stdModuleName, stdModuleNames, stdModulePath } from "./std-modules.js";

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
 * What resolving one specifier answers: the file, and the package it is in when
 * the specifier says (WP21 S2). `packageName` is left undefined when it does
 * not — a relative import stays wherever its path puts it — and `packages.ts`
 * reads it off the path for those.
 */
type ResolvedModule = {
  path: string;
  packageName?: string;
};

/** A path that exists and is a file, which is what every resolution answers. */
const isFile = (candidate: string): boolean => fs.existsSync(candidate) && fs.statSync(candidate).isFile();

/**
 * The file's text, or `null` when it cannot be read at all: `readFileSyncOrNull`
 * in the language, spelled here because the package walk is written in terms of
 * it on the other side.
 *
 * A read that throws here does not reach the internal-error path — `isSystemError`
 * in `src/index.ts` catches every `ErrnoException` and exits 1 — so what was
 * wrong with the unguarded `readFileSync` this replaced was never the exit code.
 * It was the *sentence*: `cannot open <absolute path>: EACCES`, with no span and
 * with a path spelled the way WP19 §A3 keeps out of diagnostics, where
 * `self/compilation.ts` reads the same file with `readFileSyncOrNull` and words
 * the failure itself. Two compilers, one tree, two different answers — which is
 * the divergence, and the reason this file reads like that one.
 */
const readFileOrNull = (file: string): string | null => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/**
 * How many directories the `node_modules` walk visits before it gives up
 * (`Compilation.findPackageDir`), and the twin of the same constant in
 * `self/compilation.ts`.
 *
 * Something has to end a relative walk, because it cannot recognise the
 * filesystem root: `/..` is `/`, so each step past the root re-asks what the
 * root already answered and the loop would never stop. 256 levels above the
 * importing directory is two orders of magnitude past any working directory a
 * compiler is run in, and it keeps a failed resolution instant.
 */
const PACKAGE_WALK_LIMIT = 256;

/**
 * The directory above `dir`, or `""` when there is none left to visit — the
 * twin of `parentDirectory` in `self/compilation.ts`, step for step, because
 * the two compilers have to visit the same directories in the same order.
 *
 * `path.dirname` answers this for an absolute path and stops at `/`. For a
 * relative one it stops at `.`, and it is wrong above that: `dirname("..")` is
 * `.`, back the way we came. So above `.` the walk is spelled — one more `..`
 * per level — and the operating system resolves those against the working
 * directory, which is how a module named relatively reaches the `node_modules`
 * beside the directory the compiler was run in.
 */
const parentDirectory = (dir: string): string => {
  if (dir.startsWith("/")) {
    const parent = path.dirname(dir);
    return parent === dir ? "" : parent; // `/` is the top of an absolute walk
  }
  if (dir === ".") return "..";
  // In a normalised relative path every `..` leads, so a trailing one means the
  // path is nothing but parent steps and the next level is one more.
  if (dir === ".." || dir.endsWith("/..")) return `${dir}/..`;
  return path.dirname(dir);
};

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
        const found = this.resolveSpecifier(unit, imp);
        const std = imp.specifier.startsWith(STD_PREFIX);
        // The file is read *here*, not inside `load`, because a file that will
        // not open is a fact about this import and belongs at the specifier
        // with the name the importer wrote. Reading it inside `load` made it an
        // `ErrnoException` instead, which the CLI reports as a bare
        // `cannot open <absolute path>: EACCES` with no span — a wording, a
        // position and a path convention (WP19 §A3 keeps absolute paths out of
        // diagnostics) that `self/compilation.ts` does not share, because it
        // reads with `readFileSyncOrNull` and words the failure itself. This is
        // that same read, in the same place, answering the same two sentences.
        const text = readFileOrNull(found.path);
        if (text === null) {
          throw std ? notStandardLibrary(unit, imp) : missingModule(unit, imp, found.path);
        }
        unit.resolved.set(
          imp.specifier,
          this.load(
            found.path,
            // A `nish/` module is named by where it sits in the package, not by
            // where the importer sits: it did not resolve against the importer,
            // so naming it from there put the checkout path in the header
            // whenever the entry was named absolutely (WP19 §A3).
            std
              ? stdModuleName(imp.specifier.slice(STD_PREFIX.length))
              : importedName(unit, found.path),
            text,
            false,
            found.packageName
          )
        );
      });
    }
    return unit;
  }

  private resolveSpecifier(importer: ModuleUnit, imp: ImportBinding): ResolvedModule {
    if (imp.specifier.startsWith(STD_PREFIX)) {
      return { path: this.resolveStdSpecifier(importer, imp), packageName: CLI };
    }
    if (!imp.specifier.startsWith("./") && !imp.specifier.startsWith("../")) {
      return this.resolveBareSpecifier(importer, imp);
    }
    let resolved = path.resolve(path.dirname(importer.path), imp.specifier);
    if (resolved.endsWith(".js")) resolved = resolved.slice(0, -3) + ".ts";
    else if (!resolved.endsWith(".ts")) resolved += ".ts";
    if (!isFile(resolved)) throw missingModule(importer, imp, resolved);
    return { path: resolved };
  }

  /**
   * `import { blake3 } from "@scope/hash"` (WP21 S2, `docs/wp21-packages.md`
   * §5b, §6).
   *
   * Node's algorithm, and deliberately not a resolver of our own: npm already
   * owns the registry, the lockfile and the layout, and this project should not
   * own a second one. What is ours is the *condition* — `nish`, or its
   * mode-qualified spelling — and reading the `exports` map here rather than
   * delegating to `import.meta.resolve` is what makes a package that offers no
   * Nish source fail saying so, which a resolver that only answers
   * "unresolved" could never do.
   *
   * The package is **stated** here rather than read back off the resolved path:
   * this is the code that found the manifest, so it is the code that knows
   * which package the file is in, and `packages.ts` no longer has to infer it
   * for anything that comes through here (§9b).
   */
  private resolveBareSpecifier(importer: ModuleUnit, imp: ImportBinding): ResolvedModule {
    const parsed = parseBareSpecifier(imp.specifier);
    // Pass 1 refuses a specifier that is neither relative nor a package name, so
    // `null` here is unreachable. It answers the same diagnostic rather than an
    // internal error, because an invariant that is broken anyway should not turn
    // into two different failures in the two compilers.
    if (parsed === null) throw cannotFindPackage(importer, imp, imp.specifier);
    // The walk starts from the module's *name*, not from its absolute path: the
    // name is the string both compilers hold for this module (WP19 §A3), so a
    // walk driven by it is a walk stage1 can take step for step without the
    // `cwd` builtin it has no room for. See `findPackageDir`.
    const packageDir = this.findPackageDir(path.dirname(importer.fileName), parsed.name);
    if (packageDir === null) throw cannotFindPackage(importer, imp, parsed.name);
    // `findPackageDir` only answers a directory whose manifest it could read, so
    // `null` here is a file that vanished between the two reads. It takes the
    // same route as a manifest with nothing in it for us, which is the honest
    // answer and the one `self/compilation.ts` gives: this compiler found no
    // Nish entry point in that package. Read unguarded it was a sentence stage1
    // never says — `cannot open <absolute path>: EACCES`, no span, and exit 1
    // all the same — rather than an exit code, which `readFileOrNull` says.
    const manifest = readFileOrNull(path.join(packageDir, "package.json"));
    const target =
      manifest === null
        ? null
        : nishExportTarget(
            manifest,
            parsed.subpath,
            packageConditionFor(this.opts.numberMode),
            PACKAGE_CONDITION
          );
    if (target === null) throw noNishEntryPoint(importer, imp, parsed);
    // Back to an absolute path here, because that is a module's identity in this
    // compiler; `importedName` is what turns it into the name the IR carries,
    // and it answers the same string a relative walk would have spelled.
    //
    // It is *not* a real path: `resolve` normalises, it does not follow a
    // symlink, so one package reached through two links is two modules and the
    // WP21 S1 clash check refuses the program. Node's resolver calls `realpath`
    // and gets one, which makes pnpm's store — and npm's nested layout — resolve
    // there and not here. Doing the same on this side alone would be worse than
    // the limitation: `self/` has no `realpath` to call (the language has no
    // such builtin), so stage0 would start compiling programs stage1 refuses.
    // TODO(WP21 S3): close it on both sides, which needs the builtin or a rule
    // that does without one. `tests/link/package_symlink` is the declared case,
    // and `docs/wp21-packages.md` §10d states it.
    const resolved = path.resolve(path.join(packageDir, target));
    // The manifest named a file that is not there, which is the package's own
    // mistake and not the consumer's — but it is still a module that could not
    // be found, so it is the same diagnostic the relative path gets.
    if (!isFile(resolved)) throw missingModule(importer, imp, resolved);
    return { path: resolved, packageName: parsed.name };
  }

  /**
   * The directory of package `name` as Node would find it: `node_modules/<name>`
   * with a `package.json` in it, in `from` or in any directory above it.
   *
   * A directory whose last segment is already `node_modules` is stepped over
   * rather than searched, which is Node's rule and stops
   * `node_modules/node_modules/<name>` from ever being looked for.
   *
   * **`from` is the importing module's name, and the walk climbs it exactly as
   * `self/compilation.ts` climbs it** — including `parentDirectory`'s spelled
   * `..` above a relative root. Driving the walk from the working directory
   * instead is the obvious thing and was the wrong thing: stage1 has no
   * `process.cwd()` (WP19 §A3) and cannot ever have one, so any directory this
   * one can name and that one cannot is a directory the two compilers disagree
   * about — and a package found by one compiler and not the other is a program
   * that compiles with one and not the other. What the shared spelling gives up
   * is Node's rule for an ancestor *above the name's own root*: `..` names a
   * directory without naming it, so neither compiler can tell that one is
   * itself called `node_modules`, and neither steps over it. That changes an
   * answer only for a `node_modules/node_modules/<name>` tree — which npm does
   * not produce, since the doubled directory has to exist for the rule to
   * matter — and it changes both answers the same way
   * (`docs/wp21-packages.md` §10a, `tests/link/package_doubled`).
   */
  private findPackageDir(from: string, name: string): string | null {
    // Normalised first so that the `..` segments a relative walk produces are
    // the only ones in the path, which is what `parentDirectory` reads.
    let dir = path.normalize(from);
    for (let steps = 0; steps <= PACKAGE_WALK_LIMIT; steps++) {
      if (path.basename(dir) !== PACKAGE_ROOT_SEGMENT) {
        const candidate = path.join(dir, PACKAGE_ROOT_SEGMENT, name);
        // A directory whose manifest this compiler cannot *read* is not the
        // package — the walk carries on past it rather than stopping there with
        // a message about a file the user never named. Asking by reading rather
        // than by `stat` is also what `self/compilation.ts` can ask, so the two
        // walks accept and reject the same directories.
        if (readFileOrNull(path.join(candidate, "package.json")) !== null) return candidate;
      }
      const parent = parentDirectory(dir);
      if (parent.length === 0) return null;
      dir = parent;
    }
    return null;
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
    const resolved = stdModulePath(name);
    if (name.length > 0 && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    throw notStandardLibrary(importer, imp);
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
    this.rejectInstantiatedStructClashes();
    this.sink.throwIfErrors();
    this.checked = true;
  }

  /**
   * WP18 G5 + WP21 §9c: the struct-name rule, one pass later.
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
   * miscompile, not a link error — the same failure WP21 S1 exists to prevent
   * for plain functions, and the same one `tests/link/two_packages_struct`
   * pins for a declared class.
   *
   * **Two modules of one package clash for the same reason, and are refused
   * here too.** Packages are what make `Holder` and `Holder` two names in
   * `rejectSymbolClashes`; they make no difference at all to `Holder$i32`,
   * which is a program-wide `%struct` name and a program-wide method symbol
   * whichever package asked for it. A declared `class Holder` in two modules
   * of one package is caught before bodies, by `@Holder.constructor` clashing
   * in `rejectSymbolClashes`; the generic spelling has no symbol until an
   * instantiation exists, so it reached the emitter unremarked and produced
   * two different `%struct.Holder$i32` plus an `invalid redefinition of
   * function 'Holder$i32.constructor'` from `llvm-as` — with no diagnostic.
   * `tests/link/generic_class_clash` is that program.
   *
   * One message per template rather than per instantiation: two modules that
   * both declare `Holder<T>` and both use it at `i32` and at `string` have
   * made one mistake, not two.
   */
  private rejectInstantiatedStructClashes(): void {
    const owner = new Map<string, ModuleUnit>();
    const reported = new Set<StructTemplateInfo>();
    for (const unit of this.modules) {
      for (const instance of unit.checker.program.structInstantiations.values()) {
        // The module that declares the template is the one that owns every
        // instantiation of it, whoever the annotation was written by.
        if (instance.template.decl.getSourceFile() !== unit.sourceFile) continue;
        const first = owner.get(instance.info.name);
        if (first === undefined) {
          owner.set(instance.info.name, unit);
          continue;
        }
        if (reported.has(instance.template)) continue;
        reported.add(instance.template);
        if (first.packageName === unit.packageName) {
          this.reportStructModuleClash(instance.template, first, unit);
          continue;
        }
        this.reportStructPackageClash(instance.info, first, unit, instance.template.nameNode);
      }
    }
  }

  /**
   * Two modules of one package, each declaring a generic class or interface of
   * the same name, each instantiating it.
   *
   * The sentence is `rejectSymbolClashes`'s generic-function one with the noun
   * changed, because it is the same rule one level up: a name that becomes a
   * program-wide symbol must be unique across the program, and an
   * instantiation is named after the template it came from.
   */
  private reportStructModuleClash(template: StructTemplateInfo, first: ModuleUnit, unit: ModuleUnit): void {
    this.sink.report(
      new CompileError(
        `Generic ${template.kind} \`${template.sourceName}\` is also declared in ${first.fileName}; a class or interface name must be unique across the program, and an instantiation is named after its template`,
        template.nameNode,
        unit.sourceFile
      )
    );
  }

  /**
   * The one sentence both halves of that rule say. It is one method rather than
   * two call sites because the diagnostic-code generator keys a rule on the
   * literal at its `new CompileError(...)`, so a second copy of these words
   * would be a second code for one rule.
   *
   * TODO(WP21 §7): package-scoped struct layouts, and the diagnostic for two
   * versions of one package meeting in a diamond, are that stage's.
   */
  private reportStructPackageClash(
    info: StructInfo,
    first: ModuleUnit,
    unit: ModuleUnit,
    at: ts.Node
  ): void {
    this.sink.report(
      new CompileError(
        `${info.kind === "class" ? "Class" : "Interface"} \`${info.name}\` is declared in package ${describePackage(first.packageName)} and again in package ${describePackage(unit.packageName)}; a class or interface name is still program-wide, so two packages cannot both declare one`,
        at,
        unit.sourceFile
      )
    );
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
        if (first.packageName !== unit.packageName) {
          this.reportStructPackageClash(info, first, unit, info.decl.name ?? info.decl);
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
        // One template literal rather than a concatenation, and this comment is
        // above the call rather than inside it. The code generator keys a rule
        // on the *longest literal run* of its message, and it finds that message
        // by looking for a string after the constructor with only whitespace in
        // between. Concatenated after "; a function ", the longest run was
        // "` is also defined in ", which `duplicate_export`, `duplicate_import`
        // and `duplicate_internal` also contain -- so all three carried this
        // rule's code. A comment between the constructor and the string loses
        // the rule a code entirely. `clashMessage` below is one line for the
        // first of those reasons.
        this.sink.report(
          new CompileError(
            `Generic function \`${template.sourceName}\` is also defined in ${prev.unit.fileName}; a function name must be unique across the program, and an instantiation is named after its template`,
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

/**
 * A `nish/<name>` that the standard library beside this compiler does not
 * offer — or offers as a file that will not open, which is the same answer for
 * the same reason: what the specifier names is not something this compiler can
 * compile. `self/compilation.ts` words both cases with this one sentence too.
 */
const notStandardLibrary = (importer: ModuleUnit, imp: ImportBinding): CompileError =>
  new CompileError(
    `Module \`${imp.specifier}\` is not part of the standard library (it has: ${stdModuleNames().join(", ")})`,
    imp.node.moduleSpecifier,
    importer.sourceFile
  );

/**
 * The one wording for a module that is not on disk, whether a relative
 * specifier named it or a package's `exports` did.
 *
 * Named from the importer, as `importedName` names one that *is* found: a
 * diagnostic about a missing file should not depend on the directory the
 * compiler was run from any more than the IR does (WP19 §A3).
 */
const missingModule = (importer: ModuleUnit, imp: ImportBinding, resolved: string): CompileError =>
  new CompileError(
    `Cannot find module \`${imp.specifier}\` (looked for ${importedName(importer, resolved)})`,
    imp.node.moduleSpecifier,
    importer.sourceFile
  );

/** No `node_modules/<name>` with a manifest in it, anywhere above the importer (WP21 S2). */
const cannotFindPackage = (importer: ModuleUnit, imp: ImportBinding, name: string): CompileError =>
  new CompileError(
    `Cannot find package \`${name}\`; no \`${PACKAGE_ROOT_SEGMENT}\` directory above the importing module has it`,
    imp.node.moduleSpecifier,
    importer.sourceFile
  );

/**
 * The package was found and is not an Nish package (WP21 S2).
 *
 * Its `exports` map has no `nish` condition for this subpath — or no `exports`
 * at all, or one shaped in a way `manifest.ts` does not read. The point of
 * saying it in these words is §6's: a bare import of an ordinary npm package
 * should fail naming the thing that is missing, not with a module-not-found
 * that reads like the consumer mistyped their own file name.
 *
 * The second clause reports what *this compiler* came away with rather than
 * what the package declares, and the difference is not pedantry: with the
 * mode-qualified condition outranking the plain one (§10a), a manifest whose
 * `nish-i32` names something that is not a file never reaches its perfectly
 * good `nish` row — so a sentence saying the `exports` "declares no `nish`
 * condition" would send the author to check a line that is there and correct.
 *
 * TODO(WP21 S3): the boundary diagnostics split this one message into the
 * specific ones — a package that offers Nish in the *other* number mode, named
 * with both modes in the message, and an `engines.nish` floor above this
 * compiler (§5c). Keeping it one message here is deliberate: S3 is the stage
 * that owns error quality, and everything left in it is a message rather than
 * a file.
 */
const noNishEntryPoint = (importer: ModuleUnit, imp: ImportBinding, parsed: BareSpecifier): CompileError =>
  new CompileError(
    `Package \`${parsed.name}\` has no ${LANGUAGE} entry point: its \`exports\` gave this compiler no file to compile for \`${parsed.subpath}\``,
    imp.node.moduleSpecifier,
    importer.sourceFile
  );

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
