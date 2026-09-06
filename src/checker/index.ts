/**
 * Phase B: Static-TS validation and type checking.
 *
 * The core walks top-level declarations and function bodies, dispatching
 * every statement and expression to the handler tables in `statements.ts`
 * and `expressions.ts`. It records the StaticType of every expression in a
 * side table (`CheckedProgram.types`) that the IR emitter consumes, so the
 * emitter never has to re-derive types.
 *
 * Checking is split into passes so a whole program of modules can be checked
 * together (see `src/compilation.ts`):
 *   1.  `collectSignatures`  own functions, classes/interfaces (WP2), and import statements
 *   1b. `bindImports`        resolve imports against other modules' exports
 *   2.  `checkBodies`        function and method bodies, now that every callee is known
 */
import ts from "typescript";
import { CompileError, DiagnosticSink } from "../diagnostics";
import { CompilerOptions, StaticType, registerNamedTypes, typeToString } from "../types";
import {
  coerceToContext,
  collectStructMembers,
  declareStruct,
  finishStruct,
  isStructDeclaration,
  thisLocal,
} from "./classes";
import { ConstInfo, constValue } from "./constants";
import {
  collectConstant,
  collectFunctionSignature,
  collectImports,
  markEntryMain,
  rejectNonFunctionExport,
} from "./declarations";
import { CheckContext, LoopInfo } from "./context";
import { expressionCheckers } from "./expressions";
import { CheckedProgram, FunctionSig, ImportBinding, LocalVar, StructInfo } from "./program";
import { Scope } from "./scope";
import { checkStatements, checkVariableDeclarationList, statementCheckers } from "./statements";

export * from "./program";
export { Scope } from "./scope";
export { ENTRY_MAIN_SYMBOL } from "./declarations";
export type { CheckContext, StatementChecker, ExpressionChecker, BinaryChecker, UnaryChecker } from "./context";

export interface CheckerModuleOptions {
  /** The entry module may (and with `--link` must) declare `export function main`. */
  isEntry: boolean;
  /**
   * Where errors are collected (WP10). Shared by every module of a
   * Compilation, which decides between phases whether to go on. Without one
   * the checker makes its own and `check()` throws at the end.
   */
  sink?: DiagnosticSink;
}

/** Maps an import binding to the checked program its specifier names (resolved by the Compilation). */
export type ImportResolver = (binding: ImportBinding) => CheckedProgram;

export class Checker implements CheckContext {
  readonly sf: ts.SourceFile;
  readonly program: CheckedProgram;
  /** Local name -> signature: own functions plus bound imports. */
  readonly sigs = new Map<string, FunctionSig>();
  readonly loops: LoopInfo[] = [];
  current!: FunctionSig;
  private readonly isEntry: boolean;
  readonly sink: DiagnosticSink;
  /**
   * Whether the program's entry module declares `export function main` (WP7,
   * `process.argv`). The Compilation sets it on every module before bodies
   * are checked; a single-module check falls back to this module's own entry.
   */
  entryHasMain?: boolean;

  get hasEntryMain(): boolean {
    return this.entryHasMain ?? this.program.entryMain !== undefined;
  }
  /**
   * Import names used as types before pass 1b could tell whether they name a
   * class (WP2). Resolved provisionally as `%struct.<name>`; `bindImports`
   * rejects the ones that turn out to be functions.
   */
  private readonly importsUsedAsTypes = new Set<string>();

  constructor(
    sourceFile: ts.SourceFile,
    readonly opts: CompilerOptions,
    module: CheckerModuleOptions = { isEntry: true }
  ) {
    this.sf = sourceFile;
    this.isEntry = module.isEntry;
    this.sink = module.sink ?? new DiagnosticSink();
    this.program = {
      sourceFile,
      functions: [],
      imports: [],
      exports: new Map(),
      constants: new Map(),
      exportedConstants: new Map(),
      types: new WeakMap(),
      bindings: new WeakMap(),
      constRefs: new WeakMap(),
      locals: new WeakMap(),
      callees: new WeakMap(),
      structs: new Map(),
      coercions: new WeakMap(),
    };
    registerNamedTypes(sourceFile, (name) => {
      const own = this.program.structs.get(name);
      if (own) return own.type;
      if (this.program.imports.some((imp) => imp.localName === name)) {
        this.importsUsedAsTypes.add(name);
        return { kind: "struct", name };
      }
      return undefined;
    });
  }

  /**
   * Single-module convenience: every pass in order; imports cannot be
   * resolved here. Throws the first error (with the rest attached) at the end
   * of the pass that found it, so no phase runs over broken tables.
   */
  check(): CheckedProgram {
    this.collectSignatures();
    this.sink.throwIfErrors();
    this.bindImports((b) =>
      this.error(`Cannot resolve import \`${b.specifier}\` when checking a single module`, b.node)
    );
    this.sink.throwIfErrors();
    this.checkBodies();
    this.sink.throwIfErrors();
    return this.program;
  }

