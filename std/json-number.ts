/**
 * `nish/json-number` — JSON number text compared and divided exactly, the
 * arithmetic JSON Schema's `minimum`, `maximum`, `exclusiveMinimum`,
 * `exclusiveMaximum`, `multipleOf`, `const` and `enum` ask for.
 *
 *     import { jsonNumberCompare, jsonNumberMultipleOf } from "nish/json-number"
 *
 *     jsonNumberCompare("1.0", "1e0")                  // 0: the same value
 *     jsonNumberCompare("0.1", "0.10000000000000001")  // -1, which f64 calls equal
 *     jsonNumberMultipleOf("0.3", "0.1")               // 1, which f64 calls 0
 *     jsonNumberMultipleOf("1e1000000000", "2")        // JSON_NUMBER_ERR_GAP
 *
 * **Never through `f64`.** A number is read from its text as a sign, its
 * significant digits (leading and trailing zeros dropped) and the decimal
 * exponent of its last digit, and every answer is computed on those, so
 * `9007199254740993` is not `9007199254740992`, `0.1 * 3` is not involved in
 * whether `0.3` is a multiple of `0.1`, and `1e400` is a number like any
 * other rather than an infinity. The text is a JSON number, RFC 8259's
 * grammar exactly (what `JsonDocument.numberText` answers); anything else is
 * `JSON_NUMBER_ERR_SYNTAX`.
 *
 * **What a call costs.** `jsonNumberCompare` reads each text once and
 * allocates two records of a few fields, nothing in proportion to the text:
 * time is linear in the texts' lengths. `jsonNumberCanonical` allocates the
 * string it answers, at most the text's length plus an exponent.
 * `jsonNumberMultipleOf` divides the value's digits, followed by as many
 * zeros as its exponent is above the divisor's (the gap), by the divisor's
 * digits: one step per digit of that dividend when the divisor has at most 18
 * significant digits, and one per digit of the dividend per digit of the
 * divisor otherwise, which then also allocates the remainder, one byte per
 * divisor digit. A step of that long division is a shift, up to ten
 * comparisons and up to nine subtractions of a byte each, so about twenty
 * byte operations.
 *
 * **The bounds are stated.** An exponent is at most `JSON_NUMBER_MAX_EXPONENT`
 * in size, which keeps every exponent sum far inside `i64`, and past
 * it a text is `JSON_NUMBER_ERR_EXPONENT`, unless every digit is zero:
 * `0e9999999999999999` is zero. A division that would take more
 * than `JSON_NUMBER_MAX_STEPS` steps is `JSON_NUMBER_ERR_GAP` before it
 * starts: `1e1000000000` is 12 bytes, and whether it is a multiple of `3`
 * would otherwise be a billion steps, the cheap input and expensive answer an
 * attacker sends to a validator. A JSON Schema validator reports a refused
 * comparison as the instance failing, and says why.
 *
 * Every answer is an `i32`, so a program reads them the same under
 * `--number-mode f64`; a refusal is a `JSON_NUMBER_ERR_*` code, each below
 * `-1`, so that it is never one of `jsonNumberCompare`'s answers.
 */

/** The text is not a JSON number. */
export const JSON_NUMBER_ERR_SYNTAX: i32 = -10
/** The text's exponent is larger in size than `JSON_NUMBER_MAX_EXPONENT`. */
export const JSON_NUMBER_ERR_EXPONENT: i32 = -11
/** `jsonNumberMultipleOf` was asked about a divisor of zero. */
export const JSON_NUMBER_ERR_DIVISOR: i32 = -12
/** `jsonNumberMultipleOf` would take more than `JSON_NUMBER_MAX_STEPS` steps. */
export const JSON_NUMBER_ERR_GAP: i32 = -13

/** The largest exponent, in size, a text may write: 10^15, so a sum of two stays far inside `i64`. */
export const JSON_NUMBER_MAX_EXPONENT: i64 = 1000000000000000
/** The most digit steps one `jsonNumberMultipleOf` may take, 2^20 (the module header says what a step costs). */
export const JSON_NUMBER_MAX_STEPS: i64 = 1048576

/** The most divisor digits the `u64` remainder holds: 10^18 times ten, plus nine, is below 2^64. */
const JSON_NUMBER_SMALL_DIVISOR: i32 = 18

const JSON_NUMBER_PLUS: i32 = 43
const JSON_NUMBER_MINUS: i32 = 45
const JSON_NUMBER_DOT: i32 = 46
const JSON_NUMBER_DIGIT_0: i32 = 48
const JSON_NUMBER_DIGIT_9: i32 = 57
const JSON_NUMBER_UPPER_E: i32 = 69
const JSON_NUMBER_LOWER_E: i32 = 101

