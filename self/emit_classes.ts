// Class, interface and struct lowering for stage1 (`src/codegen/emit/
// classes.ts` and the member dispatch of `emit/members.ts`;
// docs/wp14-selfhost.md milestone S4).
//
// Layout: `%struct.<Name> = type { <field types in declaration order> }`, with
// the size and padding the checker computed exactly as clang lays out the
// equivalent C struct. A value of struct type is a `%struct.<Name>*` into the
// arena, or an entry-block `alloca` when the escape analysis proved it does
// not outlive the function.
//
// `implements` is the only widening (WP24): `%struct.Square` lists `Shape`'s
// fields first, so every `Shape` operation works on a `Square` object through
// one `bitcast`. There is no inheritance and no vtable — a method call
// resolves to the method of the receiver's own type.
//
// The member dispatch that `src/` spreads over three tables keyed by the
// receiver's type kind is the `if` chain in `emitPropertyAccess` and
// `emitMethodCall` here, which is D2 again: the tables needed a registration
// per family and the language has no function values to register.

import { Emitter } from "./emit";
import {
  emitPackedResult,
  emitResultArgument,
  emitResultReturningCall,
  privateResultAbi,
  resultTypeDecl,
} from "./emit_result";
import { emitArrayLength, emitArrayMethodCall, emitNewArray } from "./emit_arrays";
import {
  compoundFloatOpcode,
  compoundIntegerOpcode,
  emitBitwiseCombine,
  emitIntBinary,
  floatText,
  isBitwiseAssignment,
} from "./emit_ops";
import { parseIntegerLiteral } from "./constants";
import { emitStringLength, emitStringMethodCall } from "./emit_strings";
import { intrinsicType } from "./emit_util";
import { internalError } from "./ice";
import {
  N_FALSE,
  N_NULL,
  N_NUMBER,
  N_STRING,
  N_TEMPLATE,
  N_TRUE,
  N_UNARY,
  Node,
} from "./nodes";
import { FieldInfo, FunctionSig, StructInfo } from "./program";
import { isFloat, T_I32, T_STRING, T_VOID } from "./types";

// ---- Helpers ------------------------------------------------------------------------

/** The `StructInfo` behind a struct-typed value; the checker resolved the same one. */
export function structInfoOf(emitter: Emitter, type: i32): StructInfo {
  const info = emitter.program.struct(emitter.table.nameOf(type));
  if (info !== null) {
    return info;
  }
  process.exit(internalError(`emitter: unknown struct \`${emitter.table.nameOf(type)}\``));
}

/** `%struct.<name>` without the trailing `*`. */
function structTypeName(info: StructInfo): string {
  return `%struct.${info.name}`;
}

/** Address of `field` inside the object `receiver` (a `%struct.X*` value). */
function structFieldPointer(emitter: Emitter, info: StructInfo, receiver: string, field: FieldInfo): string {
  const ty = structTypeName(info);
  return emitter.fn.emitValue(
    `getelementptr inbounds ${ty}, ${ty}* ${receiver}, i32 0, i32 ${field.index}`
  );
}

function loadField(emitter: Emitter, info: StructInfo, receiver: string, field: FieldInfo): string {
  const ty = emitter.llvm(field.type);
  const ptr = structFieldPointer(emitter, info, receiver, field);
  return emitter.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${emitter.alignSuffix(field.type)}`);
}

function storeField(
  emitter: Emitter,
  info: StructInfo,
  receiver: string,
  field: FieldInfo,
  value: string
): void {
  const ty = emitter.llvm(field.type);
  const ptr = structFieldPointer(emitter, info, receiver, field);
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${emitter.alignSuffix(field.type)}`);
}

/**
 * Storage for one object of `info`: an entry-block alloca when `site` was
 * proved not to escape (always 8-aligned like arena objects, so every pointer
 * attribute stays true), else `info.size` bytes bumped from the arena.
 */
