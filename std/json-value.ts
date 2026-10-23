/**
 * `nish/json-value` — any JSON document as a tree a program can read, build
 * and write back, with every number kept as the text it was written in.
 *
 * `nish/json-typed` reads JSON into a class the program declares, which is the
 * fast and safe way when the shape is known. This module is for when it is
 * not: a configuration file, a proxy that rewrites one field and passes the
 * rest through, a tool that prints whatever it was given.
 *
 *     import { JsonDocument, JSON_VALUE_NUMBER } from "nish/json-value"
 *     import { JsonLimits } from "nish/json-tokenizer"
 *
 *     const doc = new JsonDocument(new JsonLimits())
 *     const root = doc.parseText('{"id":18446744073709551615,"tags":["a","b"]}')
 *     if (root < 0) {
 *       // a JSON_TOK_ERR_* code, or JSON_VALUE_ERR_DUPLICATE; the byte is doc.errorAt
 *     }
 *     const id = doc.get(root, "id")
 *     doc.kind(id) === JSON_VALUE_NUMBER   // true
 *     doc.isU64(id)                        // true; doc.isI64(id) is false
 *     doc.numberText(id)                   // "18446744073709551615", as written
 *     doc.stringify(root)                  // the same text back, byte for byte
 *
 * **A value is a handle.** `JsonValue` is an `i32` naming one value of the
 * document that made it, and every reader and builder is a method of that
 * document. A handle stays valid until the document parses again or is
 * `clear`ed, which forgets every value at once and keeps the memory: the
 * nodes, the member slots and the bytes of every string and number live in a
 * handful of arrays the document owns and reuses. A server keeps one document
 * and parses each request into it, and once the arrays have grown to the
 * largest request seen, parsing allocates nothing.
 *
 * A handle carries the generation of the document's contents it was made in,
 * which moves on at every `parse` and `clear`, so a handle kept from an
 * earlier request names nothing in the next one, even when the next one has
 * the same shape: it is `JSON_VALUE_NONE` to `kind`, and every reader answers
 * its empty value for it rather than another document's. The generation has
 * 511 values and moves by one at a `clear`, one at a parse and two at a parse
 * that fails, so the check misses only a handle kept across exactly a
 * multiple of 511 of those steps; a program must not keep handles across
 * documents, and this catches the mistake rather than licensing it. A
 * negative handle, or one past the last value, is `JSON_VALUE_NONE` too.
 *
 * **The document's size is bounded.** Each value costs about 46 bytes of the
 * arrays the document keeps for its life, on top of the decoded text of its
 * strings, keys and numbers, which `JsonLimits.maxTotalBytes` bounds through
 * the input (`docs/security/json.md`, JSON-10). `maxValues` caps the first
 * part by capping how many values one document holds:
 * `JSON_VALUE_DEFAULT_MAX_VALUES` unless the program sets it, at most
 * `JSON_VALUE_MAX_VALUES`. A parse that would make one more is
 * `JSON_VALUE_ERR_VALUES` at the byte of the value that does not fit, and a
 * builder answers the same code.
 *
 * **Numbers are lossless.** A number keeps its source text, and is read as
 * whatever the caller asks for when it asks: `i64` and `u64` when the text is
 * an integer that fits (`isI64`, `isU64`), whether its value is whole at all
 * (`isIntegral`, so `1.0` and `1e2` are), the nearest `f64` (`f64`, correctly
 * rounded, the tokenizer's `numberF64`), or the text itself (`numberText`).
 * Writing it back copies the text. So `18446744073709551616`, wider than any
 * integer type, and `0.1000000000000000055511151231257827`, more digits than an
 * `f64` holds, come back out exactly as they went in, where JavaScript's
 * `JSON.parse` turns both into the nearest double.
 *
 * **Objects keep insertion order**, the order the members were written in or
 * added. `get` finds a member by its key with a scan, so it is for a handful of
 * lookups per object; a program that looks up many keys of a large object
 * walks it once with `keyAt` and `at`.
 *
 * **Duplicate keys are refused by default.** `{"a":1,"a":2}` is
 * `JSON_VALUE_ERR_DUPLICATE`, with `errorAt` at the first key that repeats an
 * earlier one, because two readers that pick different members of the same
 * text are a check bypassed (`docs/security/json.md`, JSON-3), and refusing
 * is what `nish/json-typed` does too. A program that has to accept what
 * `JSON.parse` accepts sets `duplicates` to `JSON_VALUE_DUPLICATE_LAST`, and
 * gets `JSON.parse`'s answer: one member, at the place of the first, holding
 * the value of the last. The check sorts each object's keys, so an object of
 * n members costs n log n comparisons whatever the keys are.
 *
 * **Every limit and every parse error is the tokenizer's.** `parse` runs a
 * `JsonTokenizer` with the `JsonLimits` the document was made with, and
 * answers its `JSON_TOK_ERR_*` code and offset unchanged. The depth limit is
 * capped at `JSON_WRITER_MAX_DEPTH`, 64, so that every document a parse
 * accepts can be written back; a deeper one is the tokenizer's
 * `JSON_TOK_ERR_DEPTH`. Nothing an input holds panics, and the parse keeps its
 * own stack of open containers rather than recursing.
 *
 * **Writing goes through `JsonWriter`.** `write(v, w)` writes a value into a
 * writer the caller set up, so its buffer, its reuse and its sticky
 * `JSON_WRITE_*` codes are the writer's own, and `stringify` is a convenience
 * that sizes a buffer and answers a string. Strings come out as `JsonWriter`
 * escapes them, which is `JSON.stringify`'s rule, numbers as their text, and
 * members in order. Only a built tree can be deeper than
 * `JSON_WRITER_MAX_DEPTH`, and writing one is the writer's
 * `JSON_WRITE_TOO_DEEP`.
 *
 * **Building a tree** is a `new*` call per value, then `push` onto an array or
 * `set` on an object, each answering `JSON_VALUE_OK` or a negative code. A
 * value lives in at most one container, so a tree built through `push` and
 * `set` can never contain itself: adding a value that is already in a
 * container, or a container to itself or to anything inside it, is
 * `JSON_VALUE_ERR_ATTACHED`, and writing always ends.
 * Strings handed to a builder are taken as their bytes, as `JsonWriter` takes
 * them, and a string read back is made from the stored bytes in one
 * allocation (`String.fromBytes`). Under Node a string is UTF-16, and
 * `parseText` and the builders take one byte per code unit, so non-ASCII text
 * is stored differently there than natively, where a string is its UTF-8
 * bytes; `parse` over a `u8[]` reads the same bytes both ways.
 *
 * **Public is not the whole API.** Nish has no private members, so the
 * methods marked "Internal" in their comments, and the fields, are reachable
 * by a program; the guarantees above hold only through the methods that are
 * not marked so. `append` with indices of the program's choosing, for
 * example, skips the check that keeps a tree finite.
 *
 * Every name here is `json`-prefixed, because a `std/` module is compiled into
 * the program that imports it and the symbol namespace is flat
 * (`std/README.md`). Every offset, count and code is an `i32`, so the module is
 * the same under `--number-mode f64`, and it runs under the Node prelude, where
 * `tests/run.js` holds every method to the native answers.
 */
