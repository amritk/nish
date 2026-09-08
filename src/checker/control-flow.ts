/**
 * Control flow: `if`, `while`, `do`, `for`, `switch`, `break`/`continue`,
 * the ternary and short-circuit operators, compound assignment, `++`/`--`.
 *
 * Conditions must be `boolean`. The language has no truthiness coercion, so
 * `if (n)` on a number is an error rather than an implicit `n !== 0`.
 *
 * Termination ("definitely does not fall through") drives the missing-return
 * and unreachable-code diagnostics:
 *   - `if`/`else` terminates when both branches do.
 *   - `while (true)`, `do {} while (true)`, `for (;;)` and `for (; true;)`
 *     terminate when their body contains no `break` aimed at them.
 *   - Any other loop may run zero times, so it never terminates.
 *   - `break` and `continue` terminate the list they appear in.
 *   - a `switch` terminates when it has a `default`, no `break` targets it,
 *     and its last clause terminates: only then is every value handled by a
 *     clause that cannot fall out.
 *
 * Narrowing (see `narrowing.ts`): a condition of the form `p !== null` /
 * `p === null` (WP6) or `r.ok` (WP16), possibly under `!`, `&&`, `||`,
 * narrows the variable it tests in the branch, loop body, right operand or
 * ternary arm it guards, and after an `if` whose other branch cannot fall
 * through.
 */
import ts from "typescript";
import { BOOL, assignable, isInteger, isNumeric, sameType, typeToString } from "../types";
import { constValue } from "./constants";
import {
  BinaryChecker,
  CheckContext,
  CheckerTable,
  ExpressionChecker,
  LoopInfo,
  StatementChecker,
  UnaryChecker,
} from "./context";
import { LANGUAGE } from "../branding";
import {
  Narrowing,
  applyNarrowings,
  conditionNarrowings,
  invalidateNarrowings,
  narrowedScope,
} from "./narrowing";
import { LocalVar } from "./program";
import { Scope } from "./scope";

// ---- Helpers shared with the emitter and the attribute analysis --------------

export function unwrapParens(expr: ts.Expression): ts.Expression {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  return inner;
}

/**
 * A loop condition that can never fail: absent (`for (;;)`) or the literal
 * `true`. The emitter uses the same predicate to know that the loop's exit
 * block is unreachable.
 */
export function isAlwaysTrue(cond: ts.Expression | undefined): boolean {
  return cond === undefined || unwrapParens(cond).kind === ts.SyntaxKind.TrueKeyword;
}

function checkCondition(ctx: CheckContext, expr: ts.Expression, scope: Scope): void {
  const t = ctx.checkExpression(expr, scope);
  if (t.kind !== "bool") {
    throw ctx.error(
      `Condition must be boolean, got ${typeToString(t)} (${LANGUAGE} has no truthiness)`,
      expr
    );
  }
}

/**
 * A branch or loop body: a block opens its own scope; a lone statement gets
 * one too. `narrowings` hold throughout the body (a scope of their own, so a
 * `let` declared in the body cannot collide with them).
 */
function checkBody(
  ctx: CheckContext,
  stmt: ts.Statement,
  scope: Scope,
  narrowings: Narrowing[] = []
): boolean {
  const inner = narrowings.length > 0 ? narrowedScope(scope, narrowings) : scope;
  return ts.isBlock(stmt) ? ctx.checkBlock(stmt, inner) : ctx.checkStatement(stmt, inner.child());
}

/** Check a loop body with the loop on the stack; returns true if it contains a `break` for this loop. */
function checkLoopBody(
  ctx: CheckContext,
  body: ts.Statement,
  scope: Scope,
  narrowings: Narrowing[] = []
): boolean {
  const loop: LoopInfo = { kind: "loop", hasBreak: false };
  ctx.loops.push(loop);
  checkBody(ctx, body, scope, narrowings);
  ctx.loops.pop();
  return loop.hasBreak;
}

// ---- Statements ---------------------------------------------------------------

const checkIf: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.IfStatement;
  checkCondition(ctx, stmt.expression, scope);
  const { whenTrue, whenFalse } = conditionNarrowings(stmt.expression, scope);
  const thenTerminates = checkBody(ctx, stmt.thenStatement, scope, whenTrue);
  const elseTerminates = stmt.elseStatement ? checkBody(ctx, stmt.elseStatement, scope, whenFalse) : false;
  // Early exit: `if (p === null) { return; }` leaves `p` non-null for the rest of the block.
  if (thenTerminates && !elseTerminates) applyNarrowings(scope, whenFalse);
  if (elseTerminates && !thenTerminates) applyNarrowings(scope, whenTrue);
  return thenTerminates && elseTerminates;
};

