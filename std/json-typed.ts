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
 * **What is generated, and from what.** `jsonDecode(d, out)` and `jsonEncode(w,
 * value)` are generic, and the bodies written below are not what runs natively:
 * the compiler lowers every call in place, in the module that makes it, to code
 * it writes from the layout of the class the call binds `T` to
 * (`src/json-typed.ts`, `src/emit-json.ts`).
 *
 *  That code is straight-line calls into the methods of `JsonDecoder` and the
 *  functions here for each field, and into `JsonWriter`'s, so all of the parsing
 *  is the tokenizer's and all of the writing is the writer's. A field may be an
 *  `i32`, `u32`, `i64`, `u64`, `f64` (or `number`), `boolean` or `string`, a
 *  numeric enum (its number), a class decoded the same way, a `JsonNumber`, an
 *  array of any of those, a `Map<string, V>` (a JSON object) whose `V` is any of
 *  these, or a string, class, array or map `| null`; anything else is refused at
 *  the call, naming the field (docs/LANGUAGE.md, "Typed JSON").
 *
 * **Call shapes.** `jsonDecode(d, out)` reads the one JSON object `d` holds
 * into `out`, a declared class, and answers `d.failed`: `JSON_DECODE_OK` (0)
 * or the first error's code. `jsonEncode(w, value)` writes `value` to the
 * writer `w` as one JSON object and answers nothing; the writer's own sticky
 * code reports a failure. The decoder is a `JsonDecoder`, a `JsonTokenizer`
 * over the input and a sticky error, and the encoder is the `JsonWriter` the
 * call is given, so the encoding is written in the writer's modes: a writer
 * set with `setIndent(2)` encodes what `JSON.stringify(v, null, 2)` writes,
 * and a `setStrict(true)` writer fails a NaN or infinite `f64` field with
 * `JSON_WRITE_NON_FINITE`.
 *
 * **What a field may be**, and how each maps:
 *
 *     Field type                    JSON                          Decoded with    Encoded with
 *     i32, u32, i64                 an integer, no fraction or    d.i32(),        w.i32, w.u32,
 *                                   exponent, in the type's       d.u32(),        w.i64
 *                                   range                         d.i64()
 *     u64                           digits alone, no sign,        d.u64()         jsonEncodeU64
 *                                   fraction or exponent, up to
 *                                   2^64 - 1
 *     numeric enum E                the number of one of E's      d.i32(), then   w.i32
 *                                   members                       a switch
 *     f64 (number in f64 mode)      any number; past the double   d.f64()         w.f64
 *                                   range an infinity, which the
 *                                   writer writes as null
 *     boolean                       true, false                   d.boolean()     w.boolean
 *     string, string | null         a string, and null for the    d.string(cur)   w.string,
 *                                   second                        jsonEncodeStringOrNull
 *     class C, C | null             an object, and null for the   C's own         C's own
 *                                   second                        decoding, into  encoding
 *                                                                 the object the
 *                                                                 field holds
 *     T[], T[] | null              an array, and null for the    d.i32Array(cur) jsonEncodeI32Array
 *                                   second                        and its kin, or and its kin, or
 *                                                                 C's or E's per  C's or E's per
 *                                                                 element         element
 *     Map<string, V>, or | null     an object whose keys are the  keys in order,  entries in the
 *                                   map's, each value a V         each value set  map's order
 *     JsonNumber                    any number, kept as the text  d.number(n)     jsonEncodeNumber
 *                                   it is written in
 *
 * A `Map`'s `V` is any type in this list, `| null` or not, a `Map` included;
 * `JsonNumber` may stand alone, be `| null`, be an array's element or be a
 * `Map`'s value. The code written for a nested class, an array's element class,
 * a `| null` field's class and a `Map`'s values is the same code, so it
 * recurses as the data does.
 *
 * Anything else is refused at the call's argument, naming the class and the
 * field (NL2485 for a field type, such as an `f32`, an `i32[][]`, a
 * `Level[][]`, a `Set`, an array of maps, a `Map` not keyed by `string` (an
 * enum key included) or a `Map` whose values cannot be written, and a generic
 * class of the program's own). An enum whose members are strings or a mix is
 * not one the language declares (NL1043), and a `const enum` is refused where
 * it is declared (NL2285).
 *
 * A value that is not a declared class (an interface, a generic class or any
 * other type) is NL2486; decoding into an interface is left for a later
 * version. A call inside a generic function is checked for each class an
 * instantiation binds.
 *
 * **Reading the class.** A class the decoder has to make itself, an array's
 * element past the end, a `| null` field that holds `null` or a map's value,
 * is made with `new C()`, so its constructor takes no parameters (NL2488).
 * Decoding assigns every field, so a `readonly` one is refused (NL2487). A
 * decode stores what it makes into the object it fills, so a call inside a
 * `using a = arena()` block is refused (NL2424); an encoding only reads the
 * object and keeps nothing, so it may run inside one. Two fields holding one
 * object are decoded into it twice, the second winning.
 *
 * **Finding the field.** The code written for a class of three or more fields
 * switches on the key's length in bytes, so a key is compared only with the
 * names of that length. Where three or more names share a length, it switches
 * once more, on the key's byte at the one position where those names differ
 * most, and calls `keyIs` for each name with that byte there, in declaration
 * order; a byte none of them has is an unknown key at once. One or two names
 * are compared in turn with `keyIs`.
 *
 *  A key with an escape has no byte to switch on there and is compared with
 *  every name of its length, so `"id"` is the field `id`; a field name that is
 *  not ASCII is dispatched by its UTF-8 bytes like any other.
 *
 * **The decoding rules.** A JSON object's keys are the class's field names,
 * byte for byte, or the keys its options give them, found by the key's length
 * and then, among three or more names of that length, by one of its bytes:
 *
 *     class Account {
 *       static readonly json = { rename: { userId: "user_id" }, optional: ["tags"] };
 *       ...
 *     }
 *
 * The compiler reads that literal; it is not a field. Every field is required
 * but an optional one, whose missing key sets it to its initializer, a key may
 * appear once, and a key that names no field is an error unless `ignoreUnknown`
 * is set, when its value is stepped over, checked but not kept. A number must
 * fit its field: an integer field takes an integer written without a fraction
 * or an exponent and in the field's range, and `f64` takes any number.
 *
 * `null` is accepted only by a field whose type is `| null`. Fields are written
 * to `out` as they are read, in the input's order: a nested object is decoded
 * into the object the field already holds, an array's elements into the
 * elements it already has, with new ones made past its end and the rest dropped
 * (so a reused object reuses its arrays and objects, and `Arena.used()` stays
 * flat: it is flat over 1,000 decodes of a three-level object), and a string
 * field keeps the string it holds when the input's is equal.
 *
 * A string that changes is a new string, made by one `String.fromBytes`,
 * straight from the input when it has no escape and from its unescaped bytes
 * when it has one. A class the decoder has to make — an array element past the
 * array's end, a `| null` field that holds `null`, or a map's value — is made
 * with `new C()`.
 *
 * A map is emptied once the object opens, then each key is read as a new string
 * and its value as a `V` made fresh for the key (a zero, `""`, the enum's first
 * member, `null`, or a new object, array or map) and `set`, so the entries are
 * the input's, in the input's order. A key the object gave already is
 * `JSON_DECODE_DUPLICATE` before its value is read, however either is escaped.
 * A value whose read fails is not `set`, so a map never holds a value the input
 * did not give.
 *
 * Unlike the rest of a decode, a map's entries are made anew each time, so
 * decoding into a map allocates its keys and values. Every map of one decoding
 * takes at most `maxMapKeys` keys between them (4,096 unless set), the keys of
 * a map inside another map included; the key past it is `JSON_DECODE_MAP_LIMIT`
 * before it is read, and `reset` starts the count again. At `0` or below no map
 * may take a key, and `{}` is the one map value accepted. Encoding writes the
 * entries in the map's own order, which is insertion order.
 *
 * That differs from a JavaScript object in one case: a key that reads as an
 * array index (`"1"`) keeps its place, where `JSON.parse` would move it first.
 *
 * **A class's options** are one `static readonly json` object literal written
 * in the class, which the compiler reads when it writes the class's code. It
 * is not a field: it has no slot, the class's layout is what it would be
 * without it, and the program cannot read it. It is the one `static` member a
 * class may declare. A class without it is decoded exactly as before. Its
 * options are checked where the class is declared, whether or not any call
 * decodes the class. There are three, each a literal and none a default
 * other than being absent:
 *
 *  - `rename`, an object mapping a field to its key on the wire, a string
 *    literal of any bytes. `{"user_id":7}` is decoded into `userId` and
 *    `userId` is encoded as `"user_id"`; the field's own name is then a key
 *    no field has. The key is dispatched like any other, escapes and
 *    non-ASCII included. Without it a field's key is its name.
 *  - `optional`, an array of field names whose key may be missing. A missing
 *    one sets the field to its initializer, on a fresh object and on one
 *    decoded into again, so a reused object keeps nothing an earlier input
 *    gave it, and allocates nothing to do it. An optional field needs an
 *    initializer. A key that is given is read like any other: once, and of
 *    its field's type. Without it every field is required and a missing key is
 *    `JSON_DECODE_MISSING`.
 *  - `presence`, described below. Without it nothing is recorded.
 *
 * Each misuse has its own diagnostic:
 *
 *     NL2492  `static json` without `readonly` but with a type, `static
 *             readonly json` with a type annotation, or on a generic class
 *     NL2493  options, `rename`, a key or an `optional` entry not written as
 *             the literal it must be (a module constant, an array for the
 *             object, a string for `optional`'s array); `presence` or one of
 *             its entries not an object literal of string literals
 *     NL2494  an option other than `rename`, `optional` and `presence`
 *     NL2495  a name that is not one of the class's fields; `presence` naming
 *             a field or a presence field the class does not declare
 *     NL2496  a rename to a value that is not a string
 *     NL2497  two fields with one key (a rename to another field's own name
 *             included), or a field renamed or made optional twice
 *     NL2498  an optional field with no initializer
 *     NL2499  a rename to a key that is not valid UTF-8, a lone surrogate such
 *             as `"\ud800"` included, which no input could give
 *     NL2592  a presence field that is not a `boolean`, is `readonly`, is the
 *             field it records, records two fields, is recorded by a presence
 *             field of its own or is renamed or made optional; a field
 *             recorded twice
 *
 * A spread in the literal is refused (NL2711), a computed key as it is
 * anywhere (NL1041), a subclass by `extends`, and a second `static readonly
 * json` is a duplicate member. The options are not a value: `User.json` names a
 * class where a value is due, and is refused as any class name there is.
 *
 * Only `static readonly json` may leave out its type: written `static json = {
 * ... }`, or as an instance field, it is an ordinary field to the parser and
 * needs one, and an instance field called `json` with a type is an ordinary
 * field, read and written under its own name. A field or a method called `json`
 * may come before or after the options. Under Node the literal is a static
 * property of the class that nothing reads.
 *
 * **Which keys were given.** An optional field's missing key and a key given
 * the field's initializer leave the same value; the `presence` option tells
 * them apart. It names, for a field, a `boolean` field of the same class that
 * each decoding sets to whether the input gave that field's key — true for a
 * key given `null` too:
 *
 *     class UserPatch {
 *       static readonly json = { optional: ["name", "email"], presence: { name: "hasName", email: "hasEmail" } };
 *       name: string = "";
 *       email: string | null = null;
 *       hasName: boolean = false;
 *       hasEmail: boolean = false;
 *     }
 *
 * Any field can be recorded, of any kind and optional or not. A presence field
 * is off the wire: no key reads it, encoding leaves it out, and no option
 * renames it, makes it optional or records it. It is set when the object
 * closes, from the flag the decoder already keeps per field to find a duplicate
 * or a missing key, so recording costs one store per recorded field and
 * allocates nothing, and a class that records nothing compiles to the code it
 * did before.
 *
 * Each object sets its own, so a nested class or an array element answers for
 * its own keys. A decoding that fails may set some of them and not others (when
 * the input is not an object, none), so read them only when `jsonDecode`
 * answered `JSON_DECODE_OK`.
 *
 * **A merge patch (RFC 7396)** is that option's use: a patch class whose
 * every field is optional and recorded, decoded and then applied a field at a
 * time — a recorded key replaces its member, `null` on a `| null` field
 * removes it, an object field is applied the same way one level down, and an
 * array is replaced whole. `null` on a field that is not `| null` is
 * `JSON_DECODE_TYPE`, so a patch that removes what the type cannot lose is
 * refused before any of it is applied. `examples/merge-patch.ts` is the
 * recipe in full.
 *
 * **Errors are sticky codes**, as the tokenizer's and the writer's are. The
 * first error sets `failed` to a negative code — a `JSON_DECODE_*` code here,
 * or the tokenizer's own `JSON_TOK_ERR_*` code when the text is not JSON or
 * crosses one of its `JsonLimits` — and `errorAt` to the byte offset of the
 * token it was found at. Every later call does nothing, and `jsonDecode`
 * answers `failed`; `reset` starts over. Nothing an input holds panics. After
 * an error, `out` holds a value of its type in every field, some of them
 * decoded and some as they were: an enum field or element never holds a number
 * that is no member's, because such a number is not stored. The codes:
 *
 *     Code                     Value  Condition                       errorAt
 *     JSON_DECODE_OK              0   nothing has failed
 *     JSON_DECODE_TYPE          -20   a value of the wrong JSON type  the value
 *     JSON_DECODE_RANGE         -21   a number its field cannot hold  the number
 *     JSON_DECODE_UNKNOWN       -22   a key that names no field       the key
 *     JSON_DECODE_DUPLICATE     -23   a key given twice               the second
 *     JSON_DECODE_MISSING       -24   a field the object lacks        the object's `}`
 *     JSON_DECODE_MAP_LIMIT     -25   more than maxMapKeys map keys   the first key past it
 *     JSON_TOK_ERR_*        -1 to -13 text that is not JSON, or past  the tokenizer's
 *                                     a JsonLimits limit
 *
 * **Limits.** The recursion is the data's, so the tokenizer's depth limit
 * bounds it: the caller's `JsonLimits.maxDepth`, 128 by default. Each level is
 * one native frame, so a limit raised into the hundreds of thousands can run
 * off the stack, and one kept to a few thousand cannot. The writer refuses a
 * 65th open container (`JSON_WRITER_MAX_DEPTH`), so a value decoded from
 * deeper than 64 levels encodes as `JSON_WRITE_TOO_DEEP`, as does an object
 * that holds itself; the encoding stops at the first failure. A full buffer
 * is the writer's `JSON_WRITE_FULL`. A duplicate of a key `ignoreUnknown`
 * steps over is not detected, because its value is never read. A map is
 * bounded by `maxMapKeys`, and a number's length by `JsonLimits.maxNumberBytes`.
 *
 * **An enum is its number.** A numeric enum is read with `d.i32()`, so a
 * number that is not an `i32` integer is that field's `JSON_DECODE_RANGE`, and
 * an integer that is not the value of one of its members is
 * `JSON_DECODE_TYPE`; a member's name, `"High"`, is a string and a type error
 * too. Two members of one value are one number. It is written as `w.i32` of
 * its value, as `JSON.stringify` writes a TypeScript numeric enum.
 *
 * **A `u64` is exact to 2^64 - 1.** It is read through the tokenizer's
 * `numberU64`, so `18446744073709551615` decodes and `18446744073709551616`,
 * `-1`, `-0` and `1.5` are `JSON_DECODE_RANGE`. It is written as its digits,
 * which `JSON.stringify` cannot do for a number past 2^53.
 *
 * **A `JsonNumber` is a number's text.** A field of it decodes and encodes any
 * number byte for byte: an integer wider than a `u64`, a fraction with more
 * digits than an `f64` holds, `1E+400` and `-0` alike. It is read as a number
 * whole, not as an object, so anything but a number is `JSON_DECODE_TYPE`, and
 * its length is bounded by `JsonLimits.maxNumberBytes` like any number's.
 * Decoding into one reuses its bytes, so `Arena.used()` stays flat over
 * decodes into one object.
 *
 * **Encoding** writes the fields in declaration order, each through the
 * writer method of its type, so the text is what `JSON.stringify` writes for
 * the same object; the writer's own sticky code reports a full buffer. A
 * presence field is left out. The keys come back in the order they were
 * written when the object is decoded from text whose keys are in that order.
 *
 * **Under Node** the types are erased, so there is no layout to generate the
 * code from: `jsonDecode` and `jsonEncode` end the program with a panic
 * naming this, rather than guessing a type from whatever value a field holds
 * (docs/LANGUAGE.md, "Typed JSON", class C). Everything else here runs there,
 * so a program may run the decoder's readers and the writer under Node and
 * get the lines the native program gets; the translation of a class is a
 * function per class of the same calls into `JsonDecoder` and `JsonWriter`. A
 * program that imports `std/json-typed.ts` by path rather than as
 * `nish/json-typed` is compiled as written and gets those bodies natively too.
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
/**
 * A value of the wrong JSON type for its field: a string for an `i32`, an
 * array for a class, `null` for a field that is not `| null`, a top-level
 * value that is not an object, or an integer that is no member's value for
 * an enum. `errorAt` is the value.
 */
export const JSON_DECODE_TYPE: i32 = -20
/**
 * A number its field cannot hold: a fraction or an exponent for an integer
 * field, a value outside its range, or a negative number, `-0` included, for
 * a `u64`. `errorAt` is the number.
 */
export const JSON_DECODE_RANGE: i32 = -21
/** A key that names no field of the class, while `ignoreUnknown` is off; `errorAt` is the key. */
export const JSON_DECODE_UNKNOWN: i32 = -22
/**
 * A key the object already gave, a field's or a `Map`'s, however either is
 * escaped; `errorAt` is the second. A key `ignoreUnknown` steps over is not
 * checked, because its value is never read.
 */
export const JSON_DECODE_DUPLICATE: i32 = -23
/** An object that ended without a required field of the class; `errorAt` is its closing brace. */
export const JSON_DECODE_MISSING: i32 = -24
/**
 * More keys, over every `Map` field one decoding fills, than `maxMapKeys`;
 * `errorAt` is the first key past the limit. The global `Map` hashes a
 * string under a per-process random key, so a body cannot choose keys that
 * collide, and this limit bounds what all the maps of one decoding hold
 * together (docs/security/json.md, JSON-13).
 */
export const JSON_DECODE_MAP_LIMIT: i32 = -25
/**
 * A tagged union's object whose tag is missing, not a string, or none of the
 * union's variants' wire tags, or a variant's object whose tag is not that
 * variant's own; `errorAt` is the tag's value, or the object's `{` when the
 * tag is missing.
 */
export const JSON_DECODE_TAG: i32 = -26

/** What a program running under Node is told, where the compiler would have written the code. */
const JSON_TYPED_ERASED: string =
  "nish/json-typed: jsonDecode, jsonDecodeUnion and jsonEncode are written by the compiler from the class's fields, and under Node the types are erased"

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
 * them. Its length is bounded by `JsonLimits.maxNumberBytes` like any
 * number's, and anything but a number read into it is `JSON_DECODE_TYPE`.
 * `setText(t)` sets it when `t` is one JSON number and answers whether it was.
 * Its methods run under Node.
 */
export class JsonNumber {
  /** The text is `bytes[0, count)`, one JSON number; the bytes past it are room. */
  bytes: u8[]
  /** How many of `bytes` are the number's text, `1` for the `0` a new one holds. */
  count: i32 = 1

  /** A number that holds `0`. */
  constructor() {
    this.bytes = [48]
  }

  /**
   * The number's text.
   *
   * @returns A new string of the text, exactly as it was decoded or set.
   */
  text(): string {
    return String.fromBytes(this.bytes, 0, this.count)
  }

  /**
   * A tokenizer over the text, read to its one token. It may open no
   * container and take a number of any length, so it allocates no stack.
   *
   * @returns A new tokenizer whose current token is the number.
   */
  private reader(): JsonTokenizer {
    const limits: JsonLimits = new JsonLimits()
    limits.maxDepth = 0
    limits.maxNumberBytes = this.count
    const tok: JsonTokenizer = new JsonTokenizer(this.bytes, 0, this.count, limits)
    tok.next()
    return tok
  }

  /**
   * Whether the number is an `i64`.
   *
   * @returns `true` when it is written without a fraction or an exponent and its value fits an `i64`.
   */
  isI64(): boolean {
    return this.reader().isInteger()
  }

  /**
   * The number as an `i64`.
   *
   * @returns The value when `isI64()` holds, and `0` otherwise.
   */
  i64(): i64 {
    return this.reader().numberI64()
  }

  /**
   * Whether the number is a `u64`.
   *
   * @returns `true` when it is written in digits alone, with no sign, fraction or exponent, and fits a `u64`.
   */
  isU64(): boolean {
    return this.reader().isU64()
  }

  /**
   * The number as a `u64`.
   *
   * @returns The value when `isU64()` holds, and `0` otherwise.
   */
  u64(): u64 {
    return this.reader().numberU64()
  }

  /**
   * The number as an `f64`.
   *
   * @returns The nearest `f64`, ties to even, as `JSON.parse` reads it; an infinity past the double range.
   */
  f64(): f64 {
    return this.reader().numberF64()
  }

  /**
   * Sets the text to `text` when it is one JSON number and nothing else; any
   * other text leaves the number as it was.
   *
   * @param text The new text: one JSON number, with no blank around it.
   * @returns `true` when `text` was one JSON number and is now the text.
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
  /** The tokenizer over the input, under the caller's `JsonLimits`. */
  private tok: JsonTokenizer
  /** `JSON_DECODE_OK`, or the first `JSON_DECODE_*` or `JSON_TOK_ERR_*` code. */
  failed: i32 = 0
  /** The byte offset in the input of the token the error was found at; `-1` until one. */
  errorAt: i32 = -1
  /**
   * The most keys every `Map` field of one decoding may take together, 4,096
   * unless set; past it, `JSON_DECODE_MAP_LIMIT`. At `0` or below, no map may
   * take a key, so a map's only accepted value is `{}`.
   */
  maxMapKeys: i32 = 4096
  /** The keys the maps of this decoding have taken so far; `reset` clears it. */
  mapKeys: i32 = 0
  /** Step over a key that names no field instead of failing with `JSON_DECODE_UNKNOWN`. */
  ignoreUnknown: boolean = false
  /**
   * Whether the tokenizer's current token is a value nothing has read yet:
   * the first token of an array element, read to see whether the array had
   * ended, or a value `takeNull` found was not `null`.
   */
  private held: boolean = false
  /** The `{` of the union object `unionTag` read ahead in, or `-1` when its tag was the first key. */
  private unionStart: i32 = -1

  /**
   * A decoder over `src[off, off + len)`, with no error and no map key taken.
   *
   * @param src The bytes that hold the input.
   * @param off Where the input starts in `src`.
   * @param len How many bytes of `src` the input is.
   * @param limits The tokenizer's limits; its `maxDepth`, 128 by default,
   *   bounds the recursion, one native frame a level.
   */
  constructor(src: u8[], off: i32, len: i32, limits: JsonLimits) {
    this.tok = new JsonTokenizer(src, off, len, limits)
  }

  /**
   * Starts over on `src[off, off + len)`, keeping the limits, `ignoreUnknown`
   * and `maxMapKeys`, and clearing any error and the count of map keys taken.
   *
   * @param src The bytes that hold the next input.
   * @param off Where it starts in `src`.
   * @param len How many bytes of `src` it is.
   */
  reset(src: u8[], off: i32, len: i32): void {
    this.tok.reset(src, off, len)
    this.failed = JSON_DECODE_OK
    this.errorAt = -1
    this.held = false
    this.mapKeys = 0
    this.unionStart = -1
  }

  /**
   * Records the first error; once one is recorded, this does nothing.
   *
   * @param code The `JSON_DECODE_*` or `JSON_TOK_ERR_*` code.
   * @param at The byte offset of the token it was found at.
   */
  private fail(code: i32, at: i32): void {
    if (this.failed === JSON_DECODE_OK) {
      this.failed = code
      this.errorAt = at
    }
  }

  /**
   * `JSON_DECODE_TYPE` at the current token, unless the read that found it
   * failed already.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
  wrongType(): void {
    this.fail(JSON_DECODE_TYPE, this.tok.tokStart)
  }

  /**
   * Takes the next value's first token: the held token, when there is one,
   * and the tokenizer's next otherwise.
   *
   * @returns Its `JSON_TOK_*` kind, or the negative code of the error, which it records.
   */
  private take(): i32 {
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

  /**
   * Takes the next value as the opening of an object.
   *
   * @returns `true` when it opens one; `false` with `JSON_DECODE_TYPE` for any other value, and after any error.
   */
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

  /**
   * Reads the next key of the open object, or its end.
   *
   * @returns `true` at a key; `false` at the object's end and after any error.
   */
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

  /**
   * Whether the current key, its escapes decoded, is `name`.
   *
   * @param name The field's name or its key on the wire.
   * @returns `true` when the key's bytes are `name`'s UTF-8.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
  keyIs(name: string): boolean {
    return this.tok.keyEquals(name)
  }

  /**
   * The current key's length in bytes once decoded, or `-1` when the current
   * token is not a key or string: what the code written for a class switches on before
   * it compares a key's bytes with a field's name.
   *
   * @returns The decoded length in bytes, or `-1`.
   */
  keyLength(): i32 {
    return this.tok.stringLength()
  }

  /**
   * Byte `at` of the current key when the key has no escape, so that its
   * bytes are the input's, and `-1` otherwise: for a key with an escape, for
   * an `at` outside it, and when the current token is not a key or string. A `-1`
   * matches no byte of a field's name, and the code written for a class then
   * compares the key with each name of its length through `keyIs`, which
   * decodes the escapes.
   *
   * @param at The byte's index in the key.
   * @returns The byte, `0` to `255`, or `-1`.
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
   * Whether the maps of this decoding may take another key, the current one:
   * whether they have taken fewer than `maxMapKeys` between them, counting
   * it as taken when they may. A key is counted here, before its value is
   * read, so the keys of a map inside another map count before the outer
   * key's value is whole, and the total never passes the limit.
   * `JSON_DECODE_MAP_LIMIT` at the key when they may not.
   *
   * @returns `true` when the key is counted; `false` with `JSON_DECODE_MAP_LIMIT`.
   */
  mapRoom(): boolean {
    if (this.mapKeys < this.maxMapKeys) {
      this.mapKeys += 1
      return true
    }
    this.fail(JSON_DECODE_MAP_LIMIT, this.tok.tokStart)
    return false
  }

  /**
   * The current key, decoded: a `Map` field's key.
   *
   * @returns A new string, or `""` when the current token is not a key or string.
   */
  key(): string {
    return this.text()
  }

  /**
   * The current key or string as a new string, made by one
   * `String.fromBytes`: straight from the input when it has no escape, and
   * from its unescaped bytes when it has one.
   *
   * @returns A new string, or `""` when the current token is neither.
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

  /**
   * Handles a key that names no field: with `ignoreUnknown` set, steps over
   * the key's value, checked but not kept, and otherwise records
   * `JSON_DECODE_UNKNOWN` at the key.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
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

  /**
   * Opens a tagged union's object and reads ahead to its tag, the key `key`,
   * stepping over the values of the keys before it, and leaves the tag's
   * string as the current token for `keyLength`, `keyByte` and `keyIs`.
   * When the tag was not the first key, `enterUnion` goes back to the
   * object's first key. A missing tag, or one that is not a string, is
   * `JSON_DECODE_TAG`; any other value than an object is `JSON_DECODE_TYPE`.
   *
   * @param key The tag's key on the wire.
   * @returns `true` at the tag's string; `false` after any error.
   *
   * @internal Called by name by the decoder the compiler writes for a union,
   *   src/emit-json.ts.
   */
  unionTag(key: string): boolean {
    if (!this.beginObject()) {
      return false
    }
    const tok: JsonTokenizer = this.tok
    const start: i32 = tok.tokStart
    let first: boolean = true
    while (this.nextField()) {
      if (tok.keyEquals(key)) {
        const k: i32 = tok.next()
        if (k < 0) {
          this.fail(k, tok.errorAt)
          return false
        }
        if (k !== JSON_TOK_STRING) {
          this.fail(JSON_DECODE_TAG, tok.tokStart)
          return false
        }
        this.unionStart = first ? -1 : start
        return true
      }
      first = false
      const k: i32 = tok.skipValue()
      if (k < 0) {
        this.fail(k, tok.errorAt)
        return false
      }
    }
    this.fail(JSON_DECODE_TAG, start)
    return false
  }

  /**
   * Records `JSON_DECODE_TAG` at the current string, a tag no variant of the
   * union gives.
   *
   * @internal Called by name by the decoder the compiler writes for a union,
   *   src/emit-json.ts.
   */
  unknownTag(): void {
    this.fail(JSON_DECODE_TAG, this.tok.tokStart)
  }

  /**
   * Readies the object `unionTag` read the tag of for its variant's fields:
   * when the tag was the first key, the next key is the one after it; when it
   * was not, the object starts over from its first key, and the tag is read
   * again as a field.
   *
   * @returns `true` when the tag is already read; `false` when it is still to come.
   *
   * @internal Called by name by the decoder the compiler writes for a union,
   *   src/emit-json.ts.
   */
  enterUnion(): boolean {
    const start: i32 = this.unionStart
    if (start < 0) {
      return true
    }
    this.unionStart = -1
    this.tok.rewindObject(start)
    return false
  }

  /**
   * Reads a variant's tag field: its value must be the string `name`, and
   * anything else is `JSON_DECODE_TAG` at the value.
   *
   * @param name The variant's tag on the wire.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
  tagValue(name: string): void {
    const k: i32 = this.take()
    if (k === JSON_TOK_STRING) {
      if (!this.tok.keyEquals(name)) {
        this.fail(JSON_DECODE_TAG, this.tok.tokStart)
      }
      return
    }
    if (k >= 0) {
      this.fail(JSON_DECODE_TAG, this.tok.tokStart)
    }
  }

  /**
   * Records `JSON_DECODE_DUPLICATE` at the current key, which the object
   * already gave.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
  duplicateField(): void {
    this.fail(JSON_DECODE_DUPLICATE, this.tok.tokStart)
  }

  /**
   * Records `JSON_DECODE_MISSING` at the `}` of the object just closed,
   * which left out a required field.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
  missingField(): void {
    this.fail(JSON_DECODE_MISSING, this.tok.tokStart)
  }

  /**
   * Ends the decoding after the top-level value: nothing but blanks may
   * follow it, and anything else is `JSON_DECODE_TYPE`.
   *
   * @returns `failed`: `JSON_DECODE_OK`, or the first error's code.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
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

  /**
   * Takes the next value when it is `null`, and holds it for the read that
   * follows when it is not.
   *
   * @returns `true` when it was `null`; `false` otherwise and after any error.
   *
   * @internal Called by name by the decoder the compiler writes for
   *   `jsonDecode`, src/emit-json.ts.
   */
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

  /**
   * Takes the next value as the opening of an array.
   *
   * @returns `true` when it opens one; `false` with `JSON_DECODE_TYPE` for any other value, and after any error.
   */
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

  /**
   * Whether the open array has another element, whose first token is then
   * held for the read that follows.
   *
   * @returns `true` at an element; `false` at the array's end and after any error.
   */
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
   *
   * @param lo The least value accepted when `bounded`.
   * @param hi The greatest value accepted when `bounded`.
   * @param bounded Whether `lo` and `hi` apply.
   * @returns The value; `0` with `JSON_DECODE_TYPE` for a value that is not
   *   a number, and with `JSON_DECODE_RANGE` for a fraction, an exponent or
   *   a value out of bounds.
   */
  private integer(lo: i64, hi: i64, bounded: boolean): i64 {
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

  /**
   * The next value as an `i32`: an integer written without a fraction or an
   * exponent, from -2^31 to 2^31 - 1. A numeric enum is read with it too.
   *
   * @returns The value; `0` with `JSON_DECODE_TYPE` or `JSON_DECODE_RANGE`.
   */
  i32(): i32 {
    const lo: i64 = -2147483648
    const hi: i64 = 2147483647
    return toI32(this.integer(lo, hi, true))
  }

  /**
   * The next value as a `u32`: an integer written without a fraction or an
   * exponent, from 0 to 2^32 - 1. The bounds are compared and never computed
   * with, so under Node a number beside a BigInt is fine.
   *
   * @returns The value; `0` with `JSON_DECODE_TYPE` or `JSON_DECODE_RANGE`.
   */
  u32(): u32 {
    const lo: i64 = 0
    const hi: i64 = 4294967295
    // Through `f64`, which holds every `u32` exactly: under Node `toU32` takes
    // no BigInt, and the `i64` the tokenizer answers is one there.
    return toU32(toF64(this.integer(lo, hi, true)))
  }

  /**
   * The next value as an `i64`: an integer written without a fraction or an
   * exponent. Any integer `isInteger` accepts fits an `i64`, so there is no
   * range to check.
   *
   * @returns The value; `0` with `JSON_DECODE_TYPE` or `JSON_DECODE_RANGE`.
   */
  i64(): i64 {
    return this.integer(toI64(0), toI64(0), false)
  }

  /**
   * The next value as a `u64`: an integer written in digits alone, with no
   * sign, fraction or exponent, up to 2^64 - 1, read through the tokenizer's
   * `numberU64`. A negative number, `-0` included, and one past 2^64 - 1 are
   * `JSON_DECODE_RANGE`, as a fraction is.
   *
   * @returns The value; `0` with `JSON_DECODE_TYPE` or `JSON_DECODE_RANGE`.
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
   * `JSON_DECODE_TYPE`, and `n` keeps the number it held. Its bytes are
   * reused, and grown only for a longer number.
   *
   * @param n The number to copy the text into.
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

  /**
   * The next value as an `f64`: any number, the nearest double, and past the
   * double range an infinity.
   *
   * @returns The value; `0` with `JSON_DECODE_TYPE` for a value that is not a number.
   */
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

  /**
   * The next value as a `boolean`.
   *
   * @returns `true` for `true`; `false` for `false`, and with `JSON_DECODE_TYPE` for any other value.
   */
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
   * to it, which allocates nothing, and a new string otherwise.
   *
   * @param cur The string the field holds now.
   * @returns The string read; `cur` with `JSON_DECODE_TYPE` for a value that is not a string.
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

  /**
   * The next value as an array whose every element is an `i32`, read as `i32()` reads one, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * allocates nothing. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as an array whose every element is a `u32`, read as `u32()` reads one, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * allocates nothing. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as an array whose every element is an `i64`, read as `i64()` reads one, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * allocates nothing. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as an array whose every element is a `u64`, read as `u64()` reads one, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * allocates nothing. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as an array whose every element is an `f64`, read as `f64()` reads one, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * allocates nothing. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as an array whose every element is a `boolean`, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * allocates nothing. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as an array whose every element is a string, read as `string(cur)` reads one, each against the string its slot holds, into `xs`.
   *
   * Each element overwrites the slot `xs` already has or is pushed past its
   * end, and the slots left over are popped, so an array no longer than `xs`
   * grows nothing. Only the container is reused: an element whose text
   * changed is a new string. A value that is not an array fails with `JSON_DECODE_TYPE`, or
   * with the tokenizer's code when the input is malformed, and leaves `xs`
   * untouched; a failure inside the array leaves its contents unspecified.
   *
   * @param xs The array the field holds now, whose slots are reused.
   * @returns `xs`, holding the input's elements.
   */
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

  /**
   * The next value as `null`, or as an array `i32Array` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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

  /**
   * The next value as `null`, or as an array `u32Array` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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

  /**
   * The next value as `null`, or as an array `i64Array` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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

  /**
   * The next value as `null`, or as an array `u64Array` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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

  /**
   * The next value as `null`, or as an array `f64Array` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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

  /**
   * The next value as `null`, or as an array `booleanArray` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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

  /**
   * The next value as `null`, or as an array `stringArray` reads, into `xs`
   * when it is an array and into a new one when it is `null`.
   *
   * @param xs The array the field holds now, or `null`.
   * @returns `null` for `null`, and otherwise the array read.
   */
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
 * Decodes the JSON object `d` holds, the whole input, into `out`. The
 * compiler writes the code from `T`'s fields at every call, in the module that
 * makes it; under Node this body ends the program with a panic, because the
 * types are erased. Called as `jsonDecode(d, out)`, with `T` the class of `out`;
 * every field of every class it reaches must be a type the module header lists,
 * and a class the decoder makes must have a constructor with no parameters.
 * The top-level value must be an object, or the answer is `JSON_DECODE_TYPE`,
 * and nothing but blanks may follow it. A call inside a `using a = arena()`
 * block is refused (NL2424).
 *
 * @param _d The decoder over the input; its `failed` and `errorAt` say what
 *   went wrong, and `reset` starts it over.
 * @param _out The object to decode into: a declared class, whose fields,
 *   nested objects and arrays are reused.
 * @returns `d.failed`: `JSON_DECODE_OK`, or the first error's code, a
 *   `JSON_DECODE_*` or the tokenizer's `JSON_TOK_ERR_*`.
 */
export const jsonDecode = <T>(_d: JsonDecoder, _out: T): i32 => {
  panic(JSON_TYPED_ERASED)
}

/**
 * Decodes the JSON text `d` reads into a tagged union, `T`: the object's tag
 * picks the variant. When it is `prev`'s, `prev` is decoded into and
 * returned, its fields, nested objects and arrays reused; otherwise a new
 * object of that variant is made with its constructor of no parameters and
 * returned. The tag may be any key of the object; it is cheapest first. The
 * compiler writes the code from the union's variants at every call, and `T`
 * is never written at the call; under Node this body ends the program with a
 * panic, because the types are erased.
 *
 * @param _d The decoder over the input; its `failed` and `errorAt` say what
 *   went wrong, and `reset` starts it over.
 * @param _prev The value the union holds now, reused when the tag names its variant.
 * @returns The decoded value; on any failure `prev`, perhaps partly
 *   overwritten, with `d.failed` set to the first error's code, such as
 *   `JSON_DECODE_TAG`.
 */
export const jsonDecodeUnion = <T>(_d: JsonDecoder, _prev: T): T => {
  panic(JSON_TYPED_ERASED)
}

/**
 * Writes `value` to `w` as one JSON object, its fields in declaration order,
 * the text `JSON.stringify` writes for it, in the writer's modes. The compiler
 * writes the code from `T`'s fields at every call; under Node this body ends
 * the program with a panic, because the types are erased. A full buffer is
 * the writer's `JSON_WRITE_FULL`, and a value deeper than 64 levels, or one
 * that holds itself, its `JSON_WRITE_TOO_DEEP`.
 *
 * @param _w The writer, whose sticky code reports any failure.
 * @param _value The object to write: a declared class.
 */
export const jsonEncode = <T>(_w: JsonWriter, _value: T): void => {
  panic(JSON_TYPED_ERASED)
}

// What an encoding calls for a field that is not one writer call. Exported
// because the code the compiler writes calls them from the module that
// encodes, which may not be this one.

/**
 * Writes a `string | null` field's value: `null`, or the string.
 *
 * @param w The writer.
 * @param s The value.
 *
 * @internal Called by name by the code the compiler writes for `jsonEncode`,
 *   src/json-typed.ts `jsonEncodeHelper`.
 */
export const jsonEncodeStringOrNull = (w: JsonWriter, s: string | null): void => {
  if (s === null) {
    w.nullValue()
  } else {
    w.string(s)
  }
}

/**
 * Writes a `u64` as its digits: at most 20 of them, written with `raw` from an
 * array of this call's own that nothing keeps. A value past 2^63 has no
 * `i64` to go through the writer's `i64` as, so every `u64` takes this one
 * loop. Every `u64` here is built with `toU64`, a BigInt under Node.
 *
 * @param w The writer.
 * @param v The value.
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

/**
 * Writes a `JsonNumber` as the text it holds, byte for byte.
 *
 * @param w The writer.
 * @param n The number.
 */
export const jsonEncodeNumber = (w: JsonWriter, n: JsonNumber): void => {
  const start: i32 = 0
  w.raw(n.bytes, start, n.count)
}

/**
 * Writes an array whose every element is an `i32`.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeI32Array = (w: JsonWriter, xs: i32[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.i32(x)
  }
  w.endArray()
}

/**
 * Writes an array whose every element is a `u32`.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeU32Array = (w: JsonWriter, xs: u32[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.u32(x)
  }
  w.endArray()
}

/**
 * Writes an array whose every element is an `i64`.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeI64Array = (w: JsonWriter, xs: i64[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.i64(x)
  }
  w.endArray()
}

/**
 * Writes an array whose every element is a `u64`, each as `jsonEncodeU64` writes it.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeU64Array = (w: JsonWriter, xs: u64[]): void => {
  w.beginArray()
  for (const x of xs) {
    jsonEncodeU64(w, x)
  }
  w.endArray()
}

/**
 * Writes an array whose every element is an `f64`, a NaN or an infinity as the writer writes one.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeF64Array = (w: JsonWriter, xs: f64[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.f64(x)
  }
  w.endArray()
}

/**
 * Writes an array whose every element is a `boolean`.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeBooleanArray = (w: JsonWriter, xs: boolean[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.boolean(x)
  }
  w.endArray()
}

/**
 * Writes an array whose every element is a string.
 *
 * @param w The writer.
 * @param xs The elements, in order.
 */
export const jsonEncodeStringArray = (w: JsonWriter, xs: string[]): void => {
  w.beginArray()
  for (const x of xs) {
    w.string(x)
  }
  w.endArray()
}

/**
 * Writes `null`, or the array as `jsonEncodeI32Array` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeI32ArrayOrNull = (w: JsonWriter, xs: i32[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeI32Array(w, xs)
  }
}

/**
 * Writes `null`, or the array as `jsonEncodeU32Array` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeU32ArrayOrNull = (w: JsonWriter, xs: u32[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeU32Array(w, xs)
  }
}

/**
 * Writes `null`, or the array as `jsonEncodeI64Array` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeI64ArrayOrNull = (w: JsonWriter, xs: i64[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeI64Array(w, xs)
  }
}

/**
 * Writes `null`, or the array as `jsonEncodeU64Array` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeU64ArrayOrNull = (w: JsonWriter, xs: u64[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeU64Array(w, xs)
  }
}

/**
 * Writes `null`, or the array as `jsonEncodeF64Array` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeF64ArrayOrNull = (w: JsonWriter, xs: f64[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeF64Array(w, xs)
  }
}

/**
 * Writes `null`, or the array as `jsonEncodeBooleanArray` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeBooleanArrayOrNull = (w: JsonWriter, xs: boolean[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeBooleanArray(w, xs)
  }
}

/**
 * Writes `null`, or the array as `jsonEncodeStringArray` writes it.
 *
 * @param w The writer.
 * @param xs The elements, or `null`.
 */
export const jsonEncodeStringArrayOrNull = (w: JsonWriter, xs: string[] | null): void => {
  if (xs === null) {
    w.nullValue()
  } else {
    jsonEncodeStringArray(w, xs)
  }
}
