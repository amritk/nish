/**
 * Classes, interfaces and structs (WP2).
 *
 * A `class` or `interface` declaration becomes one `%struct.<Name>` LLVM
 * type with its fields in declaration order at natural alignment, laid out
 * exactly as clang lays out the equivalent C struct (`computeLayout`).
 * Values of struct type are pointers to arena memory; there is no copy
 * semantics and no vtable.
 *
 * There is no inheritance (WP25) and so no subtyping between classes: a
 * method call resolves to the method the receiver's own type declares, which
 * makes every call site in a program one known symbol. The one widening is
 * `implements`: a class lists an interface whose fields are its own *first*
 * fields, so a `%struct.C*` is a valid `%struct.I*` after one `bitcast` and
 * a `C` value converts to `I` wherever an `I` is expected
 * (`coerceToContext`). Nothing converts back.
 *
 * Signature collection runs in three sub-passes so declarations may refer to
 * each other in any order (see `Checker.collectSignatures`):
 *   1a. `declareStruct`        register the name (creates the StaticType)
 *   1b. `collectStructMembers` fields, layout, method/constructor signatures
 *   1c. `finishStruct`         `implements` check, definite assignment
 * Method and constructor bodies are then ordinary functions in
 * `CheckedProgram.functions` whose first parameter is `this`.
 *
 * Rules enforced here (each with a negative test in `tests/cases/reject_cls_*`):
 *   - every field has a type annotation; an initializer must be a literal
 *     (number, string, boolean, or a negated number) of the field's type;
 *   - no `static`, `abstract`, getters/setters, optional fields, index
 *     signatures, parameter properties, or class expressions;
 *     `public`/`private`/`protected` are accepted and ignored;
 *   - `extends` on a class and `super` in any position are refused: the
 *     language has no inheritance, and the messages name the rewrite;
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
 *   - a class that `implements` an interface declares the interface's
 *     fields as its first fields, in order, with identical types, and may
 *     declare more after them; such a class value converts to the interface
 *     type implicitly (recorded in `program.coercions`).
 */
import ts from "typescript";
import {
  StaticType,
  VOID,
  alignOf,
  assignable,
  isNumeric,
  rejectForeignPointer,
  resolveTypeNode,
  sameType,
  stripNull,
  typeToString,
} from "../types.js";
import { BinaryChecker, CheckContext, CheckerTable, ExpressionChecker } from "./context.js";
import { hasExportModifier, isFunctionResult, rejectDollarInSymbolName } from "./declarations.js";
import { assignmentTargetCheckers, methodCallCheckers, newCheckers, propertyCheckers } from "./members.js";
import { checkBitwiseAssignOperands, isBitwiseCompoundOperator } from "./bitwise.js";
import { CheckedProgram, FieldInfo, FunctionSig, LocalVar, Param, StructInfo } from "./program.js";
import { Scope } from "./scope.js";

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
 * parameter and return types of its methods and constructor, through arrays
 * and nullables.
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
    // A `Result<Config, IoError>` hands the importer both payload layouts
    // without either name appearing in its source (WP16).
    else if (t.kind === "result") {
      note(t.ok);
      note(t.err);
    }
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
    else if (t.kind === "result") {
      note(t.ok);
      note(t.err);
    }
  };
  // `this` is skipped: it is the owner, reached through the `StructInfo`
  // pointer rather than by name.
  const noteSig = (sig: FunctionSig): void => {
    for (const p of sig.params.slice(sig.struct ? 1 : 0)) note(p.type);
    note(sig.returnType);
  };
  for (const f of info.fields) note(f.type);
  for (const m of info.methods.values()) noteSig(m);
  if (info.ctor) noteSig(info.ctor);
  names.delete(info.name);
  return [...names];
}

function modifierKinds(node: ts.Node): ts.SyntaxKind[] {
  return ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []).map((m) => m.kind) : [];
}

/**
 * True when `t` is a class type that lists interface `iface` in its
 * `implements` clause. The interface's fields are the class's first fields
 * (`checkImplements`), so the conversion is one `bitcast`.
 */
