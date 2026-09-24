// Type annotations, for stage1 (docs/wp14-selfhost.md, milestone S3): the
// `resolveTypeNode` of `src/types.ts`, over the `N_TYPE_*` nodes of
// `self/nodes.ts` and against a module's own named types.
//
// Every message here is byte-for-byte stage0's, because the `.err` goldens
// match on them (`tests/cases/reject_any`, `reject_union_type`,
// `reject_nullable_scalar`, ...). Where stage0 throws a `CompileError`, this
// reports into the sink and answers `T_ERROR`: D1's error-value threading, so
// a bad annotation gives one diagnostic and the declaration around it still
// gets a signature rather than cascading.
//
// The named-type lookup is a *parameter* rather than the `WeakMap` registry
// keyed by source file that `src/types.ts` uses. That registry exists to keep
// `resolveTypeNode`'s signature unchanged for recursive callers; here the
// context is one argument that is already being threaded.

import { LANGUAGE } from "./branding";
import { CheckContext, NUMBER_MODE_I32 } from "./context";
import { AliasInfo } from "./program";
import { deferInstantiation, instantiateWritten } from "./generics";
import {
  N_LIST,
  N_TYPE_ARRAY,
  N_TYPE_NULL,
  N_TYPE_PAREN,
  N_TYPE_READONLY,
  N_TYPE_REF,
  N_TYPE_UNION,
  Node,
} from "./nodes";
import {
  CPTR_NAME,
  K_ARRAY,
  T_BOOL,
  T_CPTR,
  T_ERROR,
  T_F32,
  T_F64,
  T_I32,
  T_I64,
  T_STRING,
  T_U16,
  T_U32,
  T_U64,
  T_U8,
  T_VOID,
  R_UNKNOWN,
} from "./types";

/**
 * The name ranged integers will be spelled with, `integer<Lo, Hi>`
 * (docs/wp31-ranged-integers.md §3). The feature is not built yet; the name is
 * held now so that building it later takes nothing a program already declared.
 */
export const RANGED_INTEGER: string = "integer";

const SUPPORTED_REFERENCES: string =
  "(supported: number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void, T[], Result<T, E>, Int32Array/Float64Array/BigInt64Array, and declared classes/interfaces)";
const SUPPORTED_TYPES: string =
  "(Phase 1 supports number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void)";

/** The element type of a typed-array alias, or -1 when `name` is not one. */
export const typedArrayElement = (name: string): i32 => {
  if (name === "Int32Array") {
    return T_I32;
  }
  if (name === "Float32Array") {
    return T_F32;
  }
  if (name === "Float64Array") {
    return T_F64;
  }
  if (name === "BigInt64Array") {
    return T_I64;
  }
  return -1;
};

/**
 * The scalar type a bare name spells, or -1 when it is not a scalar keyword.
 * A chain of `===` rather than a `switch`, because the language's `switch` is
 * integer-only by design (docs/wp14-selfhost.md §5) and string equality
 * compares the lengths first anyway.
 */
const scalarNamed = (name: string, numberMode: i32): i32 => {
  if (name === "number") {
    return numberMode === NUMBER_MODE_I32 ? T_I32 : T_F64;
  }
  if (name === "boolean") {
    return T_BOOL;
  }
  if (name === "string") {
    return T_STRING;
  }
  if (name === "void") {
    return T_VOID;
  }
  if (name === "i32") {
    return T_I32;
  }
  if (name === "i64") {
    return T_I64;
  }
  if (name === "u8") {
    return T_U8;
  }
  if (name === "u16") {
    return T_U16;
  }
  if (name === "u32") {
    return T_U32;
  }
  if (name === "u64") {
    return T_U64;
  }
  if (name === "f32") {
    return T_F32;
  }
  if (name === "f64") {
    return T_F64;
  }
  // WP27 S2. Answered here rather than from a declared name because it is not
  // declared anywhere: there is no `class CPtr` for a module to import, and the
  // name means the same thing in every file.
  if (name === CPTR_NAME) {
    return T_CPTR;
  }
  return -1;
};

/** An array's element type, refused when it is a foreign pointer (WP27 S2). */
const elementType = (node: Node, ctx: CheckContext): i32 => {
  const elem = resolveType(node, ctx);
  if (rejectForeignPointer(ctx, elem, "an array element", node)) {
    return T_ERROR;
  }
  return elem;
};

