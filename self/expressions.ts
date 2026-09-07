// Expression checking for stage1 (`src/checker/expressions.ts`,
// docs/wp14-selfhost.md milestone S3, pass 2).
//
// **One central `switch`, not a dispatch table.** That is decision D2 of §3a,
// taken with its cost known: `src/checker/arrays.ts` adds `for...of` by
// writing one line into a table and touching no other file, and here
// `checkExpression` must name every construct. The reasons it still wins are
// that a `switch` on a node kind lowers to an LLVM `switch` and therefore a
// jump table, and that a table of function values needs function pointers,
// which StaticTS does not have.
//
// **The contextual type is threaded down, not walked up.** stage0 asks
// `expr.parent` what type a bare literal should take; the tree here has no
// parent pointers, so every checker takes a `want` — the type this expression
// is being checked *into*, or -1 for none. It is a hint and never a coercion:
// the result is still checked against what the sink expects.

import { CheckContext } from "./context";
import { checkArrayLiteral, checkIndex, checkIndexAssignment } from "./arrays";
import { checkBuiltinCall, checkBuiltinFunction, isBuiltinFunction } from "./builtins";
import {
  checkMember,
  checkMemberAssignment,
  checkMethodCall,
  checkNew,
  checkObjectLiteral,
  checkSuperCall,
  isValueReceiver,
} from "./members";
import {
  FLAG_POSTFIX,
  N_ARRAY,
  N_BIGINT,
  N_BINARY,
  N_CALL,
  N_CONDITIONAL,
  N_FALSE,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NEW,
  N_NULL,
  N_NUMBER,
  N_OBJECT,
  N_PAREN,
  N_STRING,
  N_SUPER,
  N_TEMPLATE,
  N_TEMPLATE_TEXT,
  N_THIS,
  N_TRUE,
  N_UNARY,
  Node,
} from "./nodes";
import { coercesTo } from "./structs";
import { Local, STORAGE_PARAM, Scope } from "./symbols";
import {
  intBits,
  isFloat,
  isInteger,
  isNumeric,
  isUnsigned,
  T_BOOL,
  T_ERROR,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_VOID,
} from "./types";

/**
 * The type an expression has, recorded on the node for the emitter to read.
 *
 * A class value sitting where a base class or an implemented interface is
 * expected is *coerced* here: the node records the target type, and the
 * original goes in `nodeCoercions` so the emitter knows to insert the one
 * `bitcast`. Doing it in this one place is what stage0's `coerceToContext`
 * does from the checker core, and it is why no individual checker has to
 * know about upcasts.
 */
export function checkExpression(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  const type = computeType(ctx, expr, scope, want);
  if (coercesTo(ctx, type, want)) {
    const target = ctx.table.stripNull(want);
    ctx.program.nodeCoercions[expr.id] = type;
    ctx.program.nodeTypes[expr.id] = target;
    return target;
  }
  ctx.program.nodeTypes[expr.id] = type;
  return type;
}

function computeType(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  switch (expr.kind) {
    case N_PAREN:
      return checkExpression(ctx, expr.children[0], scope, want);
    case N_NUMBER:
      return checkNumericLiteral(ctx, expr, want, false);
    case N_BIGINT:
      return ctx.errorType(expr, "Bigint literals are forbidden in StaticTS; use the `i64` type");
    case N_STRING:
      return T_STRING;
    case N_TEMPLATE:
      return checkTemplate(ctx, expr, scope);
    case N_TRUE:
      return T_BOOL;
    case N_FALSE:
      return T_BOOL;
    case N_NULL:
      return checkNull(ctx, expr, want);
    case N_IDENT:
      return checkIdentifier(ctx, expr, scope);
    case N_THIS:
      return checkThis(ctx, expr, scope);
    case N_UNARY:
      return checkUnary(ctx, expr, scope, want);
    case N_BINARY:
      return checkBinary(ctx, expr, scope, want);
    case N_CONDITIONAL:
      return checkConditional(ctx, expr, scope, want);
    case N_CALL:
      return checkCall(ctx, expr, scope);
    case N_NEW:
      return checkNew(ctx, expr, scope);
    case N_MEMBER:
      return checkMember(ctx, expr, scope);
    case N_INDEX:
      return checkIndex(ctx, expr, scope);
    case N_ARRAY:
      return checkArrayLiteral(ctx, expr, scope, want);
    case N_OBJECT:
      return checkObjectLiteral(ctx, expr, scope, want);
    case N_SUPER:
      return ctx.errorType(expr, "`super` is only available as `super(...)` or `super.method(...)`");
    default:
      return ctx.errorType(expr, `Unsupported expression \`${ctx.textOf(expr)}\``);
  }
}

