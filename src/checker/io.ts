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
 * The file functions are globals rather than `import { readFileSync } from
 * "fs"`: StaticTS has no package resolution and bare specifiers are rejected.
 * `process.argv` waits for arrays (WP4).
 */
import ts from "typescript";
import { I32, STRING, VOID } from "../types";
import { BuiltinCallChecker, checkArgumentType, checkArity, dottedName, requireStatementPosition } from "./builtins";

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