/**
 * Where a `CPtr` may be written, and the one diagnostic for everywhere else
 * (WP27 S2, `docs/wp27-ffi.md` §7). Answers true when it refused.
 *
 * The allowed positions are a `declare function`'s parameters and return type,
 * and a local that holds what such a call answered. Everything else is refused,
 * and the refusals are not timidity — each one is a place where the compiler
 * would have to make a claim about the pointer that it cannot support:
 *
 *   - A field, an array element or a `Result` arm would put a foreign address
 *     inside a value this compiler lays out and the arena owns, and the escape
 *     analysis walks those. A `CPtr` is not arena memory and must never be
 *     treated as though it were, which is the bug class WP26 fixed in `getenv`
 *     and §2 says FFI re-opens in user code.
 *   - A parameter or return type of a function this program defines would put
 *     one across a boundary the C header, the `.d.ts` and the N-API shim all
 *     describe, and none of the three has a spelling for an address whose
 *     provenance and lifetime are unknown.
 *
 * What is left is a pointer that comes out of C, sits in a local and goes back
 * into C, which needs no claim about it at all beyond its width.
 */
export const rejectForeignPointer = (ctx: CheckContext, type: i32, position: string, node: Node): boolean => {
  if (ctx.table.stripNull(type) !== T_CPTR) {
    return false;
  }
  ctx.error(
    node,
    `\`${CPTR_NAME}\` cannot be ${position}: a foreign pointer may only appear in a \`declare function\` signature or on a local bound to one, because it is an address a C function owns and this compiler can neither lay it out nor say how long it lives`
  );
  return true;
};

/**
 * Resolve one annotation into a type id. Anything outside the rigid set is a
 * rejection: the language has no `any`, no `unknown`, no union but `T | null`, no
 * generics beyond `Array<T>`, and no structural object types.
 */
export const resolveType = (node: Node, ctx: CheckContext): i32 => {
  switch (node.kind) {
    case N_TYPE_PAREN:
      // Transparent, as `ParenthesizedType` is in `src/types.ts`: the
      // parentheses exist to group, and `(T | null)[]` is the shape that needs
      // them, because `T | null[]` groups the other way.
      return resolveType(node.children[0], ctx);
    case N_TYPE_ARRAY:
      return ctx.table.arrayOf(elementType(node.children[0], ctx));
    case N_TYPE_READONLY:
      return resolveReadonly(node, ctx);
    case N_TYPE_UNION:
      return resolveNullableUnion(node, ctx);
    case N_TYPE_REF:
      return resolveReference(node, ctx);
    default:
      return ctx.errorType(node, `Unsupported type \`${ctx.textOf(node)}\` ${SUPPORTED_TYPES}`);
  }
};

/**
 * `readonly T[]`. TypeScript allows the modifier on nothing else (TS1354,
 * "only permitted on array and tuple literal types"), so `readonly` in front of
 * a scalar or a class is not a construct this compiler has yet to support — it
 * is not TypeScript either, and the message says which rule it broke.
 */
const resolveReadonly = (node: Node, ctx: CheckContext): i32 => {
  const inner = resolveType(node.children[0], ctx);
  if (inner === T_ERROR) {
    return T_ERROR; // D1: the inner annotation already reported; do not report twice
  }
  if (ctx.table.kindOf(inner) !== K_ARRAY) {
    return ctx.errorType(
      node,
      `\`readonly\` is only permitted on an array type, got ${ctx.table.typeName(inner)}`
    );
  }
  return ctx.table.readonlyArrayOf(ctx.table.refOf(inner));
};

