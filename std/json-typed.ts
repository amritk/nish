/**
 * `nish/json-typed` — decode a JSON object into a class, and encode a class
 * back, with code the compiler writes from the class's fields.
 *
 *     import { JsonLimits } from "nish/json-tokenizer";
 *     import { JsonWriter } from "nish/json";
 *     import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";
 *
 *     class Point { x: i32 = 0; y: i32 = 0 }
 *
 *     const d = new JsonDecoder(body, 0, toI32(body.length), new JsonLimits());
 *     const p = new Point();
 *     if (jsonDecode(d, p) === 0) {
 *       const w = new JsonWriter(out, 0);
 *       jsonEncode(w, p);              // out[0 .. w.end) is {"x":..,"y":..}
 *     }
 *
 * **What is generated, and from what.** `jsonDecode(d, out)` and
 * `jsonEncode(w, value)` are generic, and the bodies written below are not
 * what runs natively: the compiler lowers every call in place, in the module
 * that makes it, to code it writes from the layout of the class the call
 * binds `T` to (`src/json-typed.ts`, `src/emit-json.ts`). That code is
 * straight-line calls into the methods of `JsonDecoder` and the functions
 * here for each field, and into `JsonWriter`'s, so all of the parsing is the
 * tokenizer's and all of the writing is the writer's. A field may be an
 * `i32`, `u32`, `i64`, `u64`, `f64` (or `number`), `boolean` or `string`, a
 * numeric enum, a class decoded the same way, a `JsonNumber`, an array or a
 * `Map<string, V>` of any of those, or any of those `| null`; anything else is
 * refused at the call, naming the field (docs/LANGUAGE.md, "Typed JSON").
 *
 * **The decoding rules.** A JSON object's keys are the class's field names,
 * byte for byte, or the keys its options give them:
 *
 *     class Account {
 *       static readonly json = { rename: { userId: "user_id" }, optional: ["tags"] };
 *       ...
 *     }
 *
 * The compiler reads that literal; it is not a field. Every field is required
 * but an optional one, whose missing key sets it to its initializer, a key may
 * appear once, and a key
 * that names no field is an error unless `ignoreUnknown` is set, when its
 * value is stepped over. A number must fit its field: an integer field takes
 * an integer written without a fraction or an exponent and in the field's
 * range, and `f64` takes any number. `null` is accepted only by a field whose
 * type is `| null`. Fields are written to `out` as they are read, in the
 * input's order: a nested object is decoded into the object the field already
 * holds, an array's elements into the elements it already has (so a reused
 * object reuses its arrays and objects, and `Arena.used()` stays flat), and a
 * string field keeps the string it holds when the input's is equal.
 * A class the decoder has to make — an array element past the array's end, or
 * a `| null` field that holds `null` — is made with `new C()`.
 *
 * **Errors are sticky codes**, as the tokenizer's and the writer's are. The
 * first error sets `failed` to a negative code — a `JSON_DECODE_*` code here,
 * or the tokenizer's own `JSON_TOK_ERR_*` code when the text is not JSON or
 * crosses one of its `JsonLimits` — and `errorAt` to the byte offset of the
 * token it was found at. Every later call does nothing, and `jsonDecode`
 * answers `failed`. Nothing an input holds panics. After an error, `out` holds
 * a value of its type in every field, some of them decoded and some as they
 * were.
 *
 * **Encoding** writes the fields in declaration order, each through the
 * writer method of its type, so the text is what `JSON.stringify` writes for
 * the same object; the writer's own sticky code reports a full buffer.
 *
 * **Under Node** the types are erased, so there is no layout to generate the
 * code from: `jsonDecode` and `jsonEncode` end the program with a panic
 * naming this, rather than guessing a type from whatever value a field holds
 * (docs/LANGUAGE.md, "Typed JSON", class C). Everything else here runs there.
 *
 * Every name here is `json`-prefixed, as `std/json.ts` explains, and every
 * code is an `i32`, so the module is the same under `--number-mode f64`.
 */
