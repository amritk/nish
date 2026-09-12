/**
 * Process and file builtins (WP7). Lowering lives in `codegen/emit/io.ts`.
 *
 *   process.exit(code: i32): void       terminates the process; as a statement
 *                                       it also terminates control flow, so a
 *                                       non-void function may end with it.
 *   readFileSync(path: string): string  whole file as an arena string; a
 *                                       missing file prints a message and
 *                                       exits with status 1.
 *   readFileSyncOrNull(path): string | null   the same read, answering `null`
 *                                       where the other exits, so a program
 *                                       can turn a missing file into its own
 *                                       diagnostic and carry on (WP14 B3).
 *   write(s: string): void              stdout, no trailing newline
 *   writeError(s: string): void         stderr, no trailing newline
 *   panic(message: string): void        the message on stderr, then exit 1
 *                                       (WP14 D1: an internal invariant keeps
 *                                       its message, which `throw` discards).
 *   writeFileSync(path: string, data: string): void   create/truncate + write
 *   appendFileSync(path: string, data: string): void  create/append + write
 *   mkdirSync(path: string): boolean    create one directory, not recursive;
 *                                       `true` when a directory is there
 *                                       afterwards, `false` otherwise. It
 *                                       answers rather than exits for the
 *                                       same reason `readFileSyncOrNull`
 *                                       does (WP14 B3).
 *   spawnSync(argv: string[]): number   run `argv[0]` through `PATH` with
 *                                       `argv` as its vector, wait, and
 *                                       answer its exit status (`128 + n`
 *                                       for a signal, `-1` when `argv` is
 *                                       empty or the child cannot be started
 *                                       or waited for).
 *   isDirectorySync(path): boolean      one `stat`: whether a directory is at
 *                                       `path` right now. It answers rather
 *                                       than exits for the same reason the
 *                                       two above do (WP14 §7a).
 *   getenv(name): string | null         one environment variable, or `null`
 *                                       when it is unset (WP19 R1). A call
 *                                       and not `process.env.NAME`, because
 *                                       member access on a dynamic key is
 *                                       what Phase 0 forbids.
 *
 *   process.argv: string[]              the command line, index 0 the program
 *                                       path (like C's argv[0]); read-only,
 *                                       and only in a program with a `main`
 *                                       entry, whose wrapper builds it once.
 *   process.platform: string            what machine the *program* runs on,
 *   process.arch: string                spelled as Node spells them; the two
 *                                       halves `--target host` composes a
 *                                       triple from (WP14 §7a).
 *
 * The file functions are globals rather than `import { readFileSync } from
 * "fs"`: the language has no package resolution and bare specifiers are rejected.
 *
 * `mkdirSync` and `spawnSync` exist so that a self-hosted driver can create
 * `-o dir/` and run `bash scripts/build.sh` for `--link` itself; wp14-selfhost.md
 * §3a D4 named exactly these two as what stage1 would need before it could
 * stop leaning on `scripts/nish.sh`.
 */
import ts from "typescript";
import { BOOL, F64, I32, STRING, VOID, arrayOf, nullableOf } from "../types.js";
import {
  BuiltinCallChecker,
  checkArgumentType,
  checkArity,
  dottedName,
  requireStatementPosition,
} from "./builtins.js";
import { CheckContext } from "./context.js";
import { NamespacePropertyChecker, namespaceProperties } from "./members.js";

const checkProcessExit: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "process.exit", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "process.exit", I32);
  requireStatementPosition(ctx, expr, "process.exit");
  return VOID;
};

const checkReadFileSync: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "readFileSync", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "readFileSync", STRING);
  return STRING;
};

/** `readFileSyncOrNull` (WP14 B3): the same read, `string | null` instead of exiting. */
const checkReadFileSyncOrNull: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "readFileSyncOrNull", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "readFileSyncOrNull", STRING);
  return nullableOf(STRING);
};

