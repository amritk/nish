/**
 * Statement checkers, one per `ts.SyntaxKind`.
 *
 * To add a statement kind: write a `StatementChecker` and register it in
 * `statementCheckers`. Return true when the statement definitely terminates.
 */
import ts from "typescript";
import { resolveTypeNode, sameType, typeToString } from "../types";
import { CheckContext, CheckerTable, StatementChecker } from "./context";
import { controlFlowStatementCheckers } from "./control-flow";
import { terminatesControlFlow } from "./io";
import { LocalVar } from "./program";
import { Scope } from "./scope";

const checkReturn: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.ReturnStatement;
  const want = ctx.current.returnType;
  if (!stmt.expression) {
    if (want.kind !== "void") throw ctx.error(`Expected a return value of type ${typeToString(want)}`, stmt);
    return true;
  }
  const got = ctx.checkExpression(stmt.expression, scope);
  if (!sameType(got, want)) {
    throw ctx.error(
      `Return type mismatch: function returns ${typeToString(want)} but expression is ${typeToString(got)}`,
      stmt.expression
    );
  }
  return true;
};

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
    const initType = ctx.checkExpression(decl.initializer, scope);
    let type = initType;
    if (decl.type) {
      type = resolveTypeNode(decl.type, ctx.sf, ctx.opts);
      if (!sameType(type, initType)) {
        throw ctx.error(
          `Cannot initialize ${typeToString(type)} variable \`${decl.name.text}\` with ${typeToString(initType)}`,
          decl.initializer
        );
      }
    }
    if (type.kind === "void") throw ctx.error("Cannot declare a variable of type void", decl);
    const v: LocalVar = { name: decl.name.text, type, mutable, storage: "local" };
    scope.declare(v, decl.name, ctx.sf);
    ctx.program.locals.set(decl, v);
  }
}

const checkExpressionStatement: StatementChecker = (ctx, node, scope) => {
  const expr = (node as ts.ExpressionStatement).expression;
  ctx.checkExpression(expr, scope);
  return terminatesControlFlow(expr); // WP7: `process.exit(n);` ends the path like `return`
};

const checkBlockStatement: StatementChecker = (ctx, node, scope) =>
  ctx.checkBlock(node as ts.Block, scope);

export const statementCheckers: CheckerTable<StatementChecker> = {
  [ts.SyntaxKind.ReturnStatement]: checkReturn,
  [ts.SyntaxKind.VariableStatement]: checkVariableStatement,
  [ts.SyntaxKind.ExpressionStatement]: checkExpressionStatement,
  [ts.SyntaxKind.Block]: checkBlockStatement,
  ...controlFlowStatementCheckers,
};

/** How a terminating statement is named in the unreachable-code diagnostic. */
const TERMINATOR_NAMES: Partial<Record<ts.SyntaxKind, string>> = {
  [ts.SyntaxKind.ExpressionStatement]: "process.exit",
  [ts.SyntaxKind.ReturnStatement]: "return",
  [ts.SyntaxKind.BreakStatement]: "break",
  [ts.SyntaxKind.ContinueStatement]: "continue",
  [ts.SyntaxKind.ThrowStatement]: "throw",
  [ts.SyntaxKind.IfStatement]: "an `if` whose branches all return",
};

/** Shared helper: check a statement list; errors on code after a terminator. */
export function checkStatements(ctx: CheckContext, stmts: readonly ts.Statement[], scope: Scope): boolean {
  let terminator: ts.Statement | undefined;
  for (const stmt of stmts) {
    if (terminator) {
      const what = TERMINATOR_NAMES[terminator.kind] ?? "an infinite loop";
      throw ctx.error(`Unreachable code after ${what}`, stmt);
    }
    if (ctx.checkStatement(stmt, scope)) terminator = stmt;
  }
  return terminator !== undefined;
}
