// Expression checking for stage1 (`src/checker/expressions.ts`,
// docs/wp14-selfhost.md milestone S3, pass 2).
//
// **One central `switch`, not a dispatch table.** That is decision D2 of §3a,
// taken with its cost known: `src/checker/arrays.ts` adds `for...of` by
// writing one line into a table and touching no other file, and here
// `checkExpression` must name every construct. The reasons it still wins are
// that a `switch` on a node kind lowers to an LLVM `switch` and therefore a
// jump table, and that a table of function values needs function pointers,
// which the language does not have.
//
// **The contextual type is threaded down, not walked up.** stage0 asks
// `expr.parent` what type a bare literal should take; the tree here has no
// parent pointers, so every checker takes a `want` — the type this expression
// is being checked *into*, or -1 for none. It is a hint and never a coercion:
// the result is still checked against what the sink expects.

import { LANGUAGE } from "./branding";
import { checkGenericCall } from "./generics";
import { CheckContext } from "./context";
import { checkArrayLiteral, checkIndex, checkIndexAssignment } from "./arrays";
import {
  checkBuiltinCall,
  checkBuiltinFunction,
  checkBuiltinFunctionNamed,
  checkImportedDottedBuiltin,
  checkNamespaceProperty,
  isBuiltinFunction,
} from "./builtins";
import { BuiltinExport } from "./nish_modules";
import { checkResultConstructor, isResultConstructor, narrowResultTest } from "./result";
import {
  checkMember,
  checkMemberAssignment,
  checkMethodCall,
  checkNew,
  checkObjectLiteral,
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
 * A class value sitting where an interface it implements is expected is
 * *coerced* here: the node records the target type, and the
 * original goes in `nodeCoercions` so the emitter knows to insert the one
 * `bitcast`. Doing it in this one place is what stage0's `coerceToContext`
 * does from the checker core, and it is why no individual checker has to
 * know about upcasts.
 */
export function checkExpression(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  // Refused already: stage0 unwound out of this statement at the first
  // diagnostic and never checked the rest of the expression either
  // (`context.ts`, `errored`). `T_ERROR` is what every caller here already
  // handles, and it does not report a second time.
  if (ctx.errored) {
    return T_ERROR;
  }
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
      return checkNumericLiteral(ctx, expr, want, false, expr);
    case N_BIGINT:
      return ctx.errorType(expr, "`bigint` literals are forbidden in " + LANGUAGE + " (use number, i32, or f64)");
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
      return checkCall(ctx, expr, scope, want);
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
      // WP25. Every spelling of `super` lands here -- `super(...)` and
      // `super.m()` are routed through the callee and the receiver -- so the
      // rule is stated once, on the `super` token, as stage0 states it.
      return ctx.errorType(
        expr,
        "`super` is not supported: Nish has no inheritance, so a class has no base class to reach"
      );
    default:
      return ctx.errorType(expr, `Unsupported expression \`${ctx.textOf(expr)}\``);
  }
}

/**
 * A numeric literal takes its type from context: `let x: i64 = 5` is an `i64`
 * five and `Math.sqrt(2)` an `f64` two. Without a context it is `number`,
 * which is `i32` unless `--number-mode f64`.
 */
