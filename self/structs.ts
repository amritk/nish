// Classes and interfaces for stage1 (`src/checker/classes.ts` pass 1,
// docs/wp14-selfhost.md milestone S3): names, fields and their layout,
// methods, the constructor, `extends` and `implements`.
//
// **The layout is the ABI.** A field's index is its position in the LLVM
// struct body and its offset is where clang would put it in the equivalent C
// struct, so `--emit-header` and a C caller agree without anyone writing the
// layout down twice. Inheritance is a prefix: a derived class copies its
// base's fields, indices and offsets included, which is what lets a
// `%struct.Derived*` be `bitcast` to a `%struct.Base*` with no adjustment.
//
// The parser has already refused generics, `abstract`, `declare`, `static`,
// getters and setters and index signatures, so what is here is the semantic
// half — duplicate members, an override that changes its signature, a base
// that is an interface, a cycle.

import { CheckContext } from "./context";
import { resolveType } from "./annotations";
import { isExported, collectParams } from "./declarations";
import {
  FLAG_READONLY,
  N_CONSTRUCTOR,
  N_EMPTY,
  N_FALSE,
  N_FIELD,
  N_METHOD,
  N_NULL,
  N_NUMBER,
  N_STRING,
  N_TEMPLATE,
  N_TRUE,
  N_UNARY,
  Node,
} from "./nodes";
import {
  FieldInfo,
  FunctionSig,
  ROLE_CONSTRUCTOR,
  ROLE_METHOD,
  STRUCT_CLASS,
  STRUCT_INTERFACE,
  StructInfo,
} from "./program";
import { StringSet } from "./map";
import { T_BOOL, T_ERROR, T_STRING, T_VOID, TypeTable } from "./types";

/**
 * Size in bytes of a value stored in a struct field. `bool` is one byte
 * (`i1` has store size 1 in LLVM's data layout, matching C's `_Bool`);
 * every other type is its own alignment, which is right for every scalar
 * and every pointer.
 */
export function sizeOfField(ctx: CheckContext, type: i32): i32 {
  return ctx.table.alignOf(type);
}

/** The next multiple of `align` at or above `value`; shared with `result.ts`. */
export function roundUpTo(value: i32, align: i32): i32 {
  const remainder = value % align;
  return remainder === 0 ? value : value + align - remainder;
}

/** Offsets in declaration order, and the size and alignment clang would compute. */
export function computeLayout(ctx: CheckContext, info: StructInfo): void {
  let offset = 0;
  let align = 1;
  for (const field of info.fields) {
    const fieldAlign = ctx.table.alignOf(field.type);
    offset = roundUpTo(offset, fieldAlign);
    field.offset = offset;
    offset = offset + sizeOfField(ctx, field.type);
    if (fieldAlign > align) {
      align = fieldAlign;
    }
  }
  info.size = roundUpTo(offset, align);
  info.align = align;
}

/** The word a message uses for this struct's kind. */
function kindWord(info: StructInfo): string {
  return info.kind === STRUCT_CLASS ? "class" : "interface";
}

/**
 * Register a name so an annotation anywhere in the module resolves it. The
 * members wait for `collectStructMembers`, because a field may be typed with
 * a class declared further down the file.
 */
export function declareStruct(ctx: CheckContext, decl: Node, kind: i32): StructInfo | null {
  const name = decl.children[0].text;
  const what = kind === STRUCT_CLASS ? "Classes" : "Interfaces";
  if (name.length === 0) {
    ctx.error(decl, `${what} must be named`);
    return null;
  }
  if (name.startsWith("sts_")) {
    ctx.error(decl.children[0], "Names starting with `sts_` are reserved for the runtime");
    return null;
  }
  if (ctx.program.structs.has(name)) {
    ctx.error(decl.children[0], `Duplicate declaration of \`${name}\``);
    return null;
  }
  if (ctx.sigs.has(name)) {
    ctx.error(decl.children[0], `\`${name}\` is already declared as a function`);
    return null;
  }
  const info = new StructInfo(name, kind, ctx.table.structOf(name), decl, ctx.source);
  info.exported = isExported(decl);
  ctx.program.addStruct(name, info);
  ctx.program.typeNames.add(name);
  return info;
}

