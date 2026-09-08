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
import { N_LIST, N_TYPE_ARRAY, N_TYPE_NULL, N_TYPE_PAREN, N_TYPE_REF, N_TYPE_UNION, Node } from "./nodes";
import {
  T_BOOL,
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

const SUPPORTED_REFERENCES: string =
  "(supported: number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void, T[], Result<T, E>, Int32Array/Float64Array/BigInt64Array, and declared classes/interfaces)";
const SUPPORTED_TYPES: string =
  "(Phase 1 supports number, i32, i64, u8, u16, u32, u64, f32, f64, boolean, string, void)";

/** The element type of a typed-array alias, or -1 when `name` is not one. */
export function typedArrayElement(name: string): i32 {
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
}

/**
 * The scalar type a bare name spells, or -1 when it is not a scalar keyword.
 * A chain of `===` rather than a `switch`, because the language's `switch` is
 * integer-only by design (docs/wp14-selfhost.md §5) and string equality
 * compares the lengths first anyway.
 */
function scalarNamed(name: string, numberMode: i32): i32 {
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
  return -1;
}

/**
 * Resolve one annotation into a type id. Anything outside the rigid set is a
 * rejection: the language has no `any`, no `unknown`, no union but `T | null`, no
 * generics beyond `Array<T>`, and no structural object types.
 */
export function resolveType(node: Node, ctx: CheckContext): i32 {
  switch (node.kind) {
    case N_TYPE_PAREN:
      // Transparent, as `ParenthesizedType` is in `src/types.ts`: the
      // parentheses exist to group, and `(T | null)[]` is the shape that needs
      // them, because `T | null[]` groups the other way.
      return resolveType(node.children[0], ctx);
    case N_TYPE_ARRAY:
      return ctx.table.arrayOf(resolveType(node.children[0], ctx));
    case N_TYPE_UNION:
      return resolveNullableUnion(node, ctx);
    case N_TYPE_REF:
      return resolveReference(node, ctx);
    default:
      return ctx.errorType(node, `Unsupported type \`${ctx.textOf(node)}\` ${SUPPORTED_TYPES}`);
  }
}

/** A named type, with or without type arguments. */
function resolveReference(node: Node, ctx: CheckContext): i32 {
  const name = node.text;
  const args = node.children[0];
  const argc = args.kind === N_LIST ? args.children.length : 0;

  if (name === "Result") {
    return resolveResult(node, args, argc, ctx);
  }

  if (name === "Array") {
    if (argc !== 1) {
      return ctx.errorType(node, "`Array` needs exactly one type argument, e.g. `Array<number>`");
    }
    return ctx.table.arrayOf(resolveType(args.children[0], ctx));
  }

  const alias = typedArrayElement(name);
  if (alias >= 0 && argc > 0) {
    const spelled = ctx.table.typeName(ctx.table.arrayOf(alias));
    return ctx.errorType(node, `\`${name}\` takes no type argument (it is an alias of \`${spelled}\`)`);
  }

  if (argc > 0) {
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

  // A class or interface: one this module declares or imports. A name that is
  // imported but not yet bound resolves provisionally, exactly as stage0 does,
  // and pass 1b rejects it if it turns out to name a function or a constant.
  if (ctx.program.typeNames.has(name)) {
    const declared = ctx.program.struct(name);
    if (declared !== null) {
      return declared.type;
    }
    ctx.program.importsUsedAsTypes.add(name);
    return ctx.table.structOf(name);
  }

  return ctx.errorType(node, `Unsupported type reference \`${ctx.textOf(node)}\` ${SUPPORTED_REFERENCES}`);
}

/**
 * `Result<T, E>` (WP16). Written like a generic, but there are no user
 * generics in the language: this is one built-in type constructor whose two
 * arguments pick a monomorphised layout, exactly as `Array<T>` does.
 *
 * `T` may be `void` — `Result<void, E>` is the fallible operation that has
 * nothing to hand back, and it carries no `value` field at all. `E` may not
 * be, because a failure that says nothing is what `panic` is for.
 */
function resolveResult(node: Node, args: Node, argc: i32, ctx: CheckContext): i32 {
  if (argc !== 2) {
    return ctx.errorType(node, "`Result` needs exactly two type arguments, e.g. `Result<number, string>`");
  }
  const ok = resolveType(args.children[0], ctx);
  const err = resolveType(args.children[1], ctx);
  if (ok === T_ERROR || err === T_ERROR) {
    return T_ERROR;
  }
  if (err === T_VOID) {
    return ctx.errorType(
      args.children[1],
      "`Result<T, void>` is not supported: an error must carry a value (use `Result<T, string>`)"
    );
  }
  return ctx.table.resultOf(ok, err, R_UNKNOWN);
}

/**
 * `T | null`. The validator already refuses every other union, so this only
 * has to find the non-null member and require it to be a pointer type — a
 * scalar has no null value to add.
 */
function resolveNullableUnion(node: Node, ctx: CheckContext): i32 {
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
    return ctx.errorType(node, "Union types other than `T | null` are forbidden in " + LANGUAGE);
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
}