/** A named type, with or without type arguments. */
const resolveReference = (node: Node, ctx: CheckContext): i32 => {
  const name = node.text;
  const args = node.children[0];
  const argc = args.kind === N_LIST ? args.children.length : 0;

  if (name === "Result") {
    return resolveResult(node, args, argc, ctx);
  }

  // Before every declared name and type parameter, so that `integer` never
  // means something a later release would have to take back.
  if (name === RANGED_INTEGER) {
    return ctx.errorType(node, "`integer<Lo, Hi>` is reserved for ranged integers, which this compiler does not have yet");
  }

  if (name === "Array") {
    if (argc !== 1) {
      return ctx.errorType(node, "`Array` needs exactly one type argument, e.g. `Array<number>`");
    }
    return ctx.table.arrayOf(elementType(args.children[0], ctx));
  }

  // `ReadonlyArray<T>` is `readonly T[]`, the way `Array<T>` is `T[]`.
  if (name === "ReadonlyArray") {
    if (argc !== 1) {
      return ctx.errorType(node, "`ReadonlyArray` needs exactly one type argument, e.g. `ReadonlyArray<number>`");
    }
    return ctx.table.readonlyArrayOf(elementType(args.children[0], ctx));
  }

  const alias = typedArrayElement(name);
  if (alias >= 0 && argc > 0) {
    const spelled = ctx.table.typeName(ctx.table.arrayOf(alias));
    return ctx.errorType(node, `\`${name}\` takes no type argument (it is an alias of \`${spelled}\`)`);
  }

  // WP18 G5: a user generic with its arguments written. Answered after the
  // built-in constructors above — so nothing that was already a type argument
  // list changes meaning — and before the refusal below, so a template written
  // with the wrong number of arguments is refused by the rule that names it
  // rather than by "unsupported type reference".
  if (argc > 0) {
    const written = ctx.program.structTemplate(name);
    if (written !== null) {
      const instantiated = instantiateWritten(ctx, written, args, node);
      return instantiated === null ? T_ERROR : instantiated.type;
    }
    // WP18 G7: `Box<i32>` where `Box` comes from another module, resolved
    // during pass 1 — before any import is bound, so the branch above has
    // nothing to answer with. The request is written down and made as soon as
    // every module has bound; from pass 1b on the branch above answers instead,
    // because binding the import put the template in scope.
    const imported = ctx.program.importNamed(name);
    if (imported !== null) {
      return deferInstantiation(ctx, imported, args, node);
    }
    return ctx.errorType(node, `Unsupported type reference \`${ctx.textOf(node)}\` ${SUPPORTED_REFERENCES}`);
  }

  if (name === "any") {
    return ctx.errorType(node, "`any` is forbidden in " + LANGUAGE);
  }
  if (name === "unknown") {
    return ctx.errorType(node, "`unknown` is forbidden in " + LANGUAGE);
  }

  const scalar = scalarNamed(name, ctx.numberMode);
  if (scalar >= 0) {
    return scalar;
  }
  if (alias >= 0) {
    return ctx.table.arrayOf(alias);
  }

  // WP18 G5: a generic class or interface named without its type arguments.
  // Here rather than in the branch above, and after the scalars, because that
  // is where stage0's named-type resolver answers a reference with no argument
  // list: `Box` on its own is not a type, and the message says how to write it.
  const bare = ctx.program.structTemplate(name);
  if (bare !== null) {
    instantiateWritten(ctx, bare, args, node);
    return T_ERROR;
  }

  // WP18: a type parameter, while an instantiation is being resolved or
  // checked. It answers here — after the built-in scalars, before anything
  // declared — which is exactly where stage0's named-type resolver sits, so
  // the two compilers shadow the same set of names.
  const bound = ctx.typeBindings.get(name, -1);
  if (bound >= 0) {
    return bound;
  }

  // A `type` alias is the type it names, so it answers here and the caller
  // never learns that a name was involved (docs/LANGUAGE.md, Type aliases).
  const declared = ctx.program.alias(name);
  if (declared !== null) {
    return aliasType(declared, ctx);
  }

  // An enum is a type of its own, and its name is the only way to spell it
  // (docs/LANGUAGE.md, Enums).
  const declaredEnum = ctx.program.enumNamed(name);
  if (declaredEnum !== null) {
    return declaredEnum.type;
  }

  // A class or interface: one this module declares or imports. A name that is
  // imported but not yet bound resolves provisionally, exactly as stage0 does,
  // and pass 1b rejects it if it turns out to name a function or a constant.
  if (ctx.program.typeNames.has(name)) {
    const struct = ctx.program.struct(name);
    if (struct !== null) {
      return struct.type;
    }
    ctx.program.importsUsedAsTypes.add(name);
    return ctx.table.structOf(name);
  }

  return ctx.errorType(node, `Unsupported type reference \`${ctx.textOf(node)}\` ${SUPPORTED_REFERENCES}`);
};

/**
 * `Result<T, E>` (WP16). Written like a generic, but there are no user
 * generics in the language: this is one built-in type constructor whose two
 * arguments pick a monomorphised layout, exactly as `Array<T>` does.
 *
 * `T` may be `void` — `Result<void, E>` is the fallible operation that has
 * nothing to hand back, and it carries no `value` field at all. `E` may not
 * be, because a failure that says nothing is what `panic` is for.
 */