/**
 * Literal initializers only (`x: number = 0`, `next: Node | null = null`):
 * the value is stored before the constructor body runs, so it has to be one
 * the emitter can write without evaluating anything.
 */
function literalInitializerType(ctx: CheckContext, expr: Node, want: i32): i32 {
  switch (expr.kind) {
    case N_NUMBER:
      return want;
    case N_STRING:
      return ctx.table.stripNull(want) === T_STRING ? want : T_STRING;
    case N_TEMPLATE:
      // A template with no holes is one text child, and is a plain string literal.
      return expr.children.length === 1 ? T_STRING : -1;
    case N_TRUE:
      return T_BOOL;
    case N_FALSE:
      return T_BOOL;
    case N_NULL:
      return ctx.table.isNullable(want) ? want : -1;
    case N_UNARY:
      return expr.text === "-" && expr.children[0].kind === N_NUMBER ? want : -1;
    default:
      return -1;
  }
}

/** One field of a class or interface, appended to `owner`. */
function collectField(ctx: CheckContext, owner: StructInfo, decl: Node): void {
  const name = decl.children[0].text;
  const what = `Field \`${name}\` of ${kindWord(owner)} \`${owner.name}\``;
  const base = owner.base;
  if (base !== null) {
    const inherited = base.field(name);
    if (inherited !== null) {
      ctx.error(
        decl.children[0],
        `${what} is already declared in base class \`${fieldOwner(base, name).name}\`; a derived class cannot redeclare or shadow an inherited field`
      );
      return;
    }
    const method = base.method(name);
    if (method !== null) {
      const holder = method.owner;
      const holderName = holder === null ? base.name : holder.name;
      ctx.error(decl.children[0], `${what} clashes with method \`${name}\` inherited from \`${holderName}\``);
      return;
    }
  }
  if (owner.field(name) !== null || owner.methodIndex.has(name)) {
    ctx.error(decl.children[0], `Duplicate member \`${name}\` in ${kindWord(owner)} \`${owner.name}\``);
    return;
  }
  const type = resolveType(decl.children[1], ctx);
  if (type === T_VOID) {
    ctx.error(decl.children[1], `${what} cannot have type void`);
    return;
  }

  const field = new FieldInfo(name, type, decl);
  field.index = owner.fields.length;
  field.readonly = (decl.flags & FLAG_READONLY) !== 0;
  const initializer = decl.children[2];
  if (initializer.kind !== N_EMPTY) {
    const initType = literalInitializerType(ctx, initializer, type);
    if (initType < 0) {
      ctx.error(
        initializer,
        `${what}: initializers must be literals (assign other values in the constructor)`
      );
    } else if (!ctx.table.assignable(initType, type)) {
      const got = ctx.table.typeName(initType);
      ctx.error(initializer, `${what} is ${ctx.table.typeName(type)} but its initializer is ${got}`);
    } else {
      field.initializer = initializer;
    }
  }
  owner.fieldIndex.set(name, owner.fields.length);
  owner.fields.push(field);
}

/** The class in `info`'s chain that declares `name`; `info` itself if none above does. */
export function fieldOwner(info: StructInfo, name: string): StructInfo {
  let owner = info;
  let walk = info.base;
  while (walk !== null) {
    if (walk.field(name) !== null) {
      owner = walk;
    }
    walk = walk.base;
  }
  return owner;
}

/** `(x: number): boolean` — the part of a method signature an override must keep. */
function describeSignature(ctx: CheckContext, sig: FunctionSig): string {
  const parts: string[] = [];
  let i = 1; // skip `this`
  while (i < sig.paramNames.length) {
    parts.push(`${sig.paramNames[i]}: ${ctx.table.typeName(sig.paramTypes[i])}`);
    i = i + 1;
  }
  return `(${parts.join(", ")}): ${ctx.table.typeName(sig.returnType)}`;
}

