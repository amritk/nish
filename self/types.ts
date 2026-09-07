// The StaticTS type model for stage1 (docs/wp14-selfhost.md, milestone S3),
// ported from `src/types.ts`.
//
// **A type is an `i32`.** `src/` writes a `StaticType` as a discriminated
// union of objects and compares them with a recursive `sameType`; here every
// type is *interned* into a `TypeTable` and named by its index, so two types
// are equal exactly when their ids are `===`. Three things fall out of that
// and all of them are why it is worth the table:
//
//   - The checker's hottest question — "are these the same type?" — is one
//     integer compare instead of a recursive walk, and it cannot answer
//     "different" for two spellings of one type.
//   - A type fits in the `i32` a `StringMap` stores, so a scope maps a name to
//     a type without a second table.
//   - `T[]` and `T[][]` cost one entry each, not one per mention. `src/`
//     allocates a fresh `{ kind: "array", elem }` at every annotation.
//
// It is the same model, not a smaller one: the scalar ids below are the union
// members of `src/types.ts` in order, and `tests/self/types_oracle.js` checks
// this file against that one over every type either can build.

import { StringMap } from "./map";

// The scalar types, which are their own kind and have fixed ids so that a
// module can name them without asking the table.
export const T_ERROR: i32 = 0; // D1's sentinel: a type that failed to check
export const T_I32: i32 = 1;
export const T_I64: i32 = 2;
export const T_U8: i32 = 3;
export const T_U16: i32 = 4;
export const T_U32: i32 = 5;
export const T_U64: i32 = 6;
export const T_F32: i32 = 7;
export const T_F64: i32 = 8;
export const T_BOOL: i32 = 9;
export const T_STRING: i32 = 10;
export const T_VOID: i32 = 11;
/** The first id a `TypeTable` hands out; everything below is fixed. */
export const T_FIRST_DERIVED: i32 = 12;

// The kinds of the types that are not scalars. `kindOf` answers one of these
// or the scalar id itself, so a `switch` over a kind is exhaustive.
export const K_ARRAY: i32 = 12;
export const K_STRUCT: i32 = 13;
export const K_NULLABLE: i32 = 14;

/** The one header type every array shares; `ARRAY_TYPE` in `src/codegen/runtime.ts`. */
export const ARRAY_STRUCT: string = "%struct.sts_array";

/**
 * IEEE-754 types. Every float lowering is the same instruction at both
 * widths; only the LLVM type name and the constant encoding differ.
 */
export function isFloat(type: i32): boolean {
  return type === T_F32 || type === T_F64;
}

/** Unsigned integers: the predicate that picks `udiv`, `icmp ult`, `lshr`, `zext`, `uitofp`. */
export function isUnsigned(type: i32): boolean {
  return type === T_U8 || type === T_U16 || type === T_U32 || type === T_U64;
}

/** Width in bits of an integer type; 0 for everything else, which is also the membership test. */
export function intBits(type: i32): i32 {
  switch (type) {
    case T_U8:
      return 8;
    case T_U16:
      return 16;
    case T_I32:
      return 32;
    case T_U32:
      return 32;
    case T_I64:
      return 64;
    case T_U64:
      return 64;
    default:
      return 0;
  }
}

export function isInteger(type: i32): boolean {
  return intBits(type) > 0;
}

export function isNumeric(type: i32): boolean {
  return isInteger(type) || isFloat(type);
}

/**
 * Every type in one program, interned.
 *
 * The parallel arrays are indexed by type id: `kinds[t]` is the kind, `refs`
 * is the element type of an array and the inner type of a nullable, and
 * `names` is the name of a struct. The scalars occupy 0..11 and are filled in
 * by the constructor so that `T_I32` and friends are usable before anything
 * has been interned.
 */
export class TypeTable {
  kinds: i32[];
  refs: i32[];
  names: string[];
  /** The interning index: a key built by `derivedKey` -> the id it names. */
  index: StringMap;

  constructor() {
    this.kinds = [];
    this.refs = [];
    this.names = [];
    this.index = new StringMap();
    let scalar = 0;
    while (scalar < T_FIRST_DERIVED) {
      this.kinds.push(scalar);
      this.refs.push(-1);
      this.names.push("");
      scalar = scalar + 1;
    }
  }

  /** How many types the table holds, scalars included. */
  size(): i32 {
    return this.kinds.length;
  }

  kindOf(type: i32): i32 {
    return this.kinds[type];
  }

  /** The element type of an array, the inner type of a nullable; -1 otherwise. */
  refOf(type: i32): i32 {
    return this.refs[type];
  }

  /** The name of a struct type; the empty string otherwise. */
  nameOf(type: i32): string {
    return this.names[type];
  }

  /**
   * The key a derived type is interned under. Kind, then the payload: a
   * reference is a decimal id and a struct is its name, and neither can
   * collide with the other because the kind leads.
   */
  derivedKey(kind: i32, ref: i32, name: string): string {
    return kind === K_STRUCT ? `${kind}:${name}` : `${kind}:${ref}`;
  }

