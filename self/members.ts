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
import { fieldOwner } from "./structs";
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
import { FunctionSig, ROLE_CONSTRUCTOR, STRUCT_CLASS, StructInfo } from "./program";
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
  return scope.lookup(receiver.text) !== null || ctx.program.constant(receiver.text) !== null;
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
  if (receiverExpr.kind === N_SUPER) {
    // Reading through `super` is never right: an inherited field lives at the
    // same offset in the derived layout, so `this.x` is the same load.
    return ctx.errorType(
      expr,
      `\`super.${expr.text}\` is not supported: inherited fields are read and written as \`this.${expr.text}\` (only \`super.method(...)\` is allowed)`
    );
  }
  if (!isValueReceiver(ctx, receiverExpr, scope)) {
    return checkNamespaceProperty(ctx, expr, receiverExpr.text, expr.text);
  }
  const receiver = checkExpression(ctx, receiverExpr, scope, -1);
  if (receiver === T_ERROR) {
    return T_ERROR;
  }
  if (ctx.table.isNullable(receiver)) {
    return ctx.errorType(
      expr,
      `Cannot read property \`${expr.text}\` of \`${ctx.table.typeName(receiver)}\`; ${nullableHint(ctx, receiver, receiverExpr)}`
    );
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
  return ctx.errorType(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`);
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
    return ctx.errorType(expr, `Unknown field \`${expr.text}\` on ${kind} \`${info.name}\`${hint}`);
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
  if (receiverExpr.kind === N_SUPER) {
    return checkSuperMethodCall(ctx, expr, access, scope);
  }
  const receiver = checkExpression(ctx, receiverExpr, scope, -1);
  if (receiver === T_ERROR) {
    return T_ERROR;
  }
  const args = expr.children[1];
  if (ctx.table.isNullable(receiver)) {
    return ctx.errorType(
      access,
      `Cannot call \`${access.text}\` on \`${ctx.table.typeName(receiver)}\`; ${nullableHint(ctx, receiver, receiverExpr)}`
    );
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
    return ctx.errorType(access, `Unknown method \`${access.text}\` on ${ctx.table.typeName(receiver)}`);
  }
  const info = structOf(ctx, receiver);
  if (info === null) {
    return T_ERROR;
  }
  const method = info.method(access.text); // own first, then the base chain: static dispatch
  if (method === null) {
    const hint = info.field(access.text) !== null ? " (it is a field, not a method)" : "";
    const kind = info.kind === STRUCT_CLASS ? "class" : "interface";
    return ctx.errorType(access, `Unknown method \`${access.text}\` on ${kind} \`${info.name}\`${hint}`);
  }
  checkMethodArguments(ctx, expr, method, args, `${info.name}.${access.text}`, scope);
  ctx.program.nodeCallees[expr.id] = method;
  return method.returnType;
}

