// The type model for stage1 (docs/wp14-selfhost.md, milestone S3),
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

import { internalError } from "./ice";
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

/**
 * A type that crosses the C boundary as exactly one machine value (WP27 S1) —
 * no pointer, no length word, no layout this compiler had to agree with anyone
 * about. `T_ERROR` passes so a signature that already failed to resolve reports
 * once rather than twice.
 *
 * Deliberately not `interop_abi`'s scalar set, which leaves `i64` and `u64` out:
 * the C ABI spells both (`int64_t`, `uint64_t`), so excluding them would refuse
 * a signature the compiler can already write into a header.
 */
export function isForeignScalar(t: i32): boolean {
  return (
    t === T_ERROR ||
    t === T_I32 ||
    t === T_I64 ||
    t === T_U8 ||
    t === T_U16 ||
    t === T_U32 ||
    t === T_U64 ||
    t === T_F32 ||
    t === T_F64 ||
    t === T_BOOL ||
    t === T_VOID
  );
}

// The kinds of the types that are not scalars. `kindOf` answers one of these
// or the scalar id itself, so a `switch` over a kind is exhaustive.
export const K_ARRAY: i32 = 12;
export const K_STRUCT: i32 = 13;
export const K_NULLABLE: i32 = 14;
/** `Result<T, E>` (WP16): a pointer to a monomorphised two-arm struct. */
export const K_RESULT: i32 = 15;
/**
 * A numeric `enum` (WP23): a distinct type whose representation is `i32`.
 * `names[type]` is the declared name, which is its identity, exactly as a
 * struct's is — and `isInteger` is deliberately false for it, so arithmetic on
 * a discriminant is refused where arithmetic on an `i32` is not.
 */
export const K_ENUM: i32 = 16;

// What the checker has proved about a `Result` at one use site. The state is
// part of the *id* because narrowing maps a variable to a type, and it is
// ignored by `assignable` and `typeName` because the LLVM value is the same
// pointer whatever has been proved about it.
export const R_UNKNOWN: i32 = 0;
export const R_OK: i32 = 1;
export const R_ERR: i32 = 2;

/** WP17: bit position of the payload in the packed `Result` word; the tag owns the low half. */
export const RESULT_PAYLOAD_SHIFT: i32 = 32;

/**
 * The private ABI a non-exported function may use for a by-value `Result`:
 * the discriminant and one slot per arm rather than one packed word. The dead
 * arm's slot is `undef`, which is what keeps it out of the live arm's
 * arithmetic. The reasoning and the measurement are in `src/types.ts`.
 */
export const RESULT_ARMS: string = "{ i1, i32, i32 }";