/** `write` / `writeError` (WP14 B2): one string, no conversion, no newline. */
function streamWriter(name: string): BuiltinCallChecker {
  return (ctx, expr, scope) => {
    checkArity(ctx, expr, name, 1);
    checkArgumentType(ctx, expr.arguments[0], scope, name, STRING);
    requireStatementPosition(ctx, expr, name);
    return VOID;
  };
}

/**
 * `panic(message)` (WP14 D1): the message on stderr, then exit 1. `throw`
 * traps and discards its value, which is right for a program that has nothing
 * to say; an internal invariant has something to say.
 */
const checkPanic: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "panic", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "panic", STRING);
  requireStatementPosition(ctx, expr, "panic");
  return VOID;
};

function fileWriter(name: string): BuiltinCallChecker {
  return (ctx, expr, scope) => {
    checkArity(ctx, expr, name, 2);
    checkArgumentType(ctx, expr.arguments[0], scope, name, STRING);
    checkArgumentType(ctx, expr.arguments[1], scope, name, STRING);
    requireStatementPosition(ctx, expr, name);
    return VOID;
  };
}

/**
 * `mkdirSync(path)` (WP14 D4): one directory, never recursive, answering
 * whether a directory is there afterwards. A `boolean` rather than a `void`
 * that exits, for the reason `readFileSyncOrNull` answers `null`: there are
 * no exceptions, so the driver has to be able to phrase its own diagnostic.
 */
const checkMkdirSync: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "mkdirSync", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "mkdirSync", STRING);
  return BOOL;
};

/**
 * `isDirectorySync(path)` (WP14 §7a): the smallest `stat` that answers the
 * question a driver actually asks of a path — is `-o out` a directory that is
 * already there, or a file to write? A `boolean` and never an exit, the same
 * bargain `mkdirSync` and `readFileSyncOrNull` make. A missing path, a plain
 * file, a broken symlink and an unreadable parent are all `false`: there is
 * no directory there, which is all the caller wanted to know.
 */
const checkIsDirectorySync: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "isDirectorySync", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "isDirectorySync", STRING);
  return BOOL;
};

/**
 * `getenv(name)` (WP19 R1): the value of one environment variable, or `null`
 * when it is unset. Nullable rather than an empty string because "unset" and
 * "set to nothing" are different answers and a driver acts on the difference:
 * `CC=` is a deliberately empty setting, `CC` unset means "use the default".
 * The result narrows with `!== null` like every other `T | null`.
 *
 * A function and not `process.env.NAME`: the namespace properties this file
 * already has (`process.argv`, `process.platform`) are fixed names, and
 * `process.env` would need member access on a key chosen at runtime, which is
 * exactly what Phase 0 refuses. WP19 §4 chose the call for that reason.
 */
const checkGetenv: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "getenv", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "getenv", STRING);
  return nullableOf(STRING);
};

/**
 * `spawnSync(argv)` (WP14 D4): the child's exit status, a `number` like
 * `a.length` is, so `f64` under `--number-mode f64`. The argument is checked
 * down to its element type — a `number[]` is not a command line — which is
 * why `checkArgumentType` compares with `sameType` rather than by kind.
 */
const checkSpawnSync: BuiltinCallChecker = (ctx, expr, scope) => {
  checkArity(ctx, expr, "spawnSync", 1);
  checkArgumentType(ctx, expr.arguments[0], scope, "spawnSync", arrayOf(STRING));
  return ctx.opts.numberMode === "f64" ? F64 : I32;
};

/** Dotted callees, spread into `builtinCalls`. */
export const ioBuiltinCalls: Record<string, BuiltinCallChecker> = {
  "process.exit": checkProcessExit,
};

// ---- process.argv -------------------------------------------------------------------

/**
 * The construct that consumes `process.argv` mutates it: the array is the
 * target of an element store (`process.argv[i] = s`, `op=`, `++`/`--`) or the
 * receiver of `push` or `pop`. Anything else (indexing, `.length`, `for...of`,
 * `indexOf`, `join`, passing it on, aliasing it) only reads it.
 */
