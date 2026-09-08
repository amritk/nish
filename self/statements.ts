// Statement checking for stage1 (`src/checker/statements.ts` and
// `src/checker/control-flow.ts`, docs/wp14-selfhost.md milestone S3, pass 2).
//
// Every checker answers **whether the statement definitely terminates the
// path**, which is the same fact three rules read: a non-`void` function must
// return on every path, code after a terminator is unreachable, and
// `willReturn` in the attribute pass is only sound where a loop is known to
// end.
//
// Recovery is per statement, which is WP10's multi-error guarantee: stage0
// catches a `CompileError` around each one, and here the checkers report and
// carry on instead (D1). The cost is visible — every caller of a checker that
// can fail has to decide what to do next rather than being unwound past.

import { LANGUAGE } from "./branding";
import { checkCondition, checkExpression, clearNarrowingsAssignedIn, narrow } from "./expressions";
import { CheckContext, LOOP_ITERATION, LOOP_SWITCH } from "./context";
import { resolveType } from "./annotations";
import { terminatesControlFlow } from "./builtins";
import { rejectDiscardedResult } from "./result";
import {
  FLAG_CONST,
  N_BLOCK,
  N_BREAK,
  N_CASE,
  N_CONTINUE,
  N_DEFAULT,
  N_DO,
  N_EMPTY,
  N_EXPR_STMT,
  N_FOR,
  N_FOR_OF,
  N_IF,
  N_RETURN,
  N_SWITCH,
  N_THROW,
  N_TRUE,
  N_VAR,
  N_WHILE,
  Node,
} from "./nodes";
import { caseValue } from "./constants";
import { Local, STORAGE_LOCAL, Scope } from "./symbols";
import { isInteger, T_BOOL, T_ERROR, T_VOID } from "./types";

/** How a terminating statement is named in the unreachable-code diagnostic. */
function terminatorName(stmt: Node): string {
  switch (stmt.kind) {
    case N_EXPR_STMT:
      return "process.exit";
    case N_RETURN:
      return "return";
    case N_BREAK:
      return "break";
    case N_CONTINUE:
      return "continue";
    case N_THROW:
      return "throw";
    case N_IF:
      return "an `if` whose branches all return";
    case N_SWITCH:
      return "a `switch` whose clauses all return";
    default:
      return "an infinite loop";
  }
}

/** A statement list in its own scope; true when the list terminates the path. */
export function checkBlock(ctx: CheckContext, block: Node, scope: Scope): boolean {
  return checkStatements(ctx, block.children, scope.child());
}

/** A statement list in `scope`; the caller decides whether that is a new one. */
export function checkStatements(ctx: CheckContext, stmts: Node[], scope: Scope): boolean {
  let terminator: Node | null = null;
  for (const stmt of stmts) {
    const before = terminator;
    if (before !== null) {
      ctx.error(stmt, `Unreachable code after ${terminatorName(before)}`);
      terminator = null; // report once per list, then keep checking
    }
    if (checkStatement(ctx, stmt, scope)) {
      terminator = stmt;
    }
  }
  return terminator !== null;
}

export function checkStatement(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  switch (stmt.kind) {
    case N_BLOCK:
      return checkBlock(ctx, stmt, scope);
    case N_VAR:
      checkVariableList(ctx, stmt, scope);
      return false;
    case N_EXPR_STMT:
      ctx.statementExpression = stmt.children[0];
      // WP16: a failure may not be dropped.
      rejectDiscardedResult(ctx, stmt.children[0], checkExpression(ctx, stmt.children[0], scope, -1));
      ctx.statementExpression = null;
      // `process.exit(n)` and `panic(m)` end the path exactly as `return` does.
      return terminatesControlFlow(ctx, stmt.children[0]);
    case N_RETURN:
      return checkReturn(ctx, stmt, scope);
    case N_IF:
      return checkIf(ctx, stmt, scope);
    case N_WHILE:
      return checkWhile(ctx, stmt, scope);
    case N_DO:
      return checkDo(ctx, stmt, scope);
    case N_FOR:
      return checkFor(ctx, stmt, scope);
    case N_FOR_OF:
      return checkForOf(ctx, stmt, scope);
    case N_SWITCH:
      return checkSwitch(ctx, stmt, scope);
    case N_BREAK:
      return checkBreak(ctx, stmt);
    case N_CONTINUE:
      return checkContinue(ctx, stmt);
    case N_THROW:
      checkExpression(ctx, stmt.children[0], scope, -1);
      return true;
    default:
      ctx.error(stmt, `Unsupported statement \`${ctx.textOf(stmt)}\``);
      return false;
  }
}

