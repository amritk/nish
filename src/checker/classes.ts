/**
 * Classes, interfaces and structs (WP2).
 *
 * A `class` or `interface` declaration becomes one `%struct.<Name>` LLVM
 * type with its fields in declaration order at natural alignment, laid out
 * exactly as clang lays out the equivalent C struct (`computeLayout`).
 * Values of struct type are pointers to arena memory; there is no copy
 * semantics and no vtable.
 *
 * Single inheritance (WP2b): `class D extends B` lays `D` out as `B`'s
 * fields followed by `D`'s own (`inheritFields`), so a `%struct.D*` is a
 * valid `%struct.B*` after one `bitcast`. A `D` value converts to `B` (or
 * any ancestor) wherever a `B` is expected, exactly like a class converts to
 * an interface it implements (`coerceToContext`); nothing converts back.
 * Methods are resolved by the *static* type of the receiver (`findMethod`
 * walks the chain; an override must keep the signature) and `super.m()`
 * names the base implementation; there is no virtual dispatch. A derived
 * constructor starts with `super(...)` (or an implicit `super()` when the
 * nearest ancestor constructor takes no parameters), which runs the nearest
 * ancestor constructor (`baseConstruction`); `this` may not be used before
 * it. A class without a constructor inherits the nearest ancestor's.
 *
 * Signature collection runs in three sub-passes so declarations may refer to
 * each other in any order (see `Checker.collectSignatures`):
 *   1a. `declareStruct`        register the name (creates the StaticType)
 *   1b. `collectStructMembers` base class, fields, layout, method/constructor signatures
 *   1c. `finishStruct`         `implements` check, `super(...)` shape, definite assignment
 * Method and constructor bodies are then ordinary functions in
 * `CheckedProgram.functions` whose first parameter is `this`.
 *
 * Rules enforced here (each with a negative test in `tests/cases/reject_cls_*`):
 *   - every field has a type annotation; an initializer must be a literal
 *     (number, string, boolean, or a negated number) of the field's type;
 *   - no `static`, `abstract`, getters/setters, optional fields, index
 *     signatures, parameter properties, or class expressions;
 *     `public`/`private`/`protected` are accepted and ignored;
 *   - `extends` names one class declared in the same module (not an
 *     interface, not an import, not itself or a descendant); an exported
 *     class extends an exported class; a derived class neither redeclares an
 *     inherited field nor overrides a method with a different signature;
 *   - `super(...)` is the first statement of a derived constructor, is
 *     required when the nearest ancestor constructor has parameters, and
 *     `this` / `super` do not appear before it; `super` is otherwise only
 *     the receiver of a method call inside a derived class;
 *   - `readonly` fields are assignable only as `this.f = ...` in the
 *     constructor of the class that declares them;
 *   - definite assignment: after the constructor runs every field has a
 *     value. Fields with initializers are stored first; every other field
 *     must be assigned by a top-level `this.f = ...` statement (or in both
 *     arms of an `if`) before any `return`, and no field may be read, and
 *     no method called on `this`, before it is assigned. Assignments inside
 *     loops or nested expressions do not count (conservative by design). A
 *     class without a constructor must initialise every field inline;
 *   - `this` is valid only inside methods and constructors;
 *   - object literals need a contextual class/interface type
 *     (`const p: P = { ... }`, a return, an argument, a field store) and
 *     must set every field exactly once, with no extras;
 *   - a class that `implements` an interface has exactly the interface's
 *     fields, in order, with identical types; such a class value converts
 *     to the interface type implicitly (recorded in `program.coercions`).
 */
import ts from "typescript";
import {
  StaticType,
  VOID,
  alignOf,
  assignable,
  isNumeric,
  resolveTypeNode,
  sameType,
  stripNull,
  typeToString,
} from "../types";
import { BinaryChecker, CheckContext, CheckerTable, ExpressionChecker } from "./context";
import { hasExportModifier } from "./declarations";
import { assignmentTargetCheckers, methodCallCheckers, newCheckers, propertyCheckers } from "./members";
import { CheckedProgram, FieldInfo, FunctionSig, LocalVar, Param, StructInfo } from "./program";
import { Scope } from "./scope";

// ---- Layout ------------------------------------------------------------------------

/**
 * Size in bytes of a value of type `t` stored in a struct field. Pointers are
 * 8 bytes; `bool` is one byte (`i1` has store size 1 in LLVM's data layout,
 * matching C `_Bool`). Kinds added by later packages default to their
 * alignment, which is right for every scalar and pointer type.
 */
export function sizeOf(t: StaticType): number {
  switch (t.kind) {
    case "i32":
      return 4;
    case "f64":
      return 8;
    case "bool":
      return 1;
    case "string":
    case "struct":
      return 8;
    case "void":
      throw new Error("sizeOf(void)");
    default:
      return alignOf(t);
  }
}

function roundUp(n: number, align: number): number {
  return Math.ceil(n / align) * align;
}

/** Assign offsets in declaration order and compute size/alignment as clang does for a C struct. */
export function computeLayout(fields: FieldInfo[]): { size: number; align: number } {
  let offset = 0;
  let align = 1;
  for (const f of fields) {
    const a = alignOf(f.type);
    offset = roundUp(offset, a);
    f.offset = offset;
    offset += sizeOf(f.type);
    if (a > align) align = a;
  }
  return { size: roundUp(offset, align), align };
}

// ---- Registry helpers ------------------------------------------------------------------

/** The StructInfo behind a struct-typed value; the emitter relies on the same lookup. */
export function structOf(ctx: CheckContext, t: StaticType): StructInfo {
  if (t.kind !== "struct") throw new Error(`structOf: not a struct type (${t.kind})`);
  const info = ctx.program.structs.get(t.name);
  if (!info) throw new Error(`structOf: no struct named \`${t.name}\``);
  return info;
}

/**
 * The struct names that appear in `info`'s *types*: its field types and the
 * parameter and return types of its methods and constructor — its own and
 * the ones it inherits — through arrays and nullables.
 *
 * An importer needs these even though it never names them. `import { Box }`
 * brings in a class whose `all(): Item[]` hands out `Item` values, and the
 * checker has to find `Item`'s methods and the emitter its field offsets in a
 * module where `Item` was never written. See `Checker.registerReachableStructs`.
 *
 * The base chain is walked but its *names* are not collected, and neither are
 * the `implements` names: a base and an interface are reached through the
 * `StructInfo` pointer the checker already holds, never by a lookup, so
 * registering them would only turn a `%struct.Base = type opaque` an importer
 * is entitled to into a full definition (`tests/link/extends_import`).
 */
/** The struct names in one signature's parameter and return types. */
export function signatureStructNames(sig: FunctionSig): string[] {
  const names = new Set<string>();
  const note = (t: StaticType): void => {
    if (t.kind === "struct") names.add(t.name);
    else if (t.kind === "array") note(t.elem);
    else if (t.kind === "nullable") note(t.inner);
  };
  for (const p of sig.params.slice(sig.struct ? 1 : 0)) note(p.type);
  note(sig.returnType);
  return [...names];
}

