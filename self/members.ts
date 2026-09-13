// Members for stage1 (`src/checker/members.ts`, `classes.ts` and
// `nullable.ts`, docs/wp14-selfhost.md milestone S3, pass 2): property
// access, method calls, `new`, object literals and `super`.
//
// stage0 dispatches these through three tables keyed by the receiver's type
// kind, which each construct family registers into. D2 takes the central
// `switch` instead, so the dispatch is here and the families are helpers; the
// invariant the tables enforced by locality — that a family's property
// checker and its method checker agree about what it owns — is a thing to
// keep in mind rather than something the shape enforces.

import { checkArrayMethod, checkArrayProperty, checkNewArray } from "./arrays";
import { checkBuiltinArity, checkNamespaceProperty, isNamespace } from "./builtins";
import { checkResultMethod, checkResultProperty } from "./result";
import { CheckContext } from "./context";
import { assignInto, checkExpression } from "./expressions";
import {
  N_ARRAY,
  N_CONDITIONAL,
  N_IDENT,
  N_INDEX,
  N_MEMBER,
  N_NUMBER,
  N_PAREN,
  N_PROPERTY,
  N_SUPER,
  N_THIS,
  N_UNARY,
  Node,
} from "./nodes";
import { EnumInfo, FunctionSig, ROLE_CONSTRUCTOR, STRUCT_CLASS, StructInfo } from "./program";
import { Scope } from "./symbols";
import { isNumeric, T_BOOL, T_ERROR, T_STRING, T_VOID } from "./types";

/**
 * Whether `receiver` is a value rather than a builtin namespace: `x.length`
 * is a member of `x`, `Math.floor` is not a member of anything. A module
 * constant is a value too, or `LIMIT.length` would be reported as an unknown
 * builtin.
 */
export function isValueReceiver(ctx: CheckContext, receiver: Node, scope: Scope): boolean {
  if (receiver.kind !== N_IDENT) {
    return true;
  }
  // A name a `nish:` import bound is a value too, and for the reason a module
  // constant is: `argv.length` is a member of the array `argv`, not a member of
  // a namespace called `argv`.
  return (
    scope.lookup(receiver.text) !== null ||
    ctx.program.constant(receiver.text) !== null ||
    ctx.program.builtinImport(receiver.text) !== null
  );
}

/**
 * What to do about an un-narrowed nullable, phrased for what was written.
 * Narrowing is keyed by variable, so `if (n.parent !== null)` does not narrow
 * `n.parent`: a store through any alias would invalidate it, and the checker
 * runs before the effect facts that could rule that out. The fix is to bind
 * the field to a local, which is provably safe and one load instead of two,
 * so the message names that idiom with the reader's own expression.
 */
function nullableHint(ctx: CheckContext, receiver: i32, receiverExpr: Node): string {
  const spelled = ctx.table.typeName(receiver);
  const narrows = `\`${spelled}\` to \`${ctx.table.typeName(ctx.table.stripNull(receiver))}\``;
  if (receiverExpr.kind === N_MEMBER || receiverExpr.kind === N_INDEX) {
    const text = ctx.textOf(receiverExpr);
    const local = receiverExpr.kind === N_MEMBER ? receiverExpr.text : "value";
    return `only a local is narrowed, not a field or element, so bind it first: \`const ${local} = ${text}; if (${local} !== null) { ... }\` narrows ${narrows}`;
  }
  return `check for null first: \`if (p !== null) { ... }\` narrows ${narrows}`;
}