/**
 * A numeric literal takes its type from context: `let x: i64 = 5` is an `i64`
 * five and `Math.sqrt(2)` an `f64` two. Without a context it is `number`,
 * which is `i32` unless `--number-mode f64`.
 */
export function checkNumericLiteral(ctx: CheckContext, expr: Node, want: i32, negated: boolean): i32 {
  const type = want >= 0 && isNumeric(want) ? want : ctx.numberType();
  if (isFloat(type)) {
    return type;
  }
  const text = expr.text;
  if (hasFraction(text)) {
    // The wording says where the integer type came from: an explicit context
    // names it, and otherwise it is the number mode.
    const where =
      want >= 0 && isNumeric(want)
        ? `where ${ctx.table.typeName(want)} is expected`
        : "in i32 number mode (use --number-mode f64)";
    return ctx.errorType(expr, `Non-integer literal \`${text}\` ${where}`);
  }
  if (type === T_I32 && !fitsInI32(text, negated)) {
    return ctx.errorType(expr, `Literal \`${text}\` does not fit in i32`);
  }
  if (isUnsigned(type)) {
    const spelled = ctx.table.typeName(type);
    if (negated) {
      return ctx.errorType(
        expr,
        `Negative literal \`-${text}\` where ${spelled} is expected (${spelled} is unsigned)`
      );
    }
    // 2^bits - 1 as an f64: exact for every width up to u64, where the
    // largest values are past 2^53 and cannot be written at all.
    const bits = intBits(type);
    const limit: f64 = bits === 64 ? 18446744073709551615.0 : Math.pow(2.0, toF64(bits)) - 1.0;
    if (Number(text) > limit) {
      return ctx.errorType(expr, `Literal \`${text}\` does not fit in ${spelled}`);
    }
  }
  return type;
}

/** Whether a literal as written has a fraction or an exponent. */
function hasFraction(text: string): boolean {
  if (text.startsWith("0x") || text.startsWith("0X") || text.startsWith("0b") || text.startsWith("0o")) {
    return false;
  }
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === 46) {
      return true; // a `.`; an exponent alone is still an integer value
    }
    i = i + 1;
  }
  return Number(text) !== Math.floor(Number(text));
}

/** `-2147483648` parses as minus applied to 2147483648; that exact form is allowed. */
function fitsInI32(text: string, negated: boolean): boolean {
  const limit: f64 = negated ? 2147483648.0 : 2147483647.0;
  return Number(text) <= limit;
}

function checkTemplate(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  for (const part of expr.children) {
    if (part.kind === N_TEMPLATE_TEXT) {
      continue;
    }
    const hole = checkExpression(ctx, part, scope, -1);
    if (hole === T_ERROR) {
      continue;
    }
    if (!isNumeric(hole) && hole !== T_BOOL && hole !== T_STRING) {
      const spelled = ctx.table.typeName(hole);
      ctx.error(part, `Template literal hole must be string, number, or boolean, got ${spelled}`);
    }
  }
  return T_STRING;
}