const checkWhile: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.WhileStatement;
  invalidateNarrowings(scope, stmt);
  checkCondition(ctx, stmt.expression, scope);
  const hasBreak = checkLoopBody(
    ctx,
    stmt.statement,
    scope,
    conditionNarrowings(stmt.expression, scope).whenTrue
  );
  return isAlwaysTrue(stmt.expression) && !hasBreak;
};

const checkDo: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.DoStatement;
  invalidateNarrowings(scope, stmt);
  const hasBreak = checkLoopBody(ctx, stmt.statement, scope);
  checkCondition(ctx, stmt.expression, scope);
  return isAlwaysTrue(stmt.expression) && !hasBreak;
};

const checkFor: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.ForStatement;
  invalidateNarrowings(scope, stmt);
  // `let` in the initializer belongs to the loop, not the enclosing block.
  const loopScope = scope.child();
  if (stmt.initializer) {
    if (ts.isVariableDeclarationList(stmt.initializer)) ctx.declareVariables(stmt.initializer, loopScope);
    else ctx.checkExpression(stmt.initializer, loopScope);
  }
  if (stmt.condition) checkCondition(ctx, stmt.condition, loopScope);
  if (stmt.incrementor) ctx.checkExpression(stmt.incrementor, loopScope);
  const narrowings = stmt.condition ? conditionNarrowings(stmt.condition, loopScope).whenTrue : [];
  const hasBreak = checkLoopBody(ctx, stmt.statement, loopScope, narrowings);
  return isAlwaysTrue(stmt.condition) && !hasBreak;
};

const checkBreak: StatementChecker = (ctx, node) => {
  const stmt = node as ts.BreakStatement;
  if (stmt.label) throw ctx.error("Labelled `break` is not supported", stmt);
  const target = ctx.loops[ctx.loops.length - 1];
  if (!target) throw ctx.error("`break` outside of a loop or `switch`", stmt);
  target.hasBreak = true;
  return true;
};

const checkContinue: StatementChecker = (ctx, node) => {
  const stmt = node as ts.ContinueStatement;
  if (stmt.label) throw ctx.error("Labelled `continue` is not supported", stmt);
  // A `switch` on the stack is a `break` target only: `continue` inside one
  // belongs to the enclosing loop, as it does in JavaScript.
  if (!ctx.loops.some((target) => target.kind === "loop")) {
    throw ctx.error("`continue` outside of a loop", stmt);
  }
  return true;
};

/**
 * The value a `case` label selects on. It has to be known at compile time,
 * because LLVM's `switch` table holds constants: an integer literal, its
 * negation, or a module constant (WP14 A3), which is where a program's token
 * and node kinds live. Anything else is a runtime value and belongs in an
 * `if`.
 */
const caseValue = (ctx: CheckContext, expr: ts.Expression): bigint | undefined => {
  const inner = unwrapParens(expr);
  if (ts.isNumericLiteral(inner)) {
    // TypeScript normalises every numeric literal's text to decimal digits
    // (`0x10` reads back as `16`), so this is exact past 2^53 as well.
    return /^\d+$/.test(inner.text) ? BigInt(inner.text) : undefined;
  }
  if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken) {
    const operand = caseValue(ctx, inner.operand);
    return operand === undefined ? undefined : -operand;
  }
  if (ts.isIdentifier(inner)) {
    const constant = ctx.program.constRefs.get(inner);
    if (!constant) return undefined;
    const value = constValue(constant);
    return value.kind === "int" ? value.value : undefined;
  }
  return undefined;
};

/**
 * A clause declares a variable directly, without a block of its own. Every
 * clause shares one scope in TypeScript, so `case 1: const x = 1; break;`
 * would leave `x` visible but unassigned in the clauses below it — reachable
 * in the language, a temporal-dead-zone throw under Node. Requiring the braces
 * removes the difference rather than documenting it, and it is what
 * ESLint's `no-case-declarations` asks for anyway.
 */
const declaresDirectly = (clause: ts.CaseOrDefaultClause): ts.Statement | undefined =>
  clause.statements.find((stmt) => ts.isVariableStatement(stmt));

