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
 *                    are stored inline instead of the call.
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
 * `collectClassFacts` reports field reads (`readsMemory`), field stores and
 * allocations (`write`, callee `sts_alloc_struct`, plus the constructor) to
 * `attributes.ts`, which owns the per-parameter pointer facts.
 */
import ts from "typescript";
import { CheckedProgram, FieldInfo, FunctionSig, ImportBinding, StructInfo } from "../../checker";
import { isAssignmentOperator } from "../../checker/classes";
import { StaticType, llvmType } from "../../types";
import { emitIntBinary } from "./arithmetic";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter } from "./context";
import {
  MemoryFacts,
  assignmentTargetEmitters,
  factCollectors,
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

/** Allocate `info.size` bytes in the arena and return the typed pointer. */
function allocate(ctx: EmitContext, info: StructInfo): string {
  const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("sts_alloc_struct")}(i64 ${info.size})`);
  return ctx.fn.emitValue(`bitcast i8* ${raw} to ${structTypeName(info)}*`);
}

/** Store every literal initializer of `info` into the object at `receiver`. */
export function emitFieldInitializers(ctx: EmitContext, info: StructInfo, receiver: string): void {
  for (const field of info.fields) {
    if (field.initializer) storeField(ctx, info, receiver, field, ctx.emitExpression(field.initializer));
  }
}

// ---- Expressions ----------------------------------------------------------------------

const emitThis: ExpressionEmitter = () => "%this";

const emitObjectLiteral: ExpressionEmitter = (ctx, node) => {
  const expr = node as ts.ObjectLiteralExpression;
  const info = structInfo(ctx.program, ctx.typeOf(expr));
  const obj = allocate(ctx, info);
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

methodCallEmitters.struct = (ctx, expr) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const callee = ctx.program.callees.get(expr)!;
  const receiver = ctx.emitExpression(access.expression);
  return emitMethodCall(ctx, callee, receiver, expr.arguments);
};

newEmitters["*"] = (ctx, expr) => {
  const info = structInfo(ctx.program, ctx.typeOf(expr));
  const obj = allocate(ctx, info);
  if (info.ctor) emitMethodCall(ctx, info.ctor, obj, expr.arguments ?? []);
  else emitFieldInitializers(ctx, info, obj);
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
    field.type.kind === "f64" ? ctx.fn.emitValue(`${floatOp} ${ty} ${old}, ${rhs}`) : emitIntBinary(ctx, intOp, ty, old, rhs);
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
    for (const m of info.methods.values()) noteSig(m);
    if (info.ctor) noteSig(info.ctor);
  }
  for (const sig of program.functions) noteSig(sig);
  for (const imp of program.imports) if (imp.sig) noteSig(imp.sig);
  for (const name of referenced) if (!declared.has(name)) lines.push(`%struct.${name} = type opaque`);
  return lines;
}

/** Constructor and methods an importer of `imp.struct` may call; each gets a `declare`. */
export function importedStructFunctions(imp: ImportBinding): FunctionSig[] {
  if (!imp.struct) return [];
  return [...(imp.struct.ctor ? [imp.struct.ctor] : []), ...imp.struct.methods.values()];
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
 */
export const collectClassFacts = (program: CheckedProgram, node: ts.Node, facts: MemoryFacts): void => {
  if (ts.isPropertyAccessExpression(node) && program.types.get(node.expression)?.kind === "struct") {
    if (isMethodCallee(node)) return; // the call itself is reported through `program.callees`
    const parent = node.parent;
    const isTarget = ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind);
    if (isTarget) {
      facts.effect = "write";
      if (parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) facts.readsMemory = true;
    } else {
      facts.readsMemory = true;
    }
  } else if (ts.isNewExpression(node) && program.types.get(node)?.kind === "struct") {
    facts.effect = "write";
    facts.callees.add("sts_alloc_struct");
    const info = structInfo(program, program.types.get(node)!);
    if (info.ctor) facts.callees.add(info.ctor.name);
  } else if (ts.isObjectLiteralExpression(node)) {
    facts.effect = "write";
    facts.callees.add("sts_alloc_struct");
  }
};

factCollectors.push(collectClassFacts);