import { JSON_WRITE_FULL, JSON_WRITE_OK, JSON_WRITER_MAX_DEPTH, JsonWriter } from "nish/json"
import {
  JSON_TOK_ARRAY_BEGIN,
  JSON_TOK_ARRAY_END,
  JSON_TOK_END,
  JSON_TOK_KEY,
  JSON_TOK_NULL,
  JSON_TOK_NUMBER,
  JSON_TOK_OBJECT_BEGIN,
  JSON_TOK_OBJECT_END,
  JSON_TOK_STRING,
  JSON_TOK_TRUE,
  JsonLimits,
  JsonTokenizer,
} from "nish/json-tokenizer"

/** A value in a `JsonDocument`: an index into it, valid until the document parses again or is cleared. */
export type JsonValue = i32

/** What `kind` answers for a handle that names no value. */
export const JSON_VALUE_NONE: i32 = 0
export const JSON_VALUE_NULL: i32 = 1
export const JSON_VALUE_BOOLEAN: i32 = 2
/** A number, kept as its text: `numberText`, `isI64`, `i64`, `isU64`, `u64` and `f64` read it. */
export const JSON_VALUE_NUMBER: i32 = 3
export const JSON_VALUE_STRING: i32 = 4
export const JSON_VALUE_ARRAY: i32 = 5
export const JSON_VALUE_OBJECT: i32 = 6

/** What a builder answers when it did what it was asked. */
export const JSON_VALUE_OK: i32 = 0
/** A key an object already has, refused while `duplicates` is `JSON_VALUE_DUPLICATE_REFUSE`. */
export const JSON_VALUE_ERR_DUPLICATE: i32 = -30
/** A handle that names no value, or a value of the wrong kind: `push` onto an object, `set` on an array. */
export const JSON_VALUE_ERR_HANDLE: i32 = -31
/** A value already in a container, or a container added to itself or to a value inside it. */
export const JSON_VALUE_ERR_ATTACHED: i32 = -32
/** Text that is not one JSON number, for `newNumber`, or an `f64` that is NaN or an infinity, for `newF64`. */
export const JSON_VALUE_ERR_NUMBER: i32 = -33
/** One value more than `JsonDocument.maxValues`, by a parse (with `errorAt` at its first byte) or a builder. */
export const JSON_VALUE_ERR_VALUES: i32 = -34

/**
 * The most values one document holds by default: a parse that would make
 * more is `JSON_VALUE_ERR_VALUES`. Each value costs the document about 46
 * bytes of arrays it keeps (`docs/security/json.md`, JSON-10), so this caps
 * them near 12 MB; a program raises `maxValues` up to
 * `JSON_VALUE_MAX_VALUES` for larger documents.
 */
export const JSON_VALUE_DEFAULT_MAX_VALUES: i32 = 262144
/** The most `maxValues` can be: a handle keeps a value's index in its low 22 bits. */
export const JSON_VALUE_MAX_VALUES: i32 = 4194304

/** The default: a repeated key is `JSON_VALUE_ERR_DUPLICATE`. */
export const JSON_VALUE_DUPLICATE_REFUSE: i32 = 0
/** `JSON.parse`'s rule: one member, at the first key's place, with the last key's value. */
export const JSON_VALUE_DUPLICATE_LAST: i32 = 1

/**
 * A handle is `generation << JSON_VALUE_INDEX_BITS | index`. The generation
 * runs from 1 to `JSON_VALUE_LAST_GENERATION` and moves on by one at every
 * `clear` and every parse, two at a parse that fails, so a handle kept from an
 * earlier document names nothing in this one, unless exactly a multiple of
 * 511 of those steps have passed.
 */
const JSON_VALUE_INDEX_BITS: i32 = 22
const JSON_VALUE_INDEX_MASK: i32 = 4194303
const JSON_VALUE_LAST_GENERATION: i32 = 511
/** At most this many members are checked for duplicates pair by pair; a larger object is sorted. */
const JSON_VALUE_PAIRWISE: i32 = 8
/** How many member slots a built container gets when it first grows. */
const JSON_VALUE_FIRST_SLOTS: i32 = 4
/** The largest an `i32` count may be, which every limit of the number reader is set to. */
const JSON_VALUE_I32_MAX: i32 = 2147483647
const JSON_VALUE_DIGIT_0: i32 = 48
/** The words of a value with nothing to point at, and a `true` boolean's first word; spelled `i32` for `--number-mode f64`. */
const JSON_VALUE_NO_WORD: i32 = 0
const JSON_VALUE_TRUE_WORD: i32 = 1
const JSON_VALUE_MINUS: i32 = 45

/**
 * A JSON tree, and the memory every value of it lives in. Make one, then
 * `parse` into it or build with the `new*` methods; the module header has the
 * rules. Its fields and its "Internal" methods are reachable, as every
 * member in Nish is; use the others.
 */
export class JsonDocument {
  /** Per value: its `JSON_VALUE_*` kind. */
  kinds: u8[]
  /** Per value: a string's or a number's first byte in `bytes`, a container's first slot, a boolean's `0` or `1`. */
  first: i32[]
  /** Per value: a string's or a number's byte count, or a container's member count. */
  count: i32[]
  /** Per value: how many slots a container has from `first`, its members and room to grow. */
  room: i32[]
  /** Per value: the container it is in, or `-1`. */
  parent: i32[]
  /** Per member slot: the member's value, and an object member's key as a window of `bytes`. */
  slotValue: i32[]
  slotKeyAt: i32[]
  slotKeyLength: i32[]
  /** The bytes of every string, key and number, decoded, one after the other. */
  bytes: u8[]
  /**
   * The parse's own stacks: the open containers, where each one's members
   * start in the pending arrays and the key it is the value of, if any; and
   * the pending arrays, which hold every member read and not yet
   * placed, with its key and the key's source offset. The sort arrays are the
   * duplicate check's. All of them keep their length from one parse to the
   * next, which is what lets a parse allocate nothing.
   */
  openValue: i32[]
  openBase: i32[]
  openKeyAt: i32[]
  openKeyLength: i32[]
  openKeySource: i32[]
  pendingValue: i32[]
  pendingKeyAt: i32[]
  pendingKeyLength: i32[]
  pendingSource: i32[]
  sortA: i32[]
  sortB: i32[]
  /** `parseText`'s copy of its string. */
  textBytes: u8[]
  tok: JsonTokenizer
  /** A tokenizer over one stored number at a time, for `isI64`, `i64` and `f64`, limited only by `i32`. */
  numbers: JsonTokenizer

