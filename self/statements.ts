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
import {
  checkCondition,
  checkExpression,
  clearNarrowingsAssignedIn,
  narrow,
  resolveMaybeAnnotation,
  WANT_MAYBE,
} from "./expressions";
import { isMaybeAnnotation } from "./validator";
import { CheckContext, LOOP_ITERATION, LOOP_SWITCH } from "./context";
import { resolveType } from "./annotations";
import { declaredOrigin, elementOrigin, isCollectionStruct } from "./generics";
import { structOf, walkReaderOf } from "./members";
import { recordGuardFusion } from "./fusion";
import { unwrapParens } from "./emit_util";
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
import { Local, STORAGE_LOCAL, Scope, TypeOrigin } from "./symbols";
import { isInteger, T_BOOL, T_ERROR, T_VOID } from "./types";

/** How a terminating statement is named in the unreachable-code diagnostic. */
const terminatorName = (stmt: Node): string => {
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
};

/** A statement list in its own scope; true when the list terminates the path. */
export const checkBlock = (ctx: CheckContext, block: Node, scope: Scope): boolean => checkStatements(ctx, block.children, scope.child());

/** A statement list in `scope`; the caller decides whether that is a new one. */
export const checkStatements = (ctx: CheckContext, stmts: Node[], scope: Scope): boolean => {
  // A list *inside* a statement that has already been refused is never reached
  // in stage0: the throw left the enclosing statement, clause bodies and all.
  // Without this the loop below would clear `errored` on the clause's first
  // statement and start reporting again inside a `switch` stage0 had
  // abandoned at its discriminant (`tests/cases/cf_switch_break` in f64 mode).
  if (ctx.errored) {
    return false;
  }
  let terminator: Node | null = null;
  for (const stmt of stmts) {
    // The recovery point, and the reason it is *here*: stage0 wraps each
    // statement of each list in its own `try`, so a `CompileError` thrown from
    // anywhere inside one statement costs exactly that statement's worth of
    // checking and the next statement starts clean
    // (`checkStatements` in `src/checker/statements.ts`). `errored` is this
    // file's throw, so it is cleared exactly where that `catch` is.
    ctx.errored = false;
    const before = terminator;
    if (before !== null) {
      ctx.error(stmt, `Unreachable code after ${terminatorName(before)}`);
      terminator = null; // report once per list, then keep checking
    }
    if (checkStatement(ctx, stmt, scope)) {
      terminator = stmt;
    }
  }
  // A list that ran has recovered from everything inside it — that is what
  // per-statement recovery means — so the flag does not escape it. The early
  // return above deliberately leaves it set instead: a list skipped because
  // its enclosing statement was already refused has recovered from nothing,
  // and its siblings (the other clauses of a `switch`, the `else` of an `if`
  // whose condition failed) must be skipped too.
  ctx.errored = false;
  return terminator !== null;
};

export const checkStatement = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
  // This statement has been refused already: stage0's `throw` would have left
  // it by now and reported nothing further (`context.ts`, `errored`).
  // Answering "does not fall through" would invent a terminator, so this
  // answers false and the list moves on to the next statement.
  if (ctx.errored) {
    return false;
  }
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
};

const checkReturn = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
  const current = ctx.current;
  const want = current === null ? T_ERROR : current.returnType;
  const value = stmt.children[0];
  if (value.kind === N_EMPTY) {
    if (want !== T_VOID && want !== T_ERROR) {
      ctx.error(stmt, `Expected a return value of type ${ctx.table.typeName(want)}`);
    }
    return true;
  }
  checkReturnValue(ctx, value, scope);
  return true;
};

/**
 * The value of a `return`, checked against the enclosing function's return
 * type. Shared with the concise arrow body (`=> n * 2`), which means the same
 * thing as a block with one `return` (docs/wp22-arrow-functions.md).
 */
export const checkReturnValue = (ctx: CheckContext, value: Node, scope: Scope): void => {
  const current = ctx.current;
  const want = current === null ? T_ERROR : current.returnType;
  const got = checkExpression(ctx, value, scope, want);
  if (got !== T_ERROR && want !== T_ERROR && !ctx.table.assignable(got, want)) {
    ctx.error(
      value,
      `Return type mismatch: function returns ${ctx.table.typeName(want)} but expression is ${ctx.table.typeName(got)}`
    );
  }
};

