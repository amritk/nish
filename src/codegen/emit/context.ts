/**
 * Extension points for the emitter, mirroring `checker/context.ts`.
 *
 * Each construct family registers handlers keyed by `ts.SyntaxKind`; handlers
 * receive an `EmitContext` with the current function, the checked program's
 * side tables, and helpers for alignment and runtime symbols.
 */
import ts from "typescript";
import { CheckedProgram, FunctionSig, LocalVar } from "../../checker";
import { CompilerOptions, StaticType, isUnsigned } from "../../types";
import { DebugInfo } from "../debug";
import { IRBlock, IRFunction } from "../ir";

/**
 * Branch targets of an enclosing loop, for `break` and `continue`. A `switch`
 * (WP14) pushes one too, with no `continueBlock`: it catches `break` while
 * `continue` looks past it for the enclosing loop, as in JavaScript.
 */
export interface LoopTarget {
  breakBlock: IRBlock;
  continueBlock: IRBlock | undefined;
  /** Set once a `break` has targeted this loop; an infinite loop without one never exits. */
  hasBreak: boolean;
}

export interface EmitContext {
  readonly program: CheckedProgram;
  readonly opts: CompilerOptions;
  /** Function currently being emitted. */
  readonly fn: IRFunction;
  /**
   * Its checked signature. `orReturn` (WP16) needs the enclosing function's
   * *StaticTS* return type to build the `Result` it returns early, which the
   * LLVM type on `fn` cannot give back.
   */
  readonly currentSig: FunctionSig;
  /** Enclosing loops, innermost last. Handlers push and pop. */
  readonly loops: LoopTarget[];
  /**
   * DWARF metadata builder when compiling with `-g` (WP10), else undefined.
   * Handlers that create a variable slot call `debug?.declareLocal`; locations
   * are attached by the core around every statement and expression.
   */
  readonly debug?: DebugInfo;

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
  /** Add a module-level global (`@sts_argv = external global ...`); duplicates are ignored. */
  declareGlobal(text: string): void;

  /**
   * WP6: the allocation expression (`new`, object literal, array literal,
   * `new Array<T>(<literal>)`) was proved not to outlive the function and is
   * lowered to an entry-block `alloca` instead of an arena bump (escape.ts).
   */
  isStackSite(node: ts.Node): boolean;
  /**
   * WP17: whether the object a by-value `Result` parameter is unpacked into
   * may be an entry-block alloca (`EscapeResult.stackParams`). A parameter has
   * no allocation *expression*, so the decision is keyed by its name.
   */
  isStackParam(name: string): boolean;
  /**
   * The unpacked object of a by-value `Result` parameter, or `undefined` for
   * every other parameter. A `Result` value *is* a pointer to its object, so
   * an identifier bound to one lowers to this value rather than to `%name`.
   */
  paramObject(name: string): string | undefined;
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
 * the instruction carries a no-wrap flag, which makes overflow poison (C
 * semantics) instead of wrapping; every site that lowers user-level integer
 * arithmetic (binary operators, unary minus, `op=`, `++`/`--`, on locals,
 * fields and elements alike) goes through here so the flag is applied
 * uniformly. Division, remainder, shifts, and the compiler's own address and
 * length arithmetic are never flagged: they have no such form, and the
 * internal `i64` counters cannot overflow.
 *
 * The flag has to match the *type's* signedness (WP15). An unsigned value that
 * passes 2^31 has not overflowed, so `nsw` on a `u32` add would make a
 * perfectly ordinary result poison; `nuw` is the claim that is true there.
 * Without `--nsw` both widths keep the documented wrapping semantics.
 */
export function intOpcode(ctx: EmitContext, opcode: string, type: StaticType): string {
  if (!ctx.opts.nsw) return opcode;
  if (opcode !== "add" && opcode !== "sub" && opcode !== "mul") return opcode;
  return `${opcode} ${isUnsigned(type) ? "nuw" : "nsw"}`;
}