function collectMethod(ctx: CheckContext, owner: StructInfo, decl: Node): void {
  const name = decl.children[0].text;
  const what = `Method \`${name}\``;
  const base = owner.base;
  if (base !== null && base.field(name) !== null) {
    ctx.error(
      decl.children[0],
      `${what} of class \`${owner.name}\` clashes with field \`${name}\` inherited from \`${fieldOwner(base, name).name}\``
    );
    return;
  }
  if (owner.field(name) !== null || owner.methodIndex.has(name)) {
    ctx.error(decl.children[0], `Duplicate member \`${name}\` in class \`${owner.name}\``);
    return;
  }
  const symbol = `${owner.name}.${name}`;
  const sig = new FunctionSig(symbol, symbol, decl);
  sig.origin = ctx.source;
  sig.exported = owner.exported;
  sig.owner = owner;
  sig.role = ROLE_METHOD;
  collectParams(ctx, sig, decl.children[1], owner.type);
  const returnAnnotation = decl.children[2];
  if (returnAnnotation.kind === N_EMPTY) {
    ctx.error(
      decl.children[0],
      `${what} of class \`${owner.name}\` needs an explicit return type annotation`
    );
    sig.returnType = T_ERROR;
  } else {
    sig.returnType = resolveType(returnAnnotation, ctx);
  }

  // An override keeps the signature: a call resolves statically by the
  // receiver's declared type, so the base and the derived method must accept
  // and return the same types. There is no overloading to fall back on.
  const overridden: FunctionSig | null = base === null ? null : base.method(name);
  if (overridden !== null && !sameSignature(sig, overridden)) {
    ctx.error(
      decl.children[0],
      `${what} of class \`${owner.name}\` overrides \`${overridden.sourceName}\` with a different signature: \`${overridden.sourceName}\` is ${describeSignature(ctx, overridden)}, \`${sig.sourceName}\` is ${describeSignature(ctx, sig)} (an override keeps the signature; there is no overloading)`
    );
  }
  owner.methodIndex.set(name, owner.methodSigs.length);
  owner.methodSigs.push(sig);
  ctx.program.functions.push(sig);
}

/** Same parameter types after `this`, and the same return type. */
function sameSignature(a: FunctionSig, b: FunctionSig): boolean {
  if (a.paramTypes.length !== b.paramTypes.length || a.returnType !== b.returnType) {
    return false;
  }
  let i = 1;
  while (i < a.paramTypes.length) {
    if (a.paramTypes[i] !== b.paramTypes[i]) {
      return false;
    }
    i = i + 1;
  }
  return true;
}

function collectConstructor(ctx: CheckContext, owner: StructInfo, decl: Node): void {
  if (owner.ctor !== null) {
    ctx.error(decl, `Class \`${owner.name}\` has more than one constructor (no overloads)`);
    return;
  }
  const symbol = `${owner.name}.constructor`;
  const sig = new FunctionSig(symbol, symbol, decl);
  sig.origin = ctx.source;
  sig.exported = owner.exported;
  sig.owner = owner;
  sig.role = ROLE_CONSTRUCTOR;
  sig.returnType = T_VOID;
  collectParams(ctx, sig, decl.children[0], owner.type);
  owner.ctor = sig;
  ctx.program.functions.push(sig);
}

/**
 * The class named by `extends`, fully collected so its fields can be copied.
 * Only a class declared in this module qualifies: an imported base would need
 * its layout before pass 1b binds imports, and an interface has no
 * constructor or methods to inherit — `implements` covers the layout.
 */
