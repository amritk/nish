/**
 * `nish/json-equal` — whether two JSON values are equal by JSON Schema's
 * rule, a canonical text and a hash that agree with it, and the first
 * repeated element of an array, which is what `const`, `enum` and
 * `uniqueItems` ask.
 *
 *     import { jsonEqual, jsonEqualFirstDuplicate } from "nish/json-equal"
 *
 *     const doc = new JsonDocument(new JsonLimits())
 *     const a = doc.parseText('[{"x":1,"y":[true]},{"y":[true],"x":1.0}]')
 *     jsonEqual(doc, doc.at(a, 0), doc, doc.at(a, 1))   // true
 *     jsonEqualFirstDuplicate(doc, a)                    // 1
 *
 * **The rule.** Two values are equal when they are the same kind and: two
 * numbers have the same mathematical value (`1`, `1.0` and `1e0` are equal;
 * `nish/json-number` decides, never through `f64`), two strings have the
 * same bytes, two booleans the same value, two arrays the same length and
 * equal elements in order, and two objects the same keys with equal values,
 * in whatever order the members are written. `null` equals only `null`, and
 * `true` is not `1`. A number whose exponent is past
 * `JSON_NUMBER_MAX_EXPONENT` cannot be read exactly, and equals only a number
 * written with the same text.
 *
 * **No depth limit.** Every walk keeps its own stack in an array, so a tree
 * built with `push` and `set` deeper than any parser allows compares as well
 * as a flat one, and nothing recurses.
 *
 * **What a call costs.** `jsonEqual` stops at the first difference. Up to
 * there it is linear in the values' size, except that each pair of objects
 * reads every key (one string each) and sorts them, `n log n` for `n`
 * members; it also allocates one string per string value, its stack, and
 * whatever `jsonNumberCompare` allocates per number pair. `jsonEqualCanonical`
 * builds the canonical bytes, about the size of the value written as JSON,
 * and sorts keys the same way. `jsonEqualHash` is FNV-1a of those bytes.
 * `jsonEqualFirstDuplicate` makes the canonical text of every element up to
 * the first repeat and keeps them in a `Map`.
 *
 * **The hash is not keyed.** FNV-1a (public domain) is the same in every
 * process, so an attacker can make many values that share a hash, and a
 * table keyed by `jsonEqualHash` alone degrades to a list. It is for a
 * filter or a fingerprint; `jsonEqualFirstDuplicate` keys its `Map` by the
 * canonical text, which the `Map`'s own keyed hash spreads.
 */

import { jsonNumberCanonical, jsonNumberCompare } from "nish/json-number"
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_NONE,
  JSON_VALUE_NULL,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JSON_VALUE_STRING,
  JsonDocument,
  JsonValue,
} from "nish/json-value"

/** On the canonical walk's stack, in place of a value: write the next key on the key stack. */
const JSON_EQUAL_KEY_TASK: i32 = -1

/** Whether `a`'s bytes sort before `b`'s, byte by byte and a prefix first. */
const jsonEqualBefore = (a: string, b: string): boolean => {
  for (let k: i32 = 0; k < toI32(a.length) && k < toI32(b.length); k++) {
    const x: i32 = toI32(a.charCodeAt(k))
    const y: i32 = toI32(b.charCodeAt(k))
    if (x !== y) {
      return x < y
    }
  }
  return toI32(a.length) < toI32(b.length)
}

// Guarded reads and writes for indexes that stay inside their arrays by the
// algorithm's reasoning rather than by a test the compiler can see.

/** `a[i]`, or `0` outside `a`. */
const jsonEqualAt = (a: i32[], i: i32): i32 => (i >= 0 && i < toI32(a.length) ? a[i] : 0)

/** `keys[i]`, or `""` outside `keys`. */
const jsonEqualKeyAt = (keys: string[], i: i32): string => (i >= 0 && i < toI32(keys.length) ? keys[i] : "")

/** `a[i] = x`, nothing outside `a`. */
const jsonEqualSetAt = (a: i32[], i: i32, x: i32): void => {
  if (i >= 0 && i < toI32(a.length)) {
    a[i] = x
  }
}

/**
 * The member positions of object `v` ordered by key bytes, with every key put
 * in `keys` by its position. A bottom-up merge sort: `n log n` comparisons and
 * no recursion. Keys in one object are distinct, so the order is total.
 */