export function referencedStructNames(info: StructInfo): string[] {
  const names = new Set<string>();
  const note = (t: StaticType): void => {
    if (t.kind === "struct") names.add(t.name);
    else if (t.kind === "array") note(t.elem);
    else if (t.kind === "nullable") note(t.inner);
  };
  // `this` is skipped: it is the owner or its base, which is reached through
  // the `StructInfo` pointer rather than by name, and noting it would pull an
  // inherited constructor's `%struct.Base` in behind a derived class.
  const noteSig = (sig: FunctionSig): void => {
    for (const p of sig.params.slice(sig.struct ? 1 : 0)) note(p.type);
    note(sig.returnType);
  };
  for (let c: StructInfo | undefined = info; c; c = c.base) {
    for (const f of c.fields) note(f.type);
    for (const m of c.methods.values()) noteSig(m);
    if (c.ctor) noteSig(c.ctor);
  }
  names.delete(info.name);
  return [...names];
}

function modifierKinds(node: ts.Node): ts.SyntaxKind[] {
  return ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []).map((m) => m.kind) : [];
}

/**
 * True when `t` is a class type that lists interface `iface` in its
 * `implements` clause, or inherits such a clause: the base's fields are the
 * prefix of the derived layout, so the interface's fields are still there.
 */
export function implementsInterface(ctx: CheckContext, t: StaticType, iface: StaticType): boolean {
  if (t.kind !== "struct" || iface.kind !== "struct" || t.name === iface.name) return false;
  const cls = ctx.program.structs.get(t.name);
  const target = ctx.program.structs.get(iface.name);
  if (!cls || !target || cls.kind !== "class" || target.kind !== "interface") return false;
  for (let c: StructInfo | undefined = cls; c; c = c.base) if (c.implements.includes(iface.name)) return true;
  return false;
}

/** True when `t` is a class type whose `extends` chain reaches `ancestor` (WP2b). */
export function isSubclassOf(ctx: CheckContext, t: StaticType, ancestor: StaticType): boolean {
  if (t.kind !== "struct" || ancestor.kind !== "struct" || t.name === ancestor.name) return false;
  const cls = ctx.program.structs.get(t.name);
  for (let c = cls?.base; c; c = c.base) if (c.name === ancestor.name) return true;
  return false;
}

/** The method `name` visible on `info`: its own, else the nearest ancestor's (static dispatch, WP2b). */
export function findMethod(info: StructInfo, name: string): FunctionSig | undefined {
  for (let c: StructInfo | undefined = info; c; c = c.base) {
    const m = c.methods.get(name);
    if (m) return m;
  }
  return undefined;
}

/** The constructor `new C(...)` runs: `C`'s own, else the nearest ancestor's (an inherited constructor, WP2b). */
export function effectiveConstructor(info: StructInfo): FunctionSig | undefined {
  for (let c: StructInfo | undefined = info; c; c = c.base) if (c.ctor) return c.ctor;
  return undefined;
}

/** The class that declares `field` (the highest ancestor whose layout still contains it). */
export function fieldOwner(info: StructInfo, field: FieldInfo): StructInfo {
  let c = info;
  while (c.base && field.index < c.base.fields.length) c = c.base;
  return c;
}

/**
 * The type an expression produces before the coercion recorded on it, if any
 * (class -> interface, WP2; derived -> base, WP2b): `program.types` holds the
 * converted type, but `new C(...)` still allocates and constructs a `C`.
 */
export function intrinsicType(program: CheckedProgram, expr: ts.Expression): StaticType | undefined {
  return program.coercions.get(expr)?.from ?? program.types.get(expr);
}

/** The fields `info` declares itself: everything after the inherited prefix. */
export function ownFields(info: StructInfo): FieldInfo[] {
  return info.fields.slice(info.base?.fields.length ?? 0);
}

/**
 * How the base part of a derived object is built (WP2b), shared by the
 * checker's definite-assignment rules, the emitter's `super(...)` lowering,
 * and the attribute analysis: walking up from `cls.base`, every ancestor
 * without a constructor has its own initializers stored directly
 * (`stores`), until the nearest ancestor constructor (`ctor`), which takes
 * the `super(...)` arguments and finishes the job.
 */
export function baseConstruction(cls: StructInfo): { ctor?: FunctionSig; stores: boolean } {
  let stores = false;
  for (let c = cls.base; c; c = c.base) {
    if (c.ctor) return { ctor: c.ctor, stores };
    if (ownFields(c).some((f) => f.initializer)) stores = true;
  }
  return { stores };
}

/** The `super(...)` call when it is the first statement of a constructor body, syntactically. */
export function explicitSuperCall(decl: ts.ConstructorDeclaration): ts.CallExpression | undefined {
  const first = decl.body?.statements[0];
  if (!first || !ts.isExpressionStatement(first)) return undefined;
  const expr = first.expression;
  return ts.isCallExpression(expr) && expr.expression.kind === ts.SyntaxKind.SuperKeyword ? expr : undefined;
}

// ---- Pass 1a: names --------------------------------------------------------------------

export function isStructDeclaration(stmt: ts.Statement): stmt is ts.ClassDeclaration | ts.InterfaceDeclaration {
  return ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt);
}

/** Register a class/interface name so annotations anywhere in the module can resolve it. */
export function declareStruct(ctx: CheckContext, decl: ts.ClassDeclaration | ts.InterfaceDeclaration): StructInfo {
  const kind = ts.isClassDeclaration(decl) ? "class" : "interface";
  if (!decl.name) throw ctx.error(`${kind === "class" ? "Classes" : "Interfaces"} must be named`, decl);
  const name = decl.name.text;
  if (name.startsWith("sts_")) throw ctx.error("Names starting with `sts_` are reserved for the runtime", decl.name);
  if (ctx.program.structs.has(name)) throw ctx.error(`Duplicate declaration of \`${name}\``, decl.name);
  if (ctx.sigs.has(name)) throw ctx.error(`\`${name}\` is already declared as a function`, decl.name);
  for (const m of modifierKinds(decl)) {
    if (m === ts.SyntaxKind.AbstractKeyword) throw ctx.error("Abstract classes are not supported", decl);
    if (m === ts.SyntaxKind.DeclareKeyword) throw ctx.error(`\`declare ${kind}\` is not supported`, decl);
    if (m === ts.SyntaxKind.DefaultKeyword) throw ctx.error("`export default` is not supported; use a named `export`", decl);
  }
  if (decl.typeParameters) throw ctx.error(`Generic ${kind === "class" ? "classes" : "interfaces"} are not supported`, decl);
  // A class's `extends` is resolved in pass 1b (`resolveBase`), once every name is registered.
  for (const clause of decl.heritageClauses ?? []) {
    if (clause.token === ts.SyntaxKind.ExtendsKeyword && kind === "interface") {
      throw ctx.error("Interface inheritance (`extends`) is not supported; list every field", clause);
    }
  }
  const info: StructInfo = {
    name,
    kind,
    type: { kind: "struct", name },
    fields: [],
    fieldsByName: new Map(),
    size: 0,
    align: 1,
    methods: new Map(),
    implements: [],
    decl,
    exported: hasExportModifier(decl),
  };
  ctx.program.structs.set(name, info);
  return info;
}