import { JsonWriter } from "nish/json"
import {
  JSON_TOK_ARRAY_BEGIN,
  JSON_TOK_ARRAY_END,
  JSON_TOK_END,
  JSON_TOK_FALSE,
  JSON_TOK_KEY,
  JSON_TOK_NULL,
  JSON_TOK_NUMBER,
  JSON_TOK_OBJECT_BEGIN,
  JSON_TOK_STRING,
  JSON_TOK_TRUE,
  JsonLimits,
  JsonTokenizer,
} from "nish/json-tokenizer"

/** Nothing has failed. */
export const JSON_DECODE_OK: i32 = 0
/** A value of the wrong JSON type for its field: a string for an `i32`, an array for a class, `null` for a field that is not `| null`. */
export const JSON_DECODE_TYPE: i32 = -20
/** A number its field cannot hold: a fraction or an exponent for an integer field, or a value outside its range. */
export const JSON_DECODE_RANGE: i32 = -21
/** A key that names no field of the class, while `ignoreUnknown` is off. */
export const JSON_DECODE_UNKNOWN: i32 = -22
/** A key that names a field the object already gave. */
export const JSON_DECODE_DUPLICATE: i32 = -23
/** An object that ended without one of the class's fields; `errorAt` is its closing brace. */
export const JSON_DECODE_MISSING: i32 = -24
/**
 * A `Map` field's object with more keys than `maxMapKeys`; `errorAt` is the
 * first key past the limit. The global `Map` hashes a string with no seed, so
 * a body can choose keys that all collide, and the limit bounds what one
 * map's probes cost (docs/security/json.md, JSON-9).
 */
export const JSON_DECODE_MAP_LIMIT: i32 = -25

/** What a program running under Node is told, where the compiler would have written the code. */
const JSON_TYPED_ERASED: string =
  "nish/json-typed: jsonDecode and jsonEncode are written by the compiler from the class's fields, and under Node the types are erased"

/**
 * A JSON number kept as the text it was written in, so that no digit is lost:
 * an integer wider than a `u64` and a fraction with more digits than an `f64`
 * holds are decoded and encoded again byte for byte. A field of this class is
 * read and written as one number, not as an object: `jsonDecode` copies the
 * number's text into it, and `jsonEncode` writes that text back unchanged.
 *
 * It reads its text as `nish/json-value` reads a number (`numberText`,
 * `isI64`, `i64`, `isU64`, `u64`, `f64`), through a tokenizer of its own, so
 * the two answer alike; the two are separate types until the typed layer
 * can name a `JsonValue`'s number directly.
 *
 * A new one holds `0`. Decoding into one reuses its bytes, so an object
 * decoded again with numbers no longer than before allocates nothing for
 * them.
 */
export class JsonNumber {
  /** The text is `bytes[0, count)`, one JSON number; the bytes past it are room. */
  bytes: u8[]
  count: i32 = 1

  constructor() {
    this.bytes = [48]
  }

  /** The number's text, exactly as it was written or set. */
  text(): string {
    return String.fromBytes(this.bytes, 0, this.count)
  }

  /**
   * A tokenizer over the text, read to its one token. It may open no
   * container and take a number of any length, so it allocates no stack.
   */
  reader(): JsonTokenizer {
    const limits: JsonLimits = new JsonLimits()
    limits.maxDepth = 0
    limits.maxNumberBytes = this.count
    const tok: JsonTokenizer = new JsonTokenizer(this.bytes, 0, this.count, limits)
    tok.next()
    return tok
  }

  /** Whether the number is written without a fraction or an exponent and its value fits an `i64`. */
  isI64(): boolean {
    return this.reader().isInteger()
  }

  /** The value as an `i64` when `isI64()` holds, and `0` otherwise. */
  i64(): i64 {
    return this.reader().numberI64()
  }

  /** Whether the number is written in digits alone, with no sign, fraction or exponent, and fits a `u64`. */
  isU64(): boolean {
    return this.reader().isU64()
  }

  /** The value as a `u64` when `isU64()` holds, and `0` otherwise. */
  u64(): u64 {
    return this.reader().numberU64()
  }