export function implementsInterface(ctx: CheckContext, t: StaticType, iface: StaticType): boolean {
  if (t.kind !== "struct" || iface.kind !== "struct" || t.name === iface.name) return false;
  const cls = ctx.program.structs.get(t.name);
  const target = ctx.program.structs.get(iface.name);
  if (!cls || !target || cls.kind !== "class" || target.kind !== "interface") return false;
  return cls.implements.includes(iface.name);
}

/**
 * The type an expression produces before the coercion recorded on it, if any
 * (class -> interface, WP2): `program.types` holds the converted type, but
 * `new C(...)` still allocates and constructs a `C`.
 */
export function intrinsicType(program: CheckedProgram, expr: ts.Expression): StaticType | undefined {
  return program.coercions.get(expr)?.from ?? program.types.get(expr);
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
  if (name.startsWith("nish_")) throw ctx.error("Names starting with `nish_` are reserved for the runtime", decl.name);
  rejectDollarInSymbolName(name, kind, decl.name, ctx.sf);
  if (ctx.program.structs.has(name)) throw ctx.error(`Duplicate declaration of \`${name}\``, decl.name);
  if (ctx.program.aliases.has(name) || ctx.program.enums.has(name)) {
    throw ctx.error(`\`${name}\` is already declared in this module`, decl.name);
  }
  if (ctx.sigs.has(name)) throw ctx.error(`\`${name}\` is already declared as a function`, decl.name);
  for (const m of modifierKinds(decl)) {
    if (m === ts.SyntaxKind.AbstractKeyword) throw ctx.error("Abstract classes are not supported", decl);
    if (m === ts.SyntaxKind.DeclareKeyword) throw ctx.error(`\`declare ${kind}\` is not supported`, decl);
    if (m === ts.SyntaxKind.DefaultKeyword) throw ctx.error("`export default` is not supported; use a named `export`", decl);
  }
  if (decl.typeParameters) {
    // Phase 0 already refused this; the message is kept for a struct that
    // reaches the checker another way (WP18 §11, G5 lifts the restriction).
    throw ctx.error(`Generic ${kind === "class" ? "classes" : "interfaces"} are not supported yet`, decl);
  }
  // A class's `extends` is refused in pass 1b, so the struct is registered
  // first and a rejected class does not cascade into every use of its name.
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
  // WP27 S2: a field would put a foreign address inside a value the arena owns
  // and the escape analysis walks. `types.ts` has the reasoning.
  rejectForeignPointer(type, "a field", decl.type, ctx.sf);

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
    const type = resolveTypeNode(p.type, ctx.sf, ctx.opts);
    rejectForeignPointer(type, "a parameter of a function this program defines", p.type, ctx.sf);
    params.push({ name: p.name.text, type });
  }
  return params;
}

/** A method's declared return type, refused when it is a foreign pointer (WP27 S2). */
const methodReturnType = (ctx: CheckContext, node: ts.TypeNode): StaticType => {
  const type = resolveTypeNode(node, ctx.sf, ctx.opts);
  rejectForeignPointer(type, "the return type of a function this program defines", node, ctx.sf);
  return type;
};

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

function collectMethod(ctx: CheckContext, owner: StructInfo, decl: ts.MethodDeclaration): void {
  const name = memberName(ctx, owner, decl.name);
  const what = `Method \`${name}\``;
  if (owner.fieldsByName.has(name) || owner.methods.has(name)) {
    throw ctx.error(`Duplicate member \`${name}\` in class \`${owner.name}\``, decl.name);
  }
  rejectMethodModifiers(ctx, owner, decl, what);
  if (!decl.body) throw ctx.error(`${what} of class \`${owner.name}\` must have a body`, decl);
  if (decl.typeParameters) throw ctx.error("Generic methods are not supported", decl);
  rejectDollarInSymbolName(name, "method", decl.name, ctx.sf);
  if (decl.asteriskToken) throw ctx.error("Generators are not supported", decl);
  if (decl.questionToken) throw ctx.error(`${what} of class \`${owner.name}\` cannot be optional`, decl);
  if (!decl.type) throw ctx.error(`${what} of class \`${owner.name}\` needs an explicit return type annotation`, decl.name);
  const sig: FunctionSig = {
    name: `${owner.name}.${name}`,
    sourceName: `${owner.name}.${name}`,
    params: collectParams(ctx, owner, decl),
    returnType: methodReturnType(ctx, decl.type),
    decl,
    nameNode: decl.name,
    declSite: decl,
    body: decl.body,
    exported: owner.exported,
    struct: owner,
    role: "method",
  };
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
    nameNode: decl,
    declSite: decl,
    body: decl.body,
    exported: owner.exported,
    struct: owner,
    role: "constructor",
  };
  owner.ctor = sig;
  ctx.program.functions.push(sig);
}