  /** `JSON_VALUE_DUPLICATE_REFUSE` or `JSON_VALUE_DUPLICATE_LAST`; read by `parse`. */
  duplicates: i32 = 0
  /** The last `parse`'s code: `0`, a `JSON_TOK_ERR_*` code or `JSON_VALUE_ERR_DUPLICATE`. */
  failed: i32 = 0
  /** The byte offset in the parsed array the error was found at, and `-1` until one. */
  errorAt: i32 = -1
  /** How many values are in use: the handles are `0 .. top - 1`. */
  top: i32 = 0
  /** How many member slots are in use, and how many bytes. */
  slotTop: i32 = 0
  byteTop: i32 = 0
  /** How many members are pending. */
  pendingTop: i32 = 0
  /** The most values the document holds; more is `JSON_VALUE_ERR_VALUES`. At most `JSON_VALUE_MAX_VALUES`. */
  maxValues: i32 = 0
  /** The generation every handle of the current document carries; see `JSON_VALUE_INDEX_BITS`. */
  generation: i32 = 1
  /** Whether the last `unsigned` read a number that fits a `u64`. */
  unsignedFits: boolean = false

  constructor(limits: JsonLimits) {
    this.maxValues = JSON_VALUE_DEFAULT_MAX_VALUES
    this.kinds = []
    this.first = []
    this.count = []
    this.room = []
    this.parent = []
    this.slotValue = []
    this.slotKeyAt = []
    this.slotKeyLength = []
    this.bytes = []
    this.openValue = []
    this.openBase = []
    this.openKeyAt = []
    this.openKeyLength = []
    this.openKeySource = []
    this.pendingValue = []
    this.pendingKeyAt = []
    this.pendingKeyLength = []
    this.pendingSource = []
    this.sortA = []
    this.sortB = []
    this.textBytes = []
    // The writer nests 64 deep, so a parsed document is held to that too:
    // every document a parse accepts can be written back.
    const capped = new JsonLimits()
    capped.maxDepth = limits.maxDepth < JSON_WRITER_MAX_DEPTH ? limits.maxDepth : JSON_WRITER_MAX_DEPTH
    capped.maxStringBytes = limits.maxStringBytes
    capped.maxNumberBytes = limits.maxNumberBytes
    capped.maxTotalBytes = limits.maxTotalBytes
    this.tok = new JsonTokenizer(this.bytes, 0, 0, capped)
    const wide = new JsonLimits()
    wide.maxDepth = 0
    wide.maxNumberBytes = JSON_VALUE_I32_MAX
    wide.maxTotalBytes = JSON_VALUE_I32_MAX
    this.numbers = new JsonTokenizer(this.bytes, 0, 0, wide)
  }

  /** Forgets every value, keeping the memory for the next parse or build. Every handle is invalid afterwards. */
  clear(): void {
    this.generation = this.generation >= JSON_VALUE_LAST_GENERATION ? 1 : this.generation + 1
    this.top = 0
    this.slotTop = 0
    this.byteTop = 0
    this.pendingTop = 0
    this.failed = 0
    this.errorAt = -1
  }

  // ---- Parsing ----------------------------------------------------------------

  /**
   * Clears the document and parses `src[off, off + len)` into it. Answers the
   * root value, or a negative code — the tokenizer's `JSON_TOK_ERR_*` or
   * `JSON_VALUE_ERR_DUPLICATE` — which is also in `failed`, with the byte
   * offset in `errorAt`. Nothing is kept from a parse that fails.
   */
  parse(src: u8[], off: i32, len: i32): JsonValue {
    this.clear()
    const tok: JsonTokenizer = this.tok
    tok.reset(src, off, len)
    let depth: i32 = 0
    let root: i32 = -1
    let keyAt: i32 = 0
    let keyLength: i32 = 0
    let keySource: i32 = 0
    let k: i32 = tok.next()
    while (k > 0) {
      let v: i32 = -1
      if (k === JSON_TOK_KEY) {
        keySource = tok.tokStart
        keyAt = this.byteTop
        keyLength = this.storeString(tok)
      } else if (k === JSON_TOK_OBJECT_BEGIN || k === JSON_TOK_ARRAY_BEGIN) {
        const c: i32 = this.newNode(
          k === JSON_TOK_OBJECT_BEGIN ? JSON_VALUE_OBJECT : JSON_VALUE_ARRAY,
          JSON_VALUE_NO_WORD,
          JSON_VALUE_NO_WORD
        )
        if (c < 0) {
          return this.parseFailed(c, tok.tokStart)
        }
        jsonValuePut(this.openValue, depth, c)
        jsonValuePut(this.openBase, depth, this.pendingTop)
        jsonValuePut(this.openKeyAt, depth, keyAt)
        jsonValuePut(this.openKeyLength, depth, keyLength)
        jsonValuePut(this.openKeySource, depth, keySource)
        depth += 1
      } else if (k === JSON_TOK_OBJECT_END || k === JSON_TOK_ARRAY_END) {
        depth -= 1
        const c: i32 = jsonValueGet(this.openValue, depth)
        const code: i32 = this.close(c, jsonValueGet(this.openBase, depth))
        if (code < 0) {
          return this.parseFailed(code, this.errorAt)
        }
        // The container's own key, read before its members' keys overwrote the three locals.
        keyAt = jsonValueGet(this.openKeyAt, depth)
        keyLength = jsonValueGet(this.openKeyLength, depth)
        keySource = jsonValueGet(this.openKeySource, depth)
        v = c
      } else if (k === JSON_TOK_STRING) {
        v = this.newNode(JSON_VALUE_STRING, this.byteTop, this.storeString(tok))
      } else if (k === JSON_TOK_NUMBER) {
        v = this.newNode(JSON_VALUE_NUMBER, this.byteTop, this.storeSource(tok))
      } else if (k === JSON_TOK_NULL) {
        v = this.newNode(JSON_VALUE_NULL, JSON_VALUE_NO_WORD, JSON_VALUE_NO_WORD)
      } else {
        v = this.newNode(
          JSON_VALUE_BOOLEAN,
          k === JSON_TOK_TRUE ? JSON_VALUE_TRUE_WORD : JSON_VALUE_NO_WORD,
          JSON_VALUE_NO_WORD
        )
      }
      // `-1` is a key or an opener, which place no value yet; below it, the value was refused.
      if (v < -1) {
        return this.parseFailed(v, tok.tokStart)
      }
      if (v >= 0) {
        if (depth === 0) {
          root = v
        } else {
          const p: i32 = this.pendingTop
          jsonValuePut(this.pendingValue, p, v)
          jsonValuePut(this.pendingKeyAt, p, keyAt)
          jsonValuePut(this.pendingKeyLength, p, keyLength)
          jsonValuePut(this.pendingSource, p, keySource)
          this.pendingTop = p + 1
        }
      }
      k = tok.next()
    }
    if (k < 0 || root < 0) {
      return this.parseFailed(k < 0 ? k : JSON_VALUE_ERR_HANDLE, tok.errorAt)
    }
    return this.handle(root)
  }

