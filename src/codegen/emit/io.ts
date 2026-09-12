/**
 * Process and file builtins (WP7), checked by `checker/io.ts`.
 *
 *   process.exit(code)          call void @nish_exit(i32 code)   then `unreachable`
 *   readFileSync(path)          call i8* @nish_read_file(i8* path)
 *   readFileSyncOrNull(path)    call i8* @nish_read_file_or_null(i8* path)
 *   write(s) / writeError(s)    call void @nish_write(i8* s, i32 fd, i1 false)
 *   panic(message)              call void @nish_write(i8* m, i32 2, i1 true)
 *                               then @nish_exit(i32 1) and `unreachable`
 *   writeFileSync(path, data)   call void @nish_write_file(i8* path, i8* data)
 *   appendFileSync(path, data)  call void @nish_append_file(i8* path, i8* data)
 *   mkdirSync(path)             call zeroext i1 @nish_mkdir(i8* path)
 *   spawnSync(argv)             call i32 @nish_spawn(%struct.nish_array* argv)
 *   isDirectorySync(path)       call zeroext i1 @nish_is_dir(i8* path)
 *   getenv(name)                call i8* @nish_getenv(i8* name)
 *   spawnSyncTo(argv, o, e)     call i32 @nish_spawn_to(%struct.nish_array* argv,
 *                                                        i8* o, i8* e)
 *   readdirSync(path)           call %struct.nish_array* @nish_readdir(i8* path)
 *   monotonicNanos()            call i64 @nish_monotonic_nanos()
 *   process.argv                load %struct.nish_array*, %struct.nish_array** @nish_argv
 *   process.platform            call i8* @nish_platform()
 *   process.arch                call i8* @nish_arch()
 *
 * `@nish_argv` is a runtime global that the entry wrapper fills with
 * `nish_argv_init(argc, argv)` before `nish_main` runs (emitter.ts), so a
 * read is one load of a pointer that never changes afterwards; it still
 * counts as a memory read (the function is at most `readonly`, never
 * `readnone`). The array is an ordinary `string[]` from there on.
 *
 * `nish_exit` is declared `noreturn`; the `unreachable` that follows closes
 * the basic block, which is what lets a non-void function end with
 * `process.exit(n);` (the checker already treats it as a terminator). The
 * attribute analysis drops `willreturn` from every function that can reach
 * it (`FunctionFacts.callsNoReturn`).
 *
 * All four write memory or perform I/O, so callers are neither `readnone`
 * nor `readonly`. Their string arguments are `nocapture` in runtime.ts, so
 * passing a parameter to them does not make it escape.
 *
 * `spawnSync` and `spawnSyncTo` are the exception to that last sentence, and the
 * only builtins whose pointer argument the runtime keeps: the spawn path copies
 * each element's bytes pointer into an arena vector that outlives the call, so
 * the array escapes. `isSpawnCall` below is what tells `classifyUse` in
 * attributes.ts, which would otherwise hand the caller a `nocapture` it cannot
 * back up — and it answers for both names, because both reach the same C.
 */
import ts from "typescript";
import { CheckedProgram } from "../../checker/index.js";
import { dottedName } from "../../checker/builtins.js";
import { ARRAY_STRUCT } from "../../types.js";
import { ARGV_GLOBAL, ARRAY_TYPE } from "../runtime.js";
import { BuiltinCall } from "./builtins.js";
import { EmitContext } from "./context.js";
import {
  NamespacePropertyEmitter,
  factCollectors,
  isValueReceiver,
  namespacePropertyEmitters,
} from "./members.js";

function stringArgs(ctx: EmitContext, expr: ts.CallExpression): string {
  return expr.arguments.map((arg) => `i8* ${ctx.emitExpression(arg)}`).join(", ");
}

const processExit: BuiltinCall = {
  emit: (ctx, expr) => {
    const code = ctx.emitExpression(expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("nish_exit")}(i32 ${code})`);
    ctx.fn.emit("unreachable");
    return "void";
  },
  callees: () => ["nish_exit"],
};

const readFileSync: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_read_file")}(${stringArgs(ctx, expr)})`),
  callees: () => ["nish_read_file"],
};

