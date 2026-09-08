/**
 * Extension points for the checker.
 *
 * Each construct family lives in its own module and registers handlers in a
 * table keyed by `ts.SyntaxKind`. Handlers receive a `CheckContext` that
 * exposes the checker's state and recursion entry points, so adding a new
 * statement or expression kind means adding a file, not editing the core.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics";
import { CompilerOptions, StaticType } from "../types";
import { CheckedProgram, FunctionSig } from "./program";
import { Scope } from "./scope";

/**
 * A `break` target whose body is being checked: a loop, or a `switch` (WP14).
 * `break` inside it records itself here; `continue` skips past the `switch`
 * entries to the innermost `loop`, exactly as it does in JavaScript.
 */
export interface LoopInfo {
  kind: "loop" | "switch";
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
  /**
   * The program's entry module declares `export function main` (WP7): what
   * `process.argv` needs, since only the entry wrapper can build it. Known
   * before any body is checked (signatures come first).
   */
  readonly hasEntryMain: boolean;

  /** Throw a CompileError at `node`. Typed as never so callers can `return ctx.error(...)`. */
  error(message: string, node: ts.Node): never;
  /**
   * Record an error without stopping (WP10 multi-error reporting). The
   * recovery points (`checkStatements`, the signature passes) call this after
   * catching a thrown `CompileError`; the enclosing function or struct is
   * marked `poisoned` so follow-on checks that assume a valid body are skipped.
   */
  report(err: CompileError): void;
  /**
   * Record a WP15 §8 performance warning at `node`. It never throws, never
   * poisons anything and never reaches the exit code: the compilation carries
   * on exactly as if the warning had not been found.
   */
  reportPerformance(message: string, node: ts.Node): void;

  /** Check a statement; returns true when it definitely terminates (returns). */
  checkStatement(stmt: ts.Statement, scope: Scope): boolean;
  /** Check a block in a fresh child scope; returns true when it definitely terminates. */
  checkBlock(block: ts.Block, scope: Scope): boolean;
  /**
   * Check a bare statement list in `scope`, with the unreachable-code rule and
   * the per-statement error recovery a block gets. The clauses of a `switch`
   * are the only statement list that is not a block.
   */
  checkStatementList(stmts: readonly ts.Statement[], scope: Scope): boolean;
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