function checkNull(ctx: CheckContext, expr: Node, want: i32): i32 {
  if (want < 0) {
    return ctx.errorType(
      expr,
      "`null` needs a contextual `T | null` type (annotate the variable, e.g. `let p: P | null = null`)"
    );
  }
  if (ctx.table.isNullable(want)) {
    return want;
  }
  // A pointer slot that is not nullable: the fix is the annotation, and the
  // message names the type the reader already wrote.
  if (ctx.table.isPointer(want)) {
    const spelled = ctx.table.typeName(want);
    return ctx.errorType(expr, `\`null\` is not a ${spelled}; declare the type as \`${spelled} | null\``);
  }
  return ctx.errorType(
    expr,
    "`null` needs a contextual `T | null` type (annotate the variable, e.g. `let p: P | null = null`)"
  );
}

function checkIdentifier(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const local = scope.lookup(expr.text);
  if (local !== null) {
    ctx.program.nodeLocals[expr.id] = local;
    return scope.typeOf(local); // the declared type, or the narrowed one inside `if (p !== null)`
  }
  // A local shadows a module constant, as it would in TypeScript, so the
  // constant table is consulted only after the scope chain.
  const constant = ctx.program.constant(expr.text);
  if (constant !== null) {
    ctx.program.nodeConstants[expr.id] = constant;
    return constant.type;
  }
  return ctx.errorType(expr, `Unknown identifier \`${expr.text}\``);
}

function checkThis(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const self = scope.lookup("this");
  if (self === null) {
    return ctx.errorType(expr, "`this` is only valid inside a method or constructor");
  }
  ctx.program.nodeLocals[expr.id] = self;
  return self.type;
}

// ---- Operators ---------------------------------------------------------------------

function checkUnary(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  const op = expr.text;
  const operand = expr.children[0];
  if (op === "++" || op === "--") {
    return checkIncrement(ctx, expr, scope);
  }
  if (op === "-" && operand.kind === N_NUMBER) {
    // The negation is part of the literal, which is what makes `-2147483648`
    // spell `INT_MIN` rather than overflowing the positive half.
    const type = checkNumericLiteral(ctx, operand, want, true);
    ctx.program.nodeTypes[operand.id] = type;
    return type;
  }
  const type = checkExpression(ctx, operand, scope, want);
  if (type === T_ERROR) {
    return T_ERROR;
  }
  if (op === "-") {
    if (!isNumeric(type)) {
      return ctx.errorType(expr, `Unsupported unary operator \`-\` on ${ctx.table.typeName(type)}`);
    }
    return type;
  }
  if (op === "!") {
    if (type !== T_BOOL) {
      return ctx.errorType(expr, `Unsupported unary operator \`!\` on ${ctx.table.typeName(type)}`);
    }
    return T_BOOL;
  }
  if (op === "~") {
    if (!isInteger(type)) {
      return ctx.errorType(
        expr,
        `Operator \`~\` requires an integer operand, got ${ctx.table.typeName(type)}`
      );
    }
    return type;
  }
  if (op === "+") {
    return ctx.errorType(expr, "Unary `+` is forbidden; it converts, and StaticTS has no conversions");
  }
  return ctx.errorType(expr, `Unsupported unary operator \`${op}\``);
}

/** `++x`, `x--`: an assignment in disguise, so the target's rules apply. */
function checkIncrement(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const target = expr.children[0];
  const type = checkExpression(ctx, target, scope, -1);
  if (type === T_ERROR) {
    return T_ERROR;
  }
  if (!isNumeric(type)) {
    return ctx.errorType(
      expr,
      `Operator \`${expr.text}\` requires a numeric operand, got ${ctx.table.typeName(type)}`
    );
  }
  if (target.kind === N_IDENT) {
    const local = scope.lookup(target.text);
    if (local === null) {
      if (ctx.program.constant(target.text) !== null) {
        return ctx.errorType(target, `Cannot assign to \`${target.text}\` because it is a module constant`);
      }
      return T_ERROR;
    }
    if (!local.mutable) {
      const what = local.storage === STORAGE_PARAM ? "parameter" : "const";
      return ctx.errorType(target, `Cannot assign to \`${local.name}\` because it is a ${what}`);
    }
    scope.clearNarrowing(local);
  }
  return type;
}