// ---- Pass 1b: members --------------------------------------------------------------------

/** Literal initializers only: the value is stored before the constructor body runs. */
function isLiteralInitializer(expr: ts.Expression): boolean {
  switch (expr.kind) {
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.NullKeyword: // `next: Node | null = null` (WP6)
      return true;
    case ts.SyntaxKind.PrefixUnaryExpression: {
      const u = expr as ts.PrefixUnaryExpression;
      return u.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(u.operand);
    }
    default:
      return false;
  }
}

function memberName(ctx: CheckContext, owner: StructInfo, name: ts.PropertyName): string {
  if (ts.isIdentifier(name)) return name.text;
  throw ctx.error(`Members of \`${owner.name}\` must have plain identifier names`, name);
}

function collectField(ctx: CheckContext, owner: StructInfo, decl: ts.PropertyDeclaration | ts.PropertySignature): void {
  const name = memberName(ctx, owner, decl.name);
  const what = `Field \`${name}\` of ${owner.kind} \`${owner.name}\``;
  if (owner.base) {
    const inherited = owner.base.fieldsByName.get(name);
    if (inherited) {
      throw ctx.error(
        `${what} is already declared in base class \`${fieldOwner(owner.base, inherited).name}\`; a derived class cannot redeclare or shadow an inherited field`,
        decl.name
      );
    }
    const method = findMethod(owner.base, name);
    if (method) throw ctx.error(`${what} clashes with method \`${name}\` inherited from \`${method.struct!.name}\``, decl.name);
  }
  if (owner.fieldsByName.has(name) || owner.methods.has(name)) {
    throw ctx.error(`Duplicate member \`${name}\` in ${owner.kind} \`${owner.name}\``, decl.name);
  }
  if (decl.questionToken) throw ctx.error(`${what} cannot be optional (every field has a fixed slot)`, decl);
  if (ts.isPropertyDeclaration(decl) && decl.exclamationToken) {
    throw ctx.error(`${what}: definite-assignment assertions (\`!\`) are not supported`, decl);
  }
  let readonly = false;
  for (const m of modifierKinds(decl)) {
    switch (m) {
      case ts.SyntaxKind.ReadonlyKeyword:
        readonly = true;
        break;
      case ts.SyntaxKind.PublicKeyword:
      case ts.SyntaxKind.PrivateKeyword:
      case ts.SyntaxKind.ProtectedKeyword:
        break; // accepted and ignored: access control is not enforced
      case ts.SyntaxKind.StaticKeyword:
        throw ctx.error(`${what}: \`static\` members are not supported (use a top-level function or const)`, decl);
      default:
        throw ctx.error(`${what}: unsupported modifier \`${ts.tokenToString(m)}\``, decl);
    }
  }
  if (!decl.type) throw ctx.error(`${what} needs a type annotation`, decl.name);
  const type = resolveTypeNode(decl.type, ctx.sf, ctx.opts);
  if (type.kind === "void") throw ctx.error(`${what} cannot have type void`, decl.type);

  const field: FieldInfo = { name, type, index: owner.fields.length, offset: 0, readonly, decl };
  const init = ts.isPropertyDeclaration(decl) ? decl.initializer : undefined;
  if (init) {
    if (!isLiteralInitializer(init)) {
      throw ctx.error(`${what}: initializers must be literals (assign other values in the constructor)`, init);
    }
    const initType = ctx.checkExpression(init, new Scope());
    if (!assignable(initType, type)) {
      throw ctx.error(`${what} is ${typeToString(type)} but its initializer is ${typeToString(initType)}`, init);
    }
    field.initializer = init;
  }
  owner.fields.push(field);
  owner.fieldsByName.set(name, field);
}

function collectParams(ctx: CheckContext, owner: StructInfo, decl: ts.SignatureDeclarationBase): Param[] {
  const params: Param[] = [{ name: "this", type: owner.type }];
  const seen = new Set<string>(["this"]);
  for (const p of decl.parameters) {
    if (!ts.isIdentifier(p.name)) throw ctx.error("Destructured parameters are not supported", p);
    if (p.dotDotDotToken) throw ctx.error("Rest parameters are not supported", p);
    if (p.questionToken || p.initializer) throw ctx.error("Optional/default parameters are not supported", p);
    if (modifierKinds(p).length > 0) {
      throw ctx.error("Parameter properties (`constructor(public x: number)`) are not supported; declare the field and assign it", p);
    }
    if (!p.type) throw ctx.error(`Parameter \`${p.name.text}\` needs a type annotation`, p);
    if (seen.has(p.name.text)) throw ctx.error(`Duplicate parameter \`${p.name.text}\``, p);
    seen.add(p.name.text);
    params.push({ name: p.name.text, type: resolveTypeNode(p.type, ctx.sf, ctx.opts) });
  }
  return params;
}

function rejectMethodModifiers(ctx: CheckContext, owner: StructInfo, decl: ts.Node, what: string): void {
  for (const m of modifierKinds(decl)) {
    switch (m) {
      case ts.SyntaxKind.PublicKeyword:
      case ts.SyntaxKind.PrivateKeyword:
      case ts.SyntaxKind.ProtectedKeyword:
        break;
      case ts.SyntaxKind.StaticKeyword:
        throw ctx.error(`${what} of class \`${owner.name}\`: \`static\` members are not supported (use a top-level function)`, decl);
      case ts.SyntaxKind.AsyncKeyword:
        throw ctx.error("async methods are not supported", decl);
      default:
        throw ctx.error(`${what} of class \`${owner.name}\`: unsupported modifier \`${ts.tokenToString(m)}\``, decl);
    }
  }
}

/** `(x: number, y: string): boolean`, the part of a method signature an override must keep. */
function describeSignature(sig: FunctionSig): string {
  const params = sig.params.slice(1).map((p) => `${p.name}: ${typeToString(p.type)}`);
  return `(${params.join(", ")}): ${typeToString(sig.returnType)}`;
}