/** `receiver.name` where `receiver` is a value, or a dotted builtin otherwise. */
export function checkMember(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const receiverExpr = expr.children[0];
  if (!isValueReceiver(ctx, receiverExpr, scope)) {
    // `Kind.If` (WP23). An enum name is not a value, so it arrives here the
    // way `Math` does, and the member is folded to its integer on the spot:
    // the emitter reads `nodeEnumValues` and an enum emits no symbol at all.
    const declaredEnum = ctx.program.enumNamed(receiverExpr.text);
    if (declaredEnum !== null) {
      return checkEnumMember(ctx, expr, declaredEnum);
    }
    return checkNamespaceProperty(ctx, expr, receiverExpr.text, expr.text);
  }
  const receiver = checkExpression(ctx, receiverExpr, scope, -1);
  if (receiver === T_ERROR) {
    return T_ERROR;
  }
  if (ctx.table.isNullable(receiver)) {
    // Against the property name, where stage0 puts it (`expr.name`).
    ctx.errorAtProperty(
      expr,
      `Cannot read property \`${expr.text}\` of \`${ctx.table.typeName(receiver)}\`; ${nullableHint(ctx, receiver, receiverExpr)}`
    );
    return T_ERROR;
  }
  if (receiver === T_STRING) {
    return checkStringProperty(ctx, expr, receiver);
  }
  if (ctx.table.isResult(receiver)) {
    return checkResultProperty(ctx, expr, receiver); // WP16
  }
  if (ctx.table.isArray(receiver)) {
    return checkArrayProperty(ctx, expr, receiver);
  }
  if (ctx.table.isStruct(receiver)) {
    return checkStructProperty(ctx, expr, receiver);
  }
  ctx.errorAtProperty(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`);
  return T_ERROR;
}

/** `Kind.If`: the member's integer, recorded for the emitter, and the enum's type (WP23). */
function checkEnumMember(ctx: CheckContext, expr: Node, info: EnumInfo): i32 {
  if (!info.hasMember(expr.text)) {
    ctx.errorAtProperty(expr, `Enum \`${info.name}\` has no member \`${expr.text}\``);
    return T_ERROR;
  }
  ctx.program.nodeEnumValues[expr.id] = info.memberValue(expr.text);
  return info.type;
}

function checkStructProperty(ctx: CheckContext, expr: Node, receiver: i32): i32 {
  const info = structOf(ctx, receiver);
  if (info === null) {
    return T_ERROR;
  }
  const field = info.field(expr.text);
  if (field === null) {
    const hint = info.method(expr.text) !== null ? " (it is a method; call it)" : "";
    const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
    ctx.errorAtProperty(expr, `Unknown field \`${expr.text}\` on ${kind} \`${info.name}\`${hint}`);
    return T_ERROR;
  }
  return field.type;
}

/** The `StructInfo` behind a struct-typed value; the emitter relies on the same lookup. */
export function structOf(ctx: CheckContext, type: i32): StructInfo | null {
  return ctx.program.struct(ctx.table.nameOf(type));
}

/** `receiver.method(args)` where `receiver` is a value. */
export function checkMethodCall(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const access = expr.children[0];
  const receiverExpr = access.children[0];
  const receiver = checkExpression(ctx, receiverExpr, scope, -1);
  if (receiver === T_ERROR) {
    return T_ERROR;
  }
  const args = expr.children[1];
  if (ctx.table.isNullable(receiver)) {
    // Against the method name, where stage0 puts it (`access.name`).
    ctx.errorAtProperty(
      access,
      `Cannot call \`${access.text}\` on \`${ctx.table.typeName(receiver)}\`; ${nullableHint(ctx, receiver, receiverExpr)}`
    );
    return T_ERROR;
  }
  if (receiver === T_STRING) {
    return checkStringMethod(ctx, expr, access, args, scope);
  }
  if (ctx.table.isResult(receiver)) {
    return checkResultMethod(ctx, expr, access, args, receiver, scope); // WP16
  }
  if (ctx.table.isArray(receiver)) {
    return checkArrayMethod(ctx, expr, access, args, receiver, scope);
  }
  if (!ctx.table.isStruct(receiver)) {
    ctx.errorAtProperty(access, `Unknown method \`${access.text}\` on ${ctx.table.typeName(receiver)}`);
    return T_ERROR;
  }
  const info = structOf(ctx, receiver);
  if (info === null) {
    return T_ERROR;
  }
  const method = info.method(access.text); // own first, then the base chain: static dispatch
  if (method === null) {
    const hint = info.field(access.text) !== null ? " (it is a field, not a method)" : "";
    const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
    ctx.errorAtProperty(access, `Unknown method \`${access.text}\` on ${kind} \`${info.name}\`${hint}`);
    return T_ERROR;
  }
  checkMethodArguments(ctx, expr, method, args, `${info.name}.${access.text}`, scope, false);
  ctx.program.nodeCallees[expr.id] = method;
  return method.returnType;
}