/**
 * Whether an operator writes to its left operand. The parser has its own
 * `isAssignment` over *token kinds*; this one reads the operator text a
 * `N_BINARY` node carries, which is what the checker has.
 */
function writesLeft(op: string): boolean {
  return op === "=" || (op.length > 1 && op.endsWith("=") && !yieldsBool(op));
}

/**
 * Operators that answer a boolean whatever their operands are. Their result
 * type says nothing about the operands, so a literal on one side takes its
 * width from the other rather than from the context: `kind === 3` folds with
 * `kind` an `i64`, and `x < 1.0` makes `1.0` an `f64`.
 */
function yieldsBool(op: string): boolean {
  return (
    op === "===" ||
    op === "!==" ||
    op === "==" ||
    op === "!=" ||
    op === "<" ||
    op === "<=" ||
    op === ">" ||
    op === ">="
  );
}

/** The arithmetic behind a compound assignment: `+=` is `+`. */
function compoundOperator(op: string): string {
  return op.substring(0, op.length - 1);
}

function checkBinary(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  const op = expr.text;
  if (op === "==" || op === "!=") {
    return ctx.errorType(expr, "Loose equality is forbidden; use === / !==");
  }
  if (writesLeft(op)) {
    return checkAssignment(ctx, expr, scope);
  }
  if (op === "&&" || op === "||") {
    return checkLogical(ctx, expr, scope);
  }
  return checkOperator(ctx, expr, op, expr.children[0], expr.children[1], scope, want);
}

/** `a op b` for every operator that reads both sides and writes neither. */
function checkOperator(
  ctx: CheckContext,
  expr: Node,
  op: string,
  leftNode: Node,
  rightNode: Node,
  scope: Scope,
  want: i32
): i32 {
  // A bare literal takes its width from the other side, which is what makes
  // `kind === 3` work when `kind` is an `i64`.
  const hint = yieldsBool(op) || isShift(op) ? -1 : want;
  let left = T_ERROR;
  let right = T_ERROR;
  if (leftNode.kind === N_NUMBER && rightNode.kind !== N_NUMBER) {
    right = checkExpression(ctx, rightNode, scope, hint);
    left = checkExpression(ctx, leftNode, scope, hint < 0 ? right : hint);
  } else {
    left = checkExpression(ctx, leftNode, scope, hint);
    right = checkExpression(ctx, rightNode, scope, hint < 0 ? left : hint);
  }
  if (left === T_ERROR || right === T_ERROR) {
    return T_ERROR;
  }
  const a = ctx.table.typeName(left);
  const b = ctx.table.typeName(right);

  if (op === "+") {
    if (left === T_STRING && right === T_STRING) {
      return T_STRING;
    }
    if (!isNumeric(left) || left !== right) {
      const hint =
        left === T_STRING || right === T_STRING
          ? " (no implicit string conversion; use a template literal)"
          : "";
      return ctx.errorType(
        expr,
        `Operator \`+\` requires two operands of the same numeric type or two strings, got ${a} and ${b}${hint}`
      );
    }
    return left;
  }
  if (op === "===" || op === "!==") {
    return checkEquality(ctx, expr, op, left, right, leftNode, rightNode);
  }
  if (op === "<" || op === "<=" || op === ">" || op === ">=") {
    if (left !== right || !isNumeric(left)) {
      return ctx.errorType(expr, `Operator \`${op}\` requires two numeric operands, got ${a} and ${b}`);
    }
    return T_BOOL;
  }
  if (isShift(op) || op === "&" || op === "|" || op === "^") {
    if (left === T_BOOL || right === T_BOOL) {
      return ctx.errorType(expr, `Operator \`${op}\` is not available on boolean${booleanAlternative(op)}`);
    }
    if (!isInteger(left) || left !== right) {
      return ctx.errorType(
        expr,
        `Operator \`${op}\` requires two operands of the same integer type, got ${a} and ${b}${f64Hint(ctx, left, right)}`
      );
    }
    return left;
  }
  if (op === "-" || op === "*" || op === "/" || op === "%") {
    if (!isNumeric(left) || left !== right) {
      return ctx.errorType(
        expr,
        `Operator \`${op}\` requires two operands of the same numeric type, got ${a} and ${b}`
      );
    }
    return left;
  }
  return ctx.errorType(expr, `Unsupported binary operator \`${op}\``);
}

