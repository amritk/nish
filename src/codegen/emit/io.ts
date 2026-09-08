/**
 * Process and file builtins (WP7), checked by `checker/io.ts`.
 *
 *   process.exit(code)          call void @amrit_exit(i32 code)   then `unreachable`
 *   readFileSync(path)          call i8* @amrit_read_file(i8* path)
 *   readFileSyncOrNull(path)    call i8* @amrit_read_file_or_null(i8* path)
 *   write(s) / writeError(s)    call void @amrit_write(i8* s, i32 fd, i1 false)
 *   panic(message)              call void @amrit_write(i8* m, i32 2, i1 true)
 *                               then @amrit_exit(i32 1) and `unreachable`
 *   writeFileSync(path, data)   call void @amrit_write_file(i8* path, i8* data)
 *   appendFileSync(path, data)  call void @amrit_append_file(i8* path, i8* data)
 *   mkdirSync(path)             call zeroext i1 @amrit_mkdir(i8* path)
 *   spawnSync(argv)             call i32 @amrit_spawn(%struct.amrit_array* argv)
 *   process.argv                load %struct.amrit_array*, %struct.amrit_array** @amrit_argv
 *
 * `@amrit_argv` is a runtime global that the entry wrapper fills with
 * `amrit_argv_init(argc, argv)` before `amrit_main` runs (emitter.ts), so a
 * read is one load of a pointer that never changes afterwards; it still
 * counts as a memory read (the function is at most `readonly`, never
 * `readnone`). The array is an ordinary `string[]` from there on.
 *
 * `amrit_exit` is declared `noreturn`; the `unreachable` that follows closes
 * the basic block, which is what lets a non-void function end with
 * `process.exit(n);` (the checker already treats it as a terminator). The
 * attribute analysis drops `willreturn` from every function that can reach
 * it (`FunctionFacts.callsNoReturn`).
 *
 * All four write memory or perform I/O, so callers are neither `readnone`
 * nor `readonly`. Their string arguments are `nocapture` in runtime.ts, so
 * passing a parameter to them does not make it escape.
 *
 * `spawnSync` is the exception to that last sentence, and the only builtin
 * whose pointer argument the runtime keeps: `amrit_spawn` copies each
 * element's bytes pointer into an arena vector that outlives the call, so the
 * array escapes. `isSpawnCall` below is what tells `classifyUse` in
 * attributes.ts, which would otherwise hand the caller a `nocapture` it cannot
 * back up.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker";
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
    ctx.fn.emit(`call void ${ctx.useRuntime("amrit_exit")}(i32 ${code})`);
    ctx.fn.emit("unreachable");
    return "void";
  },
  callees: () => ["amrit_exit"],
};

const readFileSync: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("amrit_read_file")}(${stringArgs(ctx, expr)})`),
  callees: () => ["amrit_read_file"],
};

const readFileSyncOrNull: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("amrit_read_file_or_null")}(${stringArgs(ctx, expr)})`),
  callees: () => ["amrit_read_file_or_null"],
};

/** `write` / `writeError`: the bytes as they are, on fd 1 or 2. */
function streamWriter(fd: 1 | 2): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      const text = ctx.emitExpression(expr.arguments[0]);
      ctx.fn.emit(`call void ${ctx.useRuntime("amrit_write")}(i8* ${text}, i32 ${fd}, i1 false)`);
      return "void";
    },
    callees: () => ["amrit_write"],
  };
}

/**
 * `panic(message)`: the message and a newline on stderr, then exit 1 — the
 * same observable ending as the index panic, so a program has one failure
 * mode rather than two. No runtime function of its own: `amrit_write` and
 * `amrit_exit` already exist, and `amrit_exit` is `noreturn`, which is what makes
 * the `unreachable` legal and lets a non-void function end with a panic.
 */
const panic: BuiltinCall = {
  emit: (ctx, expr) => {
    const message = ctx.emitExpression(expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("amrit_write")}(i8* ${message}, i32 2, i1 true)`);
    ctx.fn.emit(`call void ${ctx.useRuntime("amrit_exit")}(i32 1)`);
    ctx.fn.emit("unreachable");
    return "void";
  },
  callees: () => ["amrit_write", "amrit_exit"],
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

/** `mkdirSync(path)`: the C answer is already the language's `boolean`. */
const mkdirSync: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call zeroext i1 ${ctx.useRuntime("amrit_mkdir")}(${stringArgs(ctx, expr)})`),
  callees: () => ["amrit_mkdir"],
};

/**
 * `spawnSync(argv)`: the array header goes straight to the runtime, which
 * builds the C vector from it. The status is an `i32`, so `--number-mode f64`
 * widens it the way `a.length` is widened.
 */
const spawnSync: BuiltinCall = {
  emit: (ctx, expr) => {
    ctx.declareType(ARRAY_TYPE);
    const argv = ctx.emitExpression(expr.arguments[0]);
    const status = ctx.fn.emitValue(
      `call i32 ${ctx.useRuntime("amrit_spawn")}(${ARRAY_STRUCT}* ${argv})`
    );
    return ctx.typeOf(expr).kind === "f64"
      ? ctx.fn.emitValue(`sitofp i32 ${status} to double`)
      : status;
  },
  callees: () => ["amrit_spawn"],
};

/**
 * A call of the `spawnSync` builtin (not of a user function that happens to be
 * called `spawnSync`, which wins the name as every identifier builtin loses
 * it). `attributes.ts` asks, because the argument escapes into the runtime.
 */
export const isSpawnCall = (program: CheckedProgram, call: ts.CallExpression): boolean =>
  ts.isIdentifier(call.expression) && call.expression.text === "spawnSync" && !program.callees.has(call);

/** Dotted callees, spread into `builtinCallEmitters`; mirrors `ioBuiltinCalls`. */
export const ioBuiltinCallEmitters: Record<string, BuiltinCall> = {
  "process.exit": processExit,
};

/** Identifier callees, spread into `builtinFunctionEmitters`; mirrors `ioBuiltinFunctions`. */
export const ioFunctionEmitters: Record<string, BuiltinCall> = {
  readFileSync,
  readFileSyncOrNull,
  writeFileSync: fileWriter("amrit_write_file"),
  appendFileSync: fileWriter("amrit_append_file"),
  write: streamWriter(1),
  writeError: streamWriter(2),
  panic,
  mkdirSync,
  spawnSync,
};

// ---- process.argv -------------------------------------------------------------------

/** `process.argv`: the array pointer the entry wrapper stored in `@amrit_argv`; mirrors `checkProcessArgv`. */
namespacePropertyEmitters["process.argv"] = (ctx) => {
  ctx.declareType(ARRAY_TYPE);
  ctx.declareGlobal(ARGV_GLOBAL);
  const align = ctx.opts.optimizeAttributes ? ", align 8" : "";
  return ctx.fn.emitValue(`load ${ARRAY_STRUCT}*, ${ARRAY_STRUCT}** @amrit_argv${align}`);
};

const isArgvRead = (node: ts.Node): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) && dottedName(node) === "process.argv";

/** The load of `@amrit_argv` reads memory the function does not own: at most `readonly`. */
factCollectors.push((program, node, facts) => {
  if (isArgvRead(node) && !isValueReceiver(program, node.expression)) facts.readsMemory = true;
});