/**
 * `args` against `callee`'s parameters after `this`.
 *
 * `literalContext` says whether a bare numeric or array literal may take the
 * parameter's type: a constructor's arguments do (stage0's numeric walk names
 * `new Pixel(255, 0, 0)`), a method's and `super`'s do not
 * (`takesDeclaredContext`). Everything else — an object literal, a `null` —
 * takes it either way.
 */
export function checkMethodArguments(
  ctx: CheckContext,
  call: Node,
  callee: FunctionSig,
  args: Node,
  what: string,
  scope: Scope,
  literalContext: boolean
): void {
  const arity = callee.paramTypes.length - 1;
  if (args.children.length !== arity) {
    ctx.error(call, `\`${what}\` expects ${arity} argument(s), got ${args.children.length}`);
    return;
  }
  let i = 0;
  while (i < arity) {
    const arg = args.children[i];
    const want = callee.paramTypes[i + 1];
    const context = literalContext || takesDeclaredContext(arg) ? want : -1;
    const got = checkExpression(ctx, arg, scope, context);
    if (got !== T_ERROR && !ctx.table.assignable(got, want)) {
      const spelled = ctx.table.typeName(want);
      ctx.error(arg, `Argument ${i + 1} of \`${what}\`: expected ${spelled}, got ${ctx.table.typeName(got)}`);
    }
    i = i + 1;
  }
}

/** `new C(...)`, `new Array<T>(n)`, `new Int32Array(n)`. */
export function checkNew(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const callee = expr.children[0];
  if (callee.kind !== N_IDENT) {
    return ctx.errorType(callee, "`new` requires a class name");
  }
  const name = callee.text;
  const args = expr.children[2];
  const arrayType = checkNewArray(ctx, expr, name, scope);
  if (arrayType !== -1) {
    return arrayType;
  }
  const info = ctx.program.struct(name);
  if (info === null) {
    return ctx.errorType(callee, `Unknown class \`${name}\``);
  }
  if (info.kind !== STRUCT_CLASS) {
    return ctx.errorType(expr, `Cannot \`new\` interface \`${name}\`; use an object literal: \`{ ... }\``);
  }
  const ctor = info.ctor;
  if (ctor !== null) {
    checkMethodArguments(ctx, expr, ctor, args, `new ${name}`, scope, true);
    ctx.program.nodeCallees[expr.id] = ctor;
  } else if (args.children.length > 0) {
    ctx.error(
      expr,
      `\`new ${name}\` expects 0 argument(s) (the class has no constructor), got ${args.children.length}`
    );
  }
  return info.type;
}

/**
 * Whether a declared type may serve as `value`'s contextual type in a position
 * that stage0's *object-literal* walk names and its numeric and array walks do
 * not — an object literal's property value, and a method's or `super`'s
 * argument.
 *
 * stage0 answers the question with three separate walks up the parent chain
 * and stage1 threads one `want` down, so where they part has to be written
 * here. `contextualType` in `src/checker/classes.ts` names both positions,
 * which is why an object literal or a `null` in either does get the declared
 * type; the numeric walk (`contextType` in `src/checker/math.ts`, the
 * enumerated table in `docs/LANGUAGE.md`) names neither, and the array one
 * (`contextualType` in `src/checker/arrays.ts`) names neither, so a numeric
 * literal there takes the mode's default and `[]` there has no element type at
 * all and is refused. Handing `want` to those two made stage1 compile
 * `{ b: 255 }` for a `u8` field, `{ xs: [] }` and `b.get(-1)` for a method
 * whose parameter is an `i32` — all of which stage0 refuses
 * (`reject_struct_field_u8`, `reject_struct_field_empty_array`,
 * `reject_struct_field_f64`, `reject_method_arg_literal`).
 *
 * A `new` argument is *not* one of these: stage0's numeric walk names it
 * (`new Pixel(255, 0, 0)` in the table), so a constructor's parameters do give
 * a literal its type on both sides.
 *
 * Parentheses, a leading minus and both arms of a ternary are transparent in
 * stage0's walks, so they are transparent here too: `{ code: c ? 1 : 2 }` gets
 * no more context than `{ code: 1 }` does.
 */