/** The operator that *is* defined on booleans, named in the refusal. */
function booleanAlternative(op: string): string {
  if (op === "&" || op === "&=") {
    return " (use `&&`)";
  }
  if (op === "|" || op === "|=") {
    return " (use `||`)";
  }
  if (op === "^" || op === "^=") {
    return " (use `!==`)";
  }
  return "";
}

/**
 * An `f64` reaching a bit operator is usually plain `number` under
 * `--number-mode f64` rather than a deliberate annotation, so say so: the fix
 * is `toI32(x)`, not a different operator.
 */
function f64Hint(ctx: CheckContext, left: i32, right: i32): string {
  const fromMode = ctx.numberType() === T_F64 && (left === T_F64 || right === T_F64);
  return fromMode ? " (`number` is f64 under --number-mode f64; convert with toI32/toI64)" : "";
}

function isShift(op: string): boolean {
  return op === "<<" || op === ">>" || op === ">>>";
}

/**
 * `===` and `!==`: numbers and booleans by value, strings by content, classes,
 * interfaces and arrays by identity. A nullable may only be compared with
 * `null`, which the narrowing rules depend on.
 */
function checkEquality(
  ctx: CheckContext,
  expr: Node,
  op: string,
  left: i32,
  right: i32,
  leftNode: Node,
  rightNode: Node
): i32 {
  const a = ctx.table.typeName(left);
  const b = ctx.table.typeName(right);
  if (left !== right || left === T_VOID) {
    if (ctx.table.isNullable(left) || ctx.table.isNullable(right)) {
      return ctx.errorType(
        expr,
        `Cannot compare ${a} with ${b} using \`${op}\`; check the nullable side against \`null\` first, then compare the narrowed values`
      );
    }
    return ctx.errorType(
      expr,
      `Operator \`${op}\` requires two operands of the same type, got ${a} and ${b}`
    );
  }
  // Two `T | null` values: neither is narrowed, so a pointer compare would
  // answer a question about identity that the reader did not ask.
  if (ctx.table.isNullable(left) && leftNode.kind !== N_NULL && rightNode.kind !== N_NULL) {
    return ctx.errorType(
      expr,
      `Cannot compare two \`${a}\` values; compare each with \`null\` and then compare the narrowed values`
    );
  }
  return T_BOOL;
}

function checkLogical(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const left = checkExpression(ctx, expr.children[0], scope, T_BOOL);
  // The right operand is checked where the left one has already decided: in
  // `p !== null && p.value`, `p` is narrowed for the right-hand side.
  const guarded = scope.child();
  narrow(ctx, expr.children[0], guarded, expr.text === "&&");
  const right = checkExpression(ctx, expr.children[1], guarded, T_BOOL);
  if (left === T_ERROR || right === T_ERROR) {
    return T_ERROR;
  }
  if (left !== T_BOOL || right !== T_BOOL) {
    const a = ctx.table.typeName(left);
    const b = ctx.table.typeName(right);
    return ctx.errorType(expr, `Operator \`${expr.text}\` requires boolean operands, got ${a} and ${b}`);
  }
  return T_BOOL;
}