const readFileSyncOrNull: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_read_file_or_null")}(${stringArgs(ctx, expr)})`),
  callees: () => ["nish_read_file_or_null"],
};

/** `write` / `writeError`: the bytes as they are, on fd 1 or 2. */
function streamWriter(fd: 1 | 2): BuiltinCall {
  return {
    emit: (ctx, expr) => {
      const text = ctx.emitExpression(expr.arguments[0]);
      ctx.fn.emit(`call void ${ctx.useRuntime("nish_write")}(i8* ${text}, i32 ${fd}, i1 false)`);
      return "void";
    },
    callees: () => ["nish_write"],
  };
}

/**
 * `panic(message)`: the message and a newline on stderr, then exit 1 — the
 * same observable ending as the index panic, so a program has one failure
 * mode rather than two. No runtime function of its own: `nish_write` and
 * `nish_exit` already exist, and `nish_exit` is `noreturn`, which is what makes
 * the `unreachable` legal and lets a non-void function end with a panic.
 */
const panic: BuiltinCall = {
  emit: (ctx, expr) => {
    const message = ctx.emitExpression(expr.arguments[0]);
    ctx.fn.emit(`call void ${ctx.useRuntime("nish_write")}(i8* ${message}, i32 2, i1 true)`);
    ctx.fn.emit(`call void ${ctx.useRuntime("nish_exit")}(i32 1)`);
    ctx.fn.emit("unreachable");
    return "void";
  },
  callees: () => ["nish_write", "nish_exit"],
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
    ctx.fn.emitValue(`call zeroext i1 ${ctx.useRuntime("nish_mkdir")}(${stringArgs(ctx, expr)})`),
  callees: () => ["nish_mkdir"],
};

/** `isDirectorySync(path)` (WP14 §7a): one `stat`, and a `boolean` out of it. */
const isDirectorySync: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call zeroext i1 ${ctx.useRuntime("nish_is_dir")}(${stringArgs(ctx, expr)})`),
  callees: () => ["nish_is_dir"],
};

/**
 * `getenv(name)` (WP19 R1): one call, and the runtime's null is already the
 * language's. The same shape as `readFileSyncOrNull` down to the LLVM type:
 * an `i8*` that may be null, which the checker typed `string | null` and the
 * narrowing reads with an ordinary null compare.
 */
const getenv: BuiltinCall = {
  emit: (ctx, expr) =>
    ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_getenv")}(${stringArgs(ctx, expr)})`),
  callees: () => ["nish_getenv"],
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
      `call i32 ${ctx.useRuntime("nish_spawn")}(${ARRAY_STRUCT}* ${argv})`
    );
    return ctx.typeOf(expr).kind === "f64"
      ? ctx.fn.emitValue(`sitofp i32 ${status} to double`)
      : status;
  },
  callees: () => ["nish_spawn"],
};

/**
 * `spawnSyncTo(argv, stdoutPath, stderrPath)`: the same call with the two paths
 * after the vector. The arguments are emitted left to right, as every call is,
 * so a path expression that allocates does so before the child starts.
 */
const spawnSyncTo: BuiltinCall = {
  emit: (ctx, expr) => {
    ctx.declareType(ARRAY_TYPE);
    const argv = ctx.emitExpression(expr.arguments[0]);
    const out = ctx.emitExpression(expr.arguments[1]);
    const err = ctx.emitExpression(expr.arguments[2]);
    const status = ctx.fn.emitValue(
      `call i32 ${ctx.useRuntime("nish_spawn_to")}(${ARRAY_STRUCT}* ${argv}, i8* ${out}, i8* ${err})`
    );
    return ctx.typeOf(expr).kind === "f64"
      ? ctx.fn.emitValue(`sitofp i32 ${status} to double`)
      : status;
  },
  callees: () => ["nish_spawn_to"],
};

/**
 * `readdirSync(path)`: one call answering the array header, which may be null.
 * The same shape as `readFileSyncOrNull` one type up: the checker typed it
 * `string[] | null` and the narrowing reads it with an ordinary null compare,
 * so nothing here has to know that a nullable array is a nullable pointer.
 */
