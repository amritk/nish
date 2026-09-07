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
 *
 *   process.argv: string[]              the command line, index 0 the program
 *                                       path (like C's argv[0]); read-only,
 *                                       and only in a program with a `main`
 *                                       entry, whose wrapper builds it once.
 *
 * The file functions are globals rather than `import { readFileSync } from
 * "fs"`: StaticTS has no package resolution and bare specifiers are rejected.
 */
import ts from "typescript";
import { I32, STRING, VOID, arrayOf, nullableOf } from "../types";
import {
  BuiltinCallChecker,
  checkArgumentType,
  checkArity,
  dottedName,
  requireStatementPosition,
} from "./builtins";
import { CheckContext } from "./context";
import { namespaceProperties } from "./members";

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
function mutatesArgv(access: ts.PropertyAccessExpression): boolean {
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
function checkProcessArgv(ctx: CheckContext, expr: ts.PropertyAccessExpression) {
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

/** Plain identifier callees, spread into `builtinFunctions`. */
export const ioBuiltinFunctions: Record<string, BuiltinCallChecker> = {
  readFileSync: checkReadFileSync,
  readFileSyncOrNull: checkReadFileSyncOrNull,
  writeFileSync: fileWriter("writeFileSync"),
  appendFileSync: fileWriter("appendFileSync"),
  write: streamWriter("write"),
  writeError: streamWriter("writeError"),
  panic: checkPanic,
};

/**
 * An expression statement that never completes normally. `process.exit` and
 * `panic` lower to a `noreturn` call followed by `unreachable`, so for
 * definite-return analysis they count as terminators, exactly like `return`.
 */
export function terminatesControlFlow(ctx: CheckContext, expr: ts.Expression): boolean {
  if (!ts.isCallExpression(expr)) return false;
  if (dottedName(expr.expression) === "process.exit") return true;
  // A user function may be called `panic`; the builtin only applies when none is.
  return (
    ts.isIdentifier(expr.expression) && expr.expression.text === "panic" && !ctx.program.callees.has(expr)
  );
}