function collectMethod(ctx: CheckContext, owner: StructInfo, decl: ts.MethodDeclaration): void {
  const name = memberName(ctx, owner, decl.name);
  const what = `Method \`${name}\``;
  const inheritedField = owner.base?.fieldsByName.get(name);
  if (inheritedField) {
    throw ctx.error(
      `${what} of class \`${owner.name}\` clashes with field \`${name}\` inherited from \`${fieldOwner(owner.base!, inheritedField).name}\``,
      decl.name
    );
  }
  if (owner.fieldsByName.has(name) || owner.methods.has(name)) {
    throw ctx.error(`Duplicate member \`${name}\` in class \`${owner.name}\``, decl.name);
  }
  rejectMethodModifiers(ctx, owner, decl, what);
  if (!decl.body) throw ctx.error(`${what} of class \`${owner.name}\` must have a body`, decl);
  if (decl.typeParameters) throw ctx.error("Generic methods are not supported", decl);
  if (decl.asteriskToken) throw ctx.error("Generators are not supported", decl);
  if (decl.questionToken) throw ctx.error(`${what} of class \`${owner.name}\` cannot be optional`, decl);
  if (!decl.type) throw ctx.error(`${what} of class \`${owner.name}\` needs an explicit return type annotation`, decl.name);
  const sig: FunctionSig = {
    name: `${owner.name}.${name}`,
    sourceName: `${owner.name}.${name}`,
    params: collectParams(ctx, owner, decl),
    returnType: resolveTypeNode(decl.type, ctx.sf, ctx.opts),
    decl,
    exported: owner.exported,
    struct: owner,
    role: "method",
  };
  // An override keeps the signature: calls resolve statically by the receiver's
  // declared type, so `B.m` and `D.m` must accept and return the same types.
  const overridden = owner.base && findMethod(owner.base, name);
  if (overridden) {
    const same =
      sig.params.length === overridden.params.length &&
      sig.params.slice(1).every((p, i) => sameType(p.type, overridden.params[i + 1].type)) &&
      sameType(sig.returnType, overridden.returnType);
    if (!same) {
      throw ctx.error(
        `${what} of class \`${owner.name}\` overrides \`${overridden.sourceName}\` with a different signature: \`${overridden.sourceName}\` is ${describeSignature(overridden)}, \`${sig.sourceName}\` is ${describeSignature(sig)} (an override keeps the signature; there is no overloading)`,
        decl.name
      );
    }
  }
  owner.methods.set(name, sig);
  ctx.program.functions.push(sig);
}

function collectConstructor(ctx: CheckContext, owner: StructInfo, decl: ts.ConstructorDeclaration): void {
  if (owner.ctor) throw ctx.error(`Class \`${owner.name}\` has more than one constructor (no overloads)`, decl);
  rejectMethodModifiers(ctx, owner, decl, "Constructor");
  if (!decl.body) throw ctx.error(`Constructor of class \`${owner.name}\` must have a body (no overload signatures)`, decl);
  if (decl.type) throw ctx.error("Constructors cannot declare a return type", decl.type);
  const sig: FunctionSig = {
    name: `${owner.name}.constructor`,
    sourceName: `${owner.name}.constructor`,
    params: collectParams(ctx, owner, decl),
    returnType: VOID,
    decl,
    exported: owner.exported,
    struct: owner,
    role: "constructor",
  };
  owner.ctor = sig;
  ctx.program.functions.push(sig);
}

/**
 * The class named by `extends` (WP2b), fully collected so its fields can be
 * copied. Only a class declared in this module qualifies: an imported base
 * would need its layout before pass 1b binds imports, and an interface has
 * no constructor or methods to inherit (`implements` covers the layout).
 */
function resolveBase(ctx: CheckContext, info: StructInfo, decl: ts.ClassDeclaration): StructInfo | undefined {
  const clause = decl.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ExtendsKeyword);
  if (!clause) return undefined;
  const target = clause.types[0];
  if (clause.types.length !== 1 || !ts.isIdentifier(target.expression) || target.typeArguments) {
    throw ctx.error("`extends` must name exactly one class declared in this module", clause);
  }
  const name = target.expression.text;
  const base = ctx.program.structs.get(name);
  if (!base) {
    const imported = ctx.program.imports.some((imp) => imp.localName === name);
    throw ctx.error(
      imported
        ? `Class \`${info.name}\` cannot extend imported class \`${name}\`: a base class must be declared in the same module`
        : `Unknown base class \`${name}\` (\`extends\` must name a class declared in this module)`,
      target.expression
    );
  }
  if (base.kind === "interface") {
    throw ctx.error(`Class \`${info.name}\` cannot extend interface \`${name}\`; use \`implements ${name}\``, target.expression);
  }
  if (base === info) throw ctx.error(`Class \`${info.name}\` cannot extend itself`, target.expression);
  if (base.collected === "collecting") {
    throw ctx.error(`Inheritance cycle: class \`${info.name}\` extends \`${name}\`, which already extends \`${info.name}\``, target.expression);
  }
  if (info.exported && !base.exported) {
    throw ctx.error(
      `Exported class \`${info.name}\` cannot extend non-exported class \`${name}\` (the base's constructor and methods are part of \`${info.name}\`'s ABI; export \`${name}\` too)`,
      target.expression
    );
  }
  collectStructMembers(ctx, base);
  return base;
}

/** Copy the base's fields, indices and offsets included: they are the prefix of the derived layout. */
function inheritFields(info: StructInfo, base: StructInfo): void {
  for (const f of base.fields) {
    const copy: FieldInfo = { ...f };
    info.fields.push(copy);
    info.fieldsByName.set(f.name, copy);
  }
}

/** Resolve the base class, fields, layout, methods and the constructor of a registered struct. */
export function collectStructMembers(ctx: CheckContext, info: StructInfo): void {
  if (info.collected === "done") return; // already pulled in as the base of an earlier class
  info.collected = "collecting";
  if (ts.isClassDeclaration(info.decl)) {
    info.base = resolveBase(ctx, info, info.decl);
    if (info.base) inheritFields(info, info.base);
    for (const clause of info.decl.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ImplementsKeyword) continue;
      for (const t of clause.types) {
        if (!ts.isIdentifier(t.expression) || t.typeArguments) {
          throw ctx.error("`implements` must name a declared interface", t);
        }
        const target = ctx.program.structs.get(t.expression.text);
        if (target?.kind !== "interface") {
          throw ctx.error(`\`${t.expression.text}\` is not a declared interface`, t.expression);
        }
        info.implements.push(target.name);
      }
    }
    for (const member of info.decl.members) {
      if (ts.isPropertyDeclaration(member)) collectField(ctx, info, member);
      else if (ts.isMethodDeclaration(member)) collectMethod(ctx, info, member);
      else if (ts.isConstructorDeclaration(member)) collectConstructor(ctx, info, member);
      else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
        throw ctx.error(`Getters and setters are not supported in class \`${info.name}\` (use a method)`, member);
      } else if (ts.isIndexSignatureDeclaration(member)) {
        throw ctx.error(`Index signatures are not supported in class \`${info.name}\` (object layout is fixed)`, member);
      } else if (ts.isSemicolonClassElement(member)) {
        // stray `;` between members: harmless
      } else {
        throw ctx.error(`Unsupported class member in \`${info.name}\`: ${ts.SyntaxKind[member.kind]}`, member);
      }
    }
  } else {
    for (const member of info.decl.members) {
      if (ts.isPropertySignature(member)) collectField(ctx, info, member);
      else if (ts.isMethodSignature(member)) {
        throw ctx.error(`Interface \`${info.name}\` cannot declare methods (interfaces describe layout only)`, member);
      } else if (ts.isIndexSignatureDeclaration(member)) {
        throw ctx.error(`Index signatures are not supported in interface \`${info.name}\` (object layout is fixed)`, member);
      } else {
        throw ctx.error(`Unsupported interface member in \`${info.name}\`: ${ts.SyntaxKind[member.kind]}`, member);
      }
    }
  }
  const layout = computeLayout(info.fields);
  info.size = layout.size;
  info.align = layout.align;
  info.collected = "done";
}

