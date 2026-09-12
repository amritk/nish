/**
 * Type-based alias analysis metadata for class field access (WP9).
 *
 * LLVM's alias analysis cannot tell two `%struct.Body*` values apart, so
 * without help a store to `bi.vx` blocks every later load of `bj.mass`: they
 * are both "a double somewhere behind a pointer". `bench/nbody`'s inner loop
 * paid that three times over, reloading `bj.mass` and `bi.mass` once per
 * component and never vectorising.
 *
 * `!tbaa` says what the access *is* rather than where it points: a `double` at
 * offset 48 of a `Body` cannot be the `double` at offset 24 of a `Body`,
 * whatever the two pointers are. The nodes are clang's struct-path shape, so
 * the reasoning is the one LLVM's `TypeBasedAAResult` is written for:
 *
 *   !{!"nish TBAA"}                              the root
 *   !{!"omnipotent char", <root>, i64 0}         the parent of every scalar
 *   !{!"double", <char>, i64 0}                  a scalar type
 *   !{!"Body", <double>, i64 0, <double>, i64 8, ...}   a struct's layout
 *   !{<Body>, <double>, i64 48}                  an access tag: this field
 *
 * **The proof that this is sound is the absence of two things.** Nish has no
 * inheritance (LANGUAGE.md, WP25) and no casts, no unions and no pointer
 * arithmetic, so a `%struct.C*` is the only type through which a `C` object's
 * bytes are ever read or written, and two distinct classes never overlap.
 *
 * Except once. A class that `implements` an interface lays the interface's
 * fields out first so that `%struct.C*` may be `bitcast` to `%struct.I*`
 * (`StructInfo.implements`, WP25) — real prefix subtyping, and exactly the
 * case C++ handles by making the base its first member. Rather than model it,
 * `tbaaTag` answers undefined for any struct that is an interface or
 * implements one, and an access with no `!tbaa` may alias everything. That is
 * the conservative half of the rule and it costs nothing measured: the shapes
 * this exists for are plain classes.
 *
 * The same rule as `aliasDomains` in `arrays.ts` governs the spelling: the
 * nodes are named rather than self-referential so LLVM's uniquing merges
 * module A's `Body` with module B's under LTO. Distinct roots would answer
 * "may alias" across an inlined boundary, which is where the traffic is.
 */
import { FieldInfo, StructInfo } from "../../checker/program.js";
import { StaticType, llvmType } from "../../types.js";
import { EmitContext } from "./context.js";

/** The root and the `char` node every scalar hangs off, as clang spells them. */
const charNode = (ctx: EmitContext): string => {
  const root = ctx.metadata(`!{!"nish TBAA"}`);
  return ctx.metadata(`!{!"omnipotent char", ${root}, i64 0}`);
};

/**
 * The scalar node for a field type, named by its LLVM type so that two modules
 * agree. Every pointer shares one node (`ptr`): the struct path already keeps
 * one class's fields away from another's, and nothing here needs to claim that
 * a `string` field cannot alias an object field.
 */
const scalarNode = (ctx: EmitContext, t: StaticType): string => {
  const ty = llvmType(t);
  const name = ty.endsWith("*") ? "ptr" : ty;
  return ctx.metadata(`!{!"${name}", ${charNode(ctx)}, i64 0}`);
};

/** `!{!"Body", <double>, i64 0, <double>, i64 8, ...}`: the whole layout, in offset order. */
const structNode = (ctx: EmitContext, info: StructInfo): string => {
  const members = info.fields.map((f) => `${scalarNode(ctx, f.type)}, i64 ${f.offset}`);
  return ctx.metadata(`!{!"${info.name}"${members.length > 0 ? `, ${members.join(", ")}` : ""}}`);
};

/**
 * `, !tbaa !N` for a load or store of `field`, or `""` where the access must
 * stay conservative — under `--no-optimize-attributes`, and for the interface
 * shapes §1 of the header comment excludes.
 */
export const fieldTbaa = (ctx: EmitContext, info: StructInfo, field: FieldInfo): string => {
  if (!ctx.opts.optimizeAttributes) return "";
  if (info.kind === "interface" || info.implements.length > 0) return "";
  const tag = ctx.metadata(`!{${structNode(ctx, info)}, ${scalarNode(ctx, field.type)}, i64 ${field.offset}}`);
  return `, !tbaa ${tag}`;
};