/** Each `let`/`const` of a list, declared in `scope`. Shared with a `for` initializer. */
export const checkVariableList = (ctx: CheckContext, list: Node, scope: Scope): void => {
  const mutable = (list.flags & FLAG_CONST) === 0;
  for (const decl of list.children[0].children) {
    const name = decl.children[0].text;
    const annotation = decl.children[1];
    // The annotation is resolved first so that, when the initializer is
    // rejected, the variable is still declared with its declared type and
    // later statements do not report it as unknown.
    // WP32: `const a: V | undefined = m.get(k)`, the one spelling of the maybe type.
    const declared =
      annotation.kind === N_EMPTY
        ? -1
        : isMaybeAnnotation(annotation)
          ? resolveMaybeAnnotation(ctx, annotation)
          : resolveType(annotation, ctx);
    const initializer = decl.children[2];
    if (initializer.kind === N_EMPTY) {
      ctx.error(decl, `Variable \`${name}\` must be initialized`);
      const origin = declaredOrigin(ctx, annotation, initializer, scope);
      declareLocal(ctx, scope, decl, name, declared < 0 ? T_ERROR : declared, mutable, origin);
      continue;
    }
    // WP32: a `const` is one of the places a maybe may go, and a `let` is not,
    // however it is annotated, so its initialiser is refused as NL2361.
    let want = declared;
    if (!mutable && declared < 0) {
      want = WANT_MAYBE;
    } else if (mutable && ctx.table.isMaybe(declared)) {
      want = -1;
    }
    const initType = checkExpression(ctx, initializer, scope, want);
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
    // A rejected initializer leaves the variable declared only when the
    // annotation says what it is — and an annotation that did not resolve does
    // not say. Without a type there is nothing to declare it as, so it stays
    // undeclared and its later uses are `Unknown identifier` —
    // stage0's `catch` declares it in exactly the annotated case and rethrows
    // otherwise (`checkVariableDeclaration` in `src/checker/statements.ts`),
    // and the cascade that follows is the visible half of the difference
    // (WP19 §A3: `const at = m.get(k, -1)` in f64 mode).
    if (ctx.errored && (declared < 0 || declared === T_ERROR)) {
      continue;
    }
    declareLocal(ctx, scope, decl, name, type, mutable, declaredOrigin(ctx, annotation, initializer, scope));
  }
};

/**
 * `origin` is the type as a generic template wrote it, when the local is
 * declared in an instantiation's body (WP18 G6), and `null` everywhere else.
 */
const declareLocal = (
  ctx: CheckContext,
  scope: Scope,
  decl: Node,
  name: string,
  type: i32,
  mutable: boolean,
  origin: TypeOrigin | null
): void => {
  const local = new Local(name, type, mutable, STORAGE_LOCAL);
  local.origin = origin;
  if (!scope.declare(local)) {
    ctx.error(decl.children[0], `Duplicate declaration of \`${name}\``);
    return;
  }
  ctx.program.nodeLocals[decl.id] = local;
};

const checkIf = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
  checkCondition(ctx, stmt.children[0], scope);
  const thenScope = scope.child();
  narrow(ctx, stmt.children[0], thenScope, true);
  const thenTerminates = checkStatement(ctx, stmt.children[1], thenScope);
  recordGuardFusion(ctx, stmt); // WP32 S5: `if (!s.has(x)) { s.add(x); ... }` is one probe
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
};

const checkWhile = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
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
};

const checkDo = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
  clearNarrowingsAssignedIn(ctx, stmt, scope);
  ctx.pushLoop(LOOP_ITERATION);
  checkStatement(ctx, stmt.children[0], scope.child());
  const broke = ctx.popLoop();
  checkCondition(ctx, stmt.children[1], scope);
  return stmt.children[1].kind === N_TRUE && !broke;
};

const checkFor = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
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
};

const checkForOf = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
  clearNarrowingsAssignedIn(ctx, stmt, scope);
  // The head, before the iterable, in stage0's order (`src/checker/arrays.ts`).
  // The parser reads `for (const x = 0, y = 1 of a)` and `for (const x: i32 of
  // a)` without complaint, because the grammar it uses for the head is the
  // ordinary variable-declaration one; the rules about what a `for...of` head
  // may say belong to the checker, and stage1 was missing all three of them.
  // It compiled the first of those, bound `x`, and dropped `y` on the floor.
  const list = stmt.children[0].children[0];
  if (list.children.length !== 1) {
    // At the declaration, not at its first declarator: stage0's caret is under
    // `const`, and `stmt.children[0]` is the node that starts there.
    ctx.error(stmt.children[0], "`for...of` declares exactly one variable");
    return false;
  }
  const decl = list.children[0];
  if (decl.children[1].kind !== N_EMPTY) {
    ctx.error(decl.children[1], "The `for...of` variable takes the element type; remove the annotation");
    return false;
  }
  if (decl.children[2].kind !== N_EMPTY) {
    ctx.error(decl.children[2], "The `for...of` variable cannot have an initializer");
    return false;
  }
  // WP32: `m.keys()` and `m.values()` are legal here and nowhere else, which
  // `checkMethodCall` learns from `forOfWalk` (docs/wp32-map.md §6.2).
  ctx.forOfWalk = stmt;
  const iterable = checkExpression(ctx, stmt.children[1], scope, -1);
  ctx.forOfWalk = null;
  const outer = scope.child();
  const name = decl.children[0].text;
  let element = T_ERROR;
  if (ctx.program.nodeCallees[stmt.id] === null && iterable !== T_ERROR) {
    if (ctx.table.isArray(iterable)) {
      element = ctx.table.refOf(iterable);
    } else if (!checkCollectionWalk(ctx, stmt, iterable)) {
      ctx.error(stmt.children[1], `\`for...of\` requires an array, got ${ctx.table.typeName(iterable)}`);
    }
  }
  // WP32: a walk's reader, recorded by `checkWalkIterable` or `checkCollectionWalk`, gives its variable its type.
  const walked = ctx.program.nodeCallees[stmt.id];
  if (walked !== null) {
    element = walked.returnType;
  }
  // `for (let x of a)` binds a mutable element, `for (const x of a)` does not,
  // and an element of a `T[]` came from `T` (WP18 G6).
  const origin = elementOrigin(ctx, stmt.children[1], scope);
  declareLocal(ctx, outer, decl, name, element, (stmt.children[0].flags & FLAG_CONST) === 0, origin);
  ctx.pushLoop(LOOP_ITERATION);
  checkStatement(ctx, stmt.children[2], outer.child());
  ctx.popLoop();
  return false;
};