// ---- Pass 1c: implements and definite assignment -------------------------------------------

function checkImplements(ctx: CheckContext, cls: StructInfo): void {
  for (const ifaceName of cls.implements) {
    const iface = ctx.program.structs.get(ifaceName)!;
    const describe = (f: FieldInfo) => `\`${f.name}: ${typeToString(f.type)}\``;
    const n = Math.max(cls.fields.length, iface.fields.length);
    for (let i = 0; i < n; i++) {
      const want = iface.fields[i];
      const got = cls.fields[i];
      if (want && got && want.name === got.name && sameType(want.type, got.type)) continue;
      const why = !got
        ? `it lacks field ${describe(want)}`
        : !want
          ? `it declares extra field ${describe(got)}`
          : `field ${i + 1} is ${describe(want)} in \`${iface.name}\` but ${describe(got)} in \`${cls.name}\``;
      throw ctx.error(
        `Class \`${cls.name}\` does not implement \`${iface.name}\`: ${why} (fields must match exactly, in order)`,
        cls.decl.name!
      );
    }
  }
}

/** Fields assigned so far, or `terminated` once control cannot fall through. */
type Assigned = Set<string> | "terminated";

function isThisAccess(node: ts.Node): node is ts.PropertyAccessExpression {
  return ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword;
}

function isAssignmentTarget(node: ts.Node): boolean {
  const parent = node.parent;
  return ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind);
}

export function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

/** Fields that `expr` definitely assigns: `this.a = this.b = v` assigns both. */
function assignedBy(expr: ts.Expression, out: Set<string>): void {
  let inner = expr;
  while (ts.isParenthesizedExpression(inner)) inner = inner.expression;
  if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    if (isThisAccess(inner.left)) out.add(inner.left.name.text);
    assignedBy(inner.right, out);
  }
}

class DefiniteAssignment {
  constructor(
    private readonly ctx: CheckContext,
    private readonly cls: StructInfo
  ) {}

  private missing(assigned: Set<string>): FieldInfo | undefined {
    return this.cls.fields.find((f) => !assigned.has(f.name));
  }

