/**
 * Class, interface and struct lowering (WP2).
 *
 * Layout: `%struct.<Name> = type { <field types in declaration order> }`,
 * natural alignment (i32 4, double 8, i1 1, pointers 8), size and padding
 * computed by `checker/classes.ts` exactly as clang does for the same C
 * struct. A value of struct type is a `%struct.<Name>*` into the arena.
 *
 *   new P(a, b)      `%0 = call i8* @sts_alloc_struct(i64 <size>)`
 *                    `%1 = bitcast i8* %0 to %struct.P*`
 *                    `call void @P.constructor(%struct.P* %1, i32 %a, i32 %b)`
 *                    Without an explicit constructor the field initializers
 *                    are stored inline instead of the call. When escape.ts
 *                    proved the object does not outlive the function (WP6),
 *                    the allocation is `%P.obj = alloca %struct.P, align 8`
 *                    in the entry block instead of the first two lines.
 *   constructor      `define void @P.constructor(%struct.P* ... %this, ...)`:
 *                    initializer stores first (`emitFieldInitializers`), then the body.
 *   p.x              `getelementptr inbounds %struct.P, %struct.P* %p, i32 0, i32 <idx>`
 *                    + `load` with the field's alignment
 *   p.x = v          same address + `store`
 *   p.x op= v        address, `load`, op, `store`; the value is the stored result
 *   p.m(args)        `call <ret> @P.m(%struct.P* %p, args...)`
 *   this             the `%this` parameter of the enclosing method/constructor
 *   { x: 1, y: 2 }   alloc as above, then one `store` per field, in source order
 *   class -> iface   `bitcast %struct.C* %v to %struct.I*` (the checker records
 *                    the conversion in `program.coercions`; the core emits it)
 *
 * Inheritance (WP2b, `class D extends B`): `%struct.D` lists `B`'s fields
 * first, so every `B` operation works on a `D` object through one bitcast.
 *   D -> B           `bitcast %struct.D* %v to %struct.B*`, the same coercion
 *                    mechanism as class -> interface
 *   d.x (inherited)  `getelementptr inbounds %struct.D, ...` with the field's
 *                    index in the flattened layout: no cast, no base access
 *   d.m() (B's m)    `call @B.m(%struct.B* <bitcast d>, ...)`: the callee is the
 *                    method of the receiver's *static* type or its nearest
 *                    ancestor (no vtable); an override on the derived class is
 *                    chosen only when the receiver's declared type is that class
 *   super.m()        `call @B.m(%struct.B* <bitcast this>, ...)`
 *   super(args)      `call @B.constructor(%struct.B* <bitcast this>, args)`;
 *                    ancestors without a constructor get their initializers
 *                    stored instead (`constructObject`). The call is emitted
 *                    in the constructor prologue when the source omits it.
 *   new D(args)      as before; without a constructor of its own, `D`'s
 *                    initializers are stored and the nearest ancestor
 *                    constructor is called with `args` (inherited constructor)
 *
 * `collectClassFacts` reports field reads (`readsMemory`), field stores and
 * allocations (`write`, callee `sts_alloc_struct`, plus the constructor) to
 * `attributes.ts`, which owns the per-parameter pointer facts.
 */
import ts from "typescript";
import { CheckedProgram, FieldInfo, FunctionSig, ImportBinding, StructInfo } from "../../checker";
import { effectiveConstructor, explicitSuperCall, intrinsicType, isAssignmentOperator, ownFields } from "../../checker/classes";
import { StaticType, isFloat, llvmType } from "../../types";
import { emitIntBinary } from "./arithmetic";
import { floatConstant } from "./builtins";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter } from "./context";
import {
  MemoryFacts,
  assignmentTargetEmitters,
  factCollectors,
  isStackOwned,
  methodCallEmitters,
  newEmitters,
  propertyEmitters,
} from "./members";

// ---- Helpers ------------------------------------------------------------------------

export function structInfo(program: CheckedProgram, t: StaticType): StructInfo {
  if (t.kind !== "struct") throw new Error(`emitter: expected a struct type, got ${t.kind}`);
  const info = program.structs.get(t.name);
  if (!info) throw new Error(`emitter: unknown struct \`${t.name}\``);
  return info;
}

/** `%struct.<name>` without the trailing `*`. */
function structTypeName(info: StructInfo): string {
  return `%struct.${info.name}`;
}

/** Address of `field` inside the object `receiver` (a `%struct.X*` value). */
function fieldPointer(ctx: EmitContext, info: StructInfo, receiver: string, field: FieldInfo): string {
  const ty = structTypeName(info);
  return ctx.fn.emitValue(`getelementptr inbounds ${ty}, ${ty}* ${receiver}, i32 0, i32 ${field.index}`);
}

