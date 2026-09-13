// Classes and interfaces for stage1 (`src/checker/classes.ts` pass 1,
// docs/wp14-selfhost.md milestone S3): names, fields and their layout,
// methods, the constructor and `implements`.
//
// **The layout is the ABI.** A field's index is its position in the LLVM
// struct body and its offset is where clang would put it in the equivalent C
// struct, so `--emit-header` and a C caller agree without anyone writing the
// layout down twice. `implements` is a prefix rule (WP25): the interface's
// fields are the class's first fields, indices and offsets included, which is
// what lets a `%struct.Square*` be `bitcast` to a `%struct.Shape*` with no
// adjustment. There is no inheritance, so that is the only widening there is.
//
// The parser has already refused generics, `abstract`, `declare`, `static`,
// getters and setters and index signatures, so what is here is the semantic
// half — duplicate members, `extends`, a class that does not cover the
// interface it names.

import { CheckContext } from "./context";
import { resolveType } from "./annotations";
import { isExported, collectParams } from "./declarations";
import {
  FLAG_DEFINITE,
  FLAG_OPTIONAL,
  FLAG_READONLY,
  FLAG_STATIC,
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
  if (name.startsWith("nish_")) {
    ctx.error(decl.children[0], "Names starting with `nish_` are reserved for the runtime");
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
  if (ctx.program.aliases.has(name) || ctx.program.enums.has(name)) {
    ctx.error(decl.children[0], `\`${name}\` is already declared in this module`);
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
  if (owner.field(name) !== null || owner.methodIndex.has(name)) {
    ctx.error(decl.children[0], `Duplicate member \`${name}\` in ${kindWord(owner)} \`${owner.name}\``);
    return;
  }
  // The three member headers the parser flags rather than refuses
  // (`self/nodes.ts`). Each is a rule about the *member*, so the sentence
  // names it and its class, which is what the parser could not do and why
  // these were stage0's wordings alone.
  //
  // The order is stage0's and is load-bearing: a field carries the name's
  // marker and its modifiers at once, and `static x?: i32` has to get the same
  // one of the three sentences from both compilers. stage0 reads the marker
  // first for a field (`src/checker/classes.ts`, collectField) and the
  // modifiers first for a method (rejectMethodModifiers), so the two lists
  // below are deliberately not in the same order as each other.
  if ((decl.flags & FLAG_OPTIONAL) !== 0) {
    ctx.error(decl, `${what} cannot be optional (every field has a fixed slot)`);
    return;
  }
  if ((decl.flags & FLAG_DEFINITE) !== 0) {
    ctx.error(decl, `${what}: definite-assignment assertions (\`!\`) are not supported`);
    return;
  }
  if ((decl.flags & FLAG_STATIC) !== 0) {
    ctx.error(decl, `${what}: \`static\` members are not supported (use a top-level function or const)`);
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
    }
    // The field keeps its initializer even when that initializer was refused.
    // What it is worth is nothing; what it *says* is that the programmer wrote
    // one, and the definite-assignment pass would otherwise follow the first
    // diagnostic with `has no initializer and no constructor assigns it`,
    // which is a second complaint about the line the first one is about.
    // stage0 says one thing here because it throws out of the class
    // (`tests/cases/reject_cls_field_init_type`).
    field.initializer = initializer;
  }
  owner.fieldIndex.set(name, owner.fields.length);
  owner.fields.push(field);
}

function collectMethod(ctx: CheckContext, owner: StructInfo, decl: Node): void {
  const name = decl.children[0].text;
  const what = `Method \`${name}\``;
  if (owner.field(name) !== null || owner.methodIndex.has(name)) {
    ctx.error(decl.children[0], `Duplicate member \`${name}\` in class \`${owner.name}\``);
    return;
  }
  // As in `collectField` above, and worth the repetition rather than a shared
  // helper: the two sentences differ, and so does the order — stage0 reads a
  // method's modifiers before its `?`.
  if ((decl.flags & FLAG_STATIC) !== 0) {
    ctx.error(
      decl,
      `${what} of class \`${owner.name}\`: \`static\` members are not supported (use a top-level function)`
    );
    return;
  }
  if ((decl.flags & FLAG_OPTIONAL) !== 0) {
    ctx.error(decl, `${what} of class \`${owner.name}\` cannot be optional`);
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
  owner.methodIndex.set(name, owner.methodSigs.length);
  owner.methodSigs.push(sig);
  ctx.program.functions.push(sig);
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

/** The fields, layout, methods and constructor of a declared struct. */
export function collectStructMembers(ctx: CheckContext, info: StructInfo): void {
  if (info.collected) {
    return;
  }
  const decl = info.decl;
  if (info.kind === STRUCT_CLASS) {
    const extendsName = decl.children[1];
    if (extendsName.kind !== N_EMPTY) {
      // WP25. The rule lives in the checker rather than in Phase 0 because
      // inheritance needs nothing Phase 0 exists to refuse — it compiled until
      // WP25 — and the message names the rewrite, the way a removed spelling's
      // should.
      ctx.error(
        extendsName,
        `\`extends\` is not supported: Nish has no inheritance. Declare the base's fields as the first fields of \`${info.name}\` and \`implements\` an interface to convert between them`
      );
      // Stop here, which is what stage0's `throw` out of pass 1b leaves
      // behind: the struct is registered but has no members and no layout.
      info.poisoned = true;
      return;
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
  info.collected = true;
}

/**
 * `class C implements I` is a layout check, not a subtype relation: `I`'s
 * fields must be the *first* fields of `C`, in the same order and with the
 * same types, so a `%struct.C*` is a `%struct.I*` with no adjustment. `C` may
 * declare more fields after them (WP25) — that prefix is what replaced
 * inheritance as the way a wider struct is used as a narrower one.
 */
export function checkImplements(ctx: CheckContext, cls: StructInfo): void {
  for (const name of cls.implementsNames) {
    const iface = ctx.program.struct(name);
    if (iface === null) {
      continue;
    }
    // WP15 section 2a: an interface with an implementer is a *view*, not a
    // record — an `I[]` may hold any implementer and they are all longer than
    // `I` — so its elements stay one pointer per slot. `StructInfo` objects are
    // shared across the modules of a compilation, so marking the one here is
    // what makes every module lay `I[]` out the same way.
    iface.implemented = true;
    let i = 0;
    while (i < iface.fields.length) {
      const want = iface.fields[i];
      if (i < cls.fields.length) {
        const got = cls.fields[i];
        if (want.name === got.name && want.type === got.type) {
          i = i + 1;
          continue;
        }
        ctx.error(
          cls.decl.children[0],
          `Class \`${cls.name}\` does not implement \`${iface.name}\`: field ${i + 1} is ${describeField(ctx, want)} in \`${iface.name}\` but ${describeField(ctx, got)} in \`${cls.name}\` (the interface's fields must be the class's first fields, in order)`
        );
        return;
      }
      ctx.error(
        cls.decl.children[0],
        `Class \`${cls.name}\` does not implement \`${iface.name}\`: it lacks field ${describeField(ctx, want)} (the interface's fields must be the class's first fields, in order)`
      );
      return;
    }
  }
}

function describeField(ctx: CheckContext, field: FieldInfo): string {
  return `\`${field.name}: ${ctx.table.typeName(field.type)}\``;
}

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
  for (const field of info.fields) {
    noteStructNames(table, field.type, out);
  }
  for (const method of info.methodSigs) {
    signatureStructNames(table, method, out);
  }
  const ctor = info.ctor;
  if (ctor !== null) {
    signatureStructNames(table, ctor, out);
  }
}

/**
 * Whether a class value may stand where `want` is expected without a
 * conversion the reader has to write: `want` is an interface it implements.
 * That is one pointer `bitcast` — the interface's fields are the class's first
 * fields — so nothing is checked at run time and nothing converts back.
 */
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
  if (wanted.kind !== STRUCT_INTERFACE) {
    return false;
  }
  for (const name of source.implementsNames) {
    if (name === wanted.name) {
      return true;
    }
  }
  return false;
}