  /** Every use of `this` in `node` must be safe given `assigned`. */
  private checkReads(node: ts.Node, assigned: Set<string>): void {
    const visit = (n: ts.Node): void => {
      if (isThisAccess(n)) {
        const field = n.name.text;
        const isCall = ts.isCallExpression(n.parent) && n.parent.expression === n;
        if (isCall) {
          const m = this.missing(assigned);
          if (m) {
            throw this.ctx.error(
              `Cannot call \`this.${field}()\` in the constructor of \`${this.cls.name}\` before field \`${m.name}\` is assigned`,
              n
            );
          }
        } else {
          const plainStore = isAssignmentTarget(n) && (n.parent as ts.BinaryExpression).operatorToken.kind === ts.SyntaxKind.EqualsToken;
          if (!plainStore && this.cls.fieldsByName.has(field) && !assigned.has(field)) {
            throw this.ctx.error(`Field \`${field}\` is read before it is assigned in the constructor of \`${this.cls.name}\``, n);
          }
        }
        return; // the only children are `this` itself and the member name
      }
      if (n.kind === ts.SyntaxKind.ThisKeyword) {
        const m = this.missing(assigned);
        if (m) {
          throw this.ctx.error(
            `\`this\` cannot be used as a value in the constructor of \`${this.cls.name}\` before field \`${m.name}\` is assigned`,
            n
          );
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  }

  private requireAll(assigned: Set<string>, at: ts.Node): void {
    const m = this.missing(assigned);
    if (m) {
      throw this.ctx.error(`Constructor of \`${this.cls.name}\` returns before field \`${m.name}\` is assigned`, at);
    }
  }

  statements(stmts: readonly ts.Statement[], assigned: Set<string>): Assigned {
    let current: Assigned = new Set(assigned);
    for (const stmt of stmts) {
      if (current === "terminated") break; // unreachable code is reported by the body check
      current = this.statement(stmt, current);
    }
    return current;
  }

  private body(stmt: ts.Statement, assigned: Set<string>): Assigned {
    return ts.isBlock(stmt) ? this.statements(stmt.statements, assigned) : this.statement(stmt, new Set(assigned));
  }

  private statement(stmt: ts.Statement, assigned: Set<string>): Assigned {
    if (ts.isBlock(stmt)) return this.statements(stmt.statements, assigned);
    if (ts.isExpressionStatement(stmt)) {
      this.checkReads(stmt.expression, assigned);
      assignedBy(stmt.expression, assigned);
      return assigned;
    }
    if (ts.isVariableStatement(stmt)) {
      this.checkReads(stmt, assigned);
      for (const d of stmt.declarationList.declarations) if (d.initializer) assignedBy(d.initializer, assigned);
      return assigned;
    }
    if (ts.isIfStatement(stmt)) {
      this.checkReads(stmt.expression, assigned);
      const thenSet = this.body(stmt.thenStatement, assigned);
      const elseSet: Assigned = stmt.elseStatement ? this.body(stmt.elseStatement, assigned) : assigned;
      if (thenSet === "terminated") return elseSet;
      if (elseSet === "terminated") return thenSet;
      return new Set([...thenSet].filter((f) => elseSet.has(f)));
    }
    if (ts.isReturnStatement(stmt)) {
      if (stmt.expression) this.checkReads(stmt.expression, assigned);
      this.requireAll(assigned, stmt);
      return "terminated";
    }
    if (ts.isThrowStatement(stmt)) {
      this.checkReads(stmt.expression, assigned);
      return "terminated";
    }
    if (ts.isBreakStatement(stmt) || ts.isContinueStatement(stmt)) return "terminated";
    if (ts.isIterationStatement(stmt, false)) {
      // The body may run zero times: its assignments do not count, but every
      // read and return inside it is still checked against what is known here.
      if (ts.isForStatement(stmt)) {
        if (stmt.initializer) this.checkReads(stmt.initializer, assigned);
        if (stmt.condition) this.checkReads(stmt.condition, assigned);
        if (stmt.incrementor) this.checkReads(stmt.incrementor, assigned);
      } else if (ts.isWhileStatement(stmt) || ts.isDoStatement(stmt)) {
        this.checkReads(stmt.expression, assigned);
      }
      this.body(stmt.statement, assigned);
      return assigned;
    }
    this.checkReads(stmt, assigned);
    return assigned;
  }
}

/** The first `super(...)` call anywhere inside `node`, however deeply nested. */
function findSuperCall(node: ts.Node): ts.CallExpression | undefined {
  let found: ts.CallExpression | undefined;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.SuperKeyword) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** The arguments of `super(...)` may not touch `this` (or `super`): the base part of the object does not exist yet. */
function rejectThisBeforeSuper(ctx: CheckContext, cls: StructInfo, call: ts.CallExpression): void {
  const visit = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.ThisKeyword || n.kind === ts.SyntaxKind.SuperKeyword) {
      throw ctx.error(`\`${n.getText(ctx.sf)}\` cannot be used before \`super(...)\` in the constructor of \`${cls.name}\``, n);
    }
    ts.forEachChild(n, visit);
  };
  for (const arg of call.arguments) visit(arg);
}

/**
 * Definite assignment of the fields `cls` declares itself. The inherited
 * prefix is the base constructor's job (WP2b): it is treated as assigned once
 * `super(...)` has run, which is before the body when the call is implicit and
 * after the first statement when it is explicit (and it must be the first
 * statement, with no `this` in its arguments).
 */
function checkDefiniteAssignment(ctx: CheckContext, cls: StructInfo): void {
  const own = ownFields(cls);
  const initialised = new Set(own.filter((f) => f.initializer).map((f) => f.name));
  if (!cls.ctor) {
    const missing = own.find((f) => !initialised.has(f.name));
    if (missing) {
      throw ctx.error(
        `Field \`${missing.name}\` of class \`${cls.name}\` has no initializer and no constructor assigns it`,
        missing.decl.name
      );
    }
    return;
  }
  const decl = cls.ctor.decl as ts.ConstructorDeclaration;
  const superCall = explicitSuperCall(decl);
  const anySuper = findSuperCall(decl.body!);
  let statements: readonly ts.Statement[] = decl.body!.statements;
  if (!cls.base) {
    if (anySuper) throw ctx.error(`\`super(...)\` in the constructor of \`${cls.name}\`, which does not extend a class`, anySuper);
  } else {
    if (anySuper && anySuper !== superCall) {
      throw ctx.error(`\`super(...)\` must be the first statement of the constructor of \`${cls.name}\``, anySuper);
    }
    const base = baseConstruction(cls);
    if (!superCall && base.ctor && base.ctor.params.length > 1) {
      throw ctx.error(
        `Constructor of \`${cls.name}\` must start with \`super(...)\`: the constructor of \`${base.ctor.struct!.name}\` takes ${base.ctor.params.length - 1} argument(s)`,
        decl
      );
    }
    if (superCall) {
      rejectThisBeforeSuper(ctx, cls, superCall);
      statements = statements.slice(1);
    }
    for (const f of cls.base.fields) initialised.add(f.name);
  }
  const result = new DefiniteAssignment(ctx, cls).statements(statements, initialised);
  if (result === "terminated") return;
  const missing = cls.fields.find((f) => !result.has(f.name));
  if (missing) {
    throw ctx.error(
      `Field \`${missing.name}\` of class \`${cls.name}\` is not definitely assigned in the constructor`,
      missing.decl.name
    );
  }
}

/** Checks that need every struct's members resolved: `implements` layouts and definite assignment. */
export function finishStruct(ctx: CheckContext, info: StructInfo): void {
  if (info.kind !== "class") return;
  checkImplements(ctx, info);
  checkDefiniteAssignment(ctx, info);
}

// ---- Contextual types --------------------------------------------------------------------

/**
 * The type the enclosing construct expects `expr` to have, derived from its
 * parent: a typed variable initializer, a `return`, an argument of a call to
 * a user function/method/constructor, the right-hand side of an assignment,
 * a property of an object literal (recursively), or a ternary arm. Used to
 * type object literals and to convert class values to interfaces they
 * implement. Undefined when the context imposes nothing.
 */
export function contextualType(ctx: CheckContext, expr: ts.Expression, scope: Scope): StaticType | undefined {
  const parent = expr.parent;
  if (!parent) return undefined;
  if (ts.isParenthesizedExpression(parent)) return contextualType(ctx, parent, scope);
  if (ts.isConditionalExpression(parent) && parent.condition !== expr) return contextualType(ctx, parent, scope);
  if (ts.isVariableDeclaration(parent)) {
    return parent.type && parent.initializer === expr ? resolveTypeNode(parent.type, ctx.sf, ctx.opts) : undefined;
  }
  if (ts.isReturnStatement(parent)) return ctx.current.returnType;
  if (ts.isBinaryExpression(parent)) {
    if (parent.right !== expr || parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return undefined;
    let target = parent.left;
    while (ts.isParenthesizedExpression(target)) target = target.expression;
    if (ts.isIdentifier(target)) return scope.lookup(target.text)?.type;
    if (ts.isPropertyAccessExpression(target)) {
      const receiver = ctx.program.types.get(target.expression);
      if (receiver?.kind !== "struct") return undefined;
      return ctx.program.structs.get(receiver.name)?.fieldsByName.get(target.name.text)?.type;
    }
    if (ts.isElementAccessExpression(target)) {
      // `xs[i] = v` (WP4): the element type; the target was checked before the value.
      const array = ctx.program.types.get(target.expression);
      return array?.kind === "array" ? array.elem : undefined;
    }
    return undefined;
  }
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    const index = parent.arguments?.indexOf(expr) ?? -1;
    if (index < 0) return undefined;
    const callee = calleeSignature(ctx, parent);
    if (!callee) return pushElementType(ctx, parent);
    const offset = callee.struct ? 1 : 0; // skip `this`
    return callee.params[index + offset]?.type;
  }
  if (ts.isArrayLiteralExpression(parent)) {
    // An element of `[a, b]` where a `T[]` is expected (WP4): `T`.
    const array = contextualType(ctx, parent, scope);
    return array?.kind === "array" ? array.elem : undefined;
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === expr && ts.isObjectLiteralExpression(parent.parent)) {
    const literalType = contextualType(ctx, parent.parent, scope);
    if (literalType?.kind !== "struct" || !ts.isIdentifier(parent.name)) return undefined;
    return ctx.program.structs.get(literalType.name)?.fieldsByName.get(parent.name.text)?.type;
  }
  return undefined;
}

/** The user function, method, or constructor a call resolves to, when that is already known. */
function calleeSignature(ctx: CheckContext, call: ts.CallExpression | ts.NewExpression): FunctionSig | undefined {
  if (ts.isNewExpression(call)) {
    if (!ts.isIdentifier(call.expression)) return undefined;
    const info = ctx.program.structs.get(call.expression.text);
    return info && effectiveConstructor(info);
  }
  if (call.expression.kind === ts.SyntaxKind.SuperKeyword) {
    const base = ctx.current.struct?.base; // `super(...)`: the nearest ancestor constructor
    return base && effectiveConstructor(base);
  }
  if (ts.isIdentifier(call.expression)) return ctx.sigs.get(call.expression.text);
  if (ts.isPropertyAccessExpression(call.expression)) {
    // The receiver is checked before the arguments, so its type is recorded by now.
    const receiver = ctx.program.types.get(call.expression.expression);
    if (receiver?.kind !== "struct") return undefined;
    const info = ctx.program.structs.get(receiver.name);
    return info && findMethod(info, call.expression.name.text);
  }
  return undefined;
}

/** `xs.push(v)` (WP4): the argument is expected to be an element of `xs`. */
function pushElementType(ctx: CheckContext, call: ts.CallExpression | ts.NewExpression): StaticType | undefined {
  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) return undefined;
  if (call.expression.name.text !== "push") return undefined;
  const receiver = ctx.program.types.get(call.expression.expression);
  return receiver?.kind === "array" ? receiver.elem : undefined;
}