  /** `parse` over the bytes of `s`, copied into an array the document reuses; `errorAt` is a byte offset in `s`. */
  parseText(s: string): JsonValue {
    const n: i32 = toI32(s.length)
    const buf: u8[] = jsonValueRoom(this.textBytes, n)
    this.textBytes = buf
    for (let i: i32 = 0; i < n && i < toI32(buf.length); i += 1) {
      buf[i] = toU8(s.charCodeAt(i))
    }
    return this.parse(buf, JSON_VALUE_NO_WORD, n)
  }

  /** Internal: Records a failed parse and forgets what it built. */
  parseFailed(code: i32, at: i32): i32 {
    this.clear()
    this.failed = code
    this.errorAt = at
    return code
  }

  /**
   * Internal: Places the members pending from `base` into container `c` as one run of
   * slots, checking an object's keys for duplicates first. Answers `0`, or
   * `JSON_VALUE_ERR_DUPLICATE` with `errorAt` set.
   */
  close(c: i32, base: i32): i32 {
    let n: i32 = this.pendingTop - base
    const object: boolean = this.kindAt(c) === JSON_VALUE_OBJECT
    if (object && n > 1) {
      const code: i32 = this.duplicateKeys(base, n)
      if (code < 0) {
        return code
      }
    }
    const start: i32 = this.slotTop
    let kept: i32 = 0
    for (let p: i32 = base; p < base + n; p += 1) {
      const v: i32 = jsonValueGet(this.pendingValue, p)
      if (v < 0) {
        continue
      }
      const s: i32 = start + kept
      jsonValuePut(this.slotValue, s, v)
      jsonValuePut(this.slotKeyAt, s, jsonValueGet(this.pendingKeyAt, p))
      jsonValuePut(this.slotKeyLength, s, jsonValueGet(this.pendingKeyLength, p))
      jsonValuePut(this.parent, v, c)
      kept += 1
    }
    n = kept
    this.slotTop = start + n
    jsonValuePut(this.first, c, start)
    jsonValuePut(this.count, c, n)
    jsonValuePut(this.room, c, n)
    this.pendingTop = base
    return 0
  }

  /**
   * Internal: The duplicate check over the `n` members pending from `base`. Under
   * `JSON_VALUE_DUPLICATE_LAST`, a repeated key's later members are marked
   * gone (their pending value set to `-1`) and the first one takes the last
   * one's value. Small objects compare every pair; larger ones are sorted by
   * key with ties in member order, so a key's repeats are next to each other
   * and the first of them is its first member.
   */
  duplicateKeys(base: i32, n: i32): i32 {
    let firstRepeat: i32 = -1
    if (n <= JSON_VALUE_PAIRWISE) {
      for (let i: i32 = base + 1; i < base + n; i += 1) {
        for (let j: i32 = base; j < i; j += 1) {
          if (jsonValueGet(this.pendingValue, j) >= 0 && this.samePendingKey(i, j)) {
            firstRepeat = this.repeat(j, i, firstRepeat)
            break
          }
        }
      }
    } else {
      const order: i32[] = this.sortPending(base, n)
      let i: i32 = 0
      while (i < n) {
        const head: i32 = jsonValueGet(order, i)
        let j: i32 = i + 1
        while (j < n && this.samePendingKey(head, jsonValueGet(order, j))) {
          firstRepeat = this.repeat(head, jsonValueGet(order, j), firstRepeat)
          j += 1
        }
        i = j
      }
    }
    if (firstRepeat >= 0 && this.duplicates !== JSON_VALUE_DUPLICATE_LAST) {
      this.errorAt = firstRepeat
      return JSON_VALUE_ERR_DUPLICATE
    }
    return 0
  }

  /**
   * Internal: Pending member `later` repeats the key of the earlier `head`: under
   * `JSON_VALUE_DUPLICATE_LAST` `head` takes its value and it is marked gone.
   * Answers the smallest source offset of a repeating key seen so far.
   */
  repeat(head: i32, later: i32, firstRepeat: i32): i32 {
    const source: i32 = jsonValueGet(this.pendingSource, later)
    if (this.duplicates === JSON_VALUE_DUPLICATE_LAST) {
      jsonValuePut(this.pendingValue, head, jsonValueGet(this.pendingValue, later))
      jsonValuePut(this.pendingValue, later, -1)
    }
    return firstRepeat < 0 || source < firstRepeat ? source : firstRepeat
  }

  /** Internal: Whether pending members `a` and `b` have the same key bytes. */
  samePendingKey(a: i32, b: i32): boolean {
    return this.comparePending(a, b) === 0
  }

  /**
   * Internal: The pending indices `base .. base + n - 1` sorted by key, ties in index
   * order: a bottom-up merge sort between the two sort arrays, which answers
   * whichever of them holds the result.
   */
  sortPending(base: i32, n: i32): i32[] {
    let from: i32[] = jsonValueRoomI32(this.sortA, n)
    let to: i32[] = jsonValueRoomI32(this.sortB, n)
    this.sortA = from
    this.sortB = to
    for (let i: i32 = 0; i < n && i < toI32(from.length); i += 1) {
      from[i] = base + i
    }
    let width: i32 = 1
    while (width < n) {
      let lo: i32 = 0
      while (lo < n) {
        const mid: i32 = lo + width < n ? lo + width : n
        const hi: i32 = mid + width < n ? mid + width : n
        let a: i32 = lo
        let b: i32 = mid
        let out: i32 = lo
        while (out < hi) {
          const takeA: boolean =
            b >= hi || (a < mid && this.comparePending(jsonValueGet(from, a), jsonValueGet(from, b)) <= 0)
          if (takeA) {
            jsonValuePut(to, out, jsonValueGet(from, a))
            a += 1
          } else {
            jsonValuePut(to, out, jsonValueGet(from, b))
            b += 1
          }
          out += 1
        }
        lo = hi
      }
      const swap: i32[] = from
      from = to
      to = swap
      width = width * 2
    }
    return from
  }