/**
 * `switch (e) { case k: ...; default: ... }`.
 *
 * The discriminant is an integer and every label a compile-time integer
 * constant, so the whole statement lowers to LLVM's `switch` and the backend
 * builds a jump table. A `string` switch would have been a chain of
 * `amrit_str_eq` calls wearing a switch's clothes, and `if`/`else` says that
 * honestly (docs/wp14-selfhost.md §5).
 *
 * There is no implicit fallthrough: a clause with statements ends in `break`,
 * `return`, `continue` or `process.exit`, and only the last clause
 * may fall out of the statement. An *empty* clause does fall through, which
 * is how `case 1: case 2:` gives a group of labels one body.
 */
const checkSwitch: StatementChecker = (ctx, node, scope) => {
  const stmt = node as ts.SwitchStatement;
  const subject = ctx.checkExpression(stmt.expression, scope);
  if (!isInteger(subject)) {
    throw ctx.error(
      `\`switch\` requires an integer discriminant, got ${typeToString(subject)} (use \`if\` / \`else\`; only an integer switch lowers to a jump table)`,
      stmt.expression
    );
  }

  const clauses = stmt.caseBlock.clauses;
  const seen = new Map<string, ts.CaseClause>();
  let defaultClause: ts.DefaultClause | undefined;
  const target: LoopInfo = { kind: "switch", hasBreak: false };
  ctx.loops.push(target);
  let lastTerminates = false;
  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    if (ts.isDefaultClause(clause)) {
      if (defaultClause) throw ctx.error("`switch` has more than one `default` clause", clause);
      defaultClause = clause;
    } else {
      const labelType = ctx.checkExpression(clause.expression, scope);
      if (!sameType(labelType, subject)) {
        throw ctx.error(
          `\`case\` label is ${typeToString(labelType)} but the discriminant is ${typeToString(subject)}`,
          clause.expression
        );
      }
      const value = caseValue(ctx, clause.expression);
      if (value === undefined) {
        throw ctx.error(
          "`case` label must be an integer literal or a module constant (LLVM's `switch` table holds constants)",
          clause.expression
        );
      }
      const duplicate = seen.get(String(value));
      if (duplicate)
        throw ctx.error(`Duplicate \`case\` label \`${value}\` in this \`switch\``, clause.expression);
      seen.set(String(value), clause);
      ctx.program.caseValues.set(clause, value);
    }

    const declaration = declaresDirectly(clause);
    if (declaration) {
      throw ctx.error(
        "A `case` clause cannot declare a variable directly; wrap the clause body in a block (`case 1: { ... }`)",
        declaration
      );
    }
    const terminates =
      clause.statements.length > 0 ? ctx.checkStatementList(clause.statements, scope.child()) : false;
    if (clause.statements.length > 0 && !terminates && i < clauses.length - 1) {
      throw ctx.error(
        `A \`case\` clause with statements must end in \`break\`, \`return\`, \`continue\` or \`process.exit\` (${LANGUAGE} has no implicit fallthrough; leave a clause empty to give several labels one body)`,
        clause.statements[clause.statements.length - 1]
      );
    }
    lastTerminates = terminates;
  }
  ctx.loops.pop();

  // Anything not named by a clause reaches the statement after the `switch`
  // unless a `default` catches it, and so does a `break` or a last clause
  // that falls out of the bottom.
  return defaultClause !== undefined && !target.hasBreak && lastTerminates;
};


export const controlFlowStatementCheckers: CheckerTable<StatementChecker> = {
  [ts.SyntaxKind.IfStatement]: checkIf,
  [ts.SyntaxKind.WhileStatement]: checkWhile,
  [ts.SyntaxKind.DoStatement]: checkDo,
  [ts.SyntaxKind.ForStatement]: checkFor,
  [ts.SyntaxKind.SwitchStatement]: checkSwitch,
  [ts.SyntaxKind.BreakStatement]: checkBreak,
  [ts.SyntaxKind.ContinueStatement]: checkContinue,
};

// ---- Expressions --------------------------------------------------------------

/** `c ? a : b`: both arms of one type, or a `T` arm and a `T | null` arm (the result is `T | null`, WP6). */
const checkConditional: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.ConditionalExpression;
  checkCondition(ctx, expr.condition, scope);
  const narrowings = conditionNarrowings(expr.condition, scope);
  const whenTrue = ctx.checkExpression(expr.whenTrue, narrowedScope(scope, narrowings.whenTrue));
  const whenFalse = ctx.checkExpression(expr.whenFalse, narrowedScope(scope, narrowings.whenFalse));
  const result = assignable(whenTrue, whenFalse)
    ? whenFalse
    : assignable(whenFalse, whenTrue)
      ? whenTrue
      : undefined;
  if (!result) {
    throw ctx.error(
      `Ternary branches must have the same type, got ${typeToString(whenTrue)} and ${typeToString(whenFalse)}`,
      expr
    );
  }
  if (result.kind === "void") throw ctx.error("Ternary branches cannot be void", expr);
  return result;
};