function mutatesArgv(access: ts.Expression): boolean {
  let node: ts.Node = access;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && (parent.name.text === "push" || parent.name.text === "pop")) {
    return ts.isCallExpression(parent.parent) && parent.parent.expression === parent;
  }
  if (!ts.isElementAccessExpression(parent) || parent.expression !== node) return false;
  node = parent;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const use = node.parent;
  if (ts.isBinaryExpression(use) && use.left === node) {
    const op = use.operatorToken.kind;
    return op >= ts.SyntaxKind.FirstAssignment && op <= ts.SyntaxKind.LastAssignment;
  }
  return (
    (ts.isPrefixUnaryExpression(use) || ts.isPostfixUnaryExpression(use)) &&
    (use.operator === ts.SyntaxKind.PlusPlusToken || use.operator === ts.SyntaxKind.MinusMinusToken)
  );
}

/**
 * `process.argv: string[]`. Only the entry wrapper can build it (from C's
 * `argc`/`argv`), so a program without `export function main`, such as a
 * wasm or N-API library, rejects it; and it is read-only. Every other array
 * operation applies: `process.argv.length`, `process.argv[i]`, `for...of`.
 */
function checkProcessArgv(ctx: CheckContext, expr: ts.Expression) {
  if (!ctx.hasEntryMain) {
    throw ctx.error(
      "`process.argv` requires a `main` entry point (this program has no `export function main`)",
      expr
    );
  }
  if (mutatesArgv(expr)) throw ctx.error("`process.argv` is read-only", expr);
  ctx.program.usesArgv = true;
  return arrayOf(STRING);
}

namespaceProperties["process.argv"] = checkProcessArgv;

// ---- process.platform and process.arch ----------------------------------------------

/**
 * `process.platform` and `process.arch` (WP14 §7a): what machine the compiled
 * *program* runs on, not what machine compiled it. Both are plain `string`
 * values with no rule attached — unlike `process.argv` there is nothing for an
 * entry wrapper to build, so a wasm or N-API library may read them too.
 *
 * They exist because `--target host` has to ask the machine what it is, and
 * nothing else in the language does. The spellings are Node's, so the mapping
 * from the pair to a triple reads the same in `self/target.ts` as it does in
 * `hostTriple` in `codegen/target.ts`.
 */
const checkMachineProperty: NamespacePropertyChecker = () => STRING;

namespaceProperties["process.platform"] = checkMachineProperty;
namespaceProperties["process.arch"] = checkMachineProperty;

/** Plain identifier callees, spread into `builtinFunctions`. */
export const ioBuiltinFunctions: Record<string, BuiltinCallChecker> = {
  readFileSync: checkReadFileSync,
  readFileSyncOrNull: checkReadFileSyncOrNull,
  writeFileSync: fileWriter("writeFileSync"),
  appendFileSync: fileWriter("appendFileSync"),
  write: streamWriter("write"),
  writeError: streamWriter("writeError"),
  panic: checkPanic,
  mkdirSync: checkMkdirSync,
  spawnSync: checkSpawnSync,
  isDirectorySync: checkIsDirectorySync,
  getenv: checkGetenv,
};

/**
 * An expression statement that never completes normally. `process.exit` and
 * `panic` lower to a `noreturn` call followed by `unreachable`, so for
 * definite-return analysis they count as terminators, exactly like `return`.
 */
export function terminatesControlFlow(ctx: CheckContext, expr: ts.Expression): boolean {
  if (!ts.isCallExpression(expr)) return false;
  if (dottedName(expr.expression) === "process.exit") return true;
  if (!ts.isIdentifier(expr.expression)) return false;
  // An import is unambiguous: `exit` from `nish:process` terminates, and so
  // does an `as` rename of it, while an identifier that only looks like one
  // still has to pass the test below.
  const imported = ctx.program.builtinImports.get(expr.expression.text);
  if (imported) return imported.canonical === "process.exit" || imported.canonical === "panic";
  // A user function may be called `panic`; the builtin only applies when none is.
  return expr.expression.text === "panic" && !ctx.program.callees.has(expr);
}