function checkConditional(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  checkCondition(ctx, expr.children[0], scope);
  const thenScope = scope.child();
  narrow(ctx, expr.children[0], thenScope, true);
  const elseScope = scope.child();
  narrow(ctx, expr.children[0], elseScope, false);
  const whenTrue = checkExpression(ctx, expr.children[1], thenScope, want);
  const whenFalse = checkExpression(ctx, expr.children[2], elseScope, want);
  if (whenTrue === T_ERROR || whenFalse === T_ERROR) {
    return T_ERROR;
  }
  if (whenTrue === whenFalse) {
    return whenTrue;
  }
  // `c ? p : null` is `T | null`, which is the one place the arms may differ.
  if (ctx.table.assignable(whenFalse, whenTrue)) {
    return whenTrue;
  }
  if (ctx.table.assignable(whenTrue, whenFalse)) {
    return whenFalse;
  }
  const a = ctx.table.typeName(whenTrue);
  const b = ctx.table.typeName(whenFalse);
  return ctx.errorType(expr, `Ternary branches must have the same type, got ${a} and ${b}`);
}

/** A condition is a boolean: StaticTS has no truthiness. */
export function checkCondition(ctx: CheckContext, expr: Node, scope: Scope): void {
  const type = checkExpression(ctx, expr, scope, T_BOOL);
  if (type !== T_BOOL && type !== T_ERROR) {
    ctx.error(expr, `Condition must be boolean, got ${ctx.table.typeName(type)}`);
  }
}

// ---- Narrowing ---------------------------------------------------------------------

/**
 * Apply what `cond` proves to `scope`, for the region where it holds.
 *
 * Only a *variable* narrows — a local, a parameter or `this` — never a
 * property path: `if (n.next !== null) n.next.v` is rejected because a sound
 * rule would have to invalidate on every call, and the checker runs before
 * the effect facts that could prove a callee harmless. The idiom
 * `const next = n.next; if (next !== null)` is one line and one load.
 */
export function narrow(ctx: CheckContext, cond: Node, scope: Scope, whenTrue: boolean): void {
  switch (cond.kind) {
    case N_PAREN:
      narrow(ctx, cond.children[0], scope, whenTrue);
      return;
    case N_UNARY:
      if (cond.text === "!") {
        narrow(ctx, cond.children[0], scope, !whenTrue);
      }
      return;
    case N_BINARY:
      narrowBinary(ctx, cond, scope, whenTrue);
      return;
    default:
      return;
  }
}

function narrowBinary(ctx: CheckContext, cond: Node, scope: Scope, whenTrue: boolean): void {
  const op = cond.text;
  if (op === "&&" && whenTrue) {
    narrow(ctx, cond.children[0], scope, true);
    narrow(ctx, cond.children[1], scope, true);
    return;
  }
  if (op === "||" && !whenTrue) {
    narrow(ctx, cond.children[0], scope, false);
    narrow(ctx, cond.children[1], scope, false);
    return;
  }
  if (op !== "===" && op !== "!==") {
    return;
  }
  const left = cond.children[0];
  const right = cond.children[1];
  const variable = right.kind === N_NULL ? left : left.kind === N_NULL ? right : left;
  if (variable.kind !== N_IDENT || (right.kind !== N_NULL && left.kind !== N_NULL)) {
    return;
  }
  const local = scope.lookup(variable.text);
  if (local === null) {
    return;
  }
  const declared = scope.typeOf(local);
  if (!ctx.table.isNullable(declared)) {
    return;
  }
  // `p !== null` narrows where it holds; `p === null` narrows where it does not.
  const narrows = op === "!==" ? whenTrue : !whenTrue;
  if (narrows) {
    scope.narrow(local, ctx.table.stripNull(declared));
  }
}

// ---- Assignment ---------------------------------------------------------------------

function checkAssignment(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const target = expr.children[0];
  if (target.kind === N_MEMBER) {
    return checkMemberAssignment(ctx, expr, scope);
  }
  if (target.kind === N_INDEX) {
    return checkIndexAssignment(ctx, expr, scope);
  }
  if (target.kind !== N_IDENT) {
    return ctx.errorType(target, "Only simple variables can be assigned");
  }
  const local = scope.lookup(target.text);
  if (local === null) {
    if (ctx.program.constant(target.text) !== null) {
      return ctx.errorType(target, `Cannot assign to \`${target.text}\` because it is a module constant`);
    }
    return ctx.errorType(target, `Unknown identifier \`${target.text}\``);
  }
  if (!local.mutable) {
    const what = local.storage === STORAGE_PARAM ? "parameter" : "const";
    return ctx.errorType(target, `Cannot assign to \`${local.name}\` because it is a ${what}`);
  }
  ctx.program.nodeLocals[target.id] = local;
  return assignInto(ctx, expr, scope, local, local.type, local.name, "variable");
}