function loadField(ctx: EmitContext, info: StructInfo, receiver: string, field: FieldInfo): string {
  const ty = llvmType(field.type);
  const ptr = fieldPointer(ctx, info, receiver, field);
  return ctx.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${ctx.alignSuffix(field.type)}`);
}

function storeField(ctx: EmitContext, info: StructInfo, receiver: string, field: FieldInfo, value: string): void {
  const ty = llvmType(field.type);
  const ptr = fieldPointer(ctx, info, receiver, field);
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${ctx.alignSuffix(field.type)}`);
}

/**
 * Storage for one object of `info`: an entry-block alloca when `site` was
 * proved not to escape (WP6, always 8-aligned like arena objects so every
 * pointer attribute stays true), else `info.size` bytes bumped from the arena.
 */
function allocate(ctx: EmitContext, info: StructInfo, site: ts.Node): string {
  if (ctx.isStackSite(site)) return ctx.fn.emitAlloca(`${info.name}.obj`, structTypeName(info), 8);
  const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_alloc_struct")}(i64 ${info.size})`);
  return ctx.fn.emitValue(`bitcast i8* ${raw} to ${structTypeName(info)}*`);
}

/**
 * The LLVM constant for a field initializer, from its syntax and the field's
 * type alone. The checker only admits literals here (`isLiteralInitializer`),
 * and the node may belong to another module (an imported class `new`ed
 * without a constructor, or an inherited constructor, WP2b), whose type
 * table this emitter does not have.
 */
function initializerConstant(ctx: EmitContext, field: FieldInfo): string {
  const init = field.initializer!;
  const negated = ts.isPrefixUnaryExpression(init);
  const literal = negated ? (init as ts.PrefixUnaryExpression).operand : init;
  switch (literal.kind) {
    case ts.SyntaxKind.TrueKeyword:
      return "true";
    case ts.SyntaxKind.FalseKeyword:
      return "false";
    case ts.SyntaxKind.NullKeyword:
      return "null";
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return ctx.stringConstant((literal as ts.StringLiteral).text);
    default: {
      const n = Number((literal as ts.NumericLiteral).text) * (negated ? -1 : 1);
      if (isFloat(field.type)) return floatConstant(n, field.type);
      return field.type.kind === "i32" ? String(n | 0) : String(n);
    }
  }
}

/** Store the literal initializers of the fields `info` declares itself into the object at `receiver` (a `%struct.<info>*`). */
export function emitFieldInitializers(ctx: EmitContext, info: StructInfo, receiver: string): void {
  for (const field of ownFields(info)) {
    if (field.initializer) storeField(ctx, info, receiver, field, initializerConstant(ctx, field));
  }
}

/** `%struct.<from>*` -> `%struct.<to>*` for an ancestor `to` (WP2b): the base fields are a layout prefix. */
export function upcast(ctx: EmitContext, value: string, from: StructInfo, to: StructInfo): string {
  if (from === to) return value;
  return ctx.fn.emitValue(`bitcast ${structTypeName(from)}* ${value} to ${structTypeName(to)}*`);
}

/**
 * Run the construction of `info` on the object at `receiver` with `args`:
 * its constructor when it has one; otherwise its own initializers, then the
 * same for the base class (WP2b), which ends at the nearest ancestor
 * constructor (the one the checker matched `args` against) or at the root.
 */
function constructObject(ctx: EmitContext, info: StructInfo, receiver: string, args: readonly ts.Expression[]): void {
  if (info.ctor) {
    emitMethodCall(ctx, info.ctor, receiver, args);
    return;
  }
  emitFieldInitializers(ctx, info, receiver);
  if (info.base) constructObject(ctx, info.base, upcast(ctx, receiver, info, info.base), args);
}

/**
 * Constructor prologue: own initializer stores, then, for a derived class
 * whose body does not start with `super(...)`, the implicit `super()`
 * (the checker allowed the omission only when no ancestor constructor takes
 * parameters).
 */
export function emitConstructorPrologue(ctx: EmitContext, sig: FunctionSig): void {
  const info = sig.struct!;
  emitFieldInitializers(ctx, info, "%this");
  if (info.base && !explicitSuperCall(sig.decl as ts.ConstructorDeclaration)) {
    constructObject(ctx, info.base, upcast(ctx, "%this", info, info.base), []);
  }
}

/** `super(args)` (WP2b): construct the base part of `this`. */
export function emitSuperCall(ctx: EmitContext, expr: ts.CallExpression): string {
  const info = structInfo(ctx.program, ctx.program.bindings.get(expr.expression as unknown as ts.Identifier)!.type);
  constructObject(ctx, info.base!, upcast(ctx, "%this", info, info.base!), expr.arguments);
  return "void";
}

