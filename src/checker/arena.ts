/**
 * Explicit arena control (WP6), as dotted builtins next to `console.log`.
 * Lowering lives in `codegen/emit/arena.ts`.
 *
 *   Arena.reset(): void          recycle everything (`sts_reset_arena`)
 *   Arena.mark(): i64            the current bump position (`sts_arena_mark`)
 *   Arena.release(m: i64): void  rewind to a mark (`sts_arena_release`)
 *   Arena.used(): i64            bytes used in the current chunk (`sts_arena_used`)
 *
 * Safety rule (docs/wp6-memory.md): releasing or resetting while an object,
 * array or string allocated after the mark is still referenced is undefined
 * behaviour. The compiler's automatic scopes never do that; these builtins
 * are for programs that manage batches themselves, and a function that calls
 * `Arena.reset` / `Arena.release` (directly or through a callee) never gets
 * an automatic scope of its own.
 */
import { I64, VOID } from "../types";
import { BuiltinCallChecker, checkArgumentType, checkArity, requireStatementPosition } from "./builtins";

const checkReset: BuiltinCallChecker = (ctx, expr) => {
  checkArity(ctx, expr, "Arena.reset", 0);
  requireStatementPosition(ctx, expr, "Arena.reset");
  return VOID;
};

const checkMark: BuiltinCallChecker = (ctx, expr) => {
  checkArity(ctx, expr, "Arena.mark", 0);
  return I64;
};

const checkRelease: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "Arena.release", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "Arena.release", I64);
  requireStatementPosition(ctx, expr, "Arena.release");
  return VOID;
};

const checkUsed: BuiltinCallChecker = (ctx, expr) => {
  checkArity(ctx, expr, "Arena.used", 0);
  return I64;
};

/** Dotted callees, spread into `builtinCalls`. */
export const arenaBuiltinCalls: Record<string, BuiltinCallChecker> = {
  "Arena.reset": checkReset,
  "Arena.mark": checkMark,
  "Arena.release": checkRelease,
  "Arena.used": checkUsed,
};