function allocate(emitter: Emitter, info: StructInfo, site: Node): string {
  if (emitter.isStackSite(site)) {
    return emitter.fn.emitAlloca(`${info.name}.obj`, structTypeName(info), 8);
  }
  const raw = emitter.fn.emitValue(
    `call i8* ${emitter.useRuntime("nish_alloc_struct")}(i64 ${info.size})`
  );
  return emitter.fn.emitValue(`bitcast i8* ${raw} to ${structTypeName(info)}*`);
}

/**
 * The LLVM constant for a field initializer, from its syntax and the field's
 * type alone. The checker only admits literals here, and the node may belong
 * to another module (an imported class `new`ed without a constructor), whose
 * type table this emitter does not have.
 */
function initializerConstant(emitter: Emitter, field: FieldInfo): string {
  const init = field.initializer;
  if (init === null) {
    process.exit(internalError("emitter: a field initializer that is not there"));
  }
  const negated = init.kind === N_UNARY;
  const literal = negated ? init.children[0] : init;
  if (literal.kind === N_TRUE) {
    return "true";
  }
  if (literal.kind === N_FALSE) {
    return "false";
  }
  if (literal.kind === N_NULL) {
    return "null";
  }
  if (literal.kind === N_STRING) {
    return emitter.stringConstant(literal.text);
  }
  if (literal.kind === N_TEMPLATE) {
    // A template with no holes is a string literal; its one text part is the value.
    return emitter.stringConstant(literal.children.length > 0 ? literal.children[0].text : "");
  }
  if (isFloat(field.type)) {
    const value = Number(literal.text);
    return floatText(negated ? -value : value, field.type);
  }
  let value = parseIntegerLiteral(literal.text);
  if (negated) {
    value = -value;
  }
  return field.type === T_I32 ? `${toI32(value)}` : `${value}`;
}

/** Store the literal initializers of the fields `info` declares itself. */
export function emitFieldInitializers(emitter: Emitter, info: StructInfo, receiver: string): void {
  for (const field of info.fields) {
    if (field.initializer !== null) {
      storeField(emitter, info, receiver, field, initializerConstant(emitter, field));
    }
  }
}

/**
 * Run the construction of `info` on the object at `receiver` with `args`: its
 * constructor when it has one, otherwise its literal initializers.
 */
function constructObject(
  emitter: Emitter,
  info: StructInfo,
  receiver: string,
  args: Node[],
  site: Node
): void {
  const ctor = info.ctor;
  if (ctor !== null) {
    emitCall(emitter, ctor, receiver, args, site);
    return;
  }
  emitFieldInitializers(emitter, info, receiver);
}

/** Constructor prologue: the literal initializer stores, before the body runs. */
export function emitConstructorPrologue(emitter: Emitter, sig: FunctionSig): void {
  const info = sig.owner;
  if (info === null) {
    process.exit(internalError("emitter: a constructor with no owning class"));
  }
  emitFieldInitializers(emitter, info, "%this");
}

// ---- Expressions ----------------------------------------------------------------------

export function emitObjectLiteral(emitter: Emitter, expr: Node): string {
  const info = structInfoOf(emitter, emitter.typeOf(expr));
  const obj = allocate(emitter, info, expr);
  for (const prop of expr.children) {
    const field = info.field(prop.text);
    if (field === null) {
      process.exit(internalError(`emitter: unknown field \`${prop.text}\` on \`${info.name}\``));
    } else {
      storeField(emitter, info, obj, field, emitter.emitExpression(prop.children[0]));
    }
  }
  return obj;
}

/** `new C(...)`, or `new Array<T>(n)` and its typed-array aliases. */
export function emitNew(emitter: Emitter, expr: Node): string {
  if (emitter.table.isArray(emitter.typeOf(expr))) {
    return emitNewArray(emitter, expr);
  }
  // The class named, not the type it converts to.
  const info = structInfoOf(emitter, intrinsicType(emitter.program, expr));
  const obj = allocate(emitter, info, expr);
  constructObject(emitter, info, obj, expr.children[2].children, expr);
  return obj;
}

// ---- Members --------------------------------------------------------------------------------