// ---- Expressions ----------------------------------------------------------------------

const emitThis: ExpressionEmitter = () => "%this";

/** `super` as the receiver of `super.m()` (WP2b): `this` seen as the base type. */
const emitSuper: ExpressionEmitter = (ctx, node) => {
  const self = structInfo(ctx.program, ctx.program.bindings.get(node as unknown as ts.Identifier)!.type);
  return upcast(ctx, "%this", self, structInfo(ctx.program, ctx.typeOf(node)));
};

const emitObjectLiteral: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ObjectLiteralExpression;
  const info = structInfo(ctx.program, ctx.typeOf(expr));
  const obj = allocate(ctx, info, expr);
  for (const prop of expr.properties) {
    const p = prop as ts.PropertyAssignment | ts.ShorthandPropertyAssignment;
    const field = info.fieldsByName.get((p.name as ts.Identifier).text)!;
    const value = ctx.emitExpression(ts.isPropertyAssignment(p) ? p.initializer : p.name);
    storeField(ctx, info, obj, field, value);
  }
  return obj;
};

export const classExpressionEmitters: EmitterTable<ExpressionEmitter> = {
  [ts.SyntaxKind.ThisKeyword]: emitThis,
  [ts.SyntaxKind.SuperKeyword]: emitSuper,
  [ts.SyntaxKind.ObjectLiteralExpression]: emitObjectLiteral,
};

// ---- Members --------------------------------------------------------------------------------

propertyEmitters.struct = (ctx, expr, receiver) => {
  const info = structInfo(ctx.program, receiver);
  const field = info.fieldsByName.get(expr.name.text)!;
  return loadField(ctx, info, ctx.emitExpression(expr.expression), field);
};

/** `call <ret> @Sym(<this>, args...)` for a method or constructor. */
function emitMethodCall(ctx: EmitContext, callee: FunctionSig, receiver: string, args: readonly ts.Expression[]): string {
  const operands = [`${llvmType(callee.params[0].type)} ${receiver}`];
  args.forEach((arg, i) => {
    operands.push(`${llvmType(callee.params[i + 1].type)} ${ctx.emitExpression(arg)}`);
  });
  const call = `call ${llvmType(callee.returnType)} @${callee.name}(${operands.join(", ")})`;
  if (callee.returnType.kind === "void") {
    ctx.fn.emit(call);
    return "void";
  }
  return ctx.fn.emitValue(call);
}

methodCallEmitters.struct = (ctx, expr, receiverType) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const callee = ctx.program.callees.get(expr)!;
  let receiver = ctx.emitExpression(access.expression);
  // An inherited method takes `this` as its declaring class (WP2b).
  const info = structInfo(ctx.program, receiverType);
  if (callee.struct !== info) receiver = upcast(ctx, receiver, info, callee.struct!);
  return emitMethodCall(ctx, callee, receiver, expr.arguments);
};

newEmitters["*"] = (ctx, expr) => {
  const info = structInfo(ctx.program, intrinsicType(ctx.program, expr)!); // the class named, not the type it converts to
  const obj = allocate(ctx, info, expr);
  constructObject(ctx, info, obj, expr.arguments ?? []);
  return obj;
};

/** Opcode per compound operator: [integer form, floating-point form]. */
const COMPOUND_OPCODES: Partial<Record<ts.SyntaxKind, [string, string]>> = {
  [ts.SyntaxKind.PlusEqualsToken]: ["add", "fadd"],
  [ts.SyntaxKind.MinusEqualsToken]: ["sub", "fsub"],
  [ts.SyntaxKind.AsteriskEqualsToken]: ["mul", "fmul"],
  [ts.SyntaxKind.SlashEqualsToken]: ["sdiv", "fdiv"],
  [ts.SyntaxKind.PercentEqualsToken]: ["srem", "frem"],
};

