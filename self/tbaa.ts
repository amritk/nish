/**
 * Type-based alias analysis metadata for class field access (WP9). The
 * reasoning, the soundness argument and the node shapes are written out in
 * `src/codegen/emit/tbaa.ts`; this is its mirror.
 *
 * In short: `!tbaa` says what an access *is* rather than where it points, so a
 * `double` at offset 48 of a `Body` cannot be the `double` at offset 24 of a
 * `Body` whatever the two pointers are. It is sound here because Nish has no
 * inheritance, no casts, no unions and no pointer arithmetic — with one
 * exception, `implements`, whose prefix layout really is subtyping, and which
 * `fieldTbaa` answers with no tag at all.
 */
import { Emitter } from "./emit";
import { FieldInfo, STRUCT_INTERFACE, StructInfo } from "./program";

/** The root and the `char` node every scalar hangs off, as clang spells them. */
function charNode(emitter: Emitter): string {
  const root = emitter.metadata(`!{!"nish TBAA"}`);
  return emitter.metadata(`!{!"omnipotent char", ${root}, i64 0}`);
}

/**
 * The scalar node for a field type, named by its LLVM type so that two modules
 * agree under LTO. Every pointer shares one node (`ptr`): the struct path
 * already keeps one class's fields away from another's.
 */
function scalarNode(emitter: Emitter, type: i32): string {
  const ty = emitter.llvm(type);
  const name = ty.endsWith("*") ? "ptr" : ty;
  return emitter.metadata(`!{!"${name}", ${charNode(emitter)}, i64 0}`);
}

/** `!{!"Body", <double>, i64 0, <double>, i64 8, ...}`: the whole layout, in offset order. */
function structNode(emitter: Emitter, info: StructInfo): string {
  let members = "";
  let i = 0;
  while (i < info.fields.length) {
    const field = info.fields[i];
    // Interned in stage0's order, so the two compilers number the nodes alike.
    members = `${members}, ${scalarNode(emitter, field.type)}, i64 ${field.offset}`;
    i = i + 1;
  }
  return emitter.metadata(`!{!"${info.name}"${members}}`);
}

/**
 * `, !tbaa !N` for a load or store of `field`, or `""` where the access must
 * stay conservative: under `--no-optimize-attributes`, and for an interface or
 * a class that implements one, whose layouts really do overlap.
 */
export function fieldTbaa(emitter: Emitter, info: StructInfo, field: FieldInfo): string {
  if (!emitter.opts.optimizeAttributes) {
    return "";
  }
  if (info.kind === STRUCT_INTERFACE || info.implementsNames.length > 0) {
    return "";
  }
  const base = structNode(emitter, info);
  const scalar = scalarNode(emitter, field.type);
  return `, !tbaa ${emitter.metadata(`!{${base}, ${scalar}, i64 ${field.offset}}`)}`;
}