  /** The nearest `f64`, ties to even, as `JSON.parse` reads it. */
  f64(): f64 {
    return this.reader().numberF64()
  }

  /**
   * Sets the text to `text` when it is one JSON number and nothing else, and
   * answers whether it was; any other text leaves the number as it was.
   */
  setText(text: string): boolean {
    const n: i32 = toI32(text.length)
    const bytes: u8[] = new Array<u8>(n)
    for (let k: i32 = 0; k < n && k < toI32(bytes.length); k += 1) {
      let c: i32 = toI32(text.charCodeAt(k))
      // A number is ASCII; anything wider fails the check below as `~` does.
      if (c > 127) {
        c = 126
      }
      bytes[k] = toU8(c)
    }
    const limits: JsonLimits = new JsonLimits()
    limits.maxDepth = 0
    limits.maxNumberBytes = n
    const tok: JsonTokenizer = new JsonTokenizer(bytes, 0, n, limits)
    const isNumber: boolean = tok.next() === JSON_TOK_NUMBER && tok.tokStart === 0 && tok.tokEnd === n
    if (!isNumber || tok.next() !== JSON_TOK_END) {
      return false
    }
    this.bytes = bytes
    this.count = n
    return true
  }
}

/**
 * One decoding: a tokenizer over the input and the sticky error. Make one per
 * connection and `reset` it per request; nothing it does allocates but the
 * strings it decodes, the arrays it grows and the objects it makes.
 */
export class JsonDecoder {
  tok: JsonTokenizer
  /** `JSON_DECODE_OK`, or the first `JSON_DECODE_*` or `JSON_TOK_ERR_*` code. */
  failed: i32 = 0
  /** The byte offset in the input of the token the error was found at; `-1` until one. */
  errorAt: i32 = -1
  /** The most keys one `Map` field's object may give, 4,096 unless set; past it, `JSON_DECODE_MAP_LIMIT`. */
  maxMapKeys: i32 = 4096
  /** Step over a key that names no field instead of failing with `JSON_DECODE_UNKNOWN`. */
  ignoreUnknown: boolean = false
  /**
   * Whether the tokenizer's current token is a value nothing has read yet:
   * the first token of an array element, read to see whether the array had
   * ended, or a value `takeNull` found was not `null`.
   */
  held: boolean = false

  constructor(src: u8[], off: i32, len: i32, limits: JsonLimits) {
    this.tok = new JsonTokenizer(src, off, len, limits)
  }

  /** Starts over on `src[off, off + len)`, keeping the limits, `ignoreUnknown` and `maxMapKeys`, and clearing any error. */
  reset(src: u8[], off: i32, len: i32): void {
    this.tok.reset(src, off, len)
    this.failed = JSON_DECODE_OK
    this.errorAt = -1
    this.held = false
  }

  /** Records the first error. */
  fail(code: i32, at: i32): void {
    if (this.failed === JSON_DECODE_OK) {
      this.failed = code
      this.errorAt = at
    }
  }

  /** `JSON_DECODE_TYPE` at the current token, unless the read that found it failed already. */
  wrongType(): void {
    this.fail(JSON_DECODE_TYPE, this.tok.tokStart)
  }

  /** The kind of the next value's first token, or a negative code; the held token first, when there is one. */
  take(): i32 {
    if (this.failed !== JSON_DECODE_OK) {
      return this.failed
    }
    if (this.held) {
      this.held = false
      return this.tok.kind
    }
    const k: i32 = this.tok.next()
    if (k < 0) {
      this.fail(k, this.tok.errorAt)
    }
    return k
  }

  /** The next value opens an object; anything else is `JSON_DECODE_TYPE`. */
  beginObject(): boolean {
    const k: i32 = this.take()
    if (k === JSON_TOK_OBJECT_BEGIN) {
      return true
    }
    if (k >= 0) {
      this.wrongType()
    }
    return false
  }