/** `recv.f = v` stores `v`; `recv.f op= v` reads the field first, as JS does. */
const emitFieldAssignment: BinaryEmitter = (ctx, expr) => {
  const target = expr.left as ts.PropertyAccessExpression;
  const info = structInfo(ctx.program, ctx.typeOf(target.expression));
  const field = info.fieldsByName.get(target.name.text)!;
  const receiver = ctx.emitExpression(target.expression);
  if (expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const value = ctx.emitExpression(expr.right);
    storeField(ctx, info, receiver, field, value);
    return value;
  }
  const ptr = fieldPointer(ctx, info, receiver, field);
  const ty = llvmType(field.type);
  const old = ctx.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${ctx.alignSuffix(field.type)}`);
  const rhs = ctx.emitExpression(expr.right);
  const [intOp, floatOp] = COMPOUND_OPCODES[expr.operatorToken.kind]!;
  const value =
    isFloat(field.type)
      ? ctx.fn.emitValue(`${floatOp} ${ty} ${old}, ${rhs}`)
      : emitIntBinary(ctx, intOp, field.type, old, rhs);
  ctx.fn.emit(`store ${ty} ${value}, ${ty}* ${ptr}${ctx.alignSuffix(field.type)}`);
  return value;
};

assignmentTargetEmitters[ts.SyntaxKind.PropertyAccessExpression] = emitFieldAssignment;

// ---- Type declarations ------------------------------------------------------------------------

/**
 * `%struct.X = type { ... }` for every struct visible in the module, plus
 * `type opaque` for struct types the module only points at (a field or a
 * parameter of an imported declaration whose class was not imported here).
 * Pointers to opaque types are legal; only field access needs the body.
 */
export function structTypeDeclarations(program: CheckedProgram): string[] {
  const lines: string[] = [];
  const declared = new Set<string>();
  const referenced = new Set<string>();
  const note = (t: StaticType) => {
    if (t.kind === "struct") referenced.add(t.name);
  };
  const noteSig = (sig: FunctionSig) => {
    for (const p of sig.params) note(p.type);
    note(sig.returnType);
  };
  for (const info of program.structs.values()) {
    if (declared.has(info.name)) continue;
    declared.add(info.name);
    const body = info.fields.map((f) => llvmType(f.type)).join(", ");
    lines.push(`%struct.${info.name} = type {${body ? ` ${body} ` : ""}}`);
    for (const f of info.fields) note(f.type);
    // Inherited constructors and methods (WP2b) are called through the base
    // type, which an importer of the derived class alone only points at.
    for (let c: StructInfo | undefined = info; c; c = c.base) {
      note(c.type);
      for (const m of c.methods.values()) noteSig(m);
      if (c.ctor) noteSig(c.ctor);
    }
  }
  for (const sig of program.functions) noteSig(sig);
  for (const imp of program.imports) if (imp.sig) noteSig(imp.sig);
  for (const name of referenced) if (!declared.has(name)) lines.push(`%struct.${name} = type opaque`);
  return lines;
}

/**
 * Constructor and methods an importer of `imp.struct` may call, inherited
 * ones included (WP2b: `new D()` may run `B.constructor`, `d.m()` may be
 * `B.m`); each gets a `declare`.
 */
export function importedStructFunctions(imp: ImportBinding): FunctionSig[] {
  const out: FunctionSig[] = [];
  for (let c = imp.struct; c; c = c.base) {
    if (c.ctor) out.push(c.ctor);
    out.push(...c.methods.values());
  }
  return out;
}

// ---- Facts for attributes.ts --------------------------------------------------------------------

function isMethodCallee(node: ts.PropertyAccessExpression): boolean {
  return ts.isCallExpression(node.parent) && node.parent.expression === node;
}

/**
 * Memory facts for class constructs, mirroring the emitters above:
 *   field read        readsMemory
 *   field store       write
 *   new / literal     write, calls the inline allocator (and the constructor)
 * A stack object (WP6) is the function's own alloca: its allocation and the
 * field accesses through a local that only ever holds it are not memory
 * effects. The constructor call still is whatever the constructor does.
 */
export const collectClassFacts = (program: CheckedProgram, node: ts.Node, facts: MemoryFacts): void => {
  if (ts.isPropertyAccessExpression(node) && program.types.get(node.expression)?.kind === "struct") {
    if (isMethodCallee(node)) return; // the call itself is reported through `program.callees`
    if (isStackOwned(program, facts, node.expression)) return; // own alloca (WP6)
    const parent = node.parent;
    const isTarget = ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind);
    if (isTarget) {
      facts.effect = "write";
      if (parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) facts.readsMemory = true;
    } else {
      facts.readsMemory = true;
    }
  } else if (ts.isNewExpression(node) && program.types.get(node)?.kind === "struct") {
    if (!facts.stackSites.has(node)) {
      facts.effect = "write";
      facts.callees.add("sts_alloc_struct");
    }
    const ctor = effectiveConstructor(structInfo(program, intrinsicType(program, node)!)); // own or inherited (WP2b)
    if (ctor) facts.callees.add(ctor.name);
  } else if (ts.isObjectLiteralExpression(node) && !facts.stackSites.has(node)) {
    facts.effect = "write";
    facts.callees.add("sts_alloc_struct");
  }
};

factCollectors.push(collectClassFacts);