/** `recv.name` where `recv` is a value: a field load, or the `.length` of a string or array. */
export function emitPropertyAccess(emitter: Emitter, expr: Node): string {
  const receiver = emitter.typeOf(expr.children[0]);
  if (receiver === T_STRING) {
    return emitStringLength(emitter, expr);
  }
  if (emitter.table.isArray(receiver)) {
    return emitArrayLength(emitter, expr);
  }
  const info = structInfoOf(emitter, receiver);
  const field = info.field(expr.text);
  if (field !== null) {
    return loadField(emitter, info, emitter.emitExpression(expr.children[0]), field);
  }
  process.exit(internalError(`emitter: unknown field \`${expr.text}\` on \`${info.name}\``));
}

/** `call <ret> @Sym(<this>, args...)` for a method or constructor. */
function emitCall(
  emitter: Emitter,
  callee: FunctionSig,
  receiver: string,
  args: Node[],
  site: Node
): string {
  const calleePrivate = privateResultAbi(emitter, callee.exported);
  const operands: string[] = [`${emitter.llvm(callee.paramTypes[0])} ${receiver}`];
  let i = 0;
  while (i < args.length) {
    // WP17: as in the plain call, a `Result` argument the ABI packs travels as the word.
    const want = callee.paramTypes[i + 1];
    const value = emitter.table.resultByValue(want)
      ? emitPackedResult(emitter, args[i], want)
      : emitter.emitExpression(args[i]);
    operands.push(`${emitter.llvmAbi(want, calleePrivate)} ${emitResultArgument(emitter, want, value, calleePrivate)}`);
    i = i + 1;
  }
  // WP9: after the receiver and the arguments, so the bracket holds only what
  // the method itself allocates (`Emitter.beginReclaim`).
  const mark = emitter.beginReclaim(callee);
  const call = `call ${emitter.llvmAbi(callee.returnType, calleePrivate)} @${callee.name}(${operands.join(", ")})`;
  if (callee.returnType === T_VOID) {
    emitter.fn.emit(call);
    return "void";
  }
  // WP17: a small `Result` comes back in a register, exactly as it does from a
  // plain function; the unpacked object belongs to this caller.
  if (emitter.table.resultByValue(callee.returnType)) {
    return emitResultReturningCall(emitter, call, callee.returnType, site, calleePrivate);
  }
  return emitter.endReclaim(mark, emitter.fn.emitValue(call));
}

/** `recv.m(args)` where `recv` is a value: a struct method, or a string or array method. */
export function emitMethodCall(emitter: Emitter, expr: Node): string {
  const access = expr.children[0];
  const receiverType = emitter.typeOf(access.children[0]);
  if (receiverType === T_STRING) {
    return emitStringMethodCall(emitter, expr);
  }
  if (emitter.table.isArray(receiverType)) {
    return emitArrayMethodCall(emitter, expr, receiverType);
  }
  const callee = emitter.program.nodeCallees[expr.id];
  if (callee === null) {
    process.exit(internalError(`emitter: no method recorded for \`${access.text}\``));
  }
  const receiver = emitter.emitExpression(access.children[0]);
  return emitCall(emitter, callee, receiver, expr.children[1].children, expr);
}

/** `recv.f = v` stores `v`; `recv.f op= v` reads the field first, as JS does. */
export function emitFieldAssignment(emitter: Emitter, expr: Node): string {
  const target = expr.children[0];
  const info = structInfoOf(emitter, emitter.typeOf(target.children[0]));
  const field = info.field(target.text);
  if (field === null) {
    process.exit(internalError(`emitter: unknown field \`${target.text}\` on \`${info.name}\``));
  }
  const receiver = emitter.emitExpression(target.children[0]);
  if (expr.text === "=") {
    const value = emitter.emitExpression(expr.children[1]);
    storeField(emitter, info, receiver, field, value);
    return value;
  }
  // One GEP for both halves of the read-modify-write, so `p.f op= e` addresses
  // the field once however the receiver was spelled.
  const ptr = structFieldPointer(emitter, info, receiver, field);
  const ty = emitter.llvm(field.type);
  const old = emitter.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${emitter.alignSuffix(field.type)}`);
  let value = "";
  if (isBitwiseAssignment(expr.text)) {
    value = emitBitwiseCombine(emitter, expr.text, field.type, old, expr.children[1]);
  } else {
    const rhs = emitter.emitExpression(expr.children[1]);
    value = isFloat(field.type)
      ? emitter.fn.emitValue(`${compoundFloatOpcode(expr.text)} ${ty} ${old}, ${rhs}`)
      : emitIntBinary(emitter, compoundIntegerOpcode(expr.text), field.type, old, rhs);
  }
  emitter.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${emitter.alignSuffix(field.type)}`);
  return value;
}

