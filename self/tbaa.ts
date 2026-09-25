/**
 * Type-based alias analysis metadata for class field access (WP9) and for
 * array element access.
 *
 * `!tbaa` says what an access *is* rather than where it points, so a `double`
 * at offset 48 of a `Body` cannot be the `double` at offset 24 of a `Body`
 * whatever the two pointers are. It is sound here because Nish has no
 * inheritance, no casts, no unions and no pointer arithmetic — with one
 * exception, `implements`, whose prefix layout really is subtyping, and which
 * `fieldTbaa` answers with no tag at all.
 *
 * Element slots get a subtree of their own beside the scalars the fields use,
 * so that an element store is not read as a clobber of the class field that
 * holds the array (`elementTbaa` has the argument), and so does the array
 * header, so that a field store is not read as a clobber of an array's
 * `length` or `data` (`headerTbaa`). The whole rule is in
 * `docs/ARCHITECTURE.md`, "Attribute soundness rules".
 */
import { Emitter } from "./emit";
import { FieldInfo, STRUCT_INTERFACE, StructInfo } from "./program";

/** The root and the `char` node every scalar hangs off, as clang spells them. */
const charNode = (emitter: Emitter): string => {
  const root = emitter.metadata(`!{!"nish TBAA"}`);
  return emitter.metadata(`!{!"omnipotent char", ${root}, i64 0}`);
};

/**
 * A value type as a TBAA node names it: its LLVM type, so that two modules
 * agree under LTO, with every pointer spelled `ptr`.
 */
const typeName = (emitter: Emitter, type: i32): string => {
  const ty = emitter.llvm(type);
  return ty.endsWith("*") ? "ptr" : ty;
};

/**
 * The scalar node for a field type. Every pointer shares one node (`ptr`): the
 * struct path already keeps one class's fields away from another's.
 */
const scalarNode = (emitter: Emitter, type: i32): string =>
  emitter.metadata(`!{!"${typeName(emitter, type)}", ${charNode(emitter)}, i64 0}`);

/** `!{!"Body", <double>, i64 0, <double>, i64 8, ...}`: the whole layout, in offset order. */
const structNode = (emitter: Emitter, info: StructInfo): string => {
  let members = "";
  let i = 0;
  while (i < info.fields.length) {
    const field = info.fields[i];
    // An inline array field is not a member of the path: its bytes are the
    // array's header and slots, read and written only through `headerTbaa`
    // and `elementTbaa` tags, never through a field access of this class.
    if (!field.inline()) {
      // Interned in stage0's order, so the two compilers number the nodes alike.
      members = `${members}, ${scalarNode(emitter, field.type)}, i64 ${field.offset}`;
    }
    i = i + 1;
  }
  return emitter.metadata(`!{!"${info.name}"${members}}`);
};

/**
 * `, !tbaa !N` for a load or store of `field`, or `""` where the access must
 * stay conservative: under `--no-optimize-attributes`, and for an interface or
 * a class that implements one, whose layouts really do overlap.
 */
export const fieldTbaa = (emitter: Emitter, info: StructInfo, field: FieldInfo): string => {
  if (!emitter.opts.optimizeAttributes) {
    return "";
  }
  if (info.kind === STRUCT_INTERFACE || info.implementsNames.length > 0) {
    return "";
  }
  const base = structNode(emitter, info);
  const scalar = scalarNode(emitter, field.type);
  return `, !tbaa ${emitter.metadata(`!{${base}, ${scalar}, i64 ${field.offset}}`)}`;
};

/**
 * `, !tbaa !N` for a load or store of one array element slot holding a value
 * of `elem`, or `""` under `--no-optimize-attributes`.
 *
 * The node is `element <type>`, a sibling of the field scalars under the root
 * rather than a child of one, so an element access is NoAlias with every
 * tagged field access — the pointer-typed ones included, which is what keeps
 * `this.v` live across `this.v[i] = x` whatever `v` holds. That is sound
 * because element storage and the bytes a class field access reaches never
 * overlap: a data block is an arena bump, an entry-block alloca, a
 * `nish_alloc_array` block or the tail of `nish_argv_init`'s `malloc`, and a
 * class object is a `nish_alloc_struct` bump or an alloca of its own. An
 * inline array field (`self/inline_arrays.ts`) does put slots inside a class
 * object, but never where a field access goes: the field is never loaded or
 * stored as a field, and `structNode` leaves it out of the class's path. The one
 * kind of object that does live inside element storage is an inline record
 * (`inlineElementStruct`: an interface nothing implements), and its field
 * accesses carry no tag (`fieldTbaa` answers `""` for every interface), while
 * the slot itself is written by an untagged `llvm.memcpy` — so this must never
 * be asked for an inline record, and the callers ask only on the scalar path.
 * Two element types never share a slot either, because there is no cast and
 * no view of one array's storage as another's.
 */
export const elementTbaa = (emitter: Emitter, elem: i32): string => {
  if (!emitter.opts.optimizeAttributes) {
    return "";
  }
  const node = emitter.metadata(`!{!"element ${typeName(emitter, elem)}", ${charNode(emitter)}, i64 0}`);
  return `, !tbaa ${emitter.metadata(`!{${node}, ${node}, i64 0}`)}`;
};

/**
 * `, !tbaa !N` for a load or store of array header field `index` (0 `len`,
 * 1 `cap`, 2 `data`), or `""` under `--no-optimize-attributes`.
 *
 * The header is a struct node of its own, `array header`, whose fields hang
 * off two scalars that are nobody else's (`header i64`, `header ptr`). No
 * class can be named with a space, so no field's struct path can reach that
 * node, and a header access is NoAlias with every tagged class field access
 * and every element access. That is what keeps `this.piles`'s `data` and
 * `len` live across `top.next = null` in AWFY Towers.
 *
 * It is sound because every write of a header's bytes is one of two things.
 * Either it is Nish IR, and then it goes through `storeHeaderField` in
 * `self/emit_arrays.ts` and carries this tag: `new Array`, a literal, `push`
 * and `pop`, whether the header is an arena bump or an entry-block alloca. Or
 * it is C behind a call: `nish_array_grow`, `nish_alloc_array`,
 * `nish_readdir`, `nish_argv_init`, a C caller's stack header or the N-API
 * shim's. An inline array field's header sits inside a class object and is
 * written by `storeHeaderField` alone (`initInlineArrays`,
 * `emitInlineArrayAssignment`), never through the class's field path, which
 * leaves that member out. A call is opaque to TBAA, and under `-flto` the inlined C carries
 * clang's own root, which LLVM answers MayAlias against this one. A header is
 * never a class object, an element slot or an inline record, and is never
 * copied with `llvm.memcpy`. `docs/ARCHITECTURE.md` has the whole argument.
 */
export const headerTbaa = (emitter: Emitter, index: i32): string => {
  if (!emitter.opts.optimizeAttributes) {
    return "";
  }
  const omni = charNode(emitter);
  const word = emitter.metadata(`!{!"header i64", ${omni}, i64 0}`);
  const ptr = emitter.metadata(`!{!"header ptr", ${omni}, i64 0}`);
  const header = emitter.metadata(`!{!"array header", ${word}, i64 0, ${word}, i64 8, ${ptr}, i64 16}`);
  const access = index === 2 ? ptr : word;
  return `, !tbaa ${emitter.metadata(`!{${header}, ${access}, i64 ${index * 8}}`)}`;
};