function checkReturn(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  const current = ctx.current;
  const want = current === null ? T_ERROR : current.returnType;
  const value = stmt.children[0];
  if (value.kind === N_EMPTY) {
    if (want !== T_VOID && want !== T_ERROR) {
      ctx.error(stmt, `Expected a return value of type ${ctx.table.typeName(want)}`);
    }
    return true;
  }
  const got = checkExpression(ctx, value, scope, want);
  if (got !== T_ERROR && want !== T_ERROR && !ctx.table.assignable(got, want)) {
    ctx.error(
      value,
      `Return type mismatch: function returns ${ctx.table.typeName(want)} but expression is ${ctx.table.typeName(got)}`
    );
  }
  return true;
}

/** Each `let`/`const` of a list, declared in `scope`. Shared with a `for` initializer. */
export function checkVariableList(ctx: CheckContext, list: Node, scope: Scope): void {
  const mutable = (list.flags & FLAG_CONST) === 0;
  for (const decl of list.children[0].children) {
    const name = decl.children[0].text;
    const annotation = decl.children[1];
    // The annotation is resolved first so that, when the initializer is
    // rejected, the variable is still declared with its declared type and
    // later statements do not report it as unknown.
    const declared = annotation.kind === N_EMPTY ? -1 : resolveType(annotation, ctx);
    const initializer = decl.children[2];
    if (initializer.kind === N_EMPTY) {
      ctx.error(decl, `Variable \`${name}\` must be initialized`);
      declareLocal(ctx, scope, decl, name, declared < 0 ? T_ERROR : declared, mutable);
      continue;
    }
    const initType = checkExpression(ctx, initializer, scope, declared);
    let type = declared < 0 ? initType : declared;
    if (declared >= 0 && initType !== T_ERROR && !ctx.table.assignable(initType, declared)) {
      ctx.error(
        initializer,
        `Cannot initialize ${ctx.table.typeName(declared)} variable \`${name}\` with ${ctx.table.typeName(initType)}`
      );
    }
    if (type === T_VOID) {
      ctx.error(decl, "Cannot declare a variable of type void");
      type = T_ERROR;
    }
    declareLocal(ctx, scope, decl, name, type, mutable);
  }
}

function declareLocal(
  ctx: CheckContext,
  scope: Scope,
  decl: Node,
  name: string,
  type: i32,
  mutable: boolean
): void {
  const local = new Local(name, type, mutable, STORAGE_LOCAL);
  if (!scope.declare(local)) {
    ctx.error(decl.children[0], `Duplicate declaration of \`${name}\``);
    return;
  }
  ctx.program.nodeLocals[decl.id] = local;
}

function checkIf(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  checkCondition(ctx, stmt.children[0], scope);
  const thenScope = scope.child();
  narrow(ctx, stmt.children[0], thenScope, true);
  const thenTerminates = checkStatement(ctx, stmt.children[1], thenScope);
  const otherwise = stmt.children[2];
  if (otherwise.kind === N_EMPTY) {
    // `if (p === null) return;` leaves `p` narrowed for everything after it.
    if (thenTerminates) {
      narrow(ctx, stmt.children[0], scope, false);
    }
    return false;
  }
  const elseScope = scope.child();
  narrow(ctx, stmt.children[0], elseScope, false);
  const elseTerminates = checkStatement(ctx, otherwise, elseScope);
  if (thenTerminates && !elseTerminates) {
    narrow(ctx, stmt.children[0], scope, false);
  } else if (elseTerminates && !thenTerminates) {
    narrow(ctx, stmt.children[0], scope, true);
  }
  return thenTerminates && elseTerminates;
}