// ---- Type declarations ------------------------------------------------------------------------

/**
 * `%struct.X = type { ... }` for every struct visible in the module, plus
 * `type opaque` for struct types the module only points at (a field or a
 * parameter of an imported declaration whose class was not imported here).
 * Pointers to opaque types are legal; only field access needs the body.
 */
export function structTypeDeclarations(emitter: Emitter): string[] {
  const lines: string[] = [];
  const declared: string[] = [];
  const referenced: string[] = [];
  // A `Result` layout is derived from the type, not declared (WP16), so it is
  // emitted here rather than looked up: a field or signature that mentions one
  // is enough to need it in this module.
  const results: string[] = [];
  for (const info of emitter.program.structList) {
    if (declared.indexOf(info.name) >= 0) {
      continue;
    }
    declared.push(info.name);
    const types: string[] = [];
    for (const field of info.fields) {
      types.push(emitter.llvm(field.type));
    }
    const body = types.length > 0 ? ` ${types.join(", ")} ` : "";
    lines.push(`%struct.${info.name} = type {${body}}`);
    for (const field of info.fields) {
      noteStruct(emitter, referenced, results, field.type);
    }
    // Inherited constructors and methods are called through the base type,
    noteStruct(emitter, referenced, results, info.type);
    for (const method of info.methodSigs) {
      noteSignature(emitter, referenced, results, method);
    }
    const ctor = info.ctor;
    if (ctor !== null) {
      noteSignature(emitter, referenced, results, ctor);
    }
  }
  for (const sig of emitter.program.functions) {
    noteSignature(emitter, referenced, results, sig);
  }
  for (const imp of emitter.program.imports) {
    const sig = imp.sig;
    if (sig !== null) {
      noteSignature(emitter, referenced, results, sig);
    }
  }
  for (const name of referenced) {
    if (declared.indexOf(name) < 0) {
      lines.push(`%struct.${name} = type opaque`);
    }
  }
  for (const decl of results) {
    lines.push(decl);
  }
  return lines;
}

function noteStruct(emitter: Emitter, referenced: string[], results: string[], type: i32): void {
  const table = emitter.table;
  if (table.isArray(type) || table.isNullable(type)) {
    noteStruct(emitter, referenced, results, table.refOf(type));
    return;
  }
  if (table.isResult(type)) {
    noteStruct(emitter, referenced, results, table.okOf(type));
    noteStruct(emitter, referenced, results, table.errOf(type));
    const decl = resultTypeDecl(table, type);
    if (results.indexOf(decl) < 0) {
      results.push(decl);
    }
    return;
  }
  if (!table.isStruct(type)) {
    return;
  }
  const name = table.nameOf(type);
  if (referenced.indexOf(name) < 0) {
    referenced.push(name);
  }
}

function noteSignature(emitter: Emitter, referenced: string[], results: string[], sig: FunctionSig): void {
  for (const type of sig.paramTypes) {
    noteStruct(emitter, referenced, results, type);
  }
  noteStruct(emitter, referenced, results, sig.returnType);
}

/**
 * The constructor and methods an importer of `info` may call; each gets a
 * `declare`.
 */
export function structFunctions(info: StructInfo): FunctionSig[] {
  const out: FunctionSig[] = [];
  const ctor = info.ctor;
  if (ctor !== null) {
    out.push(ctor);
  }
  for (const method of info.methodSigs) {
    out.push(method);
  }
  return out;
}