  /** The id for a derived type, interning it the first time it is asked for. */
  intern(kind: i32, ref: i32, name: string): i32 {
    const key = this.derivedKey(kind, ref, name);
    const existing = this.index.get(key, -1);
    if (existing >= 0) {
      return existing;
    }
    const id = this.kinds.length;
    this.kinds.push(kind);
    this.refs.push(ref);
    this.names.push(name);
    this.index.set(key, id);
    return id;
  }

  arrayOf(elem: i32): i32 {
    return this.intern(K_ARRAY, elem, "");
  }

  structOf(name: string): i32 {
    return this.intern(K_STRUCT, -1, name);
  }

  /** `T | null`, which is already itself for a `T | null`, as in `src/types.ts`. */
  nullableOf(inner: i32): i32 {
    if (this.kinds[inner] === K_NULLABLE) {
      return inner;
    }
    return this.intern(K_NULLABLE, inner, "");
  }

  /** `T` for `T | null`; any other type unchanged. */
  stripNull(type: i32): i32 {
    return this.kinds[type] === K_NULLABLE ? this.refs[type] : type;
  }

  /** The types that may be nullable: every StaticTS value that is an LLVM pointer. */
  isPointer(type: i32): boolean {
    const kind = this.kinds[type];
    return kind === K_STRUCT || kind === K_ARRAY || type === T_STRING;
  }

  isNullable(type: i32): boolean {
    return this.kinds[type] === K_NULLABLE;
  }

  isArray(type: i32): boolean {
    return this.kinds[type] === K_ARRAY;
  }

  isStruct(type: i32): boolean {
    return this.kinds[type] === K_STRUCT;
  }

  /** The LLVM textual type. A nullable is its inner type: `null` is a pointer value, not a type. */
  llvmType(type: i32): string {
    switch (this.kinds[type]) {
      case T_ERROR:
        return "i32"; // never reached in emitted IR; the program failed to check
      case T_I32:
        return "i32";
      case T_I64:
        return "i64";
      case T_U8:
        return "i8";
      case T_U16:
        return "i16";
      case T_U32:
        return "i32";
      case T_U64:
        return "i64";
      case T_F32:
        return "float";
      case T_F64:
        return "double";
      case T_BOOL:
        return "i1";
      case T_STRING:
        return "i8*";
      case T_VOID:
        return "void";
      case K_ARRAY:
        return `${ARRAY_STRUCT}*`;
      case K_STRUCT:
        return `%struct.${this.names[type]}*`;
      case K_NULLABLE:
        return this.llvmType(this.refs[type]);
      default:
        panic(`internal error: llvmType of kind ${this.kinds[type]}`);
    }
  }

  /** Natural alignment in bytes, as clang and rustc use for the same LLVM types. */
  alignOf(type: i32): i32 {
    switch (this.kinds[type]) {
      case T_U8:
        return 1;
      case T_BOOL:
        return 1;
      case T_VOID:
        return 1;
      case T_U16:
        return 2;
      case T_I32:
        return 4;
      case T_U32:
        return 4;
      case T_F32:
        return 4;
      default:
        return 8; // i64, u64, f64, and every pointer
    }
  }

  /** The type as a diagnostic spells it: `i32[]`, `Node | null`, `boolean`. */
  typeName(type: i32): string {
    switch (this.kinds[type]) {
      case T_ERROR:
        return "error";
      case T_BOOL:
        return "boolean";
      case K_ARRAY:
        return `${this.typeName(this.refs[type])}[]`;
      case K_STRUCT:
        return this.names[type];
      case K_NULLABLE:
        return `${this.typeName(this.refs[type])} | null`;
      default:
        return this.scalarName(type);
    }
  }

  /** The spelling of a scalar type, which is its own name in the language. */
  scalarName(type: i32): string {
    switch (type) {
      case T_I32:
        return "i32";
      case T_I64:
        return "i64";
      case T_U8:
        return "u8";
      case T_U16:
        return "u16";
      case T_U32:
        return "u32";
      case T_U64:
        return "u64";
      case T_F32:
        return "f32";
      case T_F64:
        return "f64";
      case T_STRING:
        return "string";
      case T_VOID:
        return "void";
      default:
        return "error";
    }
  }

  /**
   * `from` may be stored where `to` is expected: the same type, or a `T`
   * where `T | null` is expected — the pointer is the same LLVM value. Every
   * value sink asks this: initializers, assignments, returns, arguments,
   * fields, pushes, elements.
   *
   * `T_ERROR` is assignable in both directions, which is D1's error-value
   * threading doing its job: a type that already produced a diagnostic must
   * not produce a second one at every site it reaches.
   */
  assignable(from: i32, to: i32): boolean {
    if (from === T_ERROR || to === T_ERROR) {
      return true;
    }
    if (from === to) {
      return true;
    }
    return this.kinds[to] === K_NULLABLE && this.refs[to] === from;
  }
}
