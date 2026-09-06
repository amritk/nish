/**
 * Process and file builtins (WP7). Lowering lives in `codegen/emit/io.ts`.
 *
 *   process.exit(code: i32): void       terminates the process; as a statement
 *                                       it also terminates control flow, so a
 *                                       non-void function may end with it.
 *   readFileSync(path: string): string  whole file as an arena string; a
 *                                       missing file prints a message and
 *                                       exits with status 1.
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
import { I32, STRING, VOID, arrayOf } from "../types";
import { BuiltinCallChecker, checkArgumentType, checkArity, dottedName, requireStatementPosition } from "./builtins";
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
 * receiver of `push`. Anything else (indexing, `.length`, `for...of`, passing
 * it on, aliasing it) only reads it.
 */
function mutatesArgv(access: ts.PropertyAccessExpression): boolean {
  let node: ts.Node = access;
  while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name.text === "push") {
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
  writeFileSync: fileWriter("writeFileSync"),
  appendFileSync: fileWriter("appendFileSync"),
};

/**
 * An expression statement that never completes normally. `process.exit`
 * lowers to a `noreturn` call followed by `unreachable`, so for
 * definite-return analysis it counts as a terminator, exactly like `return`.
 */
export function terminatesControlFlow(expr: ts.Expression): boolean {
  return ts.isCallExpression(expr) && dottedName(expr.expression) === "process.exit";
}