  /** Reads the next key of the open object, or its end; `false` at the end and after any error. */
  nextField(): boolean {
    if (this.failed !== JSON_DECODE_OK) {
      return false
    }
    const k: i32 = this.tok.next()
    if (k === JSON_TOK_KEY) {
      return true
    }
    if (k < 0) {
      this.fail(k, this.tok.errorAt)
    }
    return false
  }

  /** Whether the current key is `name`. */
  keyIs(name: string): boolean {
    return this.tok.keyEquals(name)
  }

  /**
   * The current key's length in bytes once decoded, or `-1` when the current
   * token is not a key: what the code written for a class switches on before
   * it compares a key's bytes with a field's name.
   */
  keyLength(): i32 {
    return this.tok.stringLength()
  }

  /**
   * Byte `at` of the current key when the key has no escape, so that its
   * bytes are the input's, and `-1` otherwise: for a key with an escape, for
   * an `at` outside it, and when the current token is not a key. A `-1`
   * matches no byte of a field's name, and the code written for a class then
   * compares the key with each name of its length through `keyIs`, which
   * decodes the escapes.
   */
  keyByte(at: i32): i32 {
    const tok: JsonTokenizer = this.tok
    const n: i32 = tok.stringLength()
    if (n !== tok.tokEnd - tok.tokStart - 2 || at < 0 || at >= n) {
      return -1
    }
    const src: u8[] = tok.src
    const i: i32 = tok.tokStart + 1 + at
    if (i < 0 || i >= toI32(src.length)) {
      return -1
    }
    return toI32(src[i])
  }

  /**
   * Whether a map that already holds `count` keys may take another, the
   * current one; `JSON_DECODE_MAP_LIMIT` at the key when it may not.
   */
  mapRoom(count: i32): boolean {
    if (count < this.maxMapKeys) {
      return true
    }
    this.fail(JSON_DECODE_MAP_LIMIT, this.tok.tokStart)
    return false
  }

  /** The current key, decoded, as a new string: a `Map` field's key. `""` when the current token is not a key. */
  key(): string {
    return this.text()
  }

  /**
   * The current key or string as a new string, made by one
   * `String.fromBytes`: straight from the input when it has no escape, and
   * from its unescaped bytes when it has one. `""` when the current token is
   * neither.
   */
  text(): string {
    const tok: JsonTokenizer = this.tok
    const n: i32 = tok.stringLength()
    if (n < 0) {
      return ""
    }
    if (n === tok.tokEnd - tok.tokStart - 2) {
      // No escape, so the bytes between the quotes are the string's, copied
      // once by `String.fromBytes`.
      return String.fromBytes(tok.src, tok.tokStart + 1, tok.tokEnd - 1)
    }
    // The unescaped bytes are a temporary: a caller that keeps only the string
    // it answers gives them back (the call-site reclaim, docs/LANGUAGE.md).
    const bytes: u8[] = new Array<u8>(n)
    const at: i32 = 0
    tok.stringInto(bytes, at)
    return String.fromBytes(bytes, 0, n)
  }

  /** The current key names no field: stepped over with its value, or `JSON_DECODE_UNKNOWN`. */
  unknownField(): void {
    if (this.failed !== JSON_DECODE_OK) {
      return
    }
    if (!this.ignoreUnknown) {
      this.fail(JSON_DECODE_UNKNOWN, this.tok.tokStart)
      return
    }
    const k: i32 = this.tok.skipValue()
    if (k < 0) {
      this.fail(k, this.tok.errorAt)
    }
  }

  /** The current key names a field the object already gave. */
  duplicateField(): void {
    this.fail(JSON_DECODE_DUPLICATE, this.tok.tokStart)
  }

  /** The object just closed without one of the fields. */
  missingField(): void {
    this.fail(JSON_DECODE_MISSING, this.tok.tokStart)
  }

  /** After the top-level value: nothing but blanks may follow. Answers `failed`. */
  finish(): i32 {
    if (this.failed === JSON_DECODE_OK) {
      const k: i32 = this.tok.next()
      if (k < 0) {
        this.fail(k, this.tok.errorAt)
      } else if (k !== JSON_TOK_END) {
        this.wrongType()
      }
    }
    return this.failed
  }

