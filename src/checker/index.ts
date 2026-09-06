/**
 * Phase B: Static-TS validation and type checking.
 *
 * The core walks top-level declarations and function bodies, dispatching
 * every statement and expression to the handler tables in `statements.ts`
 * and `expressions.ts`. It records the StaticType of every expression in a
 * side table (`CheckedProgram.types`) that the IR emitter consumes, so the
 * emitter never has to re-derive types.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics";
import { CompilerOptions, StaticType, typeToString } from "../types";
import { CheckContext, LoopInfo } from "./context";
import { collectFunctionSignature } from "./declarations";
import { expressionCheckers } from "./expressions";
import { CheckedProgram, FunctionSig, LocalVar } from "./program";
import { Scope } from "./scope";
import { checkStatements, checkVariableDeclarationList, statementCheckers } from "./statements";

export * from "./program";
export { Scope } from "./scope";
export type { CheckContext, StatementChecker, ExpressionChecker, BinaryChecker, UnaryChecker } from "./context";

export class Checker implements CheckContext {
  readonly sf: ts.SourceFile;
  readonly program: CheckedProgram;
  readonly sigs = new Map<string, FunctionSig>();
  readonly loops: LoopInfo[] = [];
  current!: FunctionSig;

  constructor(sourceFile: ts.SourceFile, readonly opts: CompilerOptions) {
    this.sf = sourceFile;
    this.program = {
      sourceFile,
      functions: [],
      types: new WeakMap(),
      bindings: new WeakMap(),
      locals: new WeakMap(),
      callees: new WeakMap(),
    };
  }

  check(): CheckedProgram {
    // Pass 1: collect signatures so functions can call each other in any order.
    for (const stmt of this.sf.statements) {
      if (!ts.isFunctionDeclaration(stmt)) {
        this.error(
          `Only top-level function declarations are supported in Phase 1 (found ${ts.SyntaxKind[stmt.kind]})`,
          stmt
        );
      }
      const sig = collectFunctionSignature(stmt, this.sf, this.opts);
      if (this.sigs.has(sig.name)) this.error(`Duplicate function \`${sig.name}\``, stmt);
      this.sigs.set(sig.name, sig);
      this.program.functions.push(sig);
    }
    // Pass 2: check bodies.
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
        `Function \`${sig.name}\` must return a value of type ${typeToString(sig.returnType)} on every path`,
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

export function checkProgram(sourceFile: ts.SourceFile, opts: CompilerOptions): CheckedProgram {
  return new Checker(sourceFile, opts).check();
}
