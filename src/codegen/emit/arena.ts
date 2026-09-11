/**
 * Explicit arena control (WP6), checked by `checker/arena.ts`.
 *
 *   Arena.reset()      call void @nish_reset_arena()
 *   Arena.mark()       call i64 @nish_arena_mark()
 *   Arena.release(m)   call void @nish_arena_release(i64 m)
 *   Arena.used()       call i64 @nish_arena_used()
 *
 * All four are declared with effect `write` in runtime.ts: `mark` and `used`
 * only read the arena state, but a caller that is `readonly` could be
 * hoisted or merged across an allocation by the optimiser, so they are kept
 * conservative. The automatic scopes (`FunctionFacts.arenaScope`) use the
 * same `nish_arena_mark` / `nish_arena_release` symbols; see escape.ts.
 *
 * The call-site reclaim (WP9) lives here too, because it is the same arena
 * bracket one level down: `beginReclaim` / `endReclaim` wrap a single call
 * rather than a whole function body. `reclaimsReturnedString` in escape.ts
 * carries the proof, and docs/wp9-optimisation.md what it measured.
 */
import { FunctionSig } from "../../checker/index.js";
import { BuiltinCall } from "./builtins.js";
import { EmitContext } from "./context.js";

function statementCall(symbol: string, arg?: "i64"): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      const args = arg ? `${arg} ${ctx.emitExpression(expr.arguments[0])}` : "";
      ctx.fn.emit(`call void ${ctx.useRuntime(symbol)}(${args})`);
      return "void";
    },
    callees: () => [symbol],
  };
}

function valueCall(symbol: string): BuiltinCall {
  return {
    emit: (ctx) => ctx.fn.emitValue(`call i64 ${ctx.useRuntime(symbol)}()`),
    callees: () => [symbol],
  };
}

/** Dotted callees, spread into `builtinCallEmitters`; mirrors `arenaBuiltinCalls`. */
export const arenaBuiltinCallEmitters: Record<string, BuiltinCall> = {
  "Arena.reset": statementCall("nish_reset_arena"),
  "Arena.mark": valueCall("nish_arena_mark"),
  "Arena.release": statementCall("nish_arena_release", "i64"),
  "Arena.used": valueCall("nish_arena_used"),
};

// ---- Call-site reclaim (WP9) -----------------------------------------------------------

/**
 * The bump position before a call whose returned string the caller may keep,
 * or `undefined` when the call does not qualify. It is emitted *after* the
 * arguments, so nothing but what the callee itself allocates falls inside the
 * bracket, and the caller's own temporaries are never at risk.
 */
export function beginReclaim(ctx: EmitContext, callee: FunctionSig): string | undefined {
  if (!ctx.reclaimsCall(callee)) return undefined;
  return ctx.fn.emitValue(`call i64 ${ctx.useRuntime("nish_arena_mark")}()`);
}

/**
 * Reclaim back to `mark`, keeping the returned string, which moves down to the
 * mark. The call's value is replaced by the string's new address, so no later
 * instruction can name the old one, and every temporary the callee bumped
 * underneath it is released.
 */
export function endReclaim(ctx: EmitContext, mark: string | undefined, value: string): string {
  if (mark === undefined) return value;
  return ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_arena_keep")}(i64 ${mark}, i8* ${value})`);
}