/** Resolve the fields, layout, methods and constructor of a registered struct. */
export function collectStructMembers(ctx: CheckContext, info: StructInfo): void {
  if (info.collected === "done") return;
  info.collected = "collecting";
  if (ts.isClassDeclaration(info.decl)) {
    for (const clause of info.decl.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      // WP25. The rule lives in the checker rather than in Phase 0 because
      // inheritance needs nothing Phase 0 exists to refuse -- it compiled
      // until WP25 -- and the message names the rewrite, the way a removed
      // spelling's should. The base *name* carries the caret, which is the
      // node stage1's parser keeps (`self/parser.ts`, `parseHeritageName`).
      throw ctx.error(
        `\`extends\` is not supported: Nish has no inheritance. Declare the base's fields as the first fields of \`${info.name}\` and \`implements\` an interface to convert between them`,
        clause.types[0]?.expression ?? clause
      );
    }
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

/**
 * The interface's fields must be the class's *first* fields, in order and with
 * identical types; the class may declare more after them (WP25). That prefix
 * is what makes the conversion one `bitcast`: for every field the interface
 * names, an `I*` and a `C*` address the same bytes at the same offset. It is
 * also how a wider struct is used as a narrower one now that a class has no
 * base class to be a prefix of.
 */
function checkImplements(ctx: CheckContext, cls: StructInfo): void {
  for (const ifaceName of cls.implements) {
    const iface = ctx.program.structs.get(ifaceName)!;
    // WP15 §2a: an interface with an implementer is a *view*, not a record —
    // an `I[]` may hold any implementer and they are all longer than `I`, so
    // its elements stay one pointer per slot. `StructInfo` objects are shared
    // across the modules of a compilation, so marking the one here is what
    // makes every module lay `I[]` out the same way (`inlineElementStruct`).
    iface.implemented = true;
    const describe = (f: FieldInfo) => `\`${f.name}: ${typeToString(f.type)}\``;
    for (let i = 0; i < iface.fields.length; i++) {
      const want = iface.fields[i];
      const got = cls.fields[i];
      if (got && want.name === got.name && sameType(want.type, got.type)) continue;
      const why = got
        ? `field ${i + 1} is ${describe(want)} in \`${iface.name}\` but ${describe(got)} in \`${cls.name}\``
        : `it lacks field ${describe(want)}`;
      throw ctx.error(
        `Class \`${cls.name}\` does not implement \`${iface.name}\`: ${why} (the interface's fields must be the class's first fields, in order)`,
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

/**
 * After the constructor returns, every field holds a value. A class with no
 * constructor has to initialise every field where it declares it.
 */
function checkDefiniteAssignment(ctx: CheckContext, cls: StructInfo): void {
  const initialised = new Set(cls.fields.filter((f) => f.initializer).map((f) => f.name));
  if (!cls.ctor) {
    const missing = cls.fields.find((f) => !initialised.has(f.name));
    if (missing) {
      throw ctx.error(
        `Field \`${missing.name}\` of class \`${cls.name}\` has no initializer and no constructor assigns it`,
        missing.decl.name
      );
    }
    return;
  }
  const decl = cls.ctor.decl as ts.ConstructorDeclaration;
  const result = new DefiniteAssignment(ctx, cls).statements(decl.body!.statements, initialised);
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
  if (isFunctionResult(expr)) return ctx.current.returnType;
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
    return info?.ctor;
  }
  if (ts.isIdentifier(call.expression)) return ctx.sigs.get(call.expression.text);
  if (ts.isPropertyAccessExpression(call.expression)) {
    // The receiver is checked before the arguments, so its type is recorded by now.
    const receiver = ctx.program.types.get(call.expression.expression);
    if (receiver?.kind !== "struct") return undefined;
    const info = ctx.program.structs.get(receiver.name);
    return info?.methods.get(call.expression.name.text);
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
 * where an interface it implements is expected, record the conversion and
 * report the expected type so the existing `sameType` checks accept it. It is
 * one pointer `bitcast` -- the interface's fields are the class's first fields.
 */
export function coerceToContext(ctx: CheckContext, expr: ts.Expression, type: StaticType, scope: Scope): StaticType {
  if (type.kind !== "struct") return type;
  const want = contextualType(ctx, expr, scope);
  const target = want && stripNull(want); // a class converts to `I | null` as it does to `I` (WP6)
  if (!target || !implementsInterface(ctx, type, target)) return type;
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
 * `super` in every position (WP25). A class has no base class, so `super(...)`,
 * `super.m()` and a bare `super` are all the same mistake and get the same
 * sentence. `checkCall` routes `super(...)` here rather than reporting its own,
 * so there is one rule and one code.
 */
const checkSuper: ExpressionChecker = (ctx, node) => {
  throw ctx.error("`super` is not supported: Nish has no inheritance, so a class has no base class to reach", node);
};

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
      // "expects a value of type" rather than a bare "is": the words are what
      // `scripts/gen-diagnostic-codes.mjs` derives the rule's code from, and a
      // message assembled entirely out of interpolations has no run long
      // enough to key on (`tests/run.js`'s coverage check).
      throw ctx.error(
        `Field \`${name}\` of \`${info.name}\` expects a value of type ${typeToString(field.type)}, got ${typeToString(t)}`,
        value
      );
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
  const method = info.methods.get(access.name.text);
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
  const ctor = info.ctor;
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
  if (receiver.kind === "result") {
    throw ctx.error(
      `Cannot assign to \`${target.name.text}\` of ${typeToString(receiver)}: a \`Result\` is immutable once built (return a new \`Ok(...)\` or \`Err(...)\` instead)`,
      target
    );
  }
  // `a.length = n` before the generic property refusal, because it is the one
  // an array tempts and the message that names `push` is the useful one.
  // `rejectLengthAssignment` in `arrays.ts` says the same sentence and cannot
  // reach it: its wrapper goes on the `=` handler that this one has already
  // replaced, so the rule `docs/LANGUAGE.md` documents was unreachable and
  // only `--parity` against stage1 — which does say it — noticed (WP19 §A3).
  if (receiver.kind === "array" && target.name.text === "length") {
    throw ctx.error(
      `Cannot assign to \`length\` of ${typeToString(receiver)} (array length is read-only; use \`push\`)`,
      target
    );
  }
  if (receiver.kind !== "struct") {
    throw ctx.error(`Cannot assign to property \`${target.name.text}\` of ${typeToString(receiver)}`, target);
  }
  const info = structOf(ctx, receiver);
  const field = info.fieldsByName.get(target.name.text);
  if (!field) throw ctx.error(`Unknown field \`${target.name.text}\` on ${info.kind} \`${info.name}\``, target.name);
  if (field.readonly) {
    // Only `this.f = v` in the constructor of the class that declares it.
    const inOwnCtor =
      ctx.current.role === "constructor" &&
      ctx.current.struct === info &&
      target.expression.kind === ts.SyntaxKind.ThisKeyword &&
      op === ts.SyntaxKind.EqualsToken;
    if (!inOwnCtor) {
      throw ctx.error(
        `Cannot assign to readonly field \`${field.name}\` of \`${info.name}\`${info.kind === "class" ? " outside its constructor" : ""}`,
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
  // `p.f &= e` and the rest of the bitwise family: same load-apply-store, but
  // the operand rule is `&`'s, so `bitwise.ts` owns the message as well.
  if (isBitwiseCompoundOperator(op)) return checkBitwiseAssignOperands(ctx, expr, field.type, rhs);
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