/** `args` against `callee`'s parameters after `this`. */
export function checkMethodArguments(
  ctx: CheckContext,
  call: Node,
  callee: FunctionSig,
  args: Node,
  what: string,
  scope: Scope
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
    const got = checkExpression(ctx, arg, scope, want);
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
  const ctor = info.effectiveConstructor(); // own, or the nearest ancestor's
  if (ctor !== null) {
    checkMethodArguments(ctx, expr, ctor, args, `new ${name}`, scope);
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
 * Whether a field's type may serve as the contextual type of the value written
 * for it in an object literal.
 *
 * stage0 answers this with three separate walks up the parent chain and stage1
 * threads one `want` down, so the difference between them has to be written
 * here. `contextualType` in `src/checker/classes.ts` names a property
 * assignment, which is why an object literal or a `null` in this position does
 * get the field's type; the numeric one (`contextType` in
 * `src/checker/math.ts`, the enumerated table in `docs/LANGUAGE.md`) and the
 * array one (`contextualType` in `src/checker/arrays.ts`) both do not, so a
 * numeric literal here takes the mode's default and `[]` here has no element
 * type at all and is refused. Passing `want` to those two made stage1 compile
 * `{ b: 255 }` for a `u8` field and `{ xs: [] }`, which stage0 refuses
 * (`reject_struct_field_u8`, `reject_struct_field_empty_array`), and
 * `{ code: 2 }` for an `i32` field in f64 mode (`reject_struct_field_f64`).
 *
 * Parentheses, a leading minus and both arms of a ternary are transparent in
 * stage0's walks, so they are transparent here too: `{ code: c ? 1 : 2 }` gets
 * no more context than `{ code: 1 }` does.
 */
function takesFieldContext(value: Node): boolean {
  if (value.kind === N_PAREN) {
    return takesFieldContext(value.children[0]);
  }
  if (value.kind === N_CONDITIONAL) {
    return takesFieldContext(value.children[1]) && takesFieldContext(value.children[2]);
  }
  if (value.kind === N_UNARY) {
    return takesFieldContext(value.children[0]);
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
    const context = takesFieldContext(value) ? field.type : -1;
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
    return ctx.errorType(target, `Unknown field \`${target.text}\` on ${kind} \`${info.name}\``);
  }
  if (field.readonly && !assignableReadonly(ctx, info, target, receiverExpr, expr.text)) {
    const owner = fieldOwner(info, field.name);
    const where = owner.kind === STRUCT_CLASS ? " outside its constructor" : "";
    return ctx.errorType(
      target,
      `Cannot assign to readonly field \`${field.name}\` of \`${owner.name}\`${where}`
    );
  }
  return assignInto(ctx, expr, scope, null, field.type, field.name, "field");
}

/**
 * A `readonly` field may only be assigned by the constructor of the class
 * that *declares* it, through `this`, with a plain `=`. A derived
 * constructor cannot write an inherited one.
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
  const field = info.field(target.text);
  if (field === null) {
    return false;
  }
  const owner = current.owner;
  return owner !== null && owner === fieldOwner(info, field.name);
}

/**
 * `super.m(...)`: `this` seen as the base type, so the method lookup starts at
 * the base and the call is static dispatch. Only a call — `super.field` is
 * read and written as `this.field`, and there is no other use for `super` as
 * a value.
 */
function checkSuperMethodCall(ctx: CheckContext, expr: Node, access: Node, scope: Scope): i32 {
  const current = ctx.current;
  const self = scope.lookup("this");
  const owner: StructInfo | null = current === null ? null : current.owner;
  if (owner === null || self === null) {
    return ctx.errorType(
      access.children[0],
      "`super` is only valid inside a method or constructor of a class that `extends` another class"
    );
  }
  const base = owner.base;
  if (base === null) {
    return ctx.errorType(
      access.children[0],
      `\`super\` in class \`${owner.name}\`, which does not extend a class`
    );
  }
  const method = base.method(access.text);
  if (method === null) {
    if (base.field(access.text) !== null) {
      return ctx.errorType(
        access,
        `\`super.${access.text}\` is not supported: inherited fields are read and written as \`this.${access.text}\` (only \`super.method(...)\` is allowed)`
      );
    }
    return ctx.errorType(access, `Unknown method \`${access.text}\` on class \`${base.name}\``);
  }
  // `super` is bound to the `this` local so the attribute analysis sees the
  // pointer flow into the callee.
  ctx.program.nodeLocals[access.children[0].id] = self;
  ctx.program.nodeTypes[access.children[0].id] = base.type;
  checkMethodArguments(ctx, expr, method, expr.children[1], `${base.name}.${access.text}`, scope);
  ctx.program.nodeCallees[expr.id] = method;
  return method.returnType;
}

/** `super(...)`: the base constructor, callable only from a derived constructor. */
export function checkSuperCall(ctx: CheckContext, expr: Node, scope: Scope): i32 {
  const current = ctx.current;
  if (current === null || current.role !== ROLE_CONSTRUCTOR) {
    return ctx.errorType(expr, "`super(...)` is only valid as the first statement of the constructor");
  }
  const owner = current.owner;
  const base: StructInfo | null = owner === null ? null : owner.base;
  if (base === null) {
    return ctx.errorType(expr, "`super(...)` requires a base class");
  }
  const ctor = base.effectiveConstructor();
  if (ctor === null) {
    if (expr.children[1].children.length > 0) {
      ctx.error(expr, `\`super\` expects 0 argument(s) (\`${base.name}\` has no constructor)`);
    }
    return T_VOID;
  }
  checkMethodArguments(ctx, expr, ctor, expr.children[1], "super", scope);
  ctx.program.nodeCallees[expr.id] = ctor;
  return T_VOID;
}

// ---- String members -----------------------------------------------------------------
//
// `src/checker/strings.ts` registers these in the member dispatch tables; with
// the central `switch` of D2 they sit beside the other receiver kinds. Every
// index is a **byte** offset, matching `.length`: a lexer walks bytes, and a
// code-point index would need a decode per access.

const STRING_METHODS: string = "charCodeAt, substring, indexOf, startsWith, endsWith";

export function checkStringProperty(ctx: CheckContext, expr: Node, receiver: i32): i32 {
  if (expr.text === "length") {
    return ctx.numberType();
  }
  return ctx.errorType(expr, `Unknown property \`${expr.text}\` on ${ctx.table.typeName(receiver)}`);
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
  return ctx.errorType(access, `Unknown method \`${name}\` on string (supported: ${STRING_METHODS})`);
}