/** The byte at `i` of `s`, or `-1` past its end. */
const jsonNumberByte = (s: string, i: i32): i32 => (i < toI32(s.length) ? toI32(s.charCodeAt(i)) : -1)

const jsonNumberIsDigit = (c: i32): boolean => c >= JSON_NUMBER_DIGIT_0 && c <= JSON_NUMBER_DIGIT_9

/**
 * One number text read as a sign, significant digits and an exponent. The
 * digits are not copied: `digit(k)` reads the k-th of them from the text,
 * stepping over the point.
 */
class JsonNumberParts {
  text: string
  /** `0` when the text is a number, else a `JSON_NUMBER_ERR_*` code. */
  code: i32
  negative: boolean
  /** Whether every digit is zero, `-0` and `0.0e5` included. */
  zero: boolean
  /** Where the integer part's digits start, and how many there are. */
  intStart: i32
  intLen: i32
  /** Where the fraction's digits start, after the point, and how many there are. */
  fracStart: i32
  fracLen: i32
  /** The first significant digit's place among the integer and fraction digits run together. */
  first: i32
  /** How many significant digits there are, from the first non-zero one to the last. */
  count: i32
  /** The decimal exponent of the first significant digit: `3` for `1234`, `-2` for `0.05`. */
  lead: i64
  /** The decimal exponent of the last significant digit: `0` for `1234`, `2` for `1200`, `-2` for `0.05`. */
  last: i64

  constructor(text: string) {
    this.text = text
    this.code = 0
    this.negative = false
    this.zero = true
    this.intStart = 0
    this.intLen = 0
    this.fracStart = 0
    this.fracLen = 0
    this.first = 0
    this.count = 0
    this.lead = toI64(0)
    this.last = toI64(0)
    this.code = this.read()
  }

  /** The k-th significant digit, `0 <= k < count`, as `0` to `9`. */
  digit(k: i32): i32 {
    return this.placeDigit(this.first + k)
  }

  /** The digit at place `p` of the integer and fraction digits run together. */
  placeDigit(p: i32): i32 {
    const at: i32 = p < this.intLen ? this.intStart + p : this.fracStart + (p - this.intLen)
    return toI32(this.text.charCodeAt(at)) - JSON_NUMBER_DIGIT_0
  }

  /** Reads the text against RFC 8259's number grammar; answers `0` or a code. */
  read(): i32 {
    const s: string = this.text
    const n: i32 = toI32(s.length)
    let i: i32 = 0
    if (jsonNumberByte(s, i) === JSON_NUMBER_MINUS) {
      this.negative = true
      i += 1
    }
    this.intStart = i
    const lead: i32 = jsonNumberByte(s, i)
    if (!jsonNumberIsDigit(lead)) {
      return JSON_NUMBER_ERR_SYNTAX
    }
    i += 1
    if (lead !== JSON_NUMBER_DIGIT_0) {
      while (jsonNumberIsDigit(jsonNumberByte(s, i))) {
        i += 1
      }
    }
    this.intLen = i - this.intStart
    if (jsonNumberByte(s, i) === JSON_NUMBER_DOT) {
      i += 1
      this.fracStart = i
      while (jsonNumberIsDigit(jsonNumberByte(s, i))) {
        i += 1
      }
      this.fracLen = i - this.fracStart
      if (this.fracLen === 0) {
        return JSON_NUMBER_ERR_SYNTAX
      }
    }
    let exponent: i64 = toI64(0)
    // An exponent past the bound is refused only once the digits are known
    // not all to be zero: `0e9999999999` is zero, as any other zero is.
    let big: boolean = false
    const e: i32 = jsonNumberByte(s, i)
    if (e === JSON_NUMBER_LOWER_E || e === JSON_NUMBER_UPPER_E) {
      i += 1
      let minus: boolean = false
      const sign: i32 = jsonNumberByte(s, i)
      if (sign === JSON_NUMBER_PLUS || sign === JSON_NUMBER_MINUS) {
        minus = sign === JSON_NUMBER_MINUS
        i += 1
      }
      if (!jsonNumberIsDigit(jsonNumberByte(s, i))) {
        return JSON_NUMBER_ERR_SYNTAX
      }
      while (jsonNumberIsDigit(jsonNumberByte(s, i))) {
        // Adding stops past the bound, so a thousand-digit exponent neither
        // overflows nor is mistaken for a small one.
        if (!big) {
          exponent = exponent * toI64(10) + toI64(jsonNumberByte(s, i) - JSON_NUMBER_DIGIT_0)
          big = exponent > JSON_NUMBER_MAX_EXPONENT
        }
        i += 1
      }
      if (minus) {
        exponent = -exponent
      }
    }
    if (i !== n) {
      return JSON_NUMBER_ERR_SYNTAX
    }
    const places: i32 = this.intLen + this.fracLen
    let first: i32 = 0
    while (first < places && this.placeDigit(first) === 0) {
      first += 1
    }
    if (first === places) {
      return 0
    }
    if (big) {
      return JSON_NUMBER_ERR_EXPONENT
    }
    let last: i32 = places - 1
    while (this.placeDigit(last) === 0) {
      last -= 1
    }
    this.zero = false
    this.first = first
    this.count = last - first + 1
    this.lead = exponent + toI64(this.intLen - 1 - first)
    this.last = exponent + toI64(this.intLen - 1 - last)
    return 0
  }
}