  /**
   * Pass 1: collect signatures so functions can call each other in any order.
   * Imports and class/interface names go first so any annotation can name
   * them; then members and function signatures in source order; finally the
   * checks that need every struct's layout (`implements`, definite assignment).
   *
   * Recovery is per declaration (WP10): a rejected class, interface, import or
   * function signature is reported, the struct is marked poisoned (its
   * layout checks are skipped), and the next declaration is collected.
   */
  collectSignatures(): void {
    const structs: StructInfo[] = [];
    for (const stmt of this.sf.statements) {
      this.sink.recover(() => {
        if (ts.isImportDeclaration(stmt)) this.program.imports.push(...collectImports(stmt, this.sf));
        else if (isStructDeclaration(stmt)) structs.push(declareStruct(this, stmt));
      });
    }
    for (const stmt of this.sf.statements) {
      if (ts.isImportDeclaration(stmt)) continue;
      if (isStructDeclaration(stmt)) {
        const info = stmt.name && this.program.structs.get(stmt.name.text);
        if (info && info.decl === stmt && !this.sink.recover(() => collectStructMembers(this, info))) {
          info.poisoned = true;
        }
        continue;
      }
      if (ts.isVariableStatement(stmt)) {
        this.sink.recover(() => this.collectConstants(stmt));
        continue;
      }
      this.sink.recover(() => this.collectFunction(stmt));
    }
    for (const info of structs) {
      if (!info.poisoned && !this.sink.recover(() => finishStruct(this, info))) info.poisoned = true;
    }
  }

  /**
   * A top-level `const` names a compile-time value (WP14). The initialiser is
   * not folded here: it may reference a constant imported from a module that
   * has not been checked yet, so folding waits for `foldConstants` in pass 2.
   */
  private collectConstants(stmt: ts.VariableStatement): void {
    for (const decl of stmt.declarationList.declarations) {
      const info = collectConstant(stmt, decl, this.sf, this.opts, this.program.constants);
      if (this.program.constants.has(info.name) || this.sigs.has(info.name) || this.program.structs.has(info.name)) {
        this.error(`\`${info.name}\` is already declared in this module`, decl.name);
      }
      this.program.constants.set(info.name, info);
      if (info.exported) this.program.exportedConstants.set(info.name, info);
    }
  }

  private collectFunction(stmt: ts.Statement): void {
    if (!ts.isFunctionDeclaration(stmt)) {
      rejectNonFunctionExport(stmt, this.sf);
      this.error(
        `Only top-level function declarations are supported in Phase 1 (found ${ts.SyntaxKind[stmt.kind]})`,
        stmt
      );
    }
    const sig = collectFunctionSignature(stmt, this.sf, this.opts);
    if (this.sigs.has(sig.sourceName)) this.error(`Duplicate function \`${sig.sourceName}\``, stmt);
    if (this.program.structs.has(sig.sourceName)) {
      this.error(`\`${sig.sourceName}\` is already declared as a class or interface`, stmt.name!);
    }
    if (sig.exported && sig.sourceName === "main") {
      if (!this.isEntry) this.error("Only the entry module may declare `export function main`", stmt.name!);
      this.program.entryMain = markEntryMain(sig, this.sf);
    }
    this.sigs.set(sig.sourceName, sig);
    this.program.functions.push(sig);
    if (sig.exported) this.program.exports.set(sig.sourceName, sig);
  }

  /** Pass 1b: bind every import to the exporter's function signature or struct. */
  bindImports(resolve: ImportResolver): void {
    for (const imp of this.program.imports) this.sink.recover(() => this.bindImport(imp, resolve(imp)));
  }

