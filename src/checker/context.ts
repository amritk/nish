/**
 * Extension points for the checker.
 *
 * Each construct family lives in its own module and registers handlers in a
 * table keyed by `ts.SyntaxKind`. Handlers receive a `CheckContext` that
 * exposes the checker's state and recursion entry points, so adding a new
 * statement or expression kind means adding a file, not editing the core.
 */
import ts from "typescript";
import { CompilerOptions, StaticType } from "../types";
import { CheckedProgram, FunctionSig } from "./program";
import { Scope } from "./scope";

/** A loop whose body is being checked; `break` inside it records itself here. */
export interface LoopInfo {
  hasBreak: boolean;
}

export interface CheckContext {
  readonly sf: ts.SourceFile;
  readonly opts: CompilerOptions;
  readonly program: CheckedProgram;
  /** Signatures of every top-level function, available before bodies are checked. */
  readonly sigs: ReadonlyMap<string, FunctionSig>;
  /** The function whose body is being checked. */
  readonly current: FunctionSig;
  /** Enclosing loops, innermost last; empty outside any loop. Handlers push and pop. */
  readonly loops: LoopInfo[];

  /** Throw a CompileError at `node`. Typed as never so callers can `return ctx.error(...)`. */
  error(message: string, node: ts.Node): never;

  /** Check a statement; returns true when it definitely terminates (returns). */
  checkStatement(stmt: ts.Statement, scope: Scope): boolean;
  /** Check a block in a fresh child scope; returns true when it definitely terminates. */
  checkBlock(block: ts.Block, scope: Scope): boolean;
  /** Check an expression, record its type in `program.types`, and return it. */
  checkExpression(expr: ts.Expression, scope: Scope): StaticType;
  /** Declare the `let`/`const` locals of a declaration list (a statement's or a `for` initializer's). */
  declareVariables(list: ts.VariableDeclarationList, scope: Scope): void;
}

/** Returns true when the statement definitely terminates control flow. */
export type StatementChecker = (ctx: CheckContext, stmt: ts.Statement, scope: Scope) => boolean;
export type ExpressionChecker = (ctx: CheckContext, expr: ts.Expression, scope: Scope) => StaticType;
export type BinaryChecker = (ctx: CheckContext, expr: ts.BinaryExpression, scope: Scope) => StaticType;
export type UnaryChecker = (ctx: CheckContext, expr: ts.PrefixUnaryExpression, scope: Scope) => StaticType;

export type CheckerTable<H> = Partial<Record<ts.SyntaxKind, H>>;