function resolveBase(ctx: CheckContext, info: StructInfo, name: Node): StructInfo | null {
  const base = ctx.program.struct(name.text);
  if (base === null) {
    let imported = false;
    for (const imp of ctx.program.imports) {
      if (imp.localName === name.text) {
        imported = true;
      }
    }
    ctx.error(
      name,
      imported
        ? `Class \`${info.name}\` cannot extend imported class \`${name.text}\`: a base class must be declared in the same module`
        : `Unknown base class \`${name.text}\` (\`extends\` must name a class declared in this module)`
    );
    return null;
  }
  if (base.kind === STRUCT_INTERFACE) {
    ctx.error(
      name,
      `Class \`${info.name}\` cannot extend interface \`${name.text}\`; use \`implements ${name.text}\``
    );
    return null;
  }
  if (base === info) {
    ctx.error(name, `Class \`${info.name}\` cannot extend itself`);
    return null;
  }
  if (base.collecting) {
    ctx.error(
      name,
      `Inheritance cycle: class \`${info.name}\` extends \`${name.text}\`, which already extends \`${info.name}\``
    );
    return null;
  }
  if (info.exported && !base.exported) {
    ctx.error(
      name,
      `Exported class \`${info.name}\` cannot extend non-exported class \`${name.text}\` (the base's constructor and methods are part of \`${info.name}\`'s ABI; export \`${name.text}\` too)`
    );
    return null;
  }
  collectStructMembers(ctx, base);
  return base;
}

/** The base's fields, indices and offsets included: they are the prefix of the derived layout. */
function inheritFields(info: StructInfo, base: StructInfo): void {
  for (const field of base.fields) {
    const copy = new FieldInfo(field.name, field.type, field.decl);
    copy.index = field.index;
    copy.offset = field.offset;
    copy.readonly = field.readonly;
    copy.initializer = field.initializer;
    info.fieldIndex.set(field.name, info.fields.length);
    info.fields.push(copy);
  }
}

/** The base class, fields, layout, methods and constructor of a declared struct. */
export function collectStructMembers(ctx: CheckContext, info: StructInfo): void {
  if (info.collected) {
    return; // already pulled in as the base of an earlier class
  }
  info.collecting = true;
  const decl = info.decl;
  if (info.kind === STRUCT_CLASS) {
    const extendsName = decl.children[1];
    if (extendsName.kind !== N_EMPTY) {
      info.base = resolveBase(ctx, info, extendsName);
      const base = info.base;
      if (base !== null) {
        inheritFields(info, base);
      }
    }
    for (const iface of decl.children[2].children) {
      const target = ctx.program.struct(iface.text);
      if (target === null || target.kind !== STRUCT_INTERFACE) {
        ctx.error(iface, `\`${iface.text}\` is not a declared interface`);
        continue;
      }
      info.implementsNames.push(target.name);
    }
    for (const member of decl.children[3].children) {
      if (member.kind === N_FIELD) {
        collectField(ctx, info, member);
      } else if (member.kind === N_METHOD) {
        collectMethod(ctx, info, member);
      } else if (member.kind === N_CONSTRUCTOR) {
        collectConstructor(ctx, info, member);
      }
    }
  } else {
    for (const member of decl.children[1].children) {
      if (member.kind === N_FIELD) {
        collectField(ctx, info, member);
      }
    }
  }
  computeLayout(ctx, info);
  info.collecting = false;
  info.collected = true;
}

/**
 * `class C implements I` is a layout check, not a subtype relation: `I`'s
 * fields must be the first fields of `C`, in the same order, with the same
 * types, so a `%struct.C*` is a `%struct.I*` with no adjustment.
 */
export function checkImplements(ctx: CheckContext, cls: StructInfo): void {
  for (const name of cls.implementsNames) {
    const iface = ctx.program.struct(name);
    if (iface === null) {
      continue;
    }
    const count = cls.fields.length > iface.fields.length ? cls.fields.length : iface.fields.length;
    let i = 0;
    while (i < count) {
      const hasWant = i < iface.fields.length;
      const hasGot = i < cls.fields.length;
      if (hasWant && hasGot) {
        const want = iface.fields[i];
        const got = cls.fields[i];
        if (want.name === got.name && want.type === got.type) {
          i = i + 1;
          continue;
        }
      }
      const why = !hasGot
        ? `it lacks field ${describeField(ctx, iface.fields[i])}`
        : !hasWant
          ? `it declares extra field ${describeField(ctx, cls.fields[i])}`
          : `field ${i + 1} is ${describeField(ctx, iface.fields[i])} in \`${iface.name}\` but ${describeField(ctx, cls.fields[i])} in \`${cls.name}\``;
      ctx.error(
        cls.decl.children[0],
        `Class \`${cls.name}\` does not implement \`${iface.name}\`: ${why} (fields must match exactly, in order)`
      );
      return;
    }
  }
}