function checkWhile(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  clearNarrowingsAssignedIn(ctx, stmt, scope);
  checkCondition(ctx, stmt.children[0], scope);
  const body = scope.child();
  narrow(ctx, stmt.children[0], body, true);
  ctx.pushLoop(LOOP_ITERATION);
  checkStatement(ctx, stmt.children[1], body);
  const broke = ctx.popLoop();
  // `while (true)` that nothing breaks out of never falls through, which is
  // what lets a function end with one and still return on every path.
  return stmt.children[0].kind === N_TRUE && !broke;
}

function checkDo(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  clearNarrowingsAssignedIn(ctx, stmt, scope);
  ctx.pushLoop(LOOP_ITERATION);
  checkStatement(ctx, stmt.children[0], scope.child());
  const broke = ctx.popLoop();
  checkCondition(ctx, stmt.children[1], scope);
  return stmt.children[1].kind === N_TRUE && !broke;
}

function checkFor(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  clearNarrowingsAssignedIn(ctx, stmt, scope);
  // The initializer's variables live in a scope of their own, so `i` is not
  // visible after the loop and two `for` loops may both declare one.
  const outer = scope.child();
  const initializer = stmt.children[0];
  if (initializer.kind === N_VAR) {
    checkVariableList(ctx, initializer, outer);
  } else if (initializer.kind !== N_EMPTY) {
    checkExpression(ctx, initializer, outer, -1);
  }
  const condition = stmt.children[1];
  if (condition.kind !== N_EMPTY) {
    checkCondition(ctx, condition, outer);
  }
  const update = stmt.children[2];
  if (update.kind !== N_EMPTY) {
    checkExpression(ctx, update, outer, -1);
  }
  const body = outer.child();
  if (condition.kind !== N_EMPTY) {
    narrow(ctx, condition, body, true);
  }
  ctx.pushLoop(LOOP_ITERATION);
  checkStatement(ctx, stmt.children[3], body);
  const broke = ctx.popLoop();
  return condition.kind === N_EMPTY && !broke;
}

function checkForOf(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  clearNarrowingsAssignedIn(ctx, stmt, scope);
  const iterable = checkExpression(ctx, stmt.children[1], scope, -1);
  const outer = scope.child();
  const decl = stmt.children[0].children[0].children[0];
  const name = decl.children[0].text;
  let element = T_ERROR;
  if (iterable !== T_ERROR) {
    if (!ctx.table.isArray(iterable)) {
      ctx.error(stmt.children[1], `\`for...of\` requires an array, got ${ctx.table.typeName(iterable)}`);
    } else {
      element = ctx.table.refOf(iterable);
    }
  }
  const annotation = decl.children[1];
  if (annotation.kind !== N_EMPTY) {
    const declared = resolveType(annotation, ctx);
    if (element !== T_ERROR && declared !== T_ERROR && declared !== element) {
      ctx.error(
        annotation,
        `\`for...of\` element is ${ctx.table.typeName(element)}, not ${ctx.table.typeName(declared)}`
      );
    }
  }
  // `for (let x of a)` binds a mutable element, `for (const x of a)` does not.
  declareLocal(ctx, outer, decl, name, element, (stmt.children[0].flags & FLAG_CONST) === 0);
  ctx.pushLoop(LOOP_ITERATION);
  checkStatement(ctx, stmt.children[2], outer.child());
  ctx.popLoop();
  return false;
}

/**
 * `switch (e) { case k: ...; default: ... }`.
 *
 * The discriminant is an integer and every label a compile-time integer
 * constant, so the whole statement lowers to LLVM's `switch` and the backend
 * builds a jump table. A `string` switch would have been a chain of
 * `sts_str_eq` calls wearing a switch's clothes, and `if`/`else` says that
 * honestly (docs/wp14-selfhost.md §5).
 *
 * There is no implicit fallthrough: a clause with statements ends in `break`,
 * `return`, `continue` or `process.exit`, and only the last clause
 * may fall out. An *empty* clause does fall through, which is how
 * `case 1: case 2:` gives a group of labels one body.
 */