const jsonEqualSortedMembers = (doc: JsonDocument, v: JsonValue, keys: string[]): i32[] => {
  const n: i32 = doc.length(v)
  let order: i32[] = []
  let spare: i32[] = []
  for (let i: i32 = 0; i < n; i++) {
    keys.push(doc.keyAt(v, i))
    order.push(i)
    spare.push(i)
  }
  // A document holds at most 2^22 values, so the widths below never come
  // near overflowing.
  let width: i32 = 1
  while (width < n) {
    let lo: i32 = 0
    while (lo < n) {
      const mid: i32 = lo + width < n ? lo + width : n
      const hi: i32 = mid + width < n ? mid + width : n
      let i: i32 = lo
      let j: i32 = mid
      for (let k: i32 = lo; k < hi; k++) {
        const left: i32 = jsonEqualAt(order, i)
        const right: i32 = jsonEqualAt(order, j)
        const takeLeft: boolean =
          i < mid && (j >= hi || !jsonEqualBefore(jsonEqualKeyAt(keys, right), jsonEqualKeyAt(keys, left)))
        jsonEqualSetAt(spare, k, takeLeft ? left : right)
        if (takeLeft) {
          i += 1
        } else {
          j += 1
        }
      }
      lo = hi
    }
    const done: i32[] = spare
    spare = order
    order = done
    width = width * 2
  }
  return order
}

/** Whether two number texts are equal by value, or by text when either is past the exponent bound. */
const jsonEqualNumbers = (a: string, b: string): boolean => {
  const c: i32 = jsonNumberCompare(a, b)
  return c < -1 ? a === b : c === 0
}

/**
 * Whether value `a` of document `da` equals value `b` of document `db` by
 * JSON Schema's rule (the module header): numbers by value, objects whatever
 * their member order. The two may be one document. `false` when either
 * handle names no value. Iterative, so any depth compares.
 */
export const jsonEqual = (da: JsonDocument, a: JsonValue, db: JsonDocument, b: JsonValue): boolean => {
  const left: JsonValue[] = [a]
  const right: JsonValue[] = [b]
  while (left.length > 0) {
    const x: JsonValue = jsonEqualAt(left, toI32(left.length) - 1)
    const y: JsonValue = jsonEqualAt(right, toI32(right.length) - 1)
    left.pop()
    right.pop()
    const kind: i32 = da.kind(x)
    if (kind === JSON_VALUE_NONE || kind !== db.kind(y)) {
      return false
    }
    if (kind === JSON_VALUE_BOOLEAN) {
      if (da.boolean(x) !== db.boolean(y)) {
        return false
      }
    } else if (kind === JSON_VALUE_NUMBER) {
      if (!jsonEqualNumbers(da.numberText(x), db.numberText(y))) {
        return false
      }
    } else if (kind === JSON_VALUE_STRING) {
      if (!db.stringEquals(y, da.string(x))) {
        return false
      }
    } else if (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) {
      const n: i32 = da.length(x)
      if (n !== db.length(y)) {
        return false
      }
      if (kind === JSON_VALUE_ARRAY) {
        for (let i: i32 = 0; i < n; i++) {
          left.push(da.at(x, i))
          right.push(db.at(y, i))
        }
      } else {
        const keysX: string[] = []
        const keysY: string[] = []
        const orderX: i32[] = jsonEqualSortedMembers(da, x, keysX)
        const orderY: i32[] = jsonEqualSortedMembers(db, y, keysY)
        for (let i: i32 = 0; i < n; i++) {
          const mx: i32 = jsonEqualAt(orderX, i)
          const my: i32 = jsonEqualAt(orderY, i)
          if (jsonEqualKeyAt(keysX, mx) !== jsonEqualKeyAt(keysY, my)) {
            return false
          }
          left.push(da.at(x, mx))
          right.push(db.at(y, my))
        }
      }
    }
  }
  return true
}

/** Appends `s`'s bytes to `out`. */
const jsonEqualPut = (out: u8[], s: string): void => {
  for (let i: i32 = 0; i < toI32(s.length); i++) {
    out.push(toU8(s.charCodeAt(i)))
  }
}

/** Appends `s` as the canonical form writes a string or a key: its length, `:`, its bytes. */
const jsonEqualPutText = (out: u8[], s: string): void => {
  jsonEqualPut(out, `${toI32(s.length)}:`)
  jsonEqualPut(out, s)
}

/**
 * Appends number `x`'s canonical form. Past the exponent bound a number is its
 * own text, tagged apart so that it never meets a canonical one, which is
 * `jsonEqual`'s fallback too. A function of its own so that the texts it makes
 * are released when it returns rather than at the end of the walk.
 */
const jsonEqualPutNumber = (out: u8[], doc: JsonDocument, x: JsonValue): void => {
  const text: string = doc.numberText(x)
  const canonical: string = jsonNumberCanonical(text)
  jsonEqualPut(out, canonical === "" ? `x${text};` : `n${canonical};`)
}

