/**
 * Process and file builtins (WP7), checked by `checker/io.ts`.
 *
 *   process.exit(code)          call void @sts_exit(i32 code)   then `unreachable`
 *   readFileSync(path)          call i8* @sts_read_file(i8* path)
 *   readFileSyncOrNull(path)    call i8* @sts_read_file_or_null(i8* path)
 *   write(s) / writeError(s)    call void @sts_write(i8* s, i32 fd, i1 false)
 *   panic(message)              call void @sts_write(i8* m, i32 2, i1 true)
 *                               then @sts_exit(i32 1) and `unreachable`
 *   writeFileSync(path, data)   call void @sts_write_file(i8* path, i8* data)
 *   appendFileSync(path, data)  call void @sts_append_file(i8* path, i8* data)
 *   process.argv                load %struct.sts_array*, %struct.sts_array** @sts_argv
 *
 * `@sts_argv` is a runtime global that the entry wrapper fills with
 * `sts_argv_init(argc, argv)` before `sts_main` runs (emitter.ts), so a
 * read is one load of a pointer that never changes afterwards; it still
 * counts as a memory read (the function is at most `readonly`, never
 * `readnone`). The array is an ordinary `string[]` from there on.
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
import { dottedName } from "../../checker/builtins";
import { ARRAY_STRUCT } from "../../types";
import { ARGV_GLOBAL, ARRAY_TYPE } from "../runtime";
import { BuiltinCall } from "./builtins";
import { EmitContext } from "./context";
import { factCollectors, isValueReceiver, namespacePropertyEmitters } from "./members";

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
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_read_file")}(${stringArgs(ctx, expr)})`),
  callees: () => ["sts_read_file"],
};

const readFileSyncOrNull: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_read_file_or_null")}(${stringArgs(ctx, expr)})`),
  callees: () => ["sts_read_file_or_null"],
};

/** `write` / `writeError`: the bytes as they are, on fd 1 or 2. */
function streamWriter(fd: 1 | 2): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      const text = ctx.emitExpression(expr.arguments[0]);
      ctx.fn.emit(`call void ${ctx.useRuntime("sts_write")}(i8* ${text}, i32 ${fd}, i1 false)`);
      return "void";
    },
    callees: () => ["sts_write"],
  };
}

/**
 * `panic(message)`: the message and a newline on stderr, then exit 1 — the
 * same observable ending as the index panic, so a program has one failure
 * mode rather than two. No runtime function of its own: `sts_write` and
 * `sts_exit` already exist, and `sts_exit` is `noreturn`, which is what makes
 * the `unreachable` legal and lets a non-void function end with a panic.
 */
const panic: BuiltinCall = {
  emit: (ctx, expr) => {
    const message = ctx.emitExpression(expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("sts_write")}(i8* ${message}, i32 2, i1 true)`);
    ctx.fn.emit(`call void ${ctx.useRuntime("sts_exit")}(i32 1)`);
    ctx.fn.emit("unreachable");
    return "void";
  },
  callees: () => ["sts_write", "sts_exit"],
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
  readFileSyncOrNull,
  writeFileSync: fileWriter("sts_write_file"),
  appendFileSync: fileWriter("sts_append_file"),
  write: streamWriter(1),
  writeError: streamWriter(2),
  panic,
};

// ---- process.argv -------------------------------------------------------------------

/** `process.argv`: the array pointer the entry wrapper stored in `@sts_argv`; mirrors `checkProcessArgv`. */
namespacePropertyEmitters["process.argv"] = (ctx) => {
  ctx.declareType(ARRAY_TYPE);
  ctx.declareGlobal(ARGV_GLOBAL);
  const align = ctx.opts.optimizeAttributes ? ", align 8" : "";
  return ctx.fn.emitValue(`load ${ARRAY_STRUCT}*, ${ARRAY_STRUCT}** @sts_argv${align}`);
};

const isArgvRead = (node: ts.Node): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) && dottedName(node) === "process.argv";

/** The load of `@sts_argv` reads memory the function does not own: at most `readonly`. */
factCollectors.push((program, node, facts) => {
  if (isArgvRead(node) && !isValueReceiver(program, node.expression)) facts.readsMemory = true;
});
