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
import { IRBlock, IRFunction } from "../ir";

/** Branch targets of an enclosing loop, for `break` and `continue`. */
export interface LoopTarget {
  breakBlock: IRBlock;
  continueBlock: IRBlock;
  /** Set once a `break` has targeted this loop; an infinite loop without one never exits. */
  hasBreak: boolean;
}

export interface EmitContext {
  readonly program: CheckedProgram;
  readonly opts: CompilerOptions;
  /** Function currently being emitted. */
  readonly fn: IRFunction;
  /** Enclosing loops, innermost last. Handlers push and pop. */
  readonly loops: LoopTarget[];

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
  /** Add a module-level `declare` line (e.g. an LLVM intrinsic); duplicates are ignored. */
  declare(text: string): void;
  /** Add a module-level named type (`%struct.x = type {...}`); duplicates are ignored. */
  declareType(text: string): void;

  /**
   * WP6: the allocation expression (`new`, object literal, array literal,
   * `new Array<T>(<literal>)`) was proved not to outlive the function and is
   * lowered to an entry-block `alloca` instead of an arena bump (escape.ts).
   */
  isStackSite(node: ts.Node): boolean;
  /**
   * WP6: emit the arena release of the function's automatic scope, if it has
   * one. Called right before every `ret`, after the return value is computed.
   */
  emitScopeExit(): void;

  emitStatement(stmt: ts.Statement): void;
  emitBlock(block: ts.Block): void;
  /** Lower an expression and return the LLVM value holding its result. */
  emitExpression(expr: ts.Expression): string;
  /** Lower the `let`/`const` locals of a declaration list (a statement's or a `for` initializer's). */
  emitVariableDeclarations(list: ts.VariableDeclarationList): void;
}

export type StatementEmitter = (ctx: EmitContext, stmt: ts.Statement) => void;
export type ExpressionEmitter = (ctx: EmitContext, expr: ts.Expression) => string;
export type BinaryEmitter = (ctx: EmitContext, expr: ts.BinaryExpression) => string;
export type UnaryEmitter = (ctx: EmitContext, expr: ts.PrefixUnaryExpression) => string;

export type EmitterTable<H> = Partial<Record<ts.SyntaxKind, H>>;

/**
 * The integer opcode to emit for `add` / `sub` / `mul` (WP9). Under `--nsw`
 * the instruction carries the no-signed-wrap flag, which makes overflow
 * poison (C semantics) instead of wrapping; every site that lowers user-level
 * integer arithmetic (binary operators, unary minus, `op=`, `++`/`--`, on
 * locals, fields and elements alike) goes through here so the flag is
 * applied uniformly. Division, remainder and the compiler's own address and
 * length arithmetic are never flagged: `sdiv`/`srem` have no `nsw` form, and
 * the internal `i64` counters cannot overflow.
 */
export function intOpcode(ctx: EmitContext, opcode: string): string {
  if (!ctx.opts.nsw) return opcode;
  return opcode === "add" || opcode === "sub" || opcode === "mul" ? `${opcode} nsw` : opcode;
}
