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
import { FunctionFacts, analyzeFunctions } from "./codegen/attributes.js";
import { emitProgram } from "./codegen/emitter.js";
import { CompileError, DiagnosticSink } from "./diagnostics.js";
import { parseSource } from "./parser.js";
import { validateSyntax } from "./validator.js";
import { CompilerOptions, DEFAULT_OPTIONS } from "./types.js";

export interface ModuleUnit {
  /** Absolute path: the module's identity. */
  path: string;
  /** Name in diagnostics and the IR header: as given for roots, cwd-relative for imports. */
  fileName: string;
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

  constructor(options: Partial<CompilerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  get entry(): ModuleUnit {
    if (this.modules.length === 0) throw new Error("Compilation has no modules");
    return this.modules[0];
  }

  /** Add a root file (the first one is the entry). `sourceText` defaults to the file's contents. */
  addRoot(fileName: string, sourceText?: string): ModuleUnit {
    return this.load(path.resolve(fileName), fileName, sourceText, this.modules.length === 0);
  }

  private load(
    absPath: string,
    fileName: string,
    sourceText: string | undefined,
    isEntry: boolean
  ): ModuleUnit {
    const existing = this.byPath.get(absPath);
    if (existing) return existing;

    const text = sourceText ?? fs.readFileSync(absPath, "utf8");
    const sourceFile = parseModule(fileName, text, this.sink);
    const checker = new Checker(sourceFile, this.opts, { isEntry, sink: this.sink });
    const unit: ModuleUnit = { path: absPath, fileName, sourceFile, isEntry, checker, resolved: new Map() };
    this.byPath.set(absPath, unit);
    this.modules.push(unit);

    checker.collectSignatures(); // pass 1: also validates the import syntax
    for (const imp of checker.program.imports) {
      if (unit.resolved.has(imp.specifier)) continue;
      // A missing module is reported and the others still load; `check()` stops before binding.
      this.sink.recover(() => {
        const target = this.resolveSpecifier(unit, imp);
        unit.resolved.set(imp.specifier, this.load(target, importedName(unit, target), undefined, false));
      });
    }
    return unit;
  }

  private resolveSpecifier(importer: ModuleUnit, imp: ImportBinding): string {
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
    for (const unit of this.modules) {
      for (const info of unit.checker.program.structs.values()) {
        if (info.decl.getSourceFile() !== unit.sourceFile) continue;
        if (!declared.has(info.name)) declared.set(info.name, info);
      }
    }
    return declared;
  }

  /**
   * A function name must be unique across the whole program, exported or not,
   * and the entry wrapper reserves `main` as well.
   *
   * Two reasons, and only the first goes away with `internal` linkage: an
   * external symbol is global to the link, so a duplicate is a duplicate
   * definition; and `analyzeFunctions` keys the whole-program fact fixpoint by
   * `FunctionSig.name` (`src/codegen/attributes.ts`), so two functions sharing
   * a name would share one set of facts and each would be emitted with the
   * other's attributes. That is a miscompile, not a link error, which is why
   * this check does not consult `--strict-exports`: `internal` linkage buys
   * inlining and dead-stripping, not a second namespace.
   */
  private rejectSymbolClashes(): void {
    const owners = new Map<string, { unit: ModuleUnit; sig?: FunctionSig }>();
    const entry = this.entry;
    if (entry.checker.program.entryMain) owners.set("main", { unit: entry });

    for (const unit of this.modules) {
      for (const sig of unit.checker.program.functions) {
        const prev = owners.get(sig.name);
        if (!prev) {
          owners.set(sig.name, { unit, sig });
          continue;
        }
        const where = `\`${sig.sourceName}\` is also defined in ${prev.unit.fileName}`;
        const message = !prev.sig
          ? `Function \`main\` in ${unit.fileName} collides with the entry wrapper \`@main\` that ${prev.unit.fileName} needs; rename it`
          : sig.exported && prev.sig.exported
            ? `Exported function ${where}; exported names must be unique across the program`
            : `Function ${where}; a function name must be unique across the program whether or not it is exported, because the whole-program attribute analysis is keyed by symbol name`;
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
