/**
 * `nish/json-pointer` — RFC 6901 JSON Pointers: parsed into their tokens,
 * escaped, resolved against a `JsonDocument`, and checked, with JSON Schema's
 * relative JSON Pointer beside them.
 *
 *     import { jsonPointerParse, jsonPointerResolve, isRelativeJsonPointer } from "nish/json-pointer"
 *
 *     const doc = new JsonDocument(new JsonLimits())
 *     const root = doc.parseText('{"a/b":[10,20],"~":true}')
 *     jsonPointerParse("/a~1b/1")                 // ["a/b", "1"]
 *     doc.i64(jsonPointerResolve(doc, root, "/a~1b/1"))   // 20
 *     jsonPointerResolve(doc, root, "/a~1b/-")    // JSON_POINTER_NONE
 *     jsonPointerResolve(doc, root, "a")          // JSON_POINTER_ERR_SYNTAX
 *     isRelativeJsonPointer("1/a~1b")             // true
 *
 * **The grammar.** A pointer is empty, naming the whole document, or a run
 * of `/`-led tokens, each any bytes but `/`, with `~0` for `~` and `~1` for
 * `/` and no other `~`. A token names an object's member by its key, bytes
 * for bytes, and an array's element by an index written `0` or without a
 * leading zero; `-`, the place after the last element, names nothing, as
 * does an index past the end, a token on a scalar, and a key not there. The
 * pointer is the decoded string, not a URI fragment: `#/a` is not one.
 *
 * A relative JSON Pointer (draft-handrews-relative-json-pointer-01, which
 * JSON Schema 2020-12's `relative-json-pointer` format names) is a
 * non-negative integer written without a leading zero, then either `#` or a
 * JSON Pointer. Only its form is checked here: resolving one needs the
 * place it is relative to, which a validator walking an instance holds.
 *
 * **What a call costs.** `isJsonPointer` and `isRelativeJsonPointer` read
 * the text once and allocate nothing. `jsonPointerParse` allocates each
 * token and the array. `jsonPointerResolve` reads the pointer once and
 * allocates each token it decodes; a member is found by `JsonDocument.get`,
 * which steps through the object's members, so a step costs the object's
 * size.
 */

import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_NONE,
  JSON_VALUE_OBJECT,
  JsonDocument,
  JsonValue,
} from "nish/json-value"

/** `jsonPointerResolve`: the pointer is well formed and names nothing in the document. */
export const JSON_POINTER_NONE: i32 = -1
/** `jsonPointerResolve`: the text is not a JSON Pointer. */
export const JSON_POINTER_ERR_SYNTAX: i32 = -2

const JSON_POINTER_HASH: i32 = 35
const JSON_POINTER_SLASH: i32 = 47
const JSON_POINTER_DIGIT_0: i32 = 48
const JSON_POINTER_DIGIT_1: i32 = 49
const JSON_POINTER_DIGIT_9: i32 = 57
const JSON_POINTER_TILDE: i32 = 126

/** The byte at `i` of `s`, or `-1` past its end. */
const jsonPointerByte = (s: string, i: i32): i32 =>
  i >= 0 && i < toI32(s.length) ? toI32(s.charCodeAt(i)) : -1

/**
 * Whether `s[from, end)` is a JSON Pointer: empty, or `/` and then tokens in
 * which every `~` is followed by `0` or `1`.
 */
const jsonPointerWellFormed = (s: string, from: i32): boolean => {
  const n: i32 = toI32(s.length)
  if (from < n && jsonPointerByte(s, from) !== JSON_POINTER_SLASH) {
    return false
  }
  for (let i: i32 = from; i < n; i++) {
    if (jsonPointerByte(s, i) === JSON_POINTER_TILDE) {
      const next: i32 = jsonPointerByte(s, i + 1)
      if (next !== JSON_POINTER_DIGIT_0 && next !== JSON_POINTER_DIGIT_1) {
        return false
      }
    }
  }
  return true
}

/** Whether `s` is an RFC 6901 JSON Pointer (the module header's grammar). Allocates nothing. */
export const isJsonPointer = (s: string): boolean => jsonPointerWellFormed(s, 0)

/**
 * Whether `s` is a relative JSON Pointer: a non-negative integer with no
 * leading zero (`0`, `12`, not `01`, `+1` or `-1`), then nothing, `#`, or a
 * JSON Pointer that is not empty. Allocates nothing.
 */
export const isRelativeJsonPointer = (s: string): boolean => {
  const first: i32 = jsonPointerByte(s, 0)
  if (first < JSON_POINTER_DIGIT_0 || first > JSON_POINTER_DIGIT_9) {
    return false
  }
  let i: i32 = 1
  if (first !== JSON_POINTER_DIGIT_0) {
    while (jsonPointerByte(s, i) >= JSON_POINTER_DIGIT_0 && jsonPointerByte(s, i) <= JSON_POINTER_DIGIT_9) {
      i += 1
    }
  }
  if (jsonPointerByte(s, i) === JSON_POINTER_HASH) {
    return i + 1 === toI32(s.length)
  }
  return jsonPointerWellFormed(s, i)
}

