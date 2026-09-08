/**
 * Explicit arena control (WP6), checked by `checker/arena.ts`.
 *
 *   Arena.reset()      call void @amrit_reset_arena()
 *   Arena.mark()       call i64 @amrit_arena_mark()
 *   Arena.release(m)   call void @amrit_arena_release(i64 m)
 *   Arena.used()       call i64 @amrit_arena_used()
 *
 * All four are declared with effect `write` in runtime.ts: `mark` and `used`
 * only read the arena state, but a caller that is `readonly` could be
 * hoisted or merged across an allocation by the optimiser, so they are kept
 * conservative. The automatic scopes (`FunctionFacts.arenaScope`) use the
 * same `amrit_arena_mark` / `amrit_arena_release` symbols; see escape.ts.
 */
import { BuiltinCall } from "./builtins";

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
  "Arena.reset": statementCall("amrit_reset_arena"),
  "Arena.mark": valueCall("amrit_arena_mark"),
  "Arena.release": statementCall("amrit_arena_release", "i64"),
  "Arena.used": valueCall("amrit_arena_used"),
};