export function checkNumericLiteral(
  ctx: CheckContext,
  expr: Node,
  want: i32,
  negated: boolean,
  at: Node
): i32 {
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
        at,
        `Negative literal \`-${text}\` where ${spelled} is expected (${spelled} is unsigned)`
      );
    }
    // Past 2^53 the literal is already the double it rounded to, whatever the
    // digits say, so the range check below would be answering a question about
    // a different number. stage0 refuses it here and stage1 was compiling it.
    if (Number(text) > TWO_53) {
      return ctx.errorType(
        expr,
        `Literal \`${text}\` exceeds 2^53 and cannot be written exactly (the parser already rounded it); compute the ${spelled} value instead`
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
  if (type === T_I64 && Math.abs(Number(text)) > TWO_53) {
    return ctx.errorType(
      expr,
      `Literal \`${text}\` exceeds 2^53 and cannot be written exactly (the parser already rounded it); compute the i64 value instead`
    );
  }
  return type;
}

/** 2^53: above it not every integer has a double, so a bigger literal is already rounded. */
const TWO_53: f64 = 9007199254740992.0;

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
  // A `nish:` import of a property builtin (`argv`, `platform`) is read as a
  // value rather than called, so it lands here, and after the scope chain for
  // the reason a module constant is: a local of the same name shadows it.
  const imported = ctx.program.builtinImport(expr.text);
  if (imported !== null) {
    if (!imported.isProperty) {
      return ctx.errorType(expr, `\`${expr.text}\` is a builtin function and can only be called`);
    }
    ctx.program.nodeBuiltins[expr.id] = imported.canonical;
    return checkNamespaceProperty(ctx, expr, imported.namespace, imported.member);
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
    // `at` is the whole `-1`: stage0 hands the literal's *parent* to the
    // refusal so the caret covers the sign (`contextualLiteralType` in
    // `src/checker/math.ts`), and the digits alone start a column late.
    const type = checkNumericLiteral(ctx, operand, want, true, expr);
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
      // With the same hint the binary operators carry: an `f64` here is
      // usually the mode's `number` rather than a deliberate annotation
      // (`checkBitwiseNot` in `src/checker/bitwise.ts`).
      return ctx.errorType(
        expr,
        `Operator \`~\` requires an integer operand, got ${ctx.table.typeName(type)}${f64Hint(ctx, type, type)}`
      );
    }
    return type;
  }
  if (op === "+") {
    return ctx.errorType(
      expr,
      "Unary `+` is forbidden; it converts, and " + LANGUAGE + " has no conversions"
    );
  }
  return ctx.errorType(expr, `Unsupported unary operator \`${op}\``);
}