  /** Internal: Pending members `a` and `b` ordered by key bytes. */
  comparePending(a: i32, b: i32): i32 {
    return jsonValueCompareBytes(
      this.bytes,
      jsonValueGet(this.pendingKeyAt, a),
      jsonValueGet(this.pendingKeyLength, a),
      jsonValueGet(this.pendingKeyAt, b),
      jsonValueGet(this.pendingKeyLength, b)
    )
  }

  /** Internal: The tokenizer's current string or key, decoded onto the end of `bytes`; answers its length. */
  storeString(tok: JsonTokenizer): i32 {
    const n: i32 = tok.stringLength()
    const at: i32 = this.byteTop
    const buf: u8[] = jsonValueRoom(this.bytes, at + n)
    this.bytes = buf
    tok.stringInto(buf, at)
    this.byteTop = at + n
    return n
  }

  /** Internal: The tokenizer's current token as written, a number's text, onto the end of `bytes`; answers its length. */
  storeSource(tok: JsonTokenizer): i32 {
    const src: u8[] = tok.src
    const start: i32 = tok.tokStart
    const n: i32 = tok.tokEnd - start
    const at: i32 = this.byteTop
    const buf: u8[] = jsonValueRoom(this.bytes, at + n)
    this.bytes = buf
    for (let i: i32 = 0; i < n && start + i < toI32(src.length) && at + i < toI32(buf.length); i += 1) {
      if (start + i >= 0 && at + i >= 0) {
        buf[at + i] = src[start + i]
      }
    }
    this.byteTop = at + n
    return n
  }

  /**
   * Internal: a new value of `kind` with its two words, in no container, and
   * its index; `JSON_VALUE_ERR_VALUES` when the document already holds
   * `maxValues`.
   */
  newNode(kind: i32, first: i32, count: i32): i32 {
    const v: i32 = this.top
    const cap: i32 = this.maxValues < JSON_VALUE_MAX_VALUES ? this.maxValues : JSON_VALUE_MAX_VALUES
    if (v >= cap) {
      return JSON_VALUE_ERR_VALUES
    }
    if (v < toI32(this.kinds.length)) {
      this.kinds[v] = toU8(kind)
    } else {
      this.kinds.push(toU8(kind))
    }
    jsonValuePut(this.first, v, first)
    jsonValuePut(this.count, v, count)
    jsonValuePut(this.room, v, 0)
    jsonValuePut(this.parent, v, -1)
    this.top = v + 1
    return v
  }

  // ---- Handles ----------------------------------------------------------------

  /** Internal: the index handle `v` names in this document, or `-1` when it names nothing here. */
  index(v: JsonValue): i32 {
    if (v < 0 || v >> JSON_VALUE_INDEX_BITS !== this.generation) {
      return -1
    }
    const x: i32 = v & JSON_VALUE_INDEX_MASK
    return x < this.top ? x : -1
  }

  /** Internal: the handle of index `x` in this document's generation; a negative `x` is answered as it is. */
  handle(x: i32): JsonValue {
    return x < 0 ? x : (this.generation << JSON_VALUE_INDEX_BITS) | x
  }

  // ---- Reading ----------------------------------------------------------------

  /** `v`'s `JSON_VALUE_*` kind, or `JSON_VALUE_NONE` when `v` names no value of this document's current contents. */
  kind(v: JsonValue): i32 {
    return this.kindAt(this.index(v))
  }

  /** Internal: the kind of index `x`, or `JSON_VALUE_NONE`. */
  kindAt(x: i32): i32 {
    const kinds: u8[] = this.kinds
    if (x < 0 || x >= this.top || x >= toI32(kinds.length)) {
      return JSON_VALUE_NONE
    }
    return toI32(kinds[x])
  }

  /** A boolean's value; `false` for any other value. */
  boolean(v: JsonValue): boolean {
    const x: i32 = this.index(v)
    return this.kindAt(x) === JSON_VALUE_BOOLEAN && jsonValueGet(this.first, x) === JSON_VALUE_TRUE_WORD
  }

  /** How many elements an array has, or members an object has; `-1` for any other value. */
  length(v: JsonValue): i32 {
    return this.lengthAt(this.index(v))
  }

  /** Internal: `length` of index `x`. */
  lengthAt(x: i32): i32 {
    const k: i32 = this.kindAt(x)
    return k === JSON_VALUE_ARRAY || k === JSON_VALUE_OBJECT ? jsonValueGet(this.count, x) : -1
  }

  /** Internal: the slot of member or element `i` of the container at index `x`, or `-1`. */
  slotAt(x: i32, i: i32): i32 {
    if (i < 0 || i >= this.lengthAt(x)) {
      return -1
    }
    return jsonValueGet(this.first, x) + i
  }

  /** Element `i` of an array, or the value of member `i` of an object, in order; `-1` when there is none. */
  at(v: JsonValue, i: i32): JsonValue {
    const s: i32 = this.slotAt(this.index(v), i)
    return s < 0 ? -1 : this.handle(jsonValueGet(this.slotValue, s))
  }

  /** The key of member `i` of an object, decoded; `""` when `v` is not an object or has no member `i`. */
  keyAt(v: JsonValue, i: i32): string {
    const x: i32 = this.index(v)
    if (this.kindAt(x) !== JSON_VALUE_OBJECT) {
      return ""
    }
    const s: i32 = this.slotAt(x, i)
    if (s < 0) {
      return ""
    }
    return this.textOf(jsonValueGet(this.slotKeyAt, s), jsonValueGet(this.slotKeyLength, s))
  }

  /** The value of the member of object `v` whose key is `key`'s bytes; `-1` when there is none. */
  get(v: JsonValue, key: string): JsonValue {
    const x: i32 = this.index(v)
    if (this.kindAt(x) !== JSON_VALUE_OBJECT) {
      return -1
    }
    const s: i32 = this.findKey(x, key)
    return s < 0 ? -1 : this.handle(jsonValueGet(this.slotValue, s))
  }