/**
 * `&&` / `||`: boolean operands, boolean result (no JS "last operand"
 * semantics). The right operand runs only when the left decided nothing, so
 * `p !== null && p.x > 0` sees `p` narrowed (and `p === null || p.x > 0` too).
 */
const checkLogical: BinaryChecker = (ctx, expr, scope) => {
  const lhs = ctx.checkExpression(expr.left, scope);
  const isAnd = expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
  const left = conditionNarrowings(expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, narrowedScope(scope, isAnd ? left.whenTrue : left.whenFalse));
  if (lhs.kind !== "bool" || rhs.kind !== "bool") {
    throw ctx.error(
      `Operator \`${ts.tokenToString(expr.operatorToken.kind)}\` requires boolean operands, got ${typeToString(lhs)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return BOOL;
};

/**
 * Resolve the target of `x += e` or `x++`: a mutable local (parameters and
 * consts are rejected). Exported for `bitwise.ts`, whose `&=` family shares
 * this rule and differs only in the operand types it then accepts.
 */
export function resolveMutableTarget(ctx: CheckContext, target: ts.Expression, scope: Scope): LocalVar {
  if (!ts.isIdentifier(target)) throw ctx.error("Only simple variables can be assigned", target);
  const v = scope.lookup(target.text);
  if (!v) {
    if (ctx.program.constants.has(target.text)) {
      throw ctx.error(`Cannot assign to \`${target.text}\` because it is a module constant`, target);
    }
    throw ctx.error(`Unknown identifier \`${target.text}\``, target);
  }
  if (!v.mutable) {
    throw ctx.error(
      `Cannot assign to \`${v.name}\` because it is a ${v.storage === "param" ? "parameter" : "const"}`,
      target
    );
  }
  ctx.program.bindings.set(target, v);
  return v;
}

const checkCompoundAssignment: BinaryChecker = (ctx, expr, scope) => {
  const target = resolveMutableTarget(ctx, expr.left, scope);
  const rhs = ctx.checkExpression(expr.right, scope);
  if (!isNumeric(target.type) || !sameType(rhs, target.type)) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(expr.operatorToken.kind)}\` requires two operands of the same numeric type, got ${typeToString(target.type)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return target.type;
};

function checkIncDec(
  ctx: CheckContext,
  expr: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression,
  scope: Scope
): ReturnType<ExpressionChecker> {
  const target = resolveMutableTarget(ctx, expr.operand, scope);
  if (!isNumeric(target.type)) {
    throw ctx.error(
      `Operator \`${ts.tokenToString(expr.operator)}\` requires a numeric variable, got ${typeToString(target.type)}`,
      expr
    );
  }
  return target.type;
}

const checkPostfixUnary: ExpressionChecker = (ctx, node, scope) =>
  checkIncDec(ctx, node as ts.PostfixUnaryExpression, scope);

const checkPrefixIncDec: UnaryChecker = (ctx, expr, scope) => checkIncDec(ctx, expr, scope);

export const controlFlowExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.ConditionalExpression]: checkConditional,
  [ts.SyntaxKind.PostfixUnaryExpression]: checkPostfixUnary,
};

export const controlFlowBinaryCheckers: CheckerTable<BinaryChecker> = {
  [ts.SyntaxKind.AmpersandAmpersandToken]: checkLogical,
  [ts.SyntaxKind.BarBarToken]: checkLogical,
  [ts.SyntaxKind.PlusEqualsToken]: checkCompoundAssignment,
  [ts.SyntaxKind.MinusEqualsToken]: checkCompoundAssignment,
  [ts.SyntaxKind.AsteriskEqualsToken]: checkCompoundAssignment,
  [ts.SyntaxKind.SlashEqualsToken]: checkCompoundAssignment,
  [ts.SyntaxKind.PercentEqualsToken]: checkCompoundAssignment,
};

export const controlFlowUnaryCheckers: CheckerTable<UnaryChecker> = {
  [ts.SyntaxKind.PlusPlusToken]: checkPrefixIncDec,
  [ts.SyntaxKind.MinusMinusToken]: checkPrefixIncDec,
};