function checkSwitch(ctx: CheckContext, stmt: Node, scope: Scope): boolean {
  const discriminant = checkExpression(ctx, stmt.children[0], scope, -1);
  if (discriminant !== T_ERROR && !isInteger(discriminant)) {
    ctx.error(
      stmt.children[0],
      `\`switch\` requires an integer discriminant, got ${ctx.table.typeName(discriminant)} (use \`if\` / \`else\`; only an integer switch lowers to a jump table)`
    );
  }
  const clauses = stmt.children[1].children;
  const seen: i64[] = [];
  let hasDefault = false;
  let lastTerminates = false;
  ctx.pushLoop(LOOP_SWITCH);
  let i = 0;
  while (i < clauses.length) {
    const clause = clauses[i];
    const body = clause.kind === N_DEFAULT ? clause.children[0] : clause.children[1];
    if (clause.kind === N_DEFAULT) {
      if (hasDefault) {
        ctx.error(clause, "`switch` has more than one `default` clause");
      }
      hasDefault = true;
    } else {
      checkCaseLabel(ctx, clause, scope, discriminant, seen);
    }
    for (const statement of body.children) {
      if (statement.kind === N_VAR) {
        ctx.error(
          statement,
          "A `case` clause cannot declare a variable directly; wrap the clause body in a block (`case 1: { ... }`)"
        );
      }
    }
    const terminates = body.children.length > 0 ? checkStatements(ctx, body.children, scope.child()) : false;
    if (body.children.length > 0 && !terminates && i < clauses.length - 1) {
      ctx.error(
        body.children[body.children.length - 1],
        "A `case` clause with statements must end in `break`, `return`, `continue` or `process.exit` (" + LANGUAGE + " has no implicit fallthrough; leave a clause empty to give several labels one body)"
      );
    }
    lastTerminates = terminates;
    i = i + 1;
  }
  const broke = ctx.popLoop();
  // Anything no clause names reaches the statement after the `switch` unless
  // a `default` catches it, and so does a `break` or a last clause that falls
  // out of the bottom.
  return hasDefault && !broke && lastTerminates;
}

/**
 * A `case` label: the same type as the discriminant, and a value LLVM's
 * `switch` table can hold — an integer literal, its negation, or a module
 * constant, which is where a program's token and node kinds live.
 */
function checkCaseLabel(ctx: CheckContext, clause: Node, scope: Scope, discriminant: i32, seen: i64[]): void {
  const label = clause.children[0];
  const type = checkExpression(ctx, label, scope, discriminant);
  if (type !== T_ERROR && discriminant !== T_ERROR && type !== discriminant) {
    ctx.error(
      label,
      `\`case\` label is ${ctx.table.typeName(type)} but the discriminant is ${ctx.table.typeName(discriminant)}`
    );
    return;
  }
  const value = caseValue(ctx, label);
  if (!value.known) {
    ctx.error(
      label,
      "`case` label must be an integer literal or a module constant (LLVM's `switch` table holds constants)"
    );
    return;
  }
  for (const previous of seen) {
    if (previous === value.value) {
      ctx.error(label, `Duplicate \`case\` label \`${value.value}\` in this \`switch\``);
      return;
    }
  }
  seen.push(value.value);
  ctx.program.nodeCaseValues[clause.id] = value.value;
}

function checkBreak(ctx: CheckContext, stmt: Node): boolean {
  if (ctx.loopKinds.length === 0) {
    ctx.error(stmt, "`break` outside of a loop or `switch`");
    return true;
  }
  ctx.loopBreaks[ctx.loopBreaks.length - 1] = true;
  return true;
}

function checkContinue(ctx: CheckContext, stmt: Node): boolean {
  // A `switch` on the stack is a `break` target only: `continue` inside one
  // belongs to the enclosing loop, as it does in JavaScript.
  let inLoop = false;
  for (const kind of ctx.loopKinds) {
    if (kind === LOOP_ITERATION) {
      inLoop = true;
    }
  }
  if (!inLoop) {
    ctx.error(stmt, "`continue` outside of a loop");
  }
  return true;
}