const resolveResult = (node: Node, args: Node, argc: i32, ctx: CheckContext): i32 => {
  if (argc !== 2) {
    return ctx.errorType(node, "`Result` needs exactly two type arguments, e.g. `Result<number, string>`");
  }
  const ok = resolveType(args.children[0], ctx);
  const err = resolveType(args.children[1], ctx);
  if (ok === T_ERROR || err === T_ERROR) {
    return T_ERROR;
  }
  if (rejectForeignPointer(ctx, ok, "a `Result` arm", args.children[0])) {
    return T_ERROR;
  }
  if (rejectForeignPointer(ctx, err, "a `Result` arm", args.children[1])) {
    return T_ERROR;
  }
  if (err === T_VOID) {
    return ctx.errorType(
      args.children[1],
      "`Result<T, void>` is not supported: an error must carry a value (use `Result<T, string>`)"
    );
  }
  return ctx.table.resultOf(ok, err, R_UNKNOWN);
};

/**
 * `T | null`. The validator already refuses every other union, so this only
 * has to find the non-null member and require it to be a pointer type — a
 * scalar has no null value to add.
 */
const resolveNullableUnion = (node: Node, ctx: CheckContext): i32 => {
  let inner = -1;
  let nulls = 0;
  for (const member of node.children) {
    if (member.kind === N_TYPE_NULL) {
      nulls = nulls + 1;
    } else if (inner < 0) {
      inner = ctx.table.stripNull(resolveType(member, ctx));
    } else {
      inner = -2; // a second non-null member: not `T | null` at all
    }
  }
  if (inner < 0 || nulls !== 1 || node.children.length !== 2) {
    return ctx.errorType(
      node,
      "Union types other than `T | null` are forbidden in " + LANGUAGE + " (values have one fixed layout)"
    );
  }
  if (inner === T_ERROR) {
    return T_ERROR;
  }
  if (ctx.table.isResult(inner)) {
    return ctx.errorType(
      node,
      "`Result<T, E> | null` is not supported: a `Result` already models absence through its error arm"
    );
  }
  if (!ctx.table.isPointer(inner)) {
    const spelled = ctx.table.typeName(inner);
    return ctx.errorType(
      node,
      `\`${spelled} | null\` is not supported: only class, interface, array, and string types can be nullable (a scalar has no null value)`
    );
  }
  return ctx.table.nullableOf(inner);
};

/**
 * Whether `name` is a type the language already spells for itself, and so may
 * not be taken by a `type` alias. A keyword like `string` is resolved from the
 * syntax, and `i32` or `Result` before any declared name is consulted, so an
 * alias under one of these names would simply never be looked at -- silently,
 * which is the part worth refusing. `integer` is on the list before it is a
 * type (`RANGED_INTEGER`), so that it is never taken in the meantime.
 */
export const builtinTypeName = (name: string): boolean => {
  if (scalarNamed(name, NUMBER_MODE_I32) >= 0) {
    return true;
  }
  if (typedArrayElement(name) >= 0) {
    return true;
  }
  return (
    name === "any" ||
    name === "unknown" ||
    name === "undefined" ||
    name === "never" ||
    name === "Array" ||
    name === "ReadonlyArray" ||
    name === "Result" ||
    name === RANGED_INTEGER
  );
};

/**
 * A class, interface or function named `integer`. An alias or an enum of that
 * name is refused by `builtinTypeName`; these three are refused here, because
 * `integer<0, 255>` would otherwise mean two things in a module that declared
 * one. `what` carries its article ("a class", "an interface").
 *
 * The declaration is the statement being reported on, so a poisoned flag left
 * by the one before it is cleared first; otherwise a class written after
 * another rejected one would be dropped with no word said.
 */
export const rejectRangedIntegerName = (ctx: CheckContext, name: string, what: string, node: Node): boolean => {
  if (name !== RANGED_INTEGER) {
    return false;
  }
  ctx.errored = false;
  ctx.error(node, `\`integer\` is reserved for ranged integers (\`integer<Lo, Hi>\`) and cannot be declared as ${what}`);
  return true;
};

/**
 * The type `info` names, resolved once. A second reference gets the memo, and
 * a reference reached from `info`'s own right-hand side is the cycle — caught
 * here rather than followed forever, the way `constants.ts` catches a constant
 * defined in terms of itself.
 *
 * A failed resolution clears the mark instead of memoising `T_ERROR`, so a
 * second use reports the same real error rather than a spurious cycle.
 */
export const aliasType = (info: AliasInfo, ctx: CheckContext): i32 => {
  if (info.resolving) {
    ctx.error(info.decl, `Type alias \`${info.name}\` is defined in terms of itself`);
    return T_ERROR;
  }
  if (info.type >= 0) {
    return info.type;
  }
  info.resolving = true;
  const resolved = resolveType(info.decl.children[1], ctx);
  info.resolving = false;
  if (resolved === T_ERROR) {
    return T_ERROR;
  }
  info.type = resolved;
  return resolved;
};
