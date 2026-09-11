/**
 * Class, interface and struct lowering (WP2).
 *
 * Layout: `%struct.<Name> = type { <field types in declaration order> }`,
 * natural alignment (i32 4, double 8, i1 1, pointers 8), size and padding
 * computed by `checker/classes.ts` exactly as clang does for the same C
 * struct. A value of struct type is a `%struct.<Name>*` into the arena.
 *
 *   new P(a, b)      `%0 = call i8* @nish_alloc_struct(i64 <size>)`
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
 * That one `bitcast` is the only widening there is (WP25): a class that
 * `implements` an interface lists the interface's fields first, so every `I`
 * operation works on a `C` object at the same offsets, and `c.x` is one
 * `getelementptr` into the flat layout either way. A class is a prefix of
 * nothing but the interfaces it names, so `c.m()` is always `@C.m` and there
 * is no vtable, no `super`, and nothing for a call site to choose between.
 *
 * `collectClassFacts` reports field reads (`readsMemory`), field stores and
 * allocations (`write`, callee `nish_alloc_struct`, plus the constructor) to
 * `attributes.ts`, which owns the per-parameter pointer facts.
 */
import ts from "typescript";
import { CheckedProgram, FieldInfo, FunctionSig, ImportBinding, StructInfo } from "../../checker/index.js";
import { intrinsicType, isAssignmentOperator } from "../../checker/classes.js";
import { ResultType, StaticType, isFloat, llvmAbiType, llvmType, resultByValue } from "../../types.js";
import { beginReclaim, endReclaim } from "./arena.js";
import { emitIntBinary } from "./arithmetic.js";
import { emitBitwiseCombine, isBitwiseCompoundOperator } from "./bitwise.js";
import {
  emitPackedResult,
  emitResultReturningCall,
  privateResultAbi,
  resultTypeDecl,
} from "./result.js";
import { floatConstant } from "./builtins.js";
import { BinaryEmitter, EmitContext, EmitterTable, ExpressionEmitter } from "./context.js";
import {
  MemoryFacts,
  assignmentTargetEmitters,
  factCollectors,
  isStackOwned,
  methodCallEmitters,
  newEmitters,
  propertyEmitters,
} from "./members.js";

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
  const raw = ctx.fn.emitValue(`call i8* ${ctx.useRuntime("nish_alloc_struct")}(i64 ${info.size})`);
  return ctx.fn.emitValue(`bitcast i8* ${raw} to ${structTypeName(info)}*`);
}

/**
 * The LLVM constant for a field initializer, from its syntax and the field's
 * type alone. The checker only admits literals here (`isLiteralInitializer`),
 * and the node may belong to another module (an imported class `new`ed
 * without a constructor), whose type table this emitter does not have.
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

/** Store the literal initializers of `info`'s fields into the object at `receiver` (a `%struct.<info>*`). */
export function emitFieldInitializers(ctx: EmitContext, info: StructInfo, receiver: string): void {
  for (const field of info.fields) {
    if (field.initializer) storeField(ctx, info, receiver, field, initializerConstant(ctx, field));
  }
}

/**
 * Run the construction of `info` on the object at `receiver` with `args`: its
 * constructor when it has one, otherwise its literal initializers.
 */
function constructObject(
  ctx: EmitContext,
  info: StructInfo,
  receiver: string,
  args: readonly ts.Expression[],
  site: ts.Node
): void {
  if (info.ctor) {
    emitMethodCall(ctx, info.ctor, receiver, args, site);
    return;
  }
  emitFieldInitializers(ctx, info, receiver);
}

/** Constructor prologue: the literal initializer stores, before the body runs. */
export function emitConstructorPrologue(ctx: EmitContext, sig: FunctionSig): void {
  emitFieldInitializers(ctx, sig.struct!, "%this");
}

// ---- Expressions ----------------------------------------------------------------------

const emitThis: ExpressionEmitter = () => "%this";

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
  [ts.SyntaxKind.ObjectLiteralExpression]: emitObjectLiteral,
};

// ---- Members --------------------------------------------------------------------------------

propertyEmitters.struct = (ctx, expr, receiver) => {
  const info = structInfo(ctx.program, receiver);
  const field = info.fieldsByName.get(expr.name.text)!;
  return loadField(ctx, info, ctx.emitExpression(expr.expression), field);
};