  private bindImport(imp: ImportBinding, target: CheckedProgram): void {
    const constant = target.exportedConstants.get(imp.importedName);
    if (constant) {
      this.bindConstantImport(imp, constant);
      return;
    }
    const struct = target.structs.get(imp.importedName);
    if (struct && struct.decl.getSourceFile() === target.sourceFile) {
      this.bindStructImport(imp, struct);
      return;
    }
    const sig = target.exports.get(imp.importedName);
    if (!sig) {
      const exists = target.functions.some((f) => f.sourceName === imp.importedName);
      this.error(
        exists
          ? `\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`
          : `Module \`${imp.specifier}\` has no exported function \`${imp.importedName}\``,
        imp.element
      );
    }
    if (this.importsUsedAsTypes.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is a function imported from \`${imp.specifier}\`, not a type`, imp.element);
    }
    const clash = this.sigs.get(imp.localName);
    if (clash) {
      const origin = this.program.imports.find((o) => o.sig === clash);
      this.error(
        origin
          ? `\`${imp.localName}\` is already imported from \`${origin.specifier}\``
          : `\`${imp.localName}\` is already declared in this module`,
        imp.element
      );
    }
    imp.sig = sig;
    this.sigs.set(imp.localName, sig);
  }

  /**
   * An imported class or interface (WP2) joins this module's struct registry
   * under its own name: the LLVM type `%struct.<name>` and the method symbols
   * are fixed by the exporter, so `import { P as Q }` cannot be honoured.
   */
  private bindStructImport(imp: ImportBinding, struct: StructInfo): void {
    if (!struct.exported) {
      this.error(`\`${imp.importedName}\` is declared in \`${imp.specifier}\` but not exported (add \`export\`)`, imp.element);
    }
    if (imp.localName !== imp.importedName) {
      this.error(
        `${struct.kind === "class" ? "Classes" : "Interfaces"} cannot be renamed on import (\`${imp.importedName} as ${imp.localName}\`): the type name is part of the ABI`,
        imp.element
      );
    }
    const clash = this.program.structs.get(imp.localName);
    if (clash) {
      const origin = this.program.imports.find((o) => o.struct === clash);
      this.error(
        origin
          ? `\`${imp.localName}\` is already imported from \`${origin.specifier}\``
          : `\`${imp.localName}\` is already declared in this module`,
        imp.element
      );
    }
    if (this.sigs.has(imp.localName)) this.error(`\`${imp.localName}\` is already declared in this module`, imp.element);
    imp.struct = struct;
    this.program.structs.set(imp.localName, struct);
  }

  /**
   * An imported `export const` (WP14) joins this module's constant table under
   * its local name. Nothing is linked: the value is folded into every use site
   * here exactly as it is in the exporting module, so `import { KIND_IF }`
   * costs no symbol and no relocation.
   */
  private bindConstantImport(imp: ImportBinding, constant: ConstInfo): void {
    if (this.program.constants.has(imp.localName) || this.sigs.has(imp.localName) ||
        this.program.structs.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is already declared in this module`, imp.element);
    }
    if (this.importsUsedAsTypes.has(imp.localName)) {
      this.error(`\`${imp.localName}\` is a constant imported from \`${imp.specifier}\`, not a type`, imp.element);
    }
    imp.constant = constant;
    this.program.constants.set(imp.localName, constant);
  }

  /**
   * Fold every constant this module declares. Done before the bodies so a bad
   * initialiser is reported once, against its own declaration, rather than
   * once per use site; an unused constant is still folded, because a constant
   * that cannot be computed is an error whether or not anybody reads it.
   */
  foldConstants(): void {
    for (const info of this.program.constants.values()) {
      if (info.decl.getSourceFile() === this.sf) this.sink.recover(() => constValue(info));
    }
  }

  /** Pass 2: check bodies. Every function is checked even after an earlier one was rejected (WP10). */
  checkBodies(): CheckedProgram {
    this.foldConstants();
    for (const sig of this.program.functions) {
      if (!this.sink.recover(() => this.checkFunctionBody(sig))) sig.poisoned = true;
    }
    return this.program;
  }

  error(message: string, node: ts.Node): never {
    throw new CompileError(message, node, this.sf);
  }

  report(err: CompileError): void {
    this.sink.report(err);
    if (this.current) this.current.poisoned = true;
  }

  private checkFunctionBody(sig: FunctionSig): void {
    this.current = sig;
    const scope = new Scope();
    // Methods and constructors (WP2) carry `this` as their first parameter.
    const offset = sig.struct ? 1 : 0;
    if (sig.struct) scope.declare(thisLocal(sig), sig.decl, this.sf);
    sig.decl.parameters.forEach((p, i) => {
      const param = sig.params[i + offset];
      const v: LocalVar = { name: param.name, type: param.type, mutable: false, storage: "param" };
      scope.declare(v, p, this.sf);
    });

    // The body shares the parameter scope rather than opening a child, so
    // `function f(a) { let a }` is a duplicate-declaration error as in TS.
    const terminates = checkStatements(this, sig.decl.body!.statements, scope);
    // A body with a rejected statement may have lost its `return`: no definite-return cascade.
    if (sig.returnType.kind !== "void" && !terminates && !sig.poisoned) {
      this.error(
        `Function \`${sig.sourceName}\` must return a value of type ${typeToString(sig.returnType)} on every path`,
        sig.decl.name ?? sig.decl
      );
    }
  }

  checkBlock(block: ts.Block, scope: Scope): boolean {
    return checkStatements(this, block.statements, scope.child());
  }

  checkStatement(stmt: ts.Statement, scope: Scope): boolean {
    const handler = statementCheckers[stmt.kind];
    if (!handler) this.error(`Unsupported statement in Phase 1: ${ts.SyntaxKind[stmt.kind]}`, stmt);
    return handler(this, stmt, scope);
  }

  checkExpression(expr: ts.Expression, scope: Scope): StaticType {
    const handler = expressionCheckers[expr.kind];
    if (!handler) this.error(`Unsupported expression in Phase 1: ${ts.SyntaxKind[expr.kind]}`, expr);
    // A class value where an interface it implements is expected takes the
    // interface type here (WP2); the emitter inserts the matching bitcast.
    const t = coerceToContext(this, expr, handler(this, expr, scope), scope);
    this.program.types.set(expr, t);
    return t;
  }

  declareVariables(list: ts.VariableDeclarationList, scope: Scope): void {
    checkVariableDeclarationList(this, list, scope);
  }
}

/** Check a single, import-free module. Multi-module programs go through `Compilation`. */
export function checkProgram(sourceFile: ts.SourceFile, opts: CompilerOptions): CheckedProgram {
  return new Checker(sourceFile, opts).check();
}