export function takesDeclaredContext(value: Node): boolean {
  if (value.kind === N_PAREN) {
    return takesDeclaredContext(value.children[0]);
  }
  if (value.kind === N_CONDITIONAL) {
    return takesDeclaredContext(value.children[1]) && takesDeclaredContext(value.children[2]);
  }
  if (value.kind === N_UNARY) {
    return takesDeclaredContext(value.children[0]);
  }
  return value.kind !== N_NUMBER && value.kind !== N_ARRAY;
}

/** `{ x: 1, y: 2 }`, which needs a contextual class or interface type. */
export function checkObjectLiteral(ctx: CheckContext, expr: Node, scope: Scope, want: i32): i32 {
  if (want < 0 || !ctx.table.isStruct(ctx.table.stripNull(want))) {
    return ctx.errorType(
      expr,
      "Object literal needs a contextual class or interface type (annotate the variable: `const p: P = { ... }`)"
    );
  }
  const target = ctx.table.stripNull(want);
  const info = structOf(ctx, target);
  if (info === null) {
    return T_ERROR;
  }
  const seen: string[] = [];
  for (const prop of expr.children) {
    if (prop.kind !== N_PROPERTY) {
      continue;
    }
    const field = info.field(prop.text);
    if (field === null) {
      ctx.error(prop, `\`${info.name}\` has no field \`${prop.text}\``);
      continue;
    }
    let duplicate = false;
    for (const name of seen) {
      if (name === prop.text) {
        duplicate = true;
      }
    }
    if (duplicate) {
      ctx.error(prop, `Field \`${prop.text}\` is set twice in the object literal`);
      continue;
    }
    seen.push(prop.text);
    const value = prop.children[0];
    const context = takesDeclaredContext(value) ? field.type : -1;
    const got = checkExpression(ctx, value, scope, context);
    if (got !== T_ERROR && !ctx.table.assignable(got, field.type)) {
      const spelled = ctx.table.typeName(field.type);
      ctx.error(
        value,
        `Field \`${prop.text}\` of \`${info.name}\` expects a value of type ${spelled}, got ${ctx.table.typeName(got)}`
      );
    }
  }
  for (const field of info.fields) {
    let set = false;
    for (const name of seen) {
      if (name === field.name) {
        set = true;
      }
    }
    if (!set) {
      ctx.error(expr, `Object literal for \`${info.name}\` is missing field \`${field.name}\``);
      return want;
    }
  }
  return want;
}

/** `recv.f = v` and `recv.f op= v` where `recv` is a struct value. */
export function checkMemberAssignment(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const target = expr.children[0];
  const receiverExpr = target.children[0];
  if (!isValueReceiver(ctx, receiverExpr, scope)) {
    return ctx.errorType(target, `Cannot assign to \`${ctx.textOf(target)}\``);
  }
  const receiver = checkExpression(ctx, receiverExpr, scope, -1);
  if (receiver === T_ERROR) {
    return T_ERROR;
  }
  if (ctx.table.isArray(receiver) && target.text === "length") {
    return ctx.errorType(
      target,
      `Cannot assign to \`length\` of ${ctx.table.typeName(receiver)} (array length is read-only; use \`push\`)`
    );
  }
  if (ctx.table.isResult(receiver)) {
    return ctx.errorType(
      target,
      `Cannot assign to \`${target.text}\` of ${ctx.table.typeName(receiver)}: a \`Result\` is immutable once built (return a new \`Ok(...)\` or \`Err(...)\` instead)`
    );
  }
  if (!ctx.table.isStruct(receiver)) {
    return ctx.errorType(
      target,
      `Cannot assign to property \`${target.text}\` of ${ctx.table.typeName(receiver)}`
    );
  }
  const info = structOf(ctx, receiver);
  if (info === null) {
    return T_ERROR;
  }
  const field = info.field(target.text);
  if (field === null) {
    const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
    ctx.errorAtProperty(target, `Unknown field \`${target.text}\` on ${kind} \`${info.name}\``);
    return T_ERROR;
  }
  if (field.readonly && !assignableReadonly(ctx, info, target, receiverExpr, expr.text)) {
    const where = info.kind === STRUCT_CLASS ? " outside its constructor" : "";
    return ctx.errorType(
      target,
      `Cannot assign to readonly field \`${field.name}\` of \`${info.name}\`${where}`
    );
  }
  return assignInto(ctx, expr, scope, null, field.type, field.name, "field");
}