/** `++x`, `x--`: an assignment in disguise, so the target's rules apply. */
function checkIncrement(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const target = expr.children[0];
  // The target is resolved before the operand is checked, as stage0's
  // `resolveMutableTarget` does, so `p.f++` is refused for being a field
  // rather than for whatever type the field turns out to have.
  if (target.kind !== N_IDENT) {
    return ctx.errorType(target, "Only simple variables can be assigned");
  }
  const type = checkExpression(ctx, target, scope, -1);
  if (type === T_ERROR) {
    return T_ERROR;
  }
  if (!isNumeric(type)) {
    return ctx.errorType(
      expr,
      `Operator \`${expr.text}\` requires a numeric variable, got ${ctx.table.typeName(type)}`
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

/** The compound assignments whose operator is bitwise rather than arithmetic. */
export function isBitwiseCompound(op: string): boolean {
  return op === "&=" || op === "|=" || op === "^=" || op === "<<=" || op === ">>=" || op === ">>>=";
}

/**
 * `x &= e`, `p.f |= e`, `a[i] ^= e`: the operand rule of `&` applied to
 * whatever the target denotes, with the refusal naming the compound token that
 * was written rather than the operator it decomposes into. The three targets
 * call this with the type of the local, the field or the element, so they are
 * accepted and refused in exactly the same words.
 */
export function checkBitwiseAssignOperands(ctx: CheckContext, expr: Node, target: i32, rhs: i32): i32 {
  const op = expr.text;
  if (target === T_ERROR || rhs === T_ERROR) {
    return T_ERROR;
  }
  if (target === T_BOOL || rhs === T_BOOL) {
    return ctx.errorType(expr, `Operator \`${op}\` is not available on boolean${booleanAlternative(op)}`);
  }
  if (!isInteger(target) || rhs !== target) {
    const a = ctx.table.typeName(target);
    const b = ctx.table.typeName(rhs);
    return ctx.errorType(
      expr,
      `Operator \`${op}\` requires two operands of the same integer type, got ${a} and ${b}${f64Hint(ctx, target, rhs)}`
    );
  }
  return target;
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
  // WP18 §2a: `identity<i32>(7)` is `(identity < i32) > (7)` to a parser with
  // one token of lookahead, which is exactly why type arguments are not written
  // at a call site. The shape is recognised here so the message names the rule
  // instead of leaving "Unknown identifier `identity`" behind, and it points at
  // the type argument, where stage0's points.
  if (op === "<" && expr.children[0].kind === N_IDENT) {
    const template = ctx.template(expr.children[0].text);
    if (template !== null) {
      const first = template.typeParams.length > 0 ? template.typeParams[0] : "T";
      return ctx.errorType(
        expr.children[1],
        `Type arguments are not written at a call site in ${LANGUAGE}: \`${first}\` is inferred from the ` +
          `arguments, so write \`${template.sourceName}(...)\``
      );
    }
  }
  return checkOperator(ctx, expr, op, expr.children[0], expr.children[1], scope);
}

/**
 * The type a bare numeric literal takes inside `a op b`: the *other operand's*,
 * whenever that is a numeric type, and only otherwise whatever the surrounding
 * context asked for.
 *
 * stage0 has no `want` to thread down here at all — `contextualLiteralType`
 * reaches a literal's binary parent and asks `peekType` about the sibling, and
 * nothing above the operator is consulted (`src/checker/math.ts`). So in f64
 * mode `toF64((ij * (ij + 1)) / 2 + i + 1)` types the `1` from `ij: i32` and
 * stays integer arithmetic, where taking the `f64` the call wants would make
 * every `+` in it mix widths (bench/spectral.ts).
 */
function literalHint(other: i32, fallback: i32): i32 {
  return isNumeric(other) ? other : fallback;
}

/**
 * Whether stage0's `peekType` would answer for this node — which is what
 * decides whether a bare literal on the *other* side may take its type.
 *
 * `docs/LANGUAGE.md` spells the list out: "an already-checked left operand, a
 * variable, a field or element of one of those, or a call to a user function
 * or to `toI32`/`toI64`/…". A sub-expression that is none of those has no type
 * yet as far as that walk is concerned, so the literal stays at the mode's
 * default: `0xc0 | (cp >> 6)` in f64 mode is an f64 meeting an i32 and is
 * refused, however obvious the shift's type looks (`self/lexer.ts` under
 * `--number-mode f64`, WP19 §A3). Reading the sibling's *computed* type
 * instead is more useful and is not what the language says.
 */
function peekable(node: Node): boolean {
  if (node.kind === N_PAREN) {
    return peekable(node.children[0]);
  }
  if (node.kind === N_UNARY) {
    return node.text === "-" && peekable(node.children[0]);
  }
  // A call is peekable only when the callee is a plain name, which is how
  // stage0 reaches a signature or a conversion builtin (`peekType`).
  if (node.kind === N_CALL) {
    return node.children[0].kind === N_IDENT;
  }
  return node.kind === N_IDENT || node.kind === N_MEMBER || node.kind === N_INDEX;
}

/** `a op b` for every operator that reads both sides and writes neither. */
function checkOperator(
  ctx: CheckContext,
  expr: Node,
  op: string,
  leftNode: Node,
  rightNode: Node,
  scope: Scope
): i32 {
  // A bare literal takes its width from the other side, which is what makes
  // `kind === 3` work when `kind` is an `i64` — and from the other side
  // *only*. The context around the operator does not reach an operand:
  // `docs/LANGUAGE.md` says so in as many words ("only the literal's
  // immediate context counts"), and stage0 enforces it by reading the sibling
  // rather than the annotation (`contextType`'s binary branch in
  // `src/checker/math.ts`). Threading `want` in made stage1 compile
  // `const b: u8 = 1 + 2`, which is a sum of two `i32` literals no annotation
  // reaches (`reject_bin_operand_context`). The sibling still propagates:
  // whichever side is checked first is what the other is checked against.
  let left = T_ERROR;
  let right = T_ERROR;
  if (leftNode.kind === N_NUMBER && rightNode.kind !== N_NUMBER) {
    right = checkExpression(ctx, rightNode, scope, -1);
    // The right operand has not been checked yet as far as stage0's walk is
    // concerned — it *peeks* at the node rather than checking it — so a shape
    // that walk does not answer for gives this literal nothing.
    left = checkExpression(ctx, leftNode, scope, peekable(rightNode) ? literalHint(right, right) : -1);
  } else {
    left = checkExpression(ctx, leftNode, scope, -1);
    // The left type is what the right side is checked against, literal or not:
    // it is the sibling for a literal and the contextual type `x === null`
    // needs for the `null`.
    right = checkExpression(
      ctx,
      rightNode,
      scope,
      rightNode.kind === N_NUMBER ? literalHint(left, left) : left
    );
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
    return ternaryResult(ctx, expr, whenTrue);
  }
  // `c ? p : null` is `T | null`, which is the one place the arms may differ.
  if (ctx.table.assignable(whenFalse, whenTrue)) {
    return ternaryResult(ctx, expr, whenTrue);
  }
  if (ctx.table.assignable(whenTrue, whenFalse)) {
    return ternaryResult(ctx, expr, whenFalse);
  }
  const a = ctx.table.typeName(whenTrue);
  const b = ctx.table.typeName(whenFalse);
  return ctx.errorType(expr, `Ternary branches must have the same type, got ${a} and ${b}`);
}

/**
 * The ternary's type, refused when it is `void`. A ternary is an expression and
 * its value is what it is for; two `void` arms agree about a type that cannot
 * be the value of anything, so the arms are where the mistake is. stage0 says
 * this at the same point and stage1 said nothing, so the two reported different
 * first diagnostics for one program (`tests/cases/reject_cf_ternary_void`).
 */
function ternaryResult(ctx: CheckContext, expr: Node, type: i32): i32 {
  if (type === T_VOID) {
    return ctx.errorType(expr, "Ternary branches cannot be void");
  }
  return type;
}

/** A condition is a boolean: the language has no truthiness. */
export function checkCondition(ctx: CheckContext, expr: Node, scope: Scope): void {
  const type = checkExpression(ctx, expr, scope, T_BOOL);
  if (type !== T_BOOL && type !== T_ERROR) {
    ctx.error(expr, `Condition must be boolean, got ${ctx.table.typeName(type)} (${LANGUAGE} has no truthiness)`);
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
      // WP16: `r.ok`, `r.isOk()` and `r.isErr()` prove the same one bit, and
      // compose with `!`, `&&` and `||` through the cases above.
      narrowResultTest(cond, scope, ctx.table, whenTrue);
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
  if (isBitwiseCompound(op)) {
    // The bitwise family reads the target, applies one instruction and writes
    // it back, whatever the target is, so a local, a field and an element all
    // share the operand rule (and the refusal) below.
    const bits = checkExpression(ctx, value, scope, slot);
    if (local !== null) {
      scope.clearNarrowing(local);
    }
    return checkBitwiseAssignOperands(ctx, expr, slot, bits);
  }
  // A compound arithmetic assignment has a rule of its own rather than the
  // binary operator's: the target must be numeric and the value must be
  // exactly the target's type, and the refusal names the token that was
  // written (`checkCompoundAssignment` in `src/checker/control-flow.ts`, and
  // the field and element paths beside it, all say the same sentence). Routing
  // it through `checkOperator` gave stage1 `+`'s wording for `+=` and `/`'s
  // for `/=`, and let `s += "b"` and `b += 1` through as well, because `+`
  // takes two strings and a boolean operand is a different refusal there.
  // WP19 §A2 found the spelling; the rest came with it.
  //
  // The target is still checked, in the order and with the hints
  // `checkOperator` used, because that is what records its type — and
  // `collectDivisionFacts` reads exactly that to decide whether `x /= k` can
  // reach `nish_panic_div` (`tests/cases/div_compound_attributes`).
  const target = checkExpression(ctx, expr.children[0], scope, slot);
  const rhs = checkExpression(
    ctx,
    value,
    scope,
    value.kind === N_NUMBER ? literalHint(target, slot) : slot
  );
  if (local !== null) {
    scope.clearNarrowing(local);
  }
  if (target === T_ERROR || rhs === T_ERROR || slot === T_ERROR) {
    return slot;
  }
  if (!isNumeric(slot) || rhs !== slot) {
    return ctx.errorType(
      expr,
      `Operator \`${op}\` requires two operands of the same numeric type, got ${ctx.table.typeName(slot)} and ${ctx.table.typeName(rhs)}`
    );
  }
  return slot;
}

// ---- Calls ---------------------------------------------------------------------

/**
 * A call to a name a `nish:` import bound (`readFileSync`, `exit`, and any
 * `as` rename of either). The rule applied is the one the global spelling
 * uses, so there is exactly one of each and the diagnostics keep naming the
 * canonical form — `exit(1, 2)` reports `process.exit`, which is the rule the
 * reader has to look up.
 *
 * The canonical name is recorded because the emitter dispatches builtins on
 * the identifier's own text, and under an import that text is the local name.
 */
function checkImportedBuiltin(ctx: CheckContext, expr: Node, scope: Scope, imported: BuiltinExport): i32 {
  const callee = expr.children[0];
  if (imported.isProperty) {
    return ctx.errorType(callee, `\`${callee.text}\` is a builtin value and cannot be called`);
  }
  ctx.program.nodeBuiltins[expr.id] = imported.canonical;
  return imported.namespace.length > 0
    ? checkImportedDottedBuiltin(ctx, expr, scope, imported.namespace, imported.member)
    : checkBuiltinFunctionNamed(ctx, expr, scope, imported.member);
}

function checkCall(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  const callee = expr.children[0];
  if (callee.kind === N_SUPER) {
    return checkExpression(ctx, callee, scope, -1); // WP25: reports on the `super` token
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
  const template = ctx.template(callee.text);
  if (template !== null) {
    return checkGenericCall(ctx, expr, template, scope); // WP18: infer, instantiate, then check
  }
  const sig = ctx.signature(callee.text);
  if (sig === null) {
    // An imported builtin first: it cannot have been shadowed, because a user
    // function of the same name is rejected at the import itself.
    const imported = ctx.program.builtinImport(callee.text);
    if (imported !== null) {
      return checkImportedBuiltin(ctx, expr, scope, imported);
    }
    if (isResultConstructor(callee.text)) {
      return checkResultConstructor(ctx, expr, scope, want); // WP16: `Ok(v)` / `Err(e)`
    }
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

/**
 * Drop the narrowing of every variable a loop assigns, before its body is
 * checked. `if (cur !== null) { while (...) { cur = cur.next; } }` narrows
 * `cur` at the `if` and the second iteration sees the assigned value, so the
 * narrowing cannot hold inside the loop — the rule `docs/LANGUAGE.md` states
 * as "before a loop whose body, condition, or update assigns the variable".
 */
export function clearNarrowingsAssignedIn(ctx: CheckContext, node: Node, scope: Scope): void {
  if (node.kind === N_BINARY && writesLeft(node.text)) {
    clearTarget(node.children[0], scope);
  } else if (node.kind === N_UNARY && (node.text === "++" || node.text === "--")) {
    clearTarget(node.children[0], scope);
  }
  for (const child of node.children) {
    clearNarrowingsAssignedIn(ctx, child, scope);
  }
}

function clearTarget(target: Node, scope: Scope): void {
  if (target.kind !== N_IDENT) {
    return;
  }
  const local = scope.lookup(target.text);
  if (local !== null) {
    scope.clearNarrowing(local);
  }
}