/** The token of well-formed pointer `p` that starts at `from` and ends before `end`, with `~1` and `~0` decoded. */
const jsonPointerToken = (p: string, from: i32, end: i32): string => {
  const bytes: u8[] = []
  let i: i32 = from
  while (i < end) {
    const c: i32 = jsonPointerByte(p, i)
    if (c === JSON_POINTER_TILDE) {
      bytes.push(
        toU8(jsonPointerByte(p, i + 1) === JSON_POINTER_DIGIT_1 ? JSON_POINTER_SLASH : JSON_POINTER_TILDE)
      )
      i += 2
    } else {
      bytes.push(toU8(c))
      i += 1
    }
  }
  return String.fromBytes(bytes, 0, toI32(bytes.length))
}

/** Where the token that starts at `from` of pointer `p` ends: the next `/`, or the end. */
const jsonPointerTokenEnd = (p: string, from: i32): i32 => {
  let i: i32 = from
  while (i < toI32(p.length) && jsonPointerByte(p, i) !== JSON_POINTER_SLASH) {
    i += 1
  }
  return i
}

/**
 * The reference tokens of JSON Pointer `p`, decoded: `[]` for `""`,
 * `["a/b", "", "~"]` for `/a~1b//~0`. `null` when `p` is not a JSON Pointer.
 */
export const jsonPointerParse = (p: string): string[] | null => {
  if (!isJsonPointer(p)) {
    return null
  }
  const tokens: string[] = []
  let i: i32 = 0
  while (i < toI32(p.length)) {
    const end: i32 = jsonPointerTokenEnd(p, i + 1)
    tokens.push(jsonPointerToken(p, i + 1, end))
    i = end
  }
  return tokens
}

/** `token` written as one token of a JSON Pointer: `~` as `~0` and `/` as `~1`, so `"a/b"` is `a~1b`. */
export const jsonPointerEscape = (token: string): string => {
  const bytes: u8[] = []
  for (let i: i32 = 0; i < toI32(token.length); i++) {
    const c: i32 = toI32(token.charCodeAt(i))
    if (c === JSON_POINTER_TILDE || c === JSON_POINTER_SLASH) {
      bytes.push(toU8(JSON_POINTER_TILDE))
      bytes.push(toU8(c === JSON_POINTER_TILDE ? JSON_POINTER_DIGIT_0 : JSON_POINTER_DIGIT_1))
    } else {
      bytes.push(toU8(c))
    }
  }
  return String.fromBytes(bytes, 0, toI32(bytes.length))
}

/**
 * The element an array token names in an array of `length` elements: its
 * index, or `-1` for `-`, a leading zero, anything but digits, or an index at
 * or past the end. Digits stop counting once they pass `length`, so a token
 * of any length is read without overflow.
 */
const jsonPointerIndex = (p: string, from: i32, end: i32, length: i32): i32 => {
  if (from === end || (end - from > 1 && jsonPointerByte(p, from) === JSON_POINTER_DIGIT_0)) {
    return -1
  }
  let value: i32 = 0
  for (let i: i32 = from; i < end; i++) {
    const c: i32 = jsonPointerByte(p, i)
    if (c < JSON_POINTER_DIGIT_0 || c > JSON_POINTER_DIGIT_9) {
      return -1
    }
    value = value * 10 + (c - JSON_POINTER_DIGIT_0)
    if (value >= length) {
      return -1
    }
  }
  return value
}

/**
 * The value JSON Pointer `p` names in `root` of `doc`: `root` itself for
 * `""`, else each token taken in turn, as the module header says.
 * `JSON_POINTER_NONE` when the pointer names nothing there (or `root` names
 * no value), and `JSON_POINTER_ERR_SYNTAX` when `p` is not a JSON Pointer.
 */
export const jsonPointerResolve = (doc: JsonDocument, root: JsonValue, p: string): JsonValue => {
  if (!isJsonPointer(p)) {
    return JSON_POINTER_ERR_SYNTAX
  }
  let at: JsonValue = root
  let i: i32 = 0
  while (doc.kind(at) !== JSON_VALUE_NONE && i < toI32(p.length)) {
    const end: i32 = jsonPointerTokenEnd(p, i + 1)
    const kind: i32 = doc.kind(at)
    if (kind === JSON_VALUE_OBJECT) {
      at = doc.get(at, jsonPointerToken(p, i + 1, end))
    } else if (kind === JSON_VALUE_ARRAY) {
      // `-` is a single byte that is not a digit, so `jsonPointerIndex` answers `-1` for it.
      const index: i32 = jsonPointerIndex(p, i + 1, end, doc.length(at))
      at = index < 0 ? JSON_POINTER_NONE : doc.at(at, index)
    } else {
      at = JSON_POINTER_NONE
    }
    i = end
  }
  return doc.kind(at) === JSON_VALUE_NONE ? JSON_POINTER_NONE : at
}