  /** Whether the next value is `null`, read if so; otherwise it is held for the read that follows. */
  takeNull(): boolean {
    const k: i32 = this.take()
    if (k === JSON_TOK_NULL) {
      return true
    }
    if (k >= 0) {
      this.held = true
    }
    return false
  }

  /** The next value opens an array; anything else is `JSON_DECODE_TYPE`. */
  beginArray(): boolean {
    const k: i32 = this.take()
    if (k === JSON_TOK_ARRAY_BEGIN) {
      return true
    }
    if (k >= 0) {
      this.wrongType()
    }
    return false
  }

  /** Whether the open array has another element, whose first token is then held; `false` at its end and after any error. */
  nextElement(): boolean {
    if (this.failed !== JSON_DECODE_OK) {
      return false
    }
    const k: i32 = this.tok.next()
    if (k === JSON_TOK_ARRAY_END) {
      return false
    }
    if (k < 0) {
      this.fail(k, this.tok.errorAt)
      return false
    }
    this.held = true
    return true
  }

  /**
   * The next value as an integer, from `lo` to `hi` when `bounded`, or `0`
   * with an error. Every `i64` it answers is the tokenizer's or made with
   * `toI64`, so that under Node, where an `i64` is a BigInt, what a caller
   * computes with it never mixes a BigInt with a number.
   */
  integer(lo: i64, hi: i64, bounded: boolean): i64 {
    const k: i32 = this.take()
    if (k !== JSON_TOK_NUMBER) {
      if (k >= 0) {
        this.wrongType()
      }
      return toI64(0)
    }
    if (!this.tok.isInteger()) {
      this.fail(JSON_DECODE_RANGE, this.tok.tokStart)
      return toI64(0)
    }
    const v: i64 = this.tok.numberI64()
    if (bounded && (v < lo || v > hi)) {
      this.fail(JSON_DECODE_RANGE, this.tok.tokStart)
      return toI64(0)
    }
    return v
  }

  i32(): i32 {
    const lo: i64 = -2147483648
    const hi: i64 = 2147483647
    return toI32(this.integer(lo, hi, true))
  }

  /** The bounds are compared and never computed with, so under Node a number beside a BigInt is fine. */
  u32(): u32 {
    const lo: i64 = 0
    const hi: i64 = 4294967295
    // Through `f64`, which holds every `u32` exactly: under Node `toU32` takes
    // no BigInt, and the `i64` the tokenizer answers is one there.
    return toU32(toF64(this.integer(lo, hi, true)))
  }

  /** Any integer `isInteger` accepts fits an `i64`, so there is no range to check. */
  i64(): i64 {
    return this.integer(toI64(0), toI64(0), false)
  }

  /**
   * The next value as a `u64`: an integer written in digits alone, with no
   * sign, fraction or exponent, up to 2^64 - 1, read through the tokenizer's
   * `numberU64`. A negative number, `-0` included, and one past 2^64 - 1 are
   * `JSON_DECODE_RANGE`, as a fraction is; `0` with an error.
   */
  u64(): u64 {
    const k: i32 = this.take()
    if (k !== JSON_TOK_NUMBER) {
      if (k >= 0) {
        this.wrongType()
      }
      return toU64(0)
    }
    if (!this.tok.isU64()) {
      this.fail(JSON_DECODE_RANGE, this.tok.tokStart)
      return toU64(0)
    }
    return this.tok.numberU64()
  }

  /**
   * The next value as a `JsonNumber`: its text, copied into `n`'s bytes
   * exactly as the input writes it. Anything but a number is
   * `JSON_DECODE_TYPE`, and `n` keeps the number it held.
   */
  number(n: JsonNumber): void {
    const k: i32 = this.take()
    if (k !== JSON_TOK_NUMBER) {
      if (k >= 0) {
        this.wrongType()
      }
      return
    }
    const tok: JsonTokenizer = this.tok
    const src: u8[] = tok.src
    const bytes: u8[] = n.bytes
    const start: i32 = tok.tokStart
    const end: i32 = tok.tokEnd
    let copied: i32 = 0
    for (let i: i32 = start; i >= 0 && i < end && i < toI32(src.length); i += 1) {
      // Read into a local first: a push ends what the guard proved about `i`.
      const b: u8 = src[i]
      if (copied < toI32(bytes.length)) {
        bytes[copied] = b
      } else {
        bytes.push(b)
      }
      copied += 1
    }
    n.count = copied
  }