/**
 * A `readonly` field may only be assigned by the constructor of the class that
 * declares it, through `this`, with a plain `=`.
 */
function assignableReadonly(
  ctx: CheckContext,
  info: StructInfo,
  target: Node,
  receiverExpr: Node,
  op: string
): boolean {
  const current = ctx.current;
  if (current === null || current.role !== ROLE_CONSTRUCTOR || op !== "=") {
    return false;
  }
  if (receiverExpr.kind !== N_THIS) {
    return false;
  }
  if (info.field(target.text) === null) {
    return false;
  }
  const owner = current.owner;
  return owner !== null && owner === info;
}

// ---- String members -----------------------------------------------------------------
//
// `src/checker/strings.ts` registers these in the member dispatch tables; with
// the central `switch` of D2 they sit beside the other receiver kinds. Every
// index is a **byte** offset, matching `.length`: a lexer walks bytes, and a
// code-point index would need a decode per access.

const STRING_METHODS: string = "charCodeAt, substring, slice, indexOf, startsWith, endsWith";

export function checkStringProperty(ctx: CheckContext, expr: Node, receiver: i32): i32 {
  if (expr.text === "length") {
    return ctx.numberType();
  }
  ctx.errorAtProperty(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`);
  return T_ERROR;
}

function checkIndexArgument(ctx: CheckContext, arg: Node, scope: Scope, name: string): void {
  const type = checkExpression(ctx, arg, scope, ctx.numberType());
  if (type !== T_ERROR && !isNumeric(type)) {
    ctx.error(arg, `\`${name}\` expects a number index, got ${ctx.table.typeName(type)}`);
  }
}

function checkStringArgument(ctx: CheckContext, arg: Node, scope: Scope, name: string): void {
  const type = checkExpression(ctx, arg, scope, T_STRING);
  if (type !== T_ERROR && type !== T_STRING) {
    // The wording `checkArgumentType` uses in `self/builtins.ts`, and stage0's
    // in `src/checker/builtins.ts`: one run for the code registry to derive a
    // rule from, and one sentence for a reader to recognise.
    ctx.error(arg, `\`${name}\` expects an argument of type string, got ${ctx.table.typeName(type)}`);
  }
}

export function checkStringMethod(
  ctx: CheckContext,
  call: Node,
  access: Node,
  args: Node,
  scope: Scope
): i32 {
  const name = access.text;
  const count = args.children.length;
  if (name === "charCodeAt") {
    if (checkBuiltinArity(ctx, call, "charCodeAt", args, 1)) {
      checkIndexArgument(ctx, args.children[0], scope, "charCodeAt");
    }
    return ctx.numberType();
  }
  if (name === "substring") {
    if (count === 0 || count > 2) {
      return ctx.errorType(call, `\`substring\` expects 1 or 2 arguments, got ${count}`);
    }
    for (const arg of args.children) {
      checkIndexArgument(ctx, arg, scope, "substring");
    }
    return T_STRING;
  }
  if (name === "slice") {
    if (count === 0 || count > 2) {
      return ctx.errorType(call, `\`slice\` expects 1 or 2 arguments, got ${count}`);
    }
    for (const arg of args.children) {
      checkIndexArgument(ctx, arg, scope, "slice");
    }
    return T_STRING;
  }
  if (name === "indexOf") {
    if (checkBuiltinArity(ctx, call, "indexOf", args, 1)) {
      checkStringArgument(ctx, args.children[0], scope, "indexOf");
    }
    return ctx.numberType();
  }
  if (name === "startsWith" || name === "endsWith") {
    if (checkBuiltinArity(ctx, call, name, args, 1)) {
      checkStringArgument(ctx, args.children[0], scope, name);
    }
    return T_BOOL;
  }
  ctx.errorAtProperty(access, `Unknown method \`${name}\` on string (supported: ${STRING_METHODS})`);
  return T_ERROR;
}