/** The canonical bytes of value `v` (`jsonEqualCanonical`), or none for a handle that names no value. */
const jsonEqualCanonicalBytes = (doc: JsonDocument, v: JsonValue): u8[] => {
  const out: u8[] = []
  if (doc.kind(v) === JSON_VALUE_NONE) {
    return out
  }
  const tasks: JsonValue[] = [v]
  const keyStack: string[] = []
  while (tasks.length > 0) {
    const x: JsonValue = jsonEqualAt(tasks, toI32(tasks.length) - 1)
    tasks.pop()
    if (x === JSON_EQUAL_KEY_TASK) {
      jsonEqualPutText(out, jsonEqualKeyAt(keyStack, toI32(keyStack.length) - 1))
      keyStack.pop()
      continue
    }
    const kind: i32 = doc.kind(x)
    if (kind === JSON_VALUE_NULL) {
      jsonEqualPut(out, "z")
    } else if (kind === JSON_VALUE_BOOLEAN) {
      jsonEqualPut(out, doc.boolean(x) ? "t" : "f")
    } else if (kind === JSON_VALUE_NUMBER) {
      jsonEqualPutNumber(out, doc, x)
    } else if (kind === JSON_VALUE_STRING) {
      jsonEqualPut(out, "s")
      jsonEqualPutText(out, doc.string(x))
    } else if (kind === JSON_VALUE_ARRAY) {
      const n: i32 = doc.length(x)
      jsonEqualPut(out, `a${n}:`)
      for (let i: i32 = n - 1; i >= 0; i--) {
        tasks.push(doc.at(x, i))
      }
    } else {
      const n: i32 = doc.length(x)
      jsonEqualPut(out, `o${n}:`)
      const keys: string[] = []
      const order: i32[] = jsonEqualSortedMembers(doc, x, keys)
      // Pushed last member first, each value before its key, so the key pops first.
      for (let i: i32 = n - 1; i >= 0; i--) {
        const m: i32 = jsonEqualAt(order, i)
        tasks.push(doc.at(x, m))
        tasks.push(JSON_EQUAL_KEY_TASK)
        keyStack.push(jsonEqualKeyAt(keys, m))
      }
    }
  }
  return out
}

/**
 * The canonical text of value `v`: the same text for exactly the values
 * `jsonEqual` calls equal, so it is a key for a `Map` or `Set` of values. It
 * is not JSON: each value is a tag and what it holds, `z`, `t` and `f` for
 * null, true and false, `n` and a `jsonNumberCanonical` text and `;` for a
 * number, `s`, a byte length, `:` and the bytes for a string, `a` and a count
 * and `:` before an array's elements, and `o` and a count and `:` before an
 * object's members in key-byte order, each key a length, `:` and its bytes.
 * `""` for a handle that names no value.
 */
export const jsonEqualCanonical = (doc: JsonDocument, v: JsonValue): string => {
  const bytes: u8[] = jsonEqualCanonicalBytes(doc, v)
  return String.fromBytes(bytes, 0, toI32(bytes.length))
}

/**
 * A 64-bit hash of value `v` that agrees with `jsonEqual`: equal values hash
 * the same. FNV-1a of the canonical bytes, unkeyed (the module header says
 * what that means for a table). The offset basis for a handle that names no
 * value.
 */
export const jsonEqualHash = (doc: JsonDocument, v: JsonValue): u64 => {
  const bytes: u8[] = jsonEqualCanonicalBytes(doc, v)
  // FNV-1a's 64-bit prime and offset basis (0xcbf29ce484222325, past what a
  // literal writes exactly), public domain. A module constant cannot be a
  // `u64`, so they are made here.
  const prime: u64 = 1099511628211
  const high: u64 = 3421674724
  const low: u64 = 2216829733
  let h: u64 = (high << 32) | low
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    h = (h ^ toU64(bytes[i])) * prime
  }
  return h
}

/**
 * The position of the first element of array `v` equal (`jsonEqual`) to an
 * earlier one, or `-1` when every element is distinct or `v` is not an array:
 * JSON Schema's `uniqueItems` holds exactly when this is `-1`. Linear in the
 * elements read, through a `Map` of their canonical texts.
 */
export const jsonEqualFirstDuplicate = (doc: JsonDocument, v: JsonValue): i32 => {
  if (doc.kind(v) !== JSON_VALUE_ARRAY) {
    return -1
  }
  const seen = new Map<string, i32>()
  const n: i32 = doc.length(v)
  for (let i: i32 = 0; i < n; i++) {
    const text: string = jsonEqualCanonical(doc, doc.at(v, i))
    if (seen.has(text)) {
      return i
    }
    seen.set(text, i)
  }
  return -1
}