/**
 * The right-hand side of `x = v` or `x op= v`, checked against `slot`. The
 * value is read *before* the narrowing is dropped, so `cur = cur.next` sees
 * the narrowed `cur` on the right and the declared type afterwards.
 */
export function assignInto(
  ctx: CheckContext,
  expr: Node,
  scope: Scope,
  local: Local | null,
  slot: i32,
  name: string,
  what: string
): i32 {
  const op = expr.text;
  const value = expr.children[1];
  if (op === "=") {
    const rhs = checkExpression(ctx, value, scope, slot);
    if (local !== null) {
      scope.clearNarrowing(local);
    }
    if (rhs !== T_ERROR && slot !== T_ERROR && !ctx.table.assignable(rhs, slot)) {
      const got = ctx.table.typeName(rhs);
      return ctx.errorType(value, `Cannot assign ${got} to ${ctx.table.typeName(slot)} ${what} \`${name}\``);
    }
    return slot;
  }
  const arithmetic = compoundOperator(op);
  const result = checkOperator(ctx, expr, arithmetic, expr.children[0], value, scope, slot);
  if (local !== null) {
    scope.clearNarrowing(local);
  }
  if (result !== T_ERROR && slot !== T_ERROR && !ctx.table.assignable(result, slot)) {
    const got = ctx.table.typeName(result);
    return ctx.errorType(value, `Cannot assign ${got} to ${ctx.table.typeName(slot)} ${what} \`${name}\``);
  }
  return slot;
}

// ---- Calls ---------------------------------------------------------------------

function checkCall(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const callee = expr.children[0];
  if (callee.kind === N_SUPER) {
    return checkSuperCall(ctx, expr, scope);
  }
  if (callee.kind === N_MEMBER) {
    // `value.method(...)` dispatches on the receiver's type; `console.log(...)`
    // is a dotted builtin, told apart by whether the receiver is a value.
    return isValueReceiver(ctx, callee.children[0], scope)
      ? checkMethodCall(ctx, expr, scope)
      : checkBuiltinCall(ctx, expr, scope);
  }
  if (callee.kind !== N_IDENT) {
    return ctx.errorType(expr, "Only direct calls to named functions are supported");
  }
  const sig = ctx.signature(callee.text);
  if (sig === null) {
    if (isBuiltinFunction(callee.text)) {
      return checkBuiltinFunction(ctx, expr, scope);
    }
    return ctx.errorType(callee, `Unknown function \`${callee.text}\``);
  }
  const args = expr.children[1];
  if (args.children.length !== sig.paramTypes.length) {
    return ctx.errorType(
      expr,
      `\`${sig.name}\` expects ${sig.paramTypes.length} argument(s), got ${args.children.length}`
    );
  }
  let i = 0;
  while (i < args.children.length) {
    const arg = args.children[i];
    const got = checkExpression(ctx, arg, scope, sig.paramTypes[i]);
    if (got !== T_ERROR && !ctx.table.assignable(got, sig.paramTypes[i])) {
      const want = ctx.table.typeName(sig.paramTypes[i]);
      ctx.error(
        arg,
        `Argument ${i + 1} of \`${sig.name}\`: expected ${want}, got ${ctx.table.typeName(got)}`
      );
    }
    i = i + 1;
  }
  ctx.program.nodeCallees[expr.id] = sig;
  return sig.returnType;
}

/** Check every argument of a call against one expected type, for the builtins. */
export function checkArguments(ctx: CheckContext, args: Node, scope: Scope, want: i32): void {
  for (const arg of args.children) {
    checkExpression(ctx, arg, scope, want);
  }
}