  f64(): f64 {
    const k: i32 = this.take()
    if (k === JSON_TOK_NUMBER) {
      return this.tok.numberF64()
    }
    if (k >= 0) {
      this.wrongType()
    }
    return 0
  }

  boolean(): boolean {
    const k: i32 = this.take()
    if (k === JSON_TOK_TRUE) {
      return true
    }
    if (k !== JSON_TOK_FALSE && k >= 0) {
      this.wrongType()
    }
    return false
  }

  /**
   * The next value as a string: `cur` itself when the input's string is equal
   * to it, which allocates nothing, and a new string otherwise; `cur` with an
   * error.
   */
  string(cur: string): string {
    const k: i32 = this.take()
    if (k !== JSON_TOK_STRING) {
      if (k >= 0) {
        this.wrongType()
      }
      return cur
    }
    if (this.tok.keyEquals(cur)) {
      return cur
    }
    return this.text()
  }

  // Arrays of scalars and strings: each element is read into the slot the
  // array already has, or pushed past its end, and what is left over is
  // popped, so an array of the same length grows nothing.

  i32Array(xs: i32[]): i32[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      const v: i32 = this.i32()
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  u32Array(xs: u32[]): u32[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      const v: u32 = this.u32()
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  i64Array(xs: i64[]): i64[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      const v: i64 = this.i64()
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  u64Array(xs: u64[]): u64[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      const v: u64 = this.u64()
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  f64Array(xs: f64[]): f64[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      const v: f64 = this.f64()
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  booleanArray(xs: boolean[]): boolean[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      const v: boolean = this.boolean()
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  stringArray(xs: string[]): string[] {
    if (!this.beginArray()) {
      return xs
    }
    let n: i32 = 0
    while (this.nextElement()) {
      let cur: string = ""
      if (n < toI32(xs.length)) {
        cur = xs[n]
      }
      // Read into a local first: the call ends what the guard proved about `n`.
      const v: string = this.string(cur)
      if (n < toI32(xs.length)) {
        xs[n] = v
      } else {
        xs.push(v)
      }
      n += 1
    }
    while (toI32(xs.length) > n && xs.length > 0) {
      xs.pop()
    }
    return xs
  }

  i32ArrayOrNull(xs: i32[] | null): i32[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.i32Array(xs)
    }
    const fresh: i32[] = []
    return this.i32Array(fresh)
  }

  u32ArrayOrNull(xs: u32[] | null): u32[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.u32Array(xs)
    }
    const fresh: u32[] = []
    return this.u32Array(fresh)
  }

  i64ArrayOrNull(xs: i64[] | null): i64[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.i64Array(xs)
    }
    const fresh: i64[] = []
    return this.i64Array(fresh)
  }

  u64ArrayOrNull(xs: u64[] | null): u64[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.u64Array(xs)
    }
    const fresh: u64[] = []
    return this.u64Array(fresh)
  }

  f64ArrayOrNull(xs: f64[] | null): f64[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.f64Array(xs)
    }
    const fresh: f64[] = []
    return this.f64Array(fresh)
  }

  booleanArrayOrNull(xs: boolean[] | null): boolean[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.booleanArray(xs)
    }
    const fresh: boolean[] = []
    return this.booleanArray(fresh)
  }

  stringArrayOrNull(xs: string[] | null): string[] | null {
    if (this.takeNull()) {
      return null
    }
    if (xs !== null) {
      return this.stringArray(xs)
    }
    const fresh: string[] = []
    return this.stringArray(fresh)
  }
}

