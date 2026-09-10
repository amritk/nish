/**
 * Statement checkers, one per `ts.SyntaxKind`.
 *
 * To add a statement kind: write a `StatementChecker` and register it in
 * `statementCheckers`. Return true when the statement definitely terminates.
 */
import ts from "typescript";
import { CompileError } from "../diagnostics.js";
import { StaticType, assignable, resolveTypeNode, typeToString } from "../types.js";
import { arrayStatementCheckers } from "./arrays.js";
import { CheckContext, CheckerTable, StatementChecker } from "./context.js";
import { controlFlowStatementCheckers } from "./control-flow.js";
import { terminatesControlFlow } from "./io.js";
import { LocalVar } from "./program.js";
import { rejectDiscardedResult } from "./result.js";
import { Scope } from "./scope.js";

const checkReturn: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.ReturnStatement;
  const want = ctx.current.returnType;
  if (!stmt.expression) {
    if (want.kind !== "void") throw ctx.error(`Expected a return value of type ${typeToString(want)}`, stmt);
    return true;
  }
  checkReturnValue(ctx, stmt.expression, scope);
  return true;
};

/**
 * The value of a `return`, checked against the enclosing function's return
 * type. Shared with the concise arrow body (`=> n * 2`), which means the same
 * thing as a block with one `return` (WP22 §4).
 */
export function checkReturnValue(ctx: CheckContext, expr: ts.Expression, scope: Scope): void {
  const want = ctx.current.returnType;
  const got = ctx.checkExpression(expr, scope);
  if (!assignable(got, want)) {
    throw ctx.error(
      `Return type mismatch: function returns ${typeToString(want)} but expression is ${typeToString(got)}`,
      expr
    );
  }
}

const checkVariableStatement: StatementChecker = (ctx, node, scope) => {
  checkVariableDeclarationList(ctx, (node as ts.VariableStatement).declarationList, scope);
  return false;
};

/** Declare each `let`/`const` of a list in `scope`; shared by variable statements and `for` initializers. */
export function checkVariableDeclarationList(
  ctx: CheckContext,
  list: ts.VariableDeclarationList,
  scope: Scope
): void {
  const isVar = !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
  if (isVar) throw ctx.error("`var` is forbidden; use `let` or `const`", list);
  const mutable = (list.flags & ts.NodeFlags.Const) === 0;

  for (const decl of list.declarations) {
    if (!ts.isIdentifier(decl.name)) throw ctx.error("Destructuring is not supported", decl);
    if (!decl.initializer) throw ctx.error(`Variable \`${decl.name.text}\` must be initialized`, decl);
    // The annotation is resolved first so that, when the initializer is
    // rejected, the variable can still be declared with its declared type and
    // later statements do not report it as unknown (WP10 recovery).
    const declared = decl.type ? resolveTypeNode(decl.type, ctx.sf, ctx.opts) : undefined;
    let type: StaticType;
    try {
      const initType = ctx.checkExpression(decl.initializer, scope);
      type = declared ?? initType;
      if (declared && !assignable(initType, declared)) {
        throw ctx.error(
          `Cannot initialize ${typeToString(declared)} variable \`${decl.name.text}\` with ${typeToString(initType)}`,
          decl.initializer
        );
      }
    } catch (err) {
      if (err instanceof CompileError && declared && declared.kind !== "void") {
        try {
          scope.declare({ name: decl.name.text, type: declared, mutable, storage: "local" }, decl.name, ctx.sf);
        } catch (dup) {
          if (!(dup instanceof CompileError)) throw dup; // already declared here: keep the original error only
        }
      }
      throw err;
    }
    if (type.kind === "void") throw ctx.error("Cannot declare a variable of type void", decl);
    const v: LocalVar = { name: decl.name.text, type, mutable, storage: "local" };
    scope.declare(v, decl.name, ctx.sf);
    ctx.program.locals.set(decl, v);
  }
}

const checkExpressionStatement: StatementChecker = (ctx, node, scope) => {
  const expr = (node as ts.ExpressionStatement).expression;
  rejectDiscardedResult(ctx, expr, ctx.checkExpression(expr, scope)); // WP16: a failure may not be dropped
  return terminatesControlFlow(ctx, expr); // WP7/WP14: `process.exit(n);` and `panic(m);` end the path like `return`
};

const checkBlockStatement: StatementChecker = (ctx, node, scope) =>
  ctx.checkBlock(node as ts.Block, scope);

export const statementCheckers: CheckerTable<StatementChecker> = {
  [ts.SyntaxKind.ReturnStatement]: checkReturn,
  [ts.SyntaxKind.VariableStatement]: checkVariableStatement,
  [ts.SyntaxKind.ExpressionStatement]: checkExpressionStatement,
  [ts.SyntaxKind.Block]: checkBlockStatement,
  ...controlFlowStatementCheckers,
  ...arrayStatementCheckers, // `for (const x of a)`
};

/** How a terminating statement is named in the unreachable-code diagnostic. */
const TERMINATOR_NAMES: Partial<Record<ts.SyntaxKind, string>> = {
  [ts.SyntaxKind.ExpressionStatement]: "process.exit",
  [ts.SyntaxKind.ReturnStatement]: "return",
  [ts.SyntaxKind.BreakStatement]: "break",
  [ts.SyntaxKind.ContinueStatement]: "continue",
  [ts.SyntaxKind.IfStatement]: "an `if` whose branches all return",
  [ts.SyntaxKind.SwitchStatement]: "a `switch` whose clauses all return",
};

/**
 * Shared helper: check a statement list; errors on code after a terminator.
 *
 * This is the recovery point of multi-error reporting (WP10): a statement
 * that throws a `CompileError` is reported, the enclosing function is marked
 * poisoned, and checking continues with the next statement. Nested lists
 * (block bodies) recover at their own innermost statement, so one bad
 * expression costs exactly one statement's worth of checking.
 */
export function checkStatements(ctx: CheckContext, stmts: readonly ts.Statement[], scope: Scope): boolean {
  let terminator: ts.Statement | undefined;
  for (const stmt of stmts) {
    try {
      if (terminator) {
        const what = TERMINATOR_NAMES[terminator.kind] ?? "an infinite loop";
        throw ctx.error(`Unreachable code after ${what}`, stmt);
      }
      if (ctx.checkStatement(stmt, scope)) terminator = stmt;
    } catch (err) {
      if (!(err instanceof CompileError)) throw err;
      ctx.report(err);
      // Report unreachable code once per list, then keep checking what follows.
      terminator = undefined;
    }
  }
  return terminator !== undefined;
}