function describeField(ctx: CheckContext, field: FieldInfo): string {
  return `\`${field.name}: ${ctx.table.typeName(field.type)}\``;
}

/**
 * Whether a class value may stand where `want` is expected without a
 * conversion the reader has to write: `want` is a class it extends, or an
 * interface it implements. Both are one pointer `bitcast` — an interface has
 * the identical layout and a base class is a layout prefix — so nothing is
 * checked at run time and nothing converts back.
 */
/**
 * The struct names a type mentions, following `T[]` and `T | null` inwards.
 * A name reached this way is a *layout* this module needs even though it
 * never wrote the name.
 */
export function noteStructNames(table: TypeTable, type: i32, out: StringSet): void {
  if (table.isStruct(type)) {
    out.add(table.nameOf(type));
    return;
  }
  // A `Result<Config, IoError>` hands the importer both payload layouts
  // without either name appearing in its source (WP16), so both arms count.
  if (table.isResult(type)) {
    noteStructNames(table, table.okOf(type), out);
    noteStructNames(table, table.errOf(type), out);
    return;
  }
  const inner = table.refOf(type);
  if (inner >= 0) {
    noteStructNames(table, inner, out);
  }
}

/**
 * The struct names a signature mentions. `this` is skipped: it is the owner or
 * its base, which is reached through the `StructInfo` itself rather than by
 * name, and noting it would pull an inherited constructor's `%struct.Base` in
 * behind a derived class.
 */
export function signatureStructNames(table: TypeTable, sig: FunctionSig, out: StringSet): void {
  let i = sig.owner === null ? 0 : 1;
  while (i < sig.paramTypes.length) {
    noteStructNames(table, sig.paramTypes[i], out);
    i = i + 1;
  }
  noteStructNames(table, sig.returnType, out);
}

/**
 * The struct names `info` mentions through its fields and its members, its
 * inherited ones included. Its own name is not one of them.
 */
export function referencedStructNames(table: TypeTable, info: StructInfo, out: StringSet): void {
  let c: StructInfo | null = info;
  while (c !== null) {
    for (const field of c.fields) {
      noteStructNames(table, field.type, out);
    }
    for (const method of c.methodSigs) {
      signatureStructNames(table, method, out);
    }
    const ctor = c.ctor;
    if (ctor !== null) {
      signatureStructNames(table, ctor, out);
    }
    c = c.base;
  }
}

export function coercesTo(ctx: CheckContext, from: i32, want: i32): boolean {
  if (want < 0 || !ctx.table.isStruct(from)) {
    return false;
  }
  const target = ctx.table.stripNull(want); // a class converts to `I | null` as it does to `I`
  if (!ctx.table.isStruct(target) || target === from) {
    return false;
  }
  const source = ctx.program.struct(ctx.table.nameOf(from));
  const wanted = ctx.program.struct(ctx.table.nameOf(target));
  if (source === null || wanted === null) {
    return false;
  }
  if (wanted.kind === STRUCT_INTERFACE) {
    // An interface a base implements is implemented by the derived class too:
    // the base's fields are the prefix, so the layout still matches.
    let walk: StructInfo | null = source;
    while (walk !== null) {
      for (const name of walk.implementsNames) {
        if (name === wanted.name) {
          return true;
        }
      }
      walk = walk.base;
    }
    return false;
  }
  let base = source.base;
  while (base !== null) {
    if (base === wanted) {
      return true;
    }
    base = base.base;
  }
  return false;
}
