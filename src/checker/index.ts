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
import { CompileError } from "../diagnostics";
import { CompilerOptions, StaticType, registerNamedTypes, typeToString } from "../types";
import {
  coerceToContext,
  collectStructMembers,
  declareStruct,
  finishStruct,
  isStructDeclaration,
  thisLocal,
} from "./classes";
import {
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
    this.program = {
      sourceFile,
      functions: [],
      imports: [],
      exports: new Map(),
      types: new WeakMap(),
      bindings: new WeakMap(),
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

  /** Single-module convenience: every pass in order; imports cannot be resolved here. */
  check(): CheckedProgram {
    this.collectSignatures();
    this.bindImports((b) =>
      this.error(`Cannot resolve import \`${b.specifier}\` when checking a single module`, b.node)
    );
    return this.checkBodies();
  }

  /**
   * Pass 1: collect signatures so functions can call each other in any order.
   * Imports and class/interface names go first so any annotation can name
   * them; then members and function signatures in source order; finally the
   * checks that need every struct's layout (`implements`, definite assignment).
   */
  collectSignatures(): void {
    const structs: StructInfo[] = [];
    for (const stmt of this.sf.statements) {
      if (ts.isImportDeclaration(stmt)) this.program.imports.push(...collectImports(stmt, this.sf));
      else if (isStructDeclaration(stmt)) structs.push(declareStruct(this, stmt));
    }
    for (const stmt of this.sf.statements) {
      if (ts.isImportDeclaration(stmt)) continue;
      if (isStructDeclaration(stmt)) {
        collectStructMembers(this, this.program.structs.get(stmt.name!.text)!);
        continue;
      }
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
    for (const info of structs) finishStruct(this, info);
  }

  /** Pass 1b: bind every import to the exporter's function signature or struct. */
  bindImports(resolve: ImportResolver): void {
    for (const imp of this.program.imports) {
      const target = resolve(imp);
      const struct = target.structs.get(imp.importedName);
      if (struct && struct.decl.getSourceFile() === target.sourceFile) {
        this.bindStructImport(imp, struct);
        continue;
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

  /** Pass 2: check bodies. */
  checkBodies(): CheckedProgram {
    for (const sig of this.program.functions) this.checkFunctionBody(sig);
    return this.program;
  }

  error(message: string, node: ts.Node): never {
    throw new CompileError(message, node, this.sf);
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
    if (sig.returnType.kind !== "void" && !terminates) {
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
