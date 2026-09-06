/**
 * Extension points for the emitter, mirroring `checker/context.ts`.
 *
 * Each construct family registers handlers keyed by `ts.SyntaxKind`; handlers
 * receive an `EmitContext` with the current function, the checked program's
 * side tables, and helpers for alignment and runtime symbols.
 */
import ts from "typescript";
import { CheckedProgram, LocalVar } from "../../checker";
import { CompilerOptions, StaticType } from "../../types";
import { IRFunction } from "../ir";

export interface EmitContext {
  readonly program: CheckedProgram;
  readonly opts: CompilerOptions;
  /** Function currently being emitted. */
  readonly fn: IRFunction;

  /** Alloca slot (`%x.addr`) for a local variable. */
  slotOf(local: LocalVar): string;
  setSlot(local: LocalVar, slot: string): void;

  /** Type the checker recorded for an expression. */
  typeOf(expr: ts.Expression): StaticType;
  /** Alignment for a type, or undefined when attributes are disabled. */
  align(t: StaticType): number | undefined;
  /** `", align N"` or `""`. */
  alignSuffix(t: StaticType): string;
  /** Reference a runtime symbol (`@sts_...`), ensuring its declaration is emitted. */
  useRuntime(name: string): string;
  /** `i8*` constant expression for a string literal; identical texts share one `@.str.N`. */
  stringConstant(text: string): string;

  emitStatement(stmt: ts.Statement): void;
  emitBlock(block: ts.Block): void;
  /** Lower an expression and return the LLVM value holding its result. */
  emitExpression(expr: ts.Expression): string;
}

export type StatementEmitter = (ctx: EmitContext, stmt: ts.Statement) => void;
export type ExpressionEmitter = (ctx: EmitContext, expr: ts.Expression) => string;
export type BinaryEmitter = (ctx: EmitContext, expr: ts.BinaryExpression) => string;

export type EmitterTable<H> = Partial<Record<ts.SyntaxKind, H>>;
