/**
 * Process and file builtins (WP7), checked by `checker/io.ts`.
 *
 *   process.exit(code)          call void @sts_exit(i32 code)   then `unreachable`
 *   readFileSync(path)          call i8* @sts_read_file(i8* path)
 *   writeFileSync(path, data)   call void @sts_write_file(i8* path, i8* data)
 *   appendFileSync(path, data)  call void @sts_append_file(i8* path, i8* data)
 *
 * `sts_exit` is declared `noreturn`; the `unreachable` that follows closes
 * the basic block, which is what lets a non-void function end with
 * `process.exit(n);` (the checker already treats it as a terminator). The
 * attribute analysis drops `willreturn` from every function that can reach
 * it (`FunctionFacts.callsNoReturn`).
 *
 * All four write memory or perform I/O, so callers are neither `readnone`
 * nor `readonly`. Their string arguments are `nocapture` in runtime.ts, so
 * passing a parameter to them does not make it escape.
 */
import ts from "typescript";
import { BuiltinCall } from "./builtins";
import { EmitContext } from "./context";

function stringArgs(ctx: EmitContext, expr: ts.CallExpression): string {
  return expr.arguments.map((arg) => `i8* ${ctx.emitExpression(arg)}`).join(", ");
}

const processExit: BuiltinCall = {
  emit: (ctx, expr) => {
    const code = ctx.emitExpression(expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("sts_exit")}(i32 ${code})`);
    ctx.fn.emit("unreachable");
    return "void";
  },
  callees: () => ["sts_exit"],
};

const readFileSync: BuiltinCall = {
  emit: (ctx, expr) => ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_read_file")}(${stringArgs(ctx, expr)})`),
  callees: () => ["sts_read_file"],
};

function fileWriter(symbol: string): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      ctx.fn.emit(`call void ${ctx.useRuntime(symbol)}(${stringArgs(ctx, expr)})`);
      return "void";
    },
    callees: () => [symbol],
  };
}

/** Dotted callees, spread into `builtinCallEmitters`; mirrors `ioBuiltinCalls`. */
export const ioBuiltinCallEmitters: Record<string, BuiltinCall> = {
  "process.exit": processExit,
};

/** Identifier callees, spread into `builtinFunctionEmitters`; mirrors `ioBuiltinFunctions`. */
export const ioFunctionEmitters: Record<string, BuiltinCall> = {
  readFileSync,
  writeFileSync: fileWriter("sts_write_file"),
  appendFileSync: fileWriter("sts_append_file"),
};