const readdirSync: BuiltinCall = {
  emit: (ctx, expr) => {
    ctx.declareType(ARRAY_TYPE);
    return ctx.fn.emitValue(
      `call ${ARRAY_STRUCT}* ${ctx.useRuntime("nish_readdir")}(${stringArgs(ctx, expr)})`
    );
  },
  callees: () => ["nish_readdir"],
};

/** `monotonicNanos()`: one call, an `i64`, and no arguments to emit. */
const monotonicNanos: BuiltinCall = {
  emit: (ctx) => ctx.fn.emitValue(`call i64 ${ctx.useRuntime("nish_monotonic_nanos")}()`),
  callees: () => ["nish_monotonic_nanos"],
};

/**
 * A call of the `spawnSync` builtin (not of a user function that happens to be
 * called `spawnSync`, which wins the name as every identifier builtin loses
 * it). `attributes.ts` asks, because the argument escapes into the runtime.
 */
export const isSpawnCall = (program: CheckedProgram, call: ts.CallExpression): boolean =>
  ts.isIdentifier(call.expression) &&
  (call.expression.text === "spawnSync" || call.expression.text === "spawnSyncTo") &&
  !program.callees.has(call);

/** Dotted callees, spread into `builtinCallEmitters`; mirrors `ioBuiltinCalls`. */
export const ioBuiltinCallEmitters: Record<string, BuiltinCall> = {
  "process.exit": processExit,
};

/** Identifier callees, spread into `builtinFunctionEmitters`; mirrors `ioBuiltinFunctions`. */
export const ioFunctionEmitters: Record<string, BuiltinCall> = {
  readFileSync,
  readFileSyncOrNull,
  writeFileSync: fileWriter("nish_write_file"),
  appendFileSync: fileWriter("nish_append_file"),
  write: streamWriter(1),
  writeError: streamWriter(2),
  panic,
  mkdirSync,
  spawnSync,
  spawnSyncTo,
  readdirSync,
  monotonicNanos,
  isDirectorySync,
  getenv,
};

// ---- process.argv -------------------------------------------------------------------

/** `process.argv`: the array pointer the entry wrapper stored in `@nish_argv`; mirrors `checkProcessArgv`. */
namespacePropertyEmitters["process.argv"] = (ctx) => {
  ctx.declareType(ARRAY_TYPE);
  ctx.declareGlobal(ARGV_GLOBAL);
  const align = ctx.opts.optimizeAttributes ? ", align 8" : "";
  return ctx.fn.emitValue(`load ${ARRAY_STRUCT}*, ${ARRAY_STRUCT}** @nish_argv${align}`);
};

const isArgvRead = (node: ts.Node): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) && dottedName(node) === "process.argv";

/** The load of `@nish_argv` reads memory the function does not own: at most `readonly`. */
factCollectors.push((program, node, facts) => {
  if (isArgvRead(node) && !isValueReceiver(program, node.expression)) facts.readsMemory = true;
});

// ---- process.platform and process.arch ------------------------------------------------

/**
 * `process.platform` / `process.arch` (WP14 §7a): one call to the runtime,
 * which answers the address of a string in its own constant data. Nothing is
 * read and nothing is allocated, so unlike `process.argv` this leaves a
 * function `readnone`, and two reads of the same property in one function are
 * one call after CSE.
 */
function machineProperty(symbol: string): NamespacePropertyEmitter {
  return (ctx) => ctx.fn.emitValue(`call i8* ${ctx.useRuntime(symbol)}()`);
}

namespacePropertyEmitters["process.platform"] = machineProperty("nish_platform");
namespacePropertyEmitters["process.arch"] = machineProperty("nish_arch");

/**
 * The other half of the pair above. The call itself is `readnone willreturn`,
 * so naming it here changes no attribute today; it is named anyway because the
 * rule is that what a construct emits and what the analysis is told it emits
 * never drift apart, and a future change to either would otherwise be silent.
 */
factCollectors.push((program, node, facts) => {
  if (!ts.isPropertyAccessExpression(node) || isValueReceiver(program, node.expression)) return;
  const dotted = dottedName(node);
  if (dotted === "process.platform") facts.callees.add("nish_platform");
  else if (dotted === "process.arch") facts.callees.add("nish_arch");
});