/**
 * Called by the checker core for every expression: when a class value sits
 * where an interface it implements, or a class it extends (WP2b), is
 * expected, record the conversion and report the expected type so the
 * existing `sameType` checks accept it. Both are one pointer `bitcast`: the
 * interface has the identical layout, the base class is a layout prefix.
 */
export function coerceToContext(ctx: CheckContext, expr: ts.Expression, type: StaticType, scope: Scope): StaticType {
  if (type.kind !== "struct") return type;
  const want = contextualType(ctx, expr, scope);
  const target = want && stripNull(want); // a class converts to `I | null` as it does to `I` (WP6)
  if (!target || !(implementsInterface(ctx, type, target) || isSubclassOf(ctx, type, target))) return type;
  ctx.program.coercions.set(expr, { from: type, to: target });
  return target;
}

// ---- Expressions: `this`, object literals ------------------------------------------------------

const checkThis: ExpressionChecker = (ctx, node, scope) => {
  const v = scope.lookup("this");
  if (!v) throw ctx.error("`this` is only valid inside a method or constructor", node);
  ctx.program.bindings.set(node as unknown as ts.Identifier, v);
  return v.type;
};

/**
 * `super` as a value (WP2b): only as the receiver of `super.m(...)` inside a
 * method or constructor of a derived class. It denotes `this` seen as the
 * base type, so the method lookup starts at the base (static dispatch) and
 * the emitter passes `this` bitcast. It is bound to the `this` local so the
 * attribute analysis sees the pointer flow to the callee.
 */
const checkSuper: ExpressionChecker = (ctx, node, scope) => {
  const cls = ctx.current.struct;
  const self = scope.lookup("this");
  if (!cls || !self) throw ctx.error("`super` is only valid inside a method or constructor of a class that `extends` another class", node);
  if (!cls.base) throw ctx.error(`\`super\` in class \`${cls.name}\`, which does not extend a class`, node);
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
    const called = ts.isCallExpression(parent.parent) && parent.parent.expression === parent;
    if (!called) {
      throw ctx.error(
        `\`super.${parent.name.text}\` is not supported: inherited fields are read and written as \`this.${parent.name.text}\` (only \`super.method(...)\` is allowed)`,
        parent
      );
    }
  } else {
    throw ctx.error("`super` can only be used as `super.method(...)`, or as `super(...)` at the start of a constructor", node);
  }
  ctx.program.bindings.set(node as unknown as ts.Identifier, self);
  return cls.base.type;
};

/**
 * `super(args)` (WP2b), reached from `checkCall`: the first statement of a
 * derived constructor (pass 1c checked the placement and that `this` is not
 * used in the arguments). The arguments are checked against the nearest
 * ancestor constructor, which is recorded in `callees`; without one the
 * call takes no arguments and only stores the ancestors' initializers.
 */
export function checkSuperCall(ctx: CheckContext, expr: ts.CallExpression, scope: Scope): StaticType {
  const cls = ctx.current.struct;
  if (!cls || ctx.current.role !== "constructor") {
    throw ctx.error("`super(...)` is only valid as the first statement of the constructor of a class that `extends` another class", expr);
  }
  if (!cls.base) throw ctx.error(`\`super(...)\` in the constructor of \`${cls.name}\`, which does not extend a class`, expr);
  if (explicitSuperCall(ctx.current.decl as ts.ConstructorDeclaration) !== expr) {
    throw ctx.error(`\`super(...)\` must be the first statement of the constructor of \`${cls.name}\``, expr);
  }
  const { ctor } = baseConstruction(cls);
  if (ctor) {
    checkMethodArguments(ctx, expr, ctor, expr.arguments, "super", scope);
    ctx.program.callees.set(expr, ctor);
  } else if (expr.arguments.length > 0) {
    throw ctx.error(`\`super\` expects 0 argument(s) (\`${cls.base.name}\` has no constructor), got ${expr.arguments.length}`, expr);
  }
  // The `this` pointer flows to the base constructor; attributes.ts reads this binding.
  ctx.program.bindings.set(expr.expression as unknown as ts.Identifier, scope.lookup("this")!);
  return VOID;
}

const checkObjectLiteral: ExpressionChecker = (ctx, node, scope) => {
  const expr = node as ts.ObjectLiteralExpression;
  const want = contextualType(ctx, expr, scope);
  if (want?.kind !== "struct") {
    throw ctx.error(
      "Object literal needs a contextual class or interface type (annotate the variable: `const p: P = { ... }`)",
      expr
    );
  }
  const info = structOf(ctx, want);
  const seen = new Set<string>();
  for (const prop of expr.properties) {
    let name: string;
    let value: ts.Expression;
    if (ts.isPropertyAssignment(prop)) {
      if (!ts.isIdentifier(prop.name)) throw ctx.error("Object literal keys must be plain identifiers", prop.name);
      name = prop.name.text;
      value = prop.initializer;
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      name = prop.name.text;
      value = prop.name;
    } else {
      throw ctx.error(`Unsupported object literal member: ${ts.SyntaxKind[prop.kind]} (only \`key: value\`)`, prop);
    }
    const field = info.fieldsByName.get(name);
    if (!field) throw ctx.error(`\`${info.name}\` has no field \`${name}\``, prop);
    if (seen.has(name)) throw ctx.error(`Field \`${name}\` is set twice in the object literal`, prop);
    seen.add(name);
    const t = ctx.checkExpression(value, scope);
    if (!assignable(t, field.type)) {
      throw ctx.error(`Field \`${name}\` of \`${info.name}\` is ${typeToString(field.type)}, got ${typeToString(t)}`, value);
    }
  }
  const missing = info.fields.find((f) => !seen.has(f.name));
  if (missing) throw ctx.error(`Object literal for \`${info.name}\` is missing field \`${missing.name}\``, expr);
  return want;
};