/** `-1`, `0` or `1` as `a`'s size is below, equal to or above `b`'s, signs aside. */
const jsonNumberCompareSize = (a: JsonNumberParts, b: JsonNumberParts): i32 => {
  if (a.lead !== b.lead) {
    return a.lead < b.lead ? -1 : 1
  }
  const n: i32 = a.count > b.count ? a.count : b.count
  for (let k: i32 = 0; k < n; k++) {
    const x: i32 = k < a.count ? a.digit(k) : 0
    const y: i32 = k < b.count ? b.digit(k) : 0
    if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

/** The sign of `p`: `0` for zero, else `-1` or `1`. */
const jsonNumberSign = (p: JsonNumberParts): i32 => {
  if (p.zero) {
    return 0
  }
  return p.negative ? -1 : 1
}

/**
 * `-1`, `0` or `1` as the value of the JSON number text `a` is below, equal
 * to or above that of `b`, exactly: `1`, `1.0`, `1e0` and `10e-1` are equal,
 * and `-0` equals `0`. A text that is not a number, or whose exponent is past
 * `JSON_NUMBER_MAX_EXPONENT`, is that `JSON_NUMBER_ERR_*` code, `a`'s first.
 * Linear in the two lengths; allocates two small records.
 */
export const jsonNumberCompare = (a: string, b: string): i32 => {
  const x = new JsonNumberParts(a)
  if (x.code !== 0) {
    return x.code
  }
  const y = new JsonNumberParts(b)
  if (y.code !== 0) {
    return y.code
  }
  const sx: i32 = jsonNumberSign(x)
  const sy: i32 = jsonNumberSign(y)
  if (sx !== sy) {
    return sx < sy ? -1 : 1
  }
  if (sx === 0) {
    return 0
  }
  const size: i32 = jsonNumberCompareSize(x, y)
  return sx > 0 ? size : -size
}

/**
 * The one text every spelling of a number's value has: `0` for zero (`-0`
 * too), else an optional `-`, the significant digits, `e` and the exponent of
 * the last digit, so `1.50`, `15e-1` and `0.015e2` are all `15e-1`, and `100`
 * is `1e2`. Two texts have the same canonical text exactly when
 * `jsonNumberCompare` calls them equal, which makes it a key for a set or a
 * hash. `""` for a text that is not a number or whose exponent is past
 * `JSON_NUMBER_MAX_EXPONENT`. Allocates the answer.
 */
export const jsonNumberCanonical = (text: string): string => {
  const p = new JsonNumberParts(text)
  if (p.code !== 0) {
    return ""
  }
  if (p.zero) {
    return "0"
  }
  const bytes: u8[] = []
  if (p.negative) {
    bytes.push(toU8(JSON_NUMBER_MINUS))
  }
  for (let k: i32 = 0; k < p.count; k++) {
    bytes.push(toU8(p.digit(k) + JSON_NUMBER_DIGIT_0))
  }
  const digits: string = String.fromBytes(bytes, 0, toI32(bytes.length))
  return `${digits}e${p.last}`
}

/**
 * Whether the low digits of the remainder, `rem[1, n]`, most significant
 * first, are at least the divisor's `n` digits.
 */
const jsonNumberAtLeast = (rem: u8[], d: JsonNumberParts): boolean => {
  for (let k: i32 = 1; k < toI32(rem.length); k++) {
    const x: i32 = toI32(rem[k])
    const y: i32 = d.digit(k - 1)
    if (x !== y) {
      return x > y
    }
  }
  return true
}

/**
 * Whether the dividend (the value's digits, then zeros to `total` digits)
 * leaves no remainder divided by the divisor's digits, more than 18 of them.
 * The remainder is one decimal digit per byte, one byte more than the divisor
 * has; each step shifts a digit in and takes the divisor away at most nine
 * times.
 */
const jsonNumberDividesLong = (v: JsonNumberParts, d: JsonNumberParts, total: i64): boolean => {
  const n: i32 = d.count
  const rem: u8[] = []
  for (let k: i32 = 0; k <= n; k++) {
    rem.push(0)
  }
  for (let step: i64 = toI64(0); step < total; step++) {
    // The remainder is below the divisor, so its top byte is zero and the
    // shift loses nothing.
    for (let k: i32 = 0; k + 1 < toI32(rem.length); k++) {
      rem[k] = rem[k + 1]
    }
    let next: i32 = 0
    if (step < toI64(v.count)) {
      next = v.digit(toI32(step))
    }
    rem[toI32(rem.length) - 1] = toU8(next)
    // Below ten divisors now: a non-zero top byte is n + 1 digits against n,
    // so certainly at least the divisor; otherwise the low n digits decide.
    while (rem[0] > 0 || jsonNumberAtLeast(rem, d)) {
      let borrow: i32 = 0
      for (let k: i32 = toI32(rem.length) - 1; k >= 1; k--) {
        let x: i32 = toI32(rem[k]) - d.digit(k - 1) - borrow
        borrow = 0
        if (x < 0) {
          x += 10
          borrow = 1
        }
        rem[k] = toU8(x)
      }
      rem[0] = toU8(toI32(rem[0]) - borrow)
    }
  }
  for (let k: i32 = 0; k < toI32(rem.length); k++) {
    if (rem[k] !== 0) {
      return false
    }
  }
  return true
}

/**
 * The same for a divisor of at most 18 digits, whose remainder fits a `u64`
 * with a digit shifted in: one multiply and one remainder per step.
 */
const jsonNumberDividesShort = (v: JsonNumberParts, d: JsonNumberParts, total: i64): boolean => {
  let divisor: u64 = toU64(0)
  for (let k: i32 = 0; k < d.count; k++) {
    divisor = divisor * toU64(10) + toU64(d.digit(k))
  }
  let rem: u64 = toU64(0)
  for (let step: i64 = toI64(0); step < total; step++) {
    const digit: u64 = step < toI64(v.count) ? toU64(v.digit(toI32(step))) : toU64(0)
    rem = (rem * toU64(10) + digit) % divisor
  }
  return rem === toU64(0)
}

/**
 * `1` when the value of the JSON number text `value` is a whole multiple of
 * that of `divisor`, exactly, else `0`: `0.3` is a multiple of `0.1` and
 * `0.0075` of `0.0001`, `4.5` is not one of `2`, and zero is one of anything.
 * Signs are ignored. JSON Schema's `multipleOf` is `1` here.
 *
 * Refused, each with its `JSON_NUMBER_ERR_*` code: a text that is not a
 * number or whose exponent is past `JSON_NUMBER_MAX_EXPONENT` (`value`'s
 * first), a `divisor` of zero, and a division of more than
 * `JSON_NUMBER_MAX_STEPS` steps, which is `JSON_NUMBER_ERR_GAP`: the value's
 * digits plus the gap between the two last digits' exponents, times the
 * divisor's digits when it has more than 18.
 */
export const jsonNumberMultipleOf = (value: string, divisor: string): i32 => {
  const v = new JsonNumberParts(value)
  if (v.code !== 0) {
    return v.code
  }
  const d = new JsonNumberParts(divisor)
  if (d.code !== 0) {
    return d.code
  }
  if (d.zero) {
    return JSON_NUMBER_ERR_DIVISOR
  }
  if (v.zero) {
    return 1
  }
  // value = V * 10^v.last and divisor = D * 10^d.last, neither V nor D ending
  // in a zero. A value whose last digit is finer than the divisor's would need
  // D * 10^k to divide V for some k above zero, and then ten would divide V.
  const gap: i64 = v.last - d.last
  if (gap < toI64(0)) {
    return 0
  }
  const total: i64 = toI64(v.count) + gap
  const short: boolean = d.count <= JSON_NUMBER_SMALL_DIVISOR
  // A module constant is a plain number under Node, where an `i64` is a
  // BigInt: comparing the two is allowed, dividing them is not.
  if (total > (short ? JSON_NUMBER_MAX_STEPS : toI64(JSON_NUMBER_MAX_STEPS) / toI64(d.count))) {
    return JSON_NUMBER_ERR_GAP
  }
  if (short) {
    return jsonNumberDividesShort(v, d, total) ? 1 : 0
  }
  return jsonNumberDividesLong(v, d, total) ? 1 : 0
}