  /** Internal: the slot of the member of the object at index `x` whose key is `key`'s bytes, or `-1`. */
  findKey(x: i32, key: string): i32 {
    const start: i32 = jsonValueGet(this.first, x)
    const n: i32 = jsonValueGet(this.count, x)
    for (let s: i32 = start; s < start + n; s += 1) {
      if (this.bytesEqual(jsonValueGet(this.slotKeyAt, s), jsonValueGet(this.slotKeyLength, s), key)) {
        return s
      }
    }
    return -1
  }

  /** A string's decoded bytes as a string; `""` for any other value. */
  string(v: JsonValue): string {
    const x: i32 = this.index(v)
    if (this.kindAt(x) !== JSON_VALUE_STRING) {
      return ""
    }
    return this.textOf(jsonValueGet(this.first, x), jsonValueGet(this.count, x))
  }

  /** Whether `v` is a string whose decoded bytes are `s`'s. Allocates nothing. */
  stringEquals(v: JsonValue, s: string): boolean {
    const x: i32 = this.index(v)
    return (
      this.kindAt(x) === JSON_VALUE_STRING &&
      this.bytesEqual(jsonValueGet(this.first, x), jsonValueGet(this.count, x), s)
    )
  }

  /** A number's text, exactly as it was written or built; `""` for any other value. */
  numberText(v: JsonValue): string {
    const x: i32 = this.index(v)
    if (this.kindAt(x) !== JSON_VALUE_NUMBER) {
      return ""
    }
    return this.textOf(jsonValueGet(this.first, x), jsonValueGet(this.count, x))
  }

  /**
   * Whether `v` is a number written without a fraction or an exponent whose
   * value fits an `i64`: the spelling, so `1.0` is not one. `isIntegral(v)`
   * asks whether the value is whole.
   */
  isI64(v: JsonValue): boolean {
    return this.readNumber(this.index(v)) && this.numbers.isInteger()
  }

  /** A number's value as an `i64` when `isI64(v)` holds, and `0` otherwise. */
  i64(v: JsonValue): i64 {
    // `numberI64` is already `0` for a number that is not an `i64`.
    return this.readNumber(this.index(v)) ? this.numbers.numberI64() : toI64(0)
  }

  /**
   * Whether `v` is a number written without a sign, a fraction or an exponent
   * whose value fits a `u64`: the spelling, as `isI64(v)` is.
   */
  isU64(v: JsonValue): boolean {
    this.unsigned(this.index(v))
    return this.unsignedFits
  }

  /** A number's value as a `u64` when `isU64(v)` holds, and `0` otherwise. */
  u64(v: JsonValue): u64 {
    return this.unsigned(this.index(v))
  }

  /**
   * Internal: the digits of the number at index `x` as a `u64`, setting
   * `unsignedFits` to whether it is a `u64` at all: no sign, no fraction or
   * exponent, and at most 2^64 - 1. Every `u64` comes from `toU64`, which is
   * a BigInt under Node, and nothing here wraps, so it means the same there.
   */
  unsigned(x: i32): u64 {
    this.unsignedFits = false
    if (!this.readNumber(x) || !this.numbers.integral) {
      return toU64(0)
    }
    const bytes: u8[] = this.bytes
    const start: i32 = jsonValueGet(this.first, x)
    const end: i32 = start + jsonValueGet(this.count, x)
    if (start < 0 || start >= toI32(bytes.length) || toI32(bytes[start]) === JSON_VALUE_MINUS) {
      return toU64(0)
    }
    const ten: u64 = toU64(10)
    // 2^64 - 1 has no literal: 2^16 - 1 widened twice.
    const quarter: u64 = toU64(65535)
    const half: u64 = (quarter << toU64(16)) | quarter
    const max: u64 = (half << toU64(32)) | half
    let acc: u64 = toU64(0)
    for (let i: i32 = start; i < end && i < toI32(bytes.length); i += 1) {
      const digit: u64 = toU64(toI32(bytes[i]) - JSON_VALUE_DIGIT_0)
      if (acc > (max - digit) / ten) {
        return toU64(0)
      }
      acc = acc * ten + digit
    }
    this.unsignedFits = true
    return acc
  }

  /**
   * Whether `v` is a number whose value is whole, however it is written:
   * JSON Schema 2020-12's "integer", the tokenizer's `isIntegral`. `1.0`,
   * `1e2` and `1e400` are, where `isI64(v)` and `isU64(v)` go by spelling and
   * by range and answer `false` for all three. `false` for any other kind and
   * for a handle from an earlier parse.
   */
  isIntegral(v: JsonValue): boolean {
    return this.readNumber(this.index(v)) && this.numbers.isIntegral()
  }

  /** A number's nearest `f64`, ties to even, as `JSON.parse` reads it; `0` for any other value. */
  f64(v: JsonValue): f64 {
    if (!this.readNumber(this.index(v))) {
      return 0
    }
    return this.numbers.numberF64()
  }

  /** Internal: points the number tokenizer at index `x`'s text and reads its one token; `false` when it is not a number. */
  readNumber(x: i32): boolean {
    if (this.kindAt(x) !== JSON_VALUE_NUMBER) {
      return false
    }
    const numbers: JsonTokenizer = this.numbers
    numbers.reset(this.bytes, jsonValueGet(this.first, x), jsonValueGet(this.count, x))
    return numbers.next() === JSON_TOK_NUMBER
  }

  /** Internal: `bytes[at, at + n)` as a string, in one allocation. */
  textOf(at: i32, n: i32): string {
    const bytes: u8[] = this.bytes
    if (at < 0 || n <= 0 || at > toI32(bytes.length) - n) {
      return ""
    }
    return String.fromBytes(bytes, at, at + n)
  }

  /** Internal: whether `bytes[at, at + n)` are exactly `s`'s bytes. */
  bytesEqual(at: i32, n: i32, s: string): boolean {
    const bytes: u8[] = this.bytes
    if (toI32(s.length) !== n || at < 0 || at > toI32(bytes.length) - n) {
      return false
    }
    for (let i: i32 = 0; i < n && i < toI32(s.length) && at + i < toI32(bytes.length); i += 1) {
      if (toI32(bytes[at + i]) !== toI32(s.charCodeAt(i))) {
        return false
      }
    }
    return true
  }

  // ---- Building ---------------------------------------------------------------
  // Each `new*` answers a handle, or `JSON_VALUE_ERR_VALUES` when the document
  // already holds `maxValues`.

  newNull(): JsonValue {
    return this.handle(this.newNode(JSON_VALUE_NULL, JSON_VALUE_NO_WORD, JSON_VALUE_NO_WORD))
  }

  newBoolean(b: boolean): JsonValue {
    return this.handle(
      this.newNode(JSON_VALUE_BOOLEAN, b ? JSON_VALUE_TRUE_WORD : JSON_VALUE_NO_WORD, JSON_VALUE_NO_WORD)
    )
  }

