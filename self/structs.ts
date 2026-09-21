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
import { rejectForeignPointer, resolveType } from "./annotations";
import { instantiateWritten } from "./generics";
import { isExported, collectParams } from "./declarations";
import {
  FLAG_DEFINITE,
  FLAG_OPTIONAL,
  FLAG_READONLY,
  FLAG_STATIC,
  FLAG_STATIC_FIRST,
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
  N_TYPE_REF,
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
export const sizeOfField = (ctx: CheckContext, type: i32): i32 => ctx.table.alignOf(type);

/** The next multiple of `align` at or above `value`; shared with `result.ts`. */
export const roundUpTo = (value: i32, align: i32): i32 => {
  const remainder = value % align;
  return remainder === 0 ? value : value + align - remainder;
};

/**
 * Offsets in declaration order, and the size and alignment clang would
 * compute. Answers the struct's *floor*: the smallest size any order of these
 * fields could reach — the sum of their widths, rounded up to the alignment —
 * which no layout can beat, because no order removes a byte a field occupies.
 *
 * It comes out of this walk rather than a second one because the walk already
 * has both numbers, and it is what the WP15 section 8 padding warning tests
 * first: a struct whose size already equals its floor cannot be improved by
 * reordering, and almost every struct is one of those.
 */
export const computeLayout = (ctx: CheckContext, info: StructInfo): i32 => {
  let offset = 0;
  let align = 1;
  let used = 0;
  for (const field of info.fields) {
    const fieldAlign = ctx.table.alignOf(field.type);
    const width = sizeOfField(ctx, field.type);
    offset = roundUpTo(offset, fieldAlign);
    field.offset = offset;
    offset = offset + width;
    used = used + width;
    if (fieldAlign > align) {
      align = fieldAlign;
    }
  }
  info.size = roundUpTo(offset, align);
  info.align = align;
  return roundUpTo(used, align);
};

/** The size `fields` lay out to in the order given, rounded up to `align`. */
const layoutSize = (ctx: CheckContext, fields: FieldInfo[], align: i32): i32 => {
  let offset = 0;
  for (const field of fields) {
    offset = roundUpTo(offset, ctx.table.alignOf(field.type)) + sizeOfField(ctx, field.type);
  }
  return roundUpTo(offset, align);
};

/**
 * The fields widest first, which is the order that reaches a struct's floor.
 *
 * A stable bucket pass rather than a sort: every alignment in the language is a
 * power of two and `align` is the largest of them, so halving from `align` down
 * to 1 visits every alignment a field of this struct can have, and taking the
 * fields of each width in declaration order keeps same-width fields where the
 * author put them. The message therefore names the smallest edit that reaches
 * the smaller layout rather than an arbitrary permutation of the declaration.
 * The halving is a shift because `width` is a power of two and an `i32` `/ 2`
 * would carry the divisor check with it.
 *
 * It runs only where the warning fires, so a struct that is already packed pays
 * for none of it.
 */
const widestFirst = (ctx: CheckContext, fields: FieldInfo[], align: i32): FieldInfo[] => {
  const sorted: FieldInfo[] = [];
  let width = align;
  while (width >= 1) {
    for (const field of fields) {
      if (ctx.table.alignOf(field.type) === width) {
        sorted.push(field);
      }
    }
    width = width >> 1;
  }
  return sorted;
};

/**
 * WP15 section 8, the tenth rule: a struct whose declared field order costs it
 * bytes of padding that a different order would not spend. The message names
 * the current size, the achievable size and the order that reaches it, which
 * is what section 8's hint column specifies.
 *
 * The floor is only the gate. The size the message names is the one the named
 * order really lays out to, measured by `layoutSize`, so the two numbers stay
 * true of each other whatever the size and alignment rules come to say about a
 * type.
 *
 * It is the one section 8 warning computed in **pass 1** — a layout is known
 * the moment a struct's members are collected, long before any body is checked
 * — which is what `DiagnosticSink.reportPerformance` orders the warning list
 * for. Without that order this would print ahead of every warning in its file.
 *
 * Two shapes are deliberately silent, because section 8's bar is a rewrite the
 * message can name and neither of these has one:
 *
 *   - a class that `implements` an interface. The interface's fields are its
 *     first fields, in order (`checkImplements`), so the prefix is not the
 *     author's to permute and "declare them widest first" would be advice that
 *     stops the program compiling. Coarse on purpose: the fields *after* the
 *     prefix are the author's, and a narrower rule could still warn about them.
 *   - a generic instantiation. `Box$i32` and `Box$bool` are separate structs
 *     sharing one declaration, so the caret would land on the same `class Box`
 *     once per instantiation, and the order that suits one type argument need
 *     not suit another.
 *
 * The other side of the `implements` rule is a clause rather than a silence.
 * An *interface* may have implementers, whose first fields it is, and whether
 * it has any is `StructInfo.implemented` — set in `checkImplements`, a pass
 * after the layout this is computed beside, so it cannot be read here. The
 * message names the second half of the rewrite instead of guessing, which reads
 * as a no-op where nothing implements the interface and is the difference
 * between advice and a broken build where something does.
 *
 * The order is named in full, however many fields there are. A struct with
 * forty of them gets forty, because a truncated order is not a rewrite anybody
 * can apply and an un-actionable message is the failure this class cannot
 * afford; the length is the price of the hint being complete.
 */
const reportWastefulPadding = (ctx: CheckContext, info: StructInfo, floor: i32): void => {
  if (floor >= info.size) {
    return;
  }
  if (info.implementsNames.length > 0 || ctx.program.structArguments(info.name) !== null) {
    return;
  }
  const fields = widestFirst(ctx, info.fields, info.align);
  const packed = layoutSize(ctx, fields, info.align);
  if (packed >= info.size) {
    return;
  }
  const parts: string[] = [];
  for (const field of fields) {
    parts.push(`${field.name}: ${ctx.table.typeName(field.type)}`);
  }
  const order = parts.join(", ");
  const alsoImplementers = info.kind === STRUCT_INTERFACE
    ? " — here and in any class that `implements` it, since the interface's fields are its implementers' first fields"
    : "";
  ctx.performance(
    info.decl.children[0],
    `\`${info.name}\` is ${info.size} bytes and would be ${packed} with the same fields in a different ` +
      `order, so ${info.size - packed} bytes of every value are padding the alignment rules insert and nothing ` +
      `reads: declare the fields widest first — \`${order}\`${alsoImplementers}`
  );
};

/** The word a message uses for this struct's kind. */
const kindWord = (info: StructInfo): string => info.kind === STRUCT_CLASS ? "class" : "interface";

/**
 * Register a name so an annotation anywhere in the module resolves it. The
 * members wait for `collectStructMembers`, because a field may be typed with
 * a class declared further down the file.
 */
export const declareStruct = (ctx: CheckContext, decl: Node, kind: i32): StructInfo | null => {
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
  // A generic class counts as a declaration of the name, exactly as a declared
  // one counts against a template in `registerStructTemplate`: `class Box<T>`
  // followed by `class Box` is one name declared twice, and the declared class
  // would be unreachable because `Box` in an annotation resolves to the
  // template.
  if (ctx.program.structs.has(name) || ctx.program.structTemplates.has(name)) {
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
};

/**
 * Literal initializers only (`x: number = 0`, `next: Node | null = null`):
 * the value is stored before the constructor body runs, so it has to be one
 * the emitter can write without evaluating anything.
 */
const literalInitializerType = (ctx: CheckContext, expr: Node, want: i32): i32 => {
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
};

/** One field of a class or interface, appended to `owner`. */
const collectField = (ctx: CheckContext, owner: StructInfo, decl: Node): void => {
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
  //
  // A field is the member `readonly` is *legal* on, which is why there is no
  // call to `rejectMemberModifiers` here: `static` is the only modifier a field
  // cannot carry, and it is read after the marker.
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
  // WP27 S2: a field would put a foreign address inside a value the arena owns
  // and the escape analysis walks. `self/annotations.ts` has the reasoning.
  if (rejectForeignPointer(ctx, type, "a field", decl.children[1])) {
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
};

/**
 * The modifiers a method or a constructor may not carry, in stage0's order.
 *
 * stage0 walks the modifier list in source order and reports the first one the
 * member cannot have (`rejectMethodModifiers` in `src/checker/classes.ts`);
 * both `static` and `readonly` are, so which of the two was written first
 * decides the sentence. The parser hands that over as `FLAG_STATIC_FIRST`
 * rather than as a list, because it is the only ordering anything asks about.
 * `public` / `private` / `protected` are accepted and ignored on both sides,
 * and every other modifier is a word stage1's parser never reads as one.
 *
 * Answers whether it reported, so a caller that must stop can.
 */
const rejectMemberModifiers = (ctx: CheckContext, decl: Node, what: string): boolean => {
  const isStatic = (decl.flags & FLAG_STATIC) !== 0;
  const isReadonly = (decl.flags & FLAG_READONLY) !== 0;
  const staticFirst = (decl.flags & FLAG_STATIC_FIRST) !== 0;
  if (isStatic && (!isReadonly || staticFirst)) {
    ctx.error(decl, `${what}: \`static\` members are not supported (use a top-level function)`);
    return true;
  }
  if (isReadonly) {
    ctx.error(decl, `${what}: unsupported modifier \`readonly\``);
    return true;
  }
  return false;
};

const collectMethod = (ctx: CheckContext, owner: StructInfo, decl: Node): void => {
  const name = decl.children[0].text;
  const what = `Method \`${name}\``;
  if (owner.field(name) !== null || owner.methodIndex.has(name)) {
    ctx.error(decl.children[0], `Duplicate member \`${name}\` in class \`${owner.name}\``);
    return;
  }
  // As in `collectField` above, and worth the repetition rather than a shared
  // helper: the two sentences differ, and so does the order — stage0 reads a
  // method's modifiers before its `?` (`rejectMethodModifiers`), so
  // `readonly m?()` is about the modifier and not about the marker.
  if (rejectMemberModifiers(ctx, decl, `${what} of class \`${owner.name}\``)) return;
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
  collectParams(ctx, sig, decl.children[1], owner.type, false);
  const returnAnnotation = decl.children[2];
  if (returnAnnotation.kind === N_EMPTY) {
    ctx.error(
      decl.children[0],
      `${what} of class \`${owner.name}\` needs an explicit return type annotation`
    );
    sig.returnType = T_ERROR;
  } else {
    sig.returnType = resolveType(returnAnnotation, ctx);
    rejectForeignPointer(ctx, sig.returnType, "the return type of a function this program defines", returnAnnotation);
  }
  owner.methodIndex.set(name, owner.methodSigs.length);
  owner.methodSigs.push(sig);
  ctx.program.functions.push(sig);
};

const collectConstructor = (ctx: CheckContext, owner: StructInfo, decl: Node): void => {
  if (owner.ctor !== null) {
    ctx.error(decl, `Class \`${owner.name}\` has more than one constructor (no overloads)`);
    return;
  }
  // stage0 reads a constructor's modifiers with the same function it reads a
  // method's (`rejectMethodModifiers`), so the sentence is the method's with
  // `Constructor` in front of it, and the order is the same: after the
  // duplicate check, before anything about the body. Without this a `static`
  // constructor is not merely accepted, it *runs* — as the instance
  // constructor, which is the one thing `static` says it is not
  // (`tests/cases/reject_cls_ctor_static`).
  //
  // Reported and then collected anyway, rather than returned from: a class
  // whose only constructor is dropped has no constructor at all, and the
  // definite-assignment pass would open the report with `Field \`x\` ... has no
  // initializer and no constructor assigns it` — advice about a constructor
  // that is right there. stage0 says one thing here because it throws out of
  // the class, and this is that, without the throw.
  const modifiers = `Constructor of class \`${owner.name}\``;
  rejectMemberModifiers(ctx, decl, modifiers);
  const symbol = `${owner.name}.constructor`;
  const sig = new FunctionSig(symbol, symbol, decl);
  sig.origin = ctx.source;
  sig.exported = owner.exported;
  sig.owner = owner;
  sig.role = ROLE_CONSTRUCTOR;
  sig.returnType = T_VOID;
  collectParams(ctx, sig, decl.children[0], owner.type, false);
  owner.ctor = sig;
  ctx.program.functions.push(sig);
};

/**
 * The fields, layout, methods and constructor of a declared struct.
 *
 * **One diagnostic per declaration, however many members are wrong**, and that
 * is a decision rather than an oversight. The member loops below do not clear
 * `errored`, so the first member to be refused silences the ones after it:
 * `class Pair { first: i32 = "one"; second: i32 = "two"; }` names `first` and
 * says nothing about `second` (#94, `tests/cases/reject_cls_field_init_type_twice`).
 *
 * Clearing it per member is two lines and would report both, which is the
 * output a reader of the second field would rather have. It is not taken, for
 * three reasons that are worth having written down where somebody would go
 * looking for the missing sentence:
 *
 *   - `errored` is not a general cascade guard. It is stage0's `throw` in a
 *     language that has none (`context.ts`), and it is cleared *exactly* where
 *     stage0's `catch` is — per declaration in `checker.ts`, per statement in
 *     `statements.ts` — and deliberately restored at the one site where stage0
 *     reports and carries on rather than throwing (`instantiateStruct` in
 *     `generics.ts`, which is why `reject_generic_expanding_field_twice` gets
 *     two diagnostics out of one class body). stage0 refuses a field's
 *     initializer with a `throw` (`collectField` in `src/checker/classes.ts`),
 *     so the silence here is that throw and clearing the flag would be the
 *     first place this compiler chose a granularity of its own.
 *   - `docs/LANGUAGE.md` states the granularity normatively — pass 1 recovers
 *     per declaration — so reporting the second member is a change to a
 *     language rule, not a bug fix, and it is not one the self-hosted half
 *     makes on its own while stage0 is still the oracle.
 *   - measured on 2026-09-21, the reset changes the output of **none** of the
 *     926 programs of the corpus: no program anybody has written here poses
 *     the question, so every gate this repository owns would be blind to the
 *     change. What it costs is one more true sentence about a program that is
 *     refused either way, which makes this a completeness question about
 *     diagnostics rather than a soundness one
 *     (`docs/wp19-stage0-retirement.md` §5a, item 6).
 *
 * The reason has an expiry. At R6 stage0 goes, and with it the compiler whose
 * `throw` this flag is imitating; the granularity becomes this compiler's own
 * choice, and the case above is what will fail when somebody makes it.
 */
export const collectStructMembers = (ctx: CheckContext, info: StructInfo): void => {
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
      // WP18 G5: `class Box<T> implements Container<T>` names an instantiated
      // interface. It is resolved here, while `T` is bound to *this*
      // instantiation's argument, so the check is the ordinary field-prefix one
      // against `Container$i32` rather than a comparison between two
      // uninstantiated field lists — which would need a type variable, and a
      // type parameter is never a type in this implementation.
      if (iface.kind !== N_TYPE_REF) {
        // `implements number[]`: stage0 sees a heritage expression that is not
        // an identifier and says this, so stage1 says it where its own grammar
        // puts the same mistake.
        ctx.error(iface, "`implements` must name a declared interface");
        continue;
      }
      const template = ctx.program.structTemplate(iface.text);
      let target: StructInfo | null = null;
      if (template !== null) {
        target = instantiateWritten(ctx, template, iface.children[0], iface);
        if (target === null) {
          continue;
        }
      } else if (iface.children[0].children.length > 0) {
        ctx.error(iface, "`implements` must name a declared interface");
        continue;
      } else {
        target = ctx.program.struct(iface.text);
      }
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
  const floor = computeLayout(ctx, info);
  info.collected = true;
  reportWastefulPadding(ctx, info, floor);
};

/**
 * `class C implements I` is a layout check, not a subtype relation: `I`'s
 * fields must be the *first* fields of `C`, in the same order and with the
 * same types, so a `%struct.C*` is a `%struct.I*` with no adjustment. `C` may
 * declare more fields after them (WP25) — that prefix is what replaced
 * inheritance as the way a wider struct is used as a narrower one.
 */
export const checkImplements = (ctx: CheckContext, cls: StructInfo): void => {
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
};

const describeField = (ctx: CheckContext, field: FieldInfo): string => `\`${field.name}: ${ctx.table.typeName(field.type)}\``;

/**
 * The struct names a type mentions, following `T[]` and `T | null` inwards.
 * A name reached this way is a *layout* this module needs even though it
 * never wrote the name.
 */
export const noteStructNames = (table: TypeTable, type: i32, out: StringSet): void => {
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
};

/**
 * The struct names a signature mentions. `this` is skipped: it is the owner or
 * its base, which is reached through the `StructInfo` itself rather than by
 * name, and noting it would pull an inherited constructor's `%struct.Base` in
 * behind a derived class.
 */
export const signatureStructNames = (table: TypeTable, sig: FunctionSig, out: StringSet): void => {
  let i = sig.owner === null ? 0 : 1;
  while (i < sig.paramTypes.length) {
    noteStructNames(table, sig.paramTypes[i], out);
    i = i + 1;
  }
  noteStructNames(table, sig.returnType, out);
};

/**
 * The struct names `info` mentions through its fields and its members, its
 * inherited ones included. Its own name is not one of them.
 */
export const referencedStructNames = (table: TypeTable, info: StructInfo, out: StringSet): void => {
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
};

/**
 * Whether a class value may stand where `want` is expected without a
 * conversion the reader has to write: `want` is an interface it implements.
 * That is one pointer `bitcast` — the interface's fields are the class's first
 * fields — so nothing is checked at run time and nothing converts back.
 */
export const coercesTo = (ctx: CheckContext, from: i32, want: i32): boolean => {
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
};