/**
 * WP32: `for (const x of s)` over the global `Set` walks it as `s.values()`
 * does, and records the reader, `keyAt`, on the loop (docs/wp32-map.md §6.3).
 * The same loop over a `Map` is refused: JavaScript walks its `entries()`,
 * `[key, value]` pairs that need destructuring. Answers whether `iterable` was
 * one of the two, having reported the second.
 */
const checkCollectionWalk = (ctx: CheckContext, stmt: Node, iterable: i32): boolean => {
  if (!ctx.table.isStruct(iterable) || ctx.table.isNullable(iterable)) {
    return false;
  }
  const info = structOf(ctx, iterable);
  if (info === null || !isCollectionStruct(info) || ctx.program.isCollections()) {
    return false;
  }
  const instance = info.instance;
  if (instance !== null && instance.template.sourceName === "Map") {
    ctx.error(
      stmt.children[1],
      `\`for...of\` over \`${ctx.table.typeName(iterable)}\` needs \`entries()\`, whose \`[key, value]\` pairs need destructuring, which this version does not have: walk \`keys()\` or \`values()\` instead, as in \`for (const k of ${ctx.textOf(unwrapParens(stmt.children[1]))}.keys())\``
    );
    return true;
  }
  ctx.program.nodeCallees[stmt.id] = walkReaderOf(ctx, info, "values");
  return true;
};

/**
 * `switch (e) { case k: ...; default: ... }`.
 *
 * The discriminant is an integer and every label a compile-time integer
 * constant, so the whole statement lowers to LLVM's `switch` and the backend
 * builds a jump table. A `string` switch would have been a chain of
 * `nish_str_eq` calls wearing a switch's clothes, and `if`/`else` says that
 * honestly (docs/wp14-selfhost.md §5).
 *
 * There is no implicit fallthrough: a clause with statements ends in `break`,
 * `return`, `continue` or `process.exit`, and only the last clause
 * may fall out. An *empty* clause does fall through, which is how
 * `case 1: case 2:` gives a group of labels one body.
 */
const checkSwitch = (ctx: CheckContext, stmt: Node, scope: Scope): boolean => {
  const discriminant = checkExpression(ctx, stmt.children[0], scope, -1);
  // WP23: an enum is an `i32` in the jump table and a type of its own to the
  // checker, so it switches exactly as an integer does — and a `case` label of
  // any other type is caught below, which is what stops `case 1:` standing in
  // for `case Kind.If:`.
  if (discriminant !== T_ERROR && !isInteger(discriminant) && !ctx.table.isEnum(discriminant)) {
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
};

/**
 * A `case` label: the same type as the discriminant, and a value LLVM's
 * `switch` table can hold — an integer literal, its negation, a module
 * constant, or an enum member (WP23), which are the three places a program's
 * token and node kinds live.
 */
const checkCaseLabel = (ctx: CheckContext, clause: Node, scope: Scope, discriminant: i32, seen: i64[]): void => {
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
      "`case` label must be an integer literal, a module constant, or an enum member (LLVM's `switch` table holds constants)"
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
};

const checkBreak = (ctx: CheckContext, stmt: Node): boolean => {
  if (ctx.loopKinds.length === 0) {
    ctx.error(stmt, "`break` outside of a loop or `switch`");
    return true;
  }
  ctx.loopBreaks[ctx.loopBreaks.length - 1] = true;
  return true;
};

const checkContinue = (ctx: CheckContext, stmt: Node): boolean => {
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
};