  /** A string holding `s`'s bytes. */
  newString(s: string): JsonValue {
    return this.newStored(JSON_VALUE_STRING, s)
  }

  /** A number holding `x`'s digits. */
  newI64(x: i64): JsonValue {
    return this.newStored(JSON_VALUE_NUMBER, `${x}`)
  }

  /** A number holding `x`'s digits. */
  newU64(x: u64): JsonValue {
    return this.newStored(JSON_VALUE_NUMBER, `${x}`)
  }

  /**
   * A number holding `x` as `String(x)` spells it, the shortest digits that
   * read back as `x`, with `-0` as `0`: what `JsonWriter.f64` writes.
   * `JSON_VALUE_ERR_NUMBER` for NaN and both infinities, which JSON cannot
   * spell.
   */
  newF64(x: f64): JsonValue {
    // `x - x` is `0` for every finite `x`, and NaN for NaN and both infinities.
    if (x - x !== toF64(0)) {
      return JSON_VALUE_ERR_NUMBER
    }
    return this.newStored(JSON_VALUE_NUMBER, `${x}`)
  }

  /**
   * A number holding `text` exactly, which must be one JSON number and
   * nothing else (RFC 8259 §6); `JSON_VALUE_ERR_NUMBER` otherwise. This is how
   * a program writes a number no integer or float type holds.
   */
  newNumber(text: string): JsonValue {
    const at: i32 = this.byteTop
    const n: i32 = this.storeText(text)
    const numbers: JsonTokenizer = this.numbers
    numbers.reset(this.bytes, at, n)
    // The tokenizer allows blanks around a value, and a number here is the text alone.
    const isNumber: boolean =
      numbers.next() === JSON_TOK_NUMBER && numbers.tokStart === at && numbers.tokEnd === at + n
    if (!isNumber || numbers.next() !== JSON_TOK_END) {
      this.byteTop = at
      return JSON_VALUE_ERR_NUMBER
    }
    return this.handle(this.newNode(JSON_VALUE_NUMBER, at, n))
  }

  newArray(): JsonValue {
    return this.handle(this.newNode(JSON_VALUE_ARRAY, this.slotTop, JSON_VALUE_NO_WORD))
  }

  newObject(): JsonValue {
    return this.handle(this.newNode(JSON_VALUE_OBJECT, this.slotTop, JSON_VALUE_NO_WORD))
  }

  /** Appends `v` to array `a`. `JSON_VALUE_OK`, or `JSON_VALUE_ERR_HANDLE` or `JSON_VALUE_ERR_ATTACHED`. */
  push(a: JsonValue, v: JsonValue): i32 {
    const ax: i32 = this.index(a)
    const vx: i32 = this.index(v)
    if (this.kindAt(ax) !== JSON_VALUE_ARRAY) {
      return JSON_VALUE_ERR_HANDLE
    }
    const code: i32 = this.adoptable(ax, vx)
    if (code < 0) {
      return code
    }
    this.append(ax, vx, JSON_VALUE_NO_WORD, JSON_VALUE_NO_WORD)
    return JSON_VALUE_OK
  }

  /**
   * Sets member `key` of object `o` to `v`: in place, keeping its position,
   * when `o` has the key, and appended last when it does not, as assigning a
   * property of a JavaScript object does. The value it replaces leaves the
   * object and is in no container afterwards. `JSON_VALUE_OK`, or
   * `JSON_VALUE_ERR_HANDLE` or `JSON_VALUE_ERR_ATTACHED`.
   */
  set(o: JsonValue, key: string, v: JsonValue): i32 {
    const ox: i32 = this.index(o)
    const vx: i32 = this.index(v)
    if (this.kindAt(ox) !== JSON_VALUE_OBJECT) {
      return JSON_VALUE_ERR_HANDLE
    }
    const code: i32 = this.adoptable(ox, vx)
    if (code < 0) {
      return code
    }
    const s: i32 = this.findKey(ox, key)
    if (s >= 0) {
      jsonValuePut(this.parent, jsonValueGet(this.slotValue, s), -1)
      jsonValuePut(this.slotValue, s, vx)
      jsonValuePut(this.parent, vx, ox)
      return JSON_VALUE_OK
    }
    this.append(ox, vx, this.byteTop, this.storeText(key))
    return JSON_VALUE_OK
  }

  /**
   * Internal: whether the value at index `v` may go into the container at
   * index `c`: it is a value, it is in no container, and it is not `c` or a
   * container `c` is inside. Through `push` and `set`, that is what keeps
   * every tree finite.
   */
  adoptable(c: i32, v: i32): i32 {
    if (this.kindAt(v) === JSON_VALUE_NONE) {
      return JSON_VALUE_ERR_HANDLE
    }
    if (jsonValueGet(this.parent, v) >= 0) {
      return JSON_VALUE_ERR_ATTACHED
    }
    let p: i32 = c
    while (p >= 0) {
      if (p === v) {
        return JSON_VALUE_ERR_ATTACHED
      }
      p = jsonValueGet(this.parent, p)
    }
    return JSON_VALUE_OK
  }

  /**
   * Internal: adds index `v`, with the key `bytes[keyAt, keyAt + keyLength)`,
   * after the last member of index `c`, unchecked: `push` and `set` check
   * first. A container whose slots are full moves them to the end of the slot
   * arrays with twice the room, unless they are at the end already, where they
   * grow in place; the slots it leaves are not reused until `clear`.
   */
  append(c: i32, v: i32, keyAt: i32, keyLength: i32): void {
    let start: i32 = jsonValueGet(this.first, c)
    const n: i32 = jsonValueGet(this.count, c)
    const capacity: i32 = jsonValueGet(this.room, c)
    if (n === capacity) {
      const grown: i32 = capacity < JSON_VALUE_FIRST_SLOTS ? JSON_VALUE_FIRST_SLOTS : capacity * 2
      if (start + capacity !== this.slotTop) {
        const moved: i32 = this.slotTop
        for (let i: i32 = 0; i < n; i += 1) {
          jsonValuePut(this.slotValue, moved + i, jsonValueGet(this.slotValue, start + i))
          jsonValuePut(this.slotKeyAt, moved + i, jsonValueGet(this.slotKeyAt, start + i))
          jsonValuePut(this.slotKeyLength, moved + i, jsonValueGet(this.slotKeyLength, start + i))
        }
        start = moved
        jsonValuePut(this.first, c, start)
      }
      this.slotTop = start + grown
      this.slotValue = jsonValueRoomI32(this.slotValue, this.slotTop)
      this.slotKeyAt = jsonValueRoomI32(this.slotKeyAt, this.slotTop)
      this.slotKeyLength = jsonValueRoomI32(this.slotKeyLength, this.slotTop)
      jsonValuePut(this.room, c, grown)
    }
    jsonValuePut(this.slotValue, start + n, v)
    jsonValuePut(this.slotKeyAt, start + n, keyAt)
    jsonValuePut(this.slotKeyLength, start + n, keyLength)
    jsonValuePut(this.count, c, n + 1)
    jsonValuePut(this.parent, v, c)
  }