/** `call <ret> @Sym(<this>, args...)` for a method or constructor. */
function emitMethodCall(
  ctx: EmitContext,
  callee: FunctionSig,
  receiver: string,
  args: readonly ts.Expression[],
  site: ts.Node
): string {
  const privateAbi = privateResultAbi(ctx, callee);
  const operands = [`${llvmType(callee.params[0].type)} ${receiver}`];
  args.forEach((arg, i) => {
    // WP17: as in `emitCall`, a `Result` argument the ABI packs travels as the word.
    const want = callee.params[i + 1].type;
    const value = resultByValue(want)
      ? emitPackedResult(ctx, arg, want as ResultType, privateAbi)
      : ctx.emitExpression(arg);
    operands.push(`${llvmAbiType(want, privateAbi)} ${value}`);
  });
  // WP9: after the receiver and the arguments, so the bracket holds only what
  // the method itself allocates (emit/arena.ts, `beginReclaim`).
  const mark = beginReclaim(ctx, callee);
  const call = `call ${llvmAbiType(callee.returnType, privateAbi)} @${callee.name}(${operands.join(", ")})`;
  if (callee.returnType.kind === "void") {
    ctx.fn.emit(call);
    return "void";
  }
  // WP17: a small `Result` comes back in a register, exactly as it does from a
  // plain function; the unpacked object belongs to this caller.
  if (resultByValue(callee.returnType)) return emitResultReturningCall(ctx, call, callee.returnType, site, privateAbi);
  return endReclaim(ctx, mark, ctx.fn.emitValue(call));
}

methodCallEmitters.struct = (ctx, expr, receiverType) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const callee = ctx.program.callees.get(expr)!;
  const receiver = ctx.emitExpression(access.expression);
  return emitMethodCall(ctx, callee, receiver, expr.arguments, expr);
};

newEmitters["*"] = (ctx, expr) => {
  const info = structInfo(ctx.program, intrinsicType(ctx.program, expr)!); // the class named, not the type it converts to
  const obj = allocate(ctx, info, expr);
  constructObject(ctx, info, obj, expr.arguments ?? [], expr);
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

/** `+= -= *= /= %=` once `old` is loaded and the right operand is evaluated. */
const emitArithmeticCombine = (
  ctx: EmitContext,
  op: ts.SyntaxKind,
  type: StaticType,
  old: string,
  rhs: string
): string => {
  const [intOp, floatOp] = COMPOUND_OPCODES[op]!;
  return isFloat(type)
    ? ctx.fn.emitValue(`${floatOp} ${llvmType(type)} ${old}, ${rhs}`)
    : emitIntBinary(ctx, intOp, type, old, rhs);
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
  // One GEP for both halves of the read-modify-write, so `p.f op= e` addresses
  // the field once however the receiver was spelled.
  const ptr = fieldPointer(ctx, info, receiver, field);
  const ty = llvmType(field.type);
  const op = expr.operatorToken.kind;
  const old = ctx.fn.emitValue(`load ${ty}, ${ty}* ${ptr}${ctx.alignSuffix(field.type)}`);
  const value = isBitwiseCompoundOperator(op)
    ? emitBitwiseCombine(ctx, op, field.type, old, expr.right)
    : emitArithmeticCombine(ctx, op, field.type, old, ctx.emitExpression(expr.right));
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
  // A `Result` layout is derived from the type, not declared (WP16), so it is
  // emitted here rather than looked up: a field or signature that mentions one
  // is enough to need it in this module.
  const results = new Set<string>();
  const note = (t: StaticType) => {
    if (t.kind === "struct") referenced.add(t.name);
    else if (t.kind === "array") note(t.elem);
    else if (t.kind === "nullable") note(t.inner);
    else if (t.kind === "result") {
      note(t.ok);
      note(t.err);
      results.add(resultTypeDecl(t));
    }
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
    note(info.type);
    for (const m of info.methods.values()) noteSig(m);
    if (info.ctor) noteSig(info.ctor);
  }
  for (const sig of program.functions) noteSig(sig);
  for (const imp of program.imports) if (imp.sig) noteSig(imp.sig);
  for (const name of referenced) if (!declared.has(name)) lines.push(`%struct.${name} = type opaque`);
  lines.push(...results);
  return lines;
}

/** Constructor and methods an importer of `imp.struct` may call; each gets a `declare`. */
export function structFunctions(info: StructInfo | undefined): FunctionSig[] {
  if (!info) return [];
  return [...(info.ctor ? [info.ctor] : []), ...info.methods.values()];
}

export function importedStructFunctions(imp: ImportBinding): FunctionSig[] {
  return structFunctions(imp.struct);
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
      facts.callees.add("nish_alloc_struct");
    }
    const ctor = structInfo(program, intrinsicType(program, node)!).ctor;
    if (ctor) facts.callees.add(ctor.name);
  } else if (ts.isObjectLiteralExpression(node) && !facts.stackSites.has(node)) {
    facts.effect = "write";
    facts.callees.add("nish_alloc_struct");
  }
};

factCollectors.push(collectClassFacts);
