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
 *   1.  `collectSignatures`  own functions and import statements
 *   1b. `bindImports`        resolve imports against other modules' exports
 *   2.  `checkBodies`        function bodies, now that every callee is known
 */
import ts from "typescript";
import { CompileError } from "../diagnostics";
import { CompilerOptions, StaticType, typeToString } from "../types";
import {
  collectFunctionSignature,
  collectImports,
  markEntryMain,
  rejectNonFunctionExport,
} from "./declarations";
import { CheckContext, LoopInfo } from "./context";
import { expressionCheckers } from "./expressions";
import { CheckedProgram, FunctionSig, ImportBinding, LocalVar } from "./program";
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
    };
  }

  /** Single-module convenience: every pass in order; imports cannot be resolved here. */
  check(): CheckedProgram {
    this.collectSignatures();
    this.bindImports((b) =>
      this.error(`Cannot resolve import \`${b.specifier}\` when checking a single module`, b.node)
    );
    return this.checkBodies();
  }

  /** Pass 1: collect signatures so functions can call each other in any order. */
  collectSignatures(): void {
    for (const stmt of this.sf.statements) {
      if (ts.isImportDeclaration(stmt)) {
        this.program.imports.push(...collectImports(stmt, this.sf));
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
      if (sig.exported && sig.sourceName === "main") {
        if (!this.isEntry) this.error("Only the entry module may declare `export function main`", stmt.name!);
        this.program.entryMain = markEntryMain(sig, this.sf);
      }
      this.sigs.set(sig.sourceName, sig);
      this.program.functions.push(sig);
      if (sig.exported) this.program.exports.set(sig.sourceName, sig);
    }
  }

  /** Pass 1b: bind every import to the exporter's signature. */
  bindImports(resolve: ImportResolver): void {
    for (const imp of this.program.imports) {
      const target = resolve(imp);
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
    sig.decl.parameters.forEach((p, i) => {
      const v: LocalVar = { name: sig.params[i].name, type: sig.params[i].type, mutable: false, storage: "param" };
      scope.declare(v, p, this.sf);
    });

    // The body shares the parameter scope rather than opening a child, so
    // `function f(a) { let a }` is a duplicate-declaration error as in TS.
    const terminates = checkStatements(this, sig.decl.body!.statements, scope);
    if (sig.returnType.kind !== "void" && !terminates) {
      this.error(
        `Function \`${sig.sourceName}\` must return a value of type ${typeToString(sig.returnType)} on every path`,
        sig.decl.name!
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
    const t = handler(this, expr, scope);
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