/**
 * Decodes the JSON object `d` holds into `out`, the whole input, and answers
 * `d.failed`: `0`, or the first error's code. The compiler writes the code
 * from `T`'s fields at every call; this body is what Node runs.
 */
export const jsonDecode = <T>(_d: JsonDecoder, _out: T): i32 => {
  panic(JSON_TYPED_ERASED)
}

/**
 * Writes `value` to `w` as one JSON object, its fields in declaration order.
 * The compiler writes the code from `T`'s fields at every call; this body is
 * what Node runs.
 */
export const jsonEncode = <T>(_w: JsonWriter, _value: T): void => {
  panic(JSON_TYPED_ERASED)
}

// What an encoding calls for a field that is not one writer call. Exported
// because the code the compiler writes calls them from the module that
// encodes, which may not be this one.

export const jsonEncodeStringOrNull = (w: JsonWriter, s: string | null): void => {
  if (s === null) {
    w.nullValue()
  } else {
    w.string(s)
  }
}

/**
 * A `u64`, as its digits: at most 20 of them, written with `raw` from an
 * array of this call's own that nothing keeps. A value past 2^63 has no
 * `i64` to go through the writer's `i64` as, so every `u64` takes this one
 * loop. Every `u64` here is built with `toU64`, a BigInt under Node.
 */
export const jsonEncodeU64 = (w: JsonWriter, v: u64): void => {
  const ten: u64 = toU64(10)
  const zero: u64 = toU64(0)
  const digits: u8[] = new Array<u8>(20)
  let rest: u64 = v
  let first: i32 = toI32(digits.length)
  for (let k: i32 = first - 1; k >= 0 && k < toI32(digits.length); k -= 1) {
    digits[k] = toU8(48 + toI32(rest % ten))
    rest = rest / ten
    first = k
    if (rest === zero) {
      break
    }
  }
  w.raw(digits, first, toI32(digits.length) - first)
}

/** A `JsonNumber`, as the text it holds, byte for byte. */
export const jsonEncodeNumber = (w: JsonWriter, n: JsonNumber): void => {
  const start: i32 = 0
  w.raw(n.bytes, start, n.count)
}

export const jsonEncodeI32Array = (w: JsonWriter, xs: i32[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.i32(x)
  }
  w.endArray()
}

export const jsonEncodeU32Array = (w: JsonWriter, xs: u32[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.u32(x)
  }
  w.endArray()
}

export const jsonEncodeI64Array = (w: JsonWriter, xs: i64[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.i64(x)
  }
  w.endArray()
}

export const jsonEncodeU64Array = (w: JsonWriter, xs: u64[]): void => {
  w.beginArray()
  for (const x of xs) {
    jsonEncodeU64(w, x)
  }
  w.endArray()
}

export const jsonEncodeF64Array = (w: JsonWriter, xs: f64[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.f64(x)
  }
  w.endArray()
}

export const jsonEncodeBooleanArray = (w: JsonWriter, xs: boolean[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.boolean(x)
  }
  w.endArray()
}

export const jsonEncodeStringArray = (w: JsonWriter, xs: string[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.string(x)
  }
  w.endArray()
}

export const jsonEncodeI32ArrayOrNull = (w: JsonWriter, xs: i32[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeI32Array(w, xs)
  }
}

export const jsonEncodeU32ArrayOrNull = (w: JsonWriter, xs: u32[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeU32Array(w, xs)
  }
}

export const jsonEncodeI64ArrayOrNull = (w: JsonWriter, xs: i64[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeI64Array(w, xs)
  }
}

export const jsonEncodeU64ArrayOrNull = (w: JsonWriter, xs: u64[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeU64Array(w, xs)
  }
}

export const jsonEncodeF64ArrayOrNull = (w: JsonWriter, xs: f64[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeF64Array(w, xs)
  }
}

export const jsonEncodeBooleanArrayOrNull = (w: JsonWriter, xs: boolean[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeBooleanArray(w, xs)
  }
}

export const jsonEncodeStringArrayOrNull = (w: JsonWriter, xs: string[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeStringArray(w, xs)
  }
}