  /** Internal: a new value of `kind` holding `s`'s bytes, as a handle. */
  newStored(kind: i32, s: string): JsonValue {
    return this.handle(this.newNode(kind, this.byteTop, this.storeText(s)))
  }

  /** Internal: `s`'s bytes onto the end of `bytes`; answers how many. */
  storeText(s: string): i32 {
    const n: i32 = toI32(s.length)
    const at: i32 = this.byteTop
    const buf: u8[] = jsonValueRoom(this.bytes, at + n)
    this.bytes = buf
    for (let i: i32 = 0; i < n && at + i < toI32(buf.length); i += 1) {
      if (at + i >= 0) {
        buf[at + i] = toU8(s.charCodeAt(i))
      }
    }
    this.byteTop = at + n
    return n
  }

  // ---- Writing ----------------------------------------------------------------

  /**
   * Writes `v` into `w` as one value, members in order and numbers as their
   * text; the outcome is the writer's, in `w.failed`. A value that names
   * nothing writes nothing and fails nothing. A parsed tree is never deeper
   * than the writer nests; a built one deeper than `JSON_WRITER_MAX_DEPTH`
   * ends at `JSON_WRITE_TOO_DEEP`, where the recursion stops.
   */
  write(v: JsonValue, w: JsonWriter): void {
    this.writeAt(this.index(v), w)
  }

  /** Internal: `write` of index `x`. */
  writeAt(x: i32, w: JsonWriter): void {
    const k: i32 = this.kindAt(x)
    if (k === JSON_VALUE_NONE || w.failed !== JSON_WRITE_OK) {
      return
    }
    if (k === JSON_VALUE_NULL) {
      w.nullValue()
    } else if (k === JSON_VALUE_BOOLEAN) {
      w.boolean(jsonValueGet(this.first, x) === JSON_VALUE_TRUE_WORD)
    } else if (k === JSON_VALUE_NUMBER) {
      w.raw(this.bytes, jsonValueGet(this.first, x), jsonValueGet(this.count, x))
    } else if (k === JSON_VALUE_STRING) {
      w.stringBytes(this.bytes, jsonValueGet(this.first, x), jsonValueGet(this.count, x))
    } else {
      // A container: its members are the slots from `first`, read directly.
      const object: boolean = k === JSON_VALUE_OBJECT
      const start: i32 = jsonValueGet(this.first, x)
      const end: i32 = start + jsonValueGet(this.count, x)
      if (object) {
        w.beginObject()
      } else {
        w.beginArray()
      }
      for (let s: i32 = start; s < end && w.failed === JSON_WRITE_OK; s += 1) {
        if (object) {
          w.keyBytes(this.bytes, jsonValueGet(this.slotKeyAt, s), jsonValueGet(this.slotKeyLength, s))
        }
        this.writeAt(jsonValueGet(this.slotValue, s), w)
      }
      if (object) {
        w.endObject()
      } else {
        w.endArray()
      }
    }
  }

  /**
   * `v` as minified JSON text: written into a buffer that doubles until it
   * fits, then made into one string. `""` when `v` names nothing or the
   * writer refuses it, which only a built tree deeper than
   * `JSON_WRITER_MAX_DEPTH` makes it do; `write` gives the code.
   */
  stringify(v: JsonValue): string {
    // Every byte stored and a few of punctuation per value: one pass fits most
    // documents, and a text with many escapes doubles from there.
    let size: i32 = this.byteTop + 8 * this.top + 64
    while (true) {
      const buf: u8[] = new Array<u8>(size)
      const w: JsonWriter = new JsonWriter(buf, 0)
      this.write(v, w)
      if (w.failed !== JSON_WRITE_FULL || size > JSON_VALUE_I32_MAX / 2) {
        return w.complete() && w.end <= toI32(buf.length) ? String.fromBytes(buf, 0, w.end) : ""
      }
      size = size * 2
    }
  }
}

/** `a[i]`, or `-1` when `i` is outside `a`. */
const jsonValueGet = (a: i32[], i: i32): i32 => (i >= 0 && i < toI32(a.length) ? a[i] : -1)

/** `a[i] = x`, growing `a` by one when `i` is its length; an `i` further out writes nothing. */
const jsonValuePut = (a: i32[], i: i32, x: i32): void => {
  if (i >= 0 && i < toI32(a.length)) {
    a[i] = x
  } else if (i === toI32(a.length)) {
    a.push(x)
  }
}

/**
 * `a` when it holds at least `n` elements, and otherwise a copy of it at
 * least twice as long, for the caller to keep in `a`'s place. Doubling is
 * what keeps a run of appends linear, and the old array is left in the arena.
 */
const jsonValueRoom = (a: u8[], n: i32): u8[] => {
  const have: i32 = toI32(a.length)
  if (n <= have) {
    return a
  }
  const grown: u8[] = new Array<u8>(n > have * 2 ? n : have * 2)
  grown.set(a, 0)
  return grown
}

/** `jsonValueRoom` for an `i32[]`. */
const jsonValueRoomI32 = (a: i32[], n: i32): i32[] => {
  const have: i32 = toI32(a.length)
  if (n <= have) {
    return a
  }
  const grown: i32[] = new Array<i32>(n > have * 2 ? n : have * 2)
  grown.set(a, 0)
  return grown
}

/** `bytes[a, a + an)` and `bytes[b, b + bn)` compared byte by byte, a shorter prefix first: negative, `0` or positive. */
const jsonValueCompareBytes = (bytes: u8[], a: i32, an: i32, b: i32, bn: i32): i32 => {
  const n: i32 = an < bn ? an : bn
  for (let i: i32 = 0; i < n; i += 1) {
    const x: i32 = a + i >= 0 && a + i < toI32(bytes.length) ? toI32(bytes[a + i]) : 0
    const y: i32 = b + i >= 0 && b + i < toI32(bytes.length) ? toI32(bytes[b + i]) : 0
    if (x !== y) {
      return x - y
    }
  }
  return an - bn
}