export const classExpressionCheckers: CheckerTable<ExpressionChecker> = {
  [ts.SyntaxKind.ThisKeyword]: checkThis,
  [ts.SyntaxKind.SuperKeyword]: checkSuper,
  [ts.SyntaxKind.ObjectLiteralExpression]: checkObjectLiteral,
};

// ---- Members: field reads, method calls, `new`, field assignment ----------------------------------

propertyCheckers.struct = (ctx, expr, receiver) => {
  const info = structOf(ctx, receiver);
  const field = info.fieldsByName.get(expr.name.text);
  if (!field) {
    const hint = info.methods.has(expr.name.text) ? " (it is a method; call it)" : "";
    throw ctx.error(`Unknown field \`${expr.name.text}\` on ${info.kind} \`${info.name}\`${hint}`, expr.name);
  }
  return field.type;
};

/** Check `args` against `callee.params` after `this`; records the callee for the emitter. */
function checkMethodArguments(
  ctx: CheckContext,
  call: ts.CallExpression | ts.NewExpression,
  callee: FunctionSig,
  args: readonly ts.Expression[],
  what: string,
  scope: Scope
): void {
  const params = callee.params.slice(1);
  if (args.length !== params.length) {
    throw ctx.error(`\`${what}\` expects ${params.length} argument(s), got ${args.length}`, call);
  }
  args.forEach((arg, i) => {
    const t = ctx.checkExpression(arg, scope);
    if (!assignable(t, params[i].type)) {
      throw ctx.error(`Argument ${i + 1} of \`${what}\`: expected ${typeToString(params[i].type)}, got ${typeToString(t)}`, arg);
    }
  });
}

methodCallCheckers.struct = (ctx, expr, receiver, scope) => {
  const access = expr.expression as ts.PropertyAccessExpression;
  const info = structOf(ctx, receiver);
  const method = findMethod(info, access.name.text); // own first, then the base chain (static dispatch, WP2b)
  if (!method) {
    const hint = info.fieldsByName.has(access.name.text) ? " (it is a field, not a method)" : "";
    throw ctx.error(`Unknown method \`${access.name.text}\` on ${info.kind} \`${info.name}\`${hint}`, access.name);
  }
  checkMethodArguments(ctx, expr, method, expr.arguments, `${info.name}.${access.name.text}`, scope);
  ctx.program.callees.set(expr, method);
  return method.returnType;
};

newCheckers["*"] = (ctx, expr, scope) => {
  if (!ts.isIdentifier(expr.expression)) throw ctx.error("`new` requires a class name", expr.expression);
  const name = expr.expression.text;
  const info = ctx.program.structs.get(name);
  if (!info) throw ctx.error(`Unknown class \`${name}\``, expr.expression);
  if (info.kind === "interface") {
    throw ctx.error(`Cannot \`new\` interface \`${name}\`; use an object literal: \`{ ... }\``, expr);
  }
  if (expr.typeArguments) throw ctx.error("Generic classes are not supported", expr);
  const args = expr.arguments ?? [];
  const ctor = effectiveConstructor(info); // own, or inherited from the nearest ancestor (WP2b)
  if (ctor) {
    checkMethodArguments(ctx, expr, ctor, args, `new ${name}`, scope);
  } else if (args.length > 0) {
    throw ctx.error(`\`new ${name}\` expects 0 argument(s) (the class has no constructor), got ${args.length}`, expr);
  }
  return info.type;
};

/** `recv.f = v` and `recv.f op= v` where `recv` is a struct value. */
const checkFieldAssignment: BinaryChecker = (ctx, expr, scope) => {
  const target = expr.left as ts.PropertyAccessExpression;
  const op = expr.operatorToken.kind;
  const opText = ts.tokenToString(op);
  if (ts.isIdentifier(target.expression) && scope.lookup(target.expression.text) === undefined) {
    throw ctx.error(`Cannot assign to \`${target.getText(ctx.sf)}\``, target);
  }
  const receiver = ctx.checkExpression(target.expression, scope);
  if (receiver.kind !== "struct") {
    throw ctx.error(`Cannot assign to property \`${target.name.text}\` of ${typeToString(receiver)}`, target);
  }
  const info = structOf(ctx, receiver);
  const field = info.fieldsByName.get(target.name.text);
  if (!field) throw ctx.error(`Unknown field \`${target.name.text}\` on ${info.kind} \`${info.name}\``, target.name);
  if (field.readonly) {
    // Only the constructor of the class that *declares* the field (WP2b: a
    // derived constructor cannot assign an inherited readonly field).
    const owner = fieldOwner(info, field);
    const inOwnCtor =
      ctx.current.role === "constructor" &&
      ctx.current.struct === owner &&
      target.expression.kind === ts.SyntaxKind.ThisKeyword &&
      op === ts.SyntaxKind.EqualsToken;
    if (!inOwnCtor) {
      throw ctx.error(
        `Cannot assign to readonly field \`${field.name}\` of \`${owner.name}\`${owner.kind === "class" ? " outside its constructor" : ""}`,
        target
      );
    }
  }
  const rhs = ctx.checkExpression(expr.right, scope);
  if (op === ts.SyntaxKind.EqualsToken) {
    if (!assignable(rhs, field.type)) {
      throw ctx.error(
        `Cannot assign ${typeToString(rhs)} to ${typeToString(field.type)} field \`${field.name}\``,
        expr.right
      );
    }
    return field.type;
  }
  const compound = [
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
  ];
  if (!compound.includes(op)) throw ctx.error(`Unsupported assignment operator \`${opText}\``, expr);
  // Every numeric width works here: the emitter lowers `op=` on a field through
  // the same `emitIntBinary` as a binary operator, so i64 and the unsigned
  // widths need nothing beyond being let through.
  if (!isNumeric(field.type) || !sameType(rhs, field.type)) {
    throw ctx.error(
      `Operator \`${opText}\` requires two operands of the same numeric type, got ${typeToString(field.type)} and ${typeToString(rhs)}`,
      expr
    );
  }
  return field.type;
};

assignmentTargetCheckers[ts.SyntaxKind.PropertyAccessExpression] = checkFieldAssignment;

/** The `this` local of a method or constructor: an immutable parameter of the owning struct's type. */
export function thisLocal(sig: FunctionSig): LocalVar {
  return { name: "this", type: sig.struct!.type, mutable: false, storage: "param" };
}