/** The one header type every array shares; `ARRAY_TYPE` in `src/codegen/runtime.ts`. */
export const ARRAY_STRUCT: string = "%struct.nish_array";

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
  /** The error arm of a `Result`; -1 for every other kind. */
  errs: i32[];
  /** The proof carried by a `Result` id; `R_UNKNOWN` for every other kind. */
  states: i32[];
  /**
   * `true` for the `readonly T[]` spelling of an array id, `false` for every
   * other id. It is a flag beside the kind rather than a kind of its own so
   * that every site asking `kindOf(t) === K_ARRAY` — the length, the element,
   * `for...of`, the layout, the emitter — keeps working unchanged, and only
   * the three that write have to ask the extra question.
   */
  readonlys: boolean[];
  /** The interning index: a key built by `derivedKey` -> the id it names. */
  index: StringMap;

  constructor() {
    this.kinds = [];
    this.refs = [];
    this.names = [];
    this.errs = [];
    this.states = [];
    this.readonlys = [];
    this.index = new StringMap();
    let scalar = 0;
    while (scalar < T_FIRST_DERIVED) {
      this.kinds.push(scalar);
      this.refs.push(-1);
      this.names.push("");
      this.errs.push(-1);
      this.states.push(R_UNKNOWN);
      this.readonlys.push(false);
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
    return kind === K_STRUCT || kind === K_ENUM ? `${kind}:${name}` : `${kind}:${ref}`;
  }

  /** The id for a derived type, interning it the first time it is asked for. */
  intern(kind: i32, ref: i32, name: string): i32 {
    return this.internAll(kind, ref, name, -1, R_UNKNOWN, false);
  }

  /** `intern` with the two `Result` payloads and the array `readonly` flag. */
  internAll(kind: i32, ref: i32, name: string, err: i32, state: i32, ro: boolean): i32 {
    // `readonly T[]` and `T[]` are two types, so they are two ids and the key
    // has to tell them apart; the suffix is only added for the readonly one so
    // that every key already in the table keeps its spelling.
    const base = kind === K_RESULT ? `${kind}:${ref}:${err}:${state}` : this.derivedKey(kind, ref, name);
    const key = ro ? `${base}:ro` : base;
    const existing = this.index.get(key, -1);
    if (existing >= 0) {
      return existing;
    }
    const id = this.kinds.length;
    this.kinds.push(kind);
    this.refs.push(ref);
    this.names.push(name);
    this.errs.push(err);
    this.states.push(state);
    this.readonlys.push(ro);
    this.index.set(key, id);
    return id;
  }

  arrayOf(elem: i32): i32 {
    return this.intern(K_ARRAY, elem, "");
  }

  /** `readonly T[]` / `ReadonlyArray<T>`: `T[]`'s id space, with every write refused. */
  readonlyArrayOf(elem: i32): i32 {
    return this.internAll(K_ARRAY, elem, "", -1, R_UNKNOWN, true);
  }

  /** True for the `readonly T[]` spelling; false for every other id, -1 included. */
  isReadonlyArray(type: i32): boolean {
    return type >= 0 && this.kinds[type] === K_ARRAY && this.readonlys[type];
  }

  structOf(name: string): i32 {
    return this.intern(K_STRUCT, -1, name);
  }

  /** The type a numeric `enum` declaration names (WP23); identity is the declared name. */
  enumOf(name: string): i32 {
    return this.intern(K_ENUM, -1, name);
  }

  isEnum(type: i32): boolean {
    return type >= 0 && this.kinds[type] === K_ENUM;
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

  // ---- `Result<T, E>` (WP16) ----------------------------------------------

  resultOf(ok: i32, err: i32, state: i32): i32 {
    return this.internAll(K_RESULT, ok, "", err, state, false);
  }

  /**
   * The side tables hand out -1 for a node whose type was never recorded (a
   * callee position, a node the checker rejected), and this predicate is asked
   * about those, so it answers rather than indexing past the table.
   */
  isResult(type: i32): boolean {
    return type >= 0 && this.kinds[type] === K_RESULT;
  }

  /** The success arm of a `Result`; `refOf` under another name, for readers. */
  okOf(type: i32): i32 {
    return this.refs[type];
  }

  errOf(type: i32): i32 {
    return this.errs[type];
  }

  stateOf(type: i32): i32 {
    return this.states[type];
  }

  /** The same `Result` read under a different proof; anything else unchanged. */
  withState(type: i32, state: i32): i32 {
    if (this.kinds[type] !== K_RESULT) {
      return type;
    }
    return this.resultOf(this.refs[type], this.errs[type], state);
  }

  /**
   * A prefix-coded name for a type, so one LLVM struct is monomorphised per
   * distinct `Result<T, E>` and two different ones can never share a layout.
   * Every constructor writes its tag before its operands, which makes the
   * encoding unambiguous without separators of its own: `res.res.i32.str.str`
   * can only be read one way. A class name is prefixed with `$` because that
   * character cannot appear in a TypeScript identifier, so a `Result` over a
   * class called `res` cannot collide with the constructor.
   */
  mangle(type: i32): string {
    switch (this.kinds[type]) {
      case T_STRING:
        return "str";
      case T_BOOL:
        return "bool";
      case K_ARRAY:
        // `readonly T[]` and `T[]` are two types (`sameType` says so), so they
        // need two names: without the tag `identity<readonly i32[]>` and
        // `identity<i32[]>` would be one symbol (WP18 §3c).
        return this.readonlys[type]
          ? `roarr.${this.mangle(this.refs[type])}`
          : `arr.${this.mangle(this.refs[type])}`;
      case K_NULLABLE:
        return `opt.${this.mangle(this.refs[type])}`;
      case K_STRUCT:
        return `$${this.names[type]}`;
      // An enum is an `i32` in memory but not an `i32` in the type system, so
      // it mangles apart from one: `Result<Kind, string>` and
      // `Result<i32, string>` share a layout and must not share a layout name.
      case K_ENUM:
        return `en$${this.names[type]}`;
      case K_RESULT:
        return `res.${this.mangle(this.refs[type])}.${this.mangle(this.errs[type])}`;
      default:
        return this.scalarName(type);
    }
  }

  /** The LLVM struct name (without the `%struct.` prefix) backing a `Result`. */
  resultStructName(type: i32): string {
    return `nish_result.${this.mangle(this.refs[type])}.${this.mangle(this.errs[type])}`;
  }

  /** The types that may be nullable: every value that is an LLVM pointer. */
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

  /**
   * WP17: the payload types the packed by-value `Result` word can carry — a
   * scalar of at most four bytes, so a discriminant word and a payload word
   * together are one `i64`. `i64`, `u64` and `f64` are four bytes too many; a
   * string, an array, a class, a nullable or a nested `Result` is a pointer,
   * and a pointer payload would need the whole word on its own.
   */
  packablePayload(type: i32): boolean {
    const kind = this.kinds[type];
    return (
      kind === T_VOID ||
      kind === T_BOOL ||
      kind === T_U8 ||
      kind === T_U16 ||
      kind === T_I32 ||
      kind === T_U32 ||
      kind === T_F32 ||
      // WP23: an enum is an `i32`, so it packs exactly as one does — every
      // widening on that path goes through `llvmType`, which already says `i32`.
      kind === K_ENUM
    );
  }

  /**
   * WP17: whether a `Result` is returned by value, in one `i64`, rather than
   * as the WP16 pointer to an arena struct.
   *
   *   bits  0..31   the discriminant: 1 for `Ok`, 0 for `Err`
   *   bits 32..63   the live arm's payload, zero-extended
   *
   * The dead arm is not represented, which is what makes `Result<i32, i32>` —
   * twelve bytes as a struct — fit in a word. Eight bytes is not a tuning
   * knob: `i64` is the only return width whose C-ABI lowering is the same LLVM
   * type on all six supported triples. `docs/wp17-result-abi.md` has the
   * measurements; `src/types.ts` has the same predicate.
   */
  resultByValue(type: i32): boolean {
    if (!this.isResult(type)) {
      return false;
    }
    return this.packablePayload(this.refs[type]) && this.packablePayload(this.errs[type]);
  }

  /**
   * The LLVM type at a call boundary — a parameter or a return slot. It
   * differs from `llvmType` for exactly one shape: a `Result` small enough to
   * pack travels in a register as an `i64`, never as a pointer to arena
   * memory.
   */
  llvmAbiType(type: i32, privateAbi: boolean): string {
    if (this.resultByValue(type)) {
      return privateAbi ? RESULT_ARMS : "i64";
    }
    return this.llvmType(type);
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
      case K_ENUM:
        return "i32";
      case K_NULLABLE:
        return this.llvmType(this.refs[type]);
      case K_RESULT:
        return `%struct.${this.resultStructName(type)}*`;
      default:
        process.exit(internalError(`internal error: llvmType of kind ${this.kinds[type]}`));
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
      case K_ENUM:
        return 4; // an i32
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
        return this.readonlys[type]
          ? `readonly ${this.typeName(this.refs[type])}[]`
          : `${this.typeName(this.refs[type])}[]`;
      case K_STRUCT:
        return this.names[type];
      case K_ENUM:
        return this.names[type];
      case K_NULLABLE:
        return `${this.typeName(this.refs[type])} | null`;
      case K_RESULT:
        // The proof is not part of the name: a narrowed `Result` reads the
        // same in a diagnostic as the value it was narrowed from.
        return `Result<${this.typeName(this.refs[type])}, ${this.typeName(this.errs[type])}>`;
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
    // `state` is a proof about one use site, not part of the type: a `Result`
    // narrowed to its ok arm is the same value, and the same LLVM pointer, as
    // the un-narrowed one it came from (WP16).
    if (this.kinds[from] === K_RESULT && this.kinds[to] === K_RESULT) {
      return this.refs[from] === this.refs[to] && this.errs[from] === this.errs[to];
    }
    if (this.widensToReadonlyArray(from, to)) {
      return true;
    }
    if (this.kinds[to] === K_NULLABLE) {
      return this.refs[to] === from || this.widensToReadonlyArray(from, this.refs[to]);
    }
    return false;
  }

  /**
   * A `T[]` where a `readonly T[]` is wanted. One direction only: handing a
   * mutable array to something that promises not to write through it is safe,
   * and the reverse would launder the promise away. The two ids name the same
   * pointer, so nothing is emitted for the conversion.
   */
  widensToReadonlyArray(from: i32, to: i32): boolean {
    if (!this.isReadonlyArray(to) || this.kinds[from] !== K_ARRAY) {
      return false;
    }
    return this.refs[from] === this.refs[to];
  }
}
