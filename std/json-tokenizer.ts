/**
 * `nish/json-tokenizer` — a validating, streaming tokenizer for RFC 8259 JSON
 * held in a window of a `u8[]`.
 *
 * `std/json`'s `jsonField` reads one field of one flat object and validates
 * nothing. A server that takes JSON from a peer needs the opposite: every byte
 * checked against the grammar, nothing allocated per request, and a hard limit
 * on everything an attacker controls. That is this module.
 *
 *     import { JsonLimits, JsonTokenizer, JSON_TOK_END, JSON_TOK_KEY } from "nish/json-tokenizer";
 *
 *     const t = new JsonTokenizer(body, 0, toI32(body.length), new JsonLimits());
 *     let k: i32 = t.next();
 *     while (k > 0) {
 *       if (k === JSON_TOK_KEY && t.keyEquals("message")) {
 *         // t.next() is the value; t.stringInto(out, 0) copies it out
 *       }
 *       k = t.next();
 *     }
 *     // k === JSON_TOK_END: the window held one whole, valid JSON text
 *     // k < 0: a JSON_TOK_ERR_* code, also in t.failed, at byte t.errorAt
 *
 * **One token per `next()`.** It answers a `JSON_TOK_*` kind — an object or
 * array opening or closing, a key, a string, a number, `true`, `false` or
 * `null` — then `JSON_TOK_END` once the top-level value is complete and only
 * blanks follow it, and `JSON_TOK_END` again on every later call.
 * `tokStart` and `tokEnd` bound the token's bytes in the source (a string's
 * include its quotes), and `depth` is the number of containers open after it.
 * Structure is checked as the tokens go by: a comma or colon out of place, a
 * closer that does not match its opener, a second top-level value, or anything
 * but blanks after the first, is an error at the byte where it stands.
 *
 * **Errors are sticky.** The first error sets `failed` to a negative
 * `JSON_TOK_ERR_*` code and `errorAt` to the byte offset it was found at, and
 * every later `next()` answers the same code without reading anything, as
 * `nish/net/hpack`'s decoder does. Nothing an input can hold panics, and no
 * byte outside `src[off, off + len)` is ever read. `reset` starts over on a new
 * window with the same limits and the same depth stack, so a server holds one
 * tokenizer per connection and allocates nothing per request.
 *
 * **Strings are checked as UTF-8 and decoded on request.** A string may hold
 * any well-formed UTF-8 (RFC 3629: no overlong form, no surrogate code point,
 * nothing past U+10FFFF, no sequence cut short), no raw byte below 0x20, and
 * the escapes of RFC 8259 §7. A `\u` escape of a high surrogate must be
 * followed at once by one of a low surrogate, and a low surrogate must follow
 * a high one: a lone surrogate escape is an error. RFC 8259 allows one, but it
 * names no Unicode character, decodes to no valid UTF-8, and is what a peer
 * smuggles past a check done on the decoded bytes, so this module takes the
 * stricter reading (`docs/security/json.md`, "Lone surrogates"). Nothing is decoded until
 * the caller asks: `stringInto` writes the decoded bytes of the current key
 * or string into the caller's array, and `keyEquals` compares them with a
 * string without writing them anywhere.
 *
 * **Numbers are checked against the grammar and parsed on request.**
 * `numberF64` is correctly rounded: a number of at most 15 significant digits
 * whose decimal exponent is within ±22 is one exact multiply or divide of two
 * exact doubles (Clinger's fast path), and any other goes to the runtime's
 * `parseFloat`, which is `strtod`, from a function whose own arena scope
 * releases the copy it reads, so it leaves the arena where it was. `isInteger` and `numberI64` read a number
 * written without a fraction or an exponent that fits in an `i64`, and
 * `isU64` and `numberU64` one written without a sign either that fits in a
 * `u64`. Those go by spelling; `isIntegral` asks whether the value is whole,
 * however it is written (`1.0`, `1e2`), from the text and at any size.
 *
 * **Runs are read in bulk.** A string's plain bytes, the blanks between
 * tokens and a number's digits are each stepped over by a loop that reads
 * `src` directly, bounded by the window's end (or a string's or number's
 * limit, which is never past it) and by the array's length, so a run stops
 * exactly where a read through `jsonTokByteAt` would have answered `-1`.
 * The readers of a number already scanned, and `stringInto`'s copy of a
 * string with no escape, read `src` the same way; every other byte goes
 * through `jsonTokByteAt`.
 *
 * **Duplicate keys are tokens.** `{"a":1,"a":2}` is two keys; which one wins,
 * or whether a duplicate is an error, is the decision of whatever reads the
 * tokens (`docs/security/json.md`, JSON-3).
 *
 * **The limits** are `JsonLimits`: nesting depth, bytes in one string, bytes
 * in one number and bytes in the whole window. Each has its own error code and
 * a default sized for a request body, and each is checked before the work it
 * bounds, so a depth bomb costs one byte of stack per level allowed and an
 * over-long string is refused at the first byte past the limit.
 *
 * Every name here is `json`-prefixed, because a `std/` module is compiled into
 * the program that imports it and the symbol namespace is flat
 * (`std/README.md`). Every offset is a byte offset, and every constant is an
 * `i32`, so the module is the same under `--number-mode f64`
 * (`docs/wp26-stdlib.md` §4). Written from RFC 8259 and RFC 3629, not ported
 * from another implementation.
 */

/** The top-level value is complete and only blanks follow it. Answered again on every later call. */
export const JSON_TOK_END: i32 = 0
/** `{`. */
export const JSON_TOK_OBJECT_BEGIN: i32 = 1
/** `}`. */
export const JSON_TOK_OBJECT_END: i32 = 2
/** `[`. */
export const JSON_TOK_ARRAY_BEGIN: i32 = 3
/** `]`. */
export const JSON_TOK_ARRAY_END: i32 = 4
/** A member's name: a string followed by its colon. The value is the next token. */
export const JSON_TOK_KEY: i32 = 5
/** A string value. */
export const JSON_TOK_STRING: i32 = 6
/** A number value. */
export const JSON_TOK_NUMBER: i32 = 7
/** `true`. */
export const JSON_TOK_TRUE: i32 = 8
/** `false`. */
export const JSON_TOK_FALSE: i32 = 9
/** `null`. */
export const JSON_TOK_NULL: i32 = 10

/** A byte that cannot stand where it stands: `[1,]`, `{"a" 1}`, `[1}`, `[01]`, `+1`, `.5`, `nulx`, a byte outside a string that is not ASCII. */
export const JSON_TOK_ERR_SYNTAX: i32 = -1
/** The window ended inside a value: an empty window, `[1,`, `{"a":`, an unclosed string. */
export const JSON_TOK_ERR_TRUNCATED: i32 = -2
/** Something other than blanks after the top-level value: `[] []`, `1 2`, a trailing NUL. */
export const JSON_TOK_ERR_TRAILING: i32 = -3
/** A string holds a byte sequence that is not UTF-8: an overlong form, a surrogate, a code point past U+10FFFF, a sequence cut short by a byte that does not continue it, a stray continuation byte. */
export const JSON_TOK_ERR_UTF8: i32 = -4
/** A backslash not followed by one of `"\/bfnrt`, or a `\u` not followed by four hex digits. */
export const JSON_TOK_ERR_ESCAPE: i32 = -5
/** A `\u` escape of a surrogate that is not one half of a high-then-low pair. */
export const JSON_TOK_ERR_SURROGATE: i32 = -6
/** A raw byte below 0x20 inside a string, which RFC 8259 §7 requires to be escaped. */
export const JSON_TOK_ERR_CONTROL: i32 = -7
/** A number outside the RFC 8259 §6 grammar: `-a`, `1.a`, `1ex`, `-Infinity`. A number the window cuts short (`1.`, `-`) is `JSON_TOK_ERR_TRUNCATED`. */
export const JSON_TOK_ERR_NUMBER: i32 = -8
/** An opening bracket or brace past `JsonLimits.maxDepth` open containers. */
export const JSON_TOK_ERR_DEPTH: i32 = -9
/** A string, or a key, longer than `JsonLimits.maxStringBytes` bytes between its quotes. */
export const JSON_TOK_ERR_STRING_LIMIT: i32 = -10
/** A number longer than `JsonLimits.maxNumberBytes` bytes. */
export const JSON_TOK_ERR_NUMBER_LIMIT: i32 = -11
/** A window longer than `JsonLimits.maxTotalBytes` bytes. Answered by the first `next()`, before anything is read. */
export const JSON_TOK_ERR_TOTAL_LIMIT: i32 = -12
/** `off` and `len` do not describe a window inside `src`. Answered by the first `next()`. */
export const JSON_TOK_ERR_WINDOW: i32 = -13

/**
 * The default limits, sized for a request body. A depth of 128 is serde_json's
 * recursion limit and deeper than any document a person writes; a string may
 * be a mebibyte; 256 bytes hold every double in its shortest form many times
 * over; and a body of 16 MiB is past what an HTTP server should buffer anyway.
 */
export const JSON_DEFAULT_MAX_DEPTH: i32 = 128
export const JSON_DEFAULT_MAX_STRING_BYTES: i32 = 1048576
export const JSON_DEFAULT_MAX_NUMBER_BYTES: i32 = 256
export const JSON_DEFAULT_MAX_TOTAL_BYTES: i32 = 16777216

/**
 * What a `JsonTokenizer` refuses to read, each with its own error code. The
 * tokenizer copies the four numbers when it is made, so changing an object
 * afterwards changes nothing for a tokenizer already made from it. A negative
 * limit is read as zero: with a depth of zero only a scalar top-level value
 * is accepted, with a string limit of zero only `""`.
 */
export class JsonLimits {
  /** Containers open at once; the tokenizer allocates one byte of stack per level, once. */
  maxDepth: i32
  /** Raw bytes between a string's quotes, escapes counted as written. */
  maxStringBytes: i32
  /** Bytes in one number, sign and exponent included. */
  maxNumberBytes: i32
  /** Bytes in the window handed to the constructor or to `reset`. */
  maxTotalBytes: i32

  /** The defaults, `JSON_DEFAULT_*`. */
  constructor() {
    this.maxDepth = JSON_DEFAULT_MAX_DEPTH
    this.maxStringBytes = JSON_DEFAULT_MAX_STRING_BYTES
    this.maxNumberBytes = JSON_DEFAULT_MAX_NUMBER_BYTES
    this.maxTotalBytes = JSON_DEFAULT_MAX_TOTAL_BYTES
  }
}

/** What `next()` expects at the cursor. */
const JSON_TOK_WANT_VALUE: i32 = 0
const JSON_TOK_WANT_VALUE_OR_CLOSE: i32 = 1
const JSON_TOK_WANT_KEY_OR_CLOSE: i32 = 2
const JSON_TOK_WANT_COLON: i32 = 3
const JSON_TOK_WANT_COMMA_OR_CLOSE: i32 = 4
const JSON_TOK_WANT_NOTHING: i32 = 5

/** What the depth stack holds for an open container. */
const JSON_TOK_IN_OBJECT: i32 = 1
const JSON_TOK_IN_ARRAY: i32 = 2

const JSON_TOK_TAB: i32 = 9
const JSON_TOK_NEWLINE: i32 = 10
const JSON_TOK_CARRIAGE_RETURN: i32 = 13
const JSON_TOK_SPACE: i32 = 32
const JSON_TOK_QUOTE: i32 = 34
const JSON_TOK_PLUS: i32 = 43
const JSON_TOK_COMMA: i32 = 44
const JSON_TOK_MINUS: i32 = 45
const JSON_TOK_DOT: i32 = 46
const JSON_TOK_SLASH: i32 = 47
const JSON_TOK_DIGIT_0: i32 = 48
const JSON_TOK_DIGIT_1: i32 = 49
const JSON_TOK_DIGIT_9: i32 = 57
const JSON_TOK_COLON: i32 = 58
const JSON_TOK_UPPER_A: i32 = 65
const JSON_TOK_UPPER_E: i32 = 69
const JSON_TOK_UPPER_F: i32 = 70
const JSON_TOK_OPEN_BRACKET: i32 = 91
const JSON_TOK_BACKSLASH: i32 = 92
const JSON_TOK_CLOSE_BRACKET: i32 = 93
const JSON_TOK_LOWER_A: i32 = 97
const JSON_TOK_LOWER_B: i32 = 98
const JSON_TOK_LOWER_E: i32 = 101
const JSON_TOK_LOWER_F: i32 = 102
const JSON_TOK_LOWER_N: i32 = 110
const JSON_TOK_LOWER_R: i32 = 114
const JSON_TOK_LOWER_T: i32 = 116
const JSON_TOK_LOWER_U: i32 = 117
const JSON_TOK_OPEN_BRACE: i32 = 123
const JSON_TOK_CLOSE_BRACE: i32 = 125

/** The bytes the short escapes stand for: backspace, form feed, newline, carriage return, tab. */
const JSON_TOK_BACKSPACE: i32 = 8
const JSON_TOK_FORM_FEED: i32 = 12

/** The bytes and code points UTF-8 is checked and built against (RFC 3629 §3, §4). */
const JSON_TOK_ASCII_END: i32 = 128
const JSON_TOK_CONTINUATION_LOW: i32 = 128
const JSON_TOK_CONTINUATION_HIGH: i32 = 191
const JSON_TOK_LEAD_TWO_LOW: i32 = 194
const JSON_TOK_LEAD_TWO_HIGH: i32 = 223
const JSON_TOK_LEAD_E0: i32 = 224
const JSON_TOK_LEAD_ED: i32 = 237
const JSON_TOK_LEAD_THREE_HIGH: i32 = 239
const JSON_TOK_LEAD_F0: i32 = 240
const JSON_TOK_LEAD_F4: i32 = 244
const JSON_TOK_E0_SECOND_LOW: i32 = 160
const JSON_TOK_ED_SECOND_HIGH: i32 = 159
const JSON_TOK_F0_SECOND_LOW: i32 = 144
const JSON_TOK_F4_SECOND_HIGH: i32 = 143
const JSON_TOK_TWO_BYTE_LEAD: i32 = 192
const JSON_TOK_THREE_BYTE_LEAD: i32 = 224
const JSON_TOK_FOUR_BYTE_LEAD: i32 = 240
const JSON_TOK_LOW_SIX: i32 = 63
const JSON_TOK_CONTINUATION_BITS: i32 = 6
const JSON_TOK_TWO_BYTE_FLOOR: i32 = 128
const JSON_TOK_THREE_BYTE_FLOOR: i32 = 2048
const JSON_TOK_FOUR_BYTE_FLOOR: i32 = 65536
const JSON_TOK_HIGH_SURROGATE: i32 = 55296
const JSON_TOK_LOW_SURROGATE: i32 = 56320
const JSON_TOK_SURROGATE_END: i32 = 57344
const JSON_TOK_HEX_BASE: i32 = 16
const JSON_TOK_TEN: i32 = 10

/** Clinger's fast path: at most 15 significant digits, so the mantissa is an exact double, and 10^22, the largest exact power of ten. */
const JSON_TOK_FAST_DIGITS: i32 = 15
const JSON_TOK_FAST_EXPONENT: i32 = 22
/** Where an exponent's digits stop being added up: past it, the fast path is out of reach and `parseFloat` reads the text. */
const JSON_TOK_EXPONENT_CAP: i32 = 100000
/** 2^31 - 1 is 214748364 tens and 7: one more digit on a larger value, or a digit past 7 on that one, leaves `i32`. */
const JSON_TOK_I32_TENS: i32 = 214748364
const JSON_TOK_I32_LAST_DIGIT: i32 = 7

/**
 * Whether the decimal digits `src[i, end)` add up to more than `bound`, which
 * is at least `0`. The sum stops as soon as it passes `bound`, and before a
 * step that would leave `i32`, which is past any `bound` too, so an exponent
 * of any length is compared exactly and nothing overflows, under Node as in
 * a native build.
 */
const jsonTokDigitsExceed = (src: u8[], i: i32, end: i32, bound: i32): boolean => {
  let value: i32 = 0
  let at: i32 = i
  while (at < end && at < toI32(src.length)) {
    const digit: i32 = toI32(src[at]) - JSON_TOK_DIGIT_0
    if (value > JSON_TOK_I32_TENS || (value === JSON_TOK_I32_TENS && digit > JSON_TOK_I32_LAST_DIGIT)) {
      return true
    }
    value = value * JSON_TOK_TEN + digit
    if (value > bound) {
      return true
    }
    at += 1
  }
  return false
}

/**
 * The furthest a window may end. The scan reads up to twelve bytes past a
 * position it has checked against the end, so a window that ends within 64
 * bytes of 2^31 - 1 is refused rather than let an offset overflow. Reaching
 * it takes an array of 2 GiB, so no test does.
 */
const JSON_TOK_END_CEILING: i32 = 2147483583

/** The byte at `i`, or `-1` when `i` is outside `[0, end)` or outside `src`. */
const jsonTokByteAt = (src: u8[], i: i32, end: i32): i32 => {
  if (i < 0 || i >= end || i >= toI32(src.length)) {
    return -1
  }
  return toI32(src[i])
}

/** The four bytes RFC 8259 §2 allows between tokens. */
const jsonTokIsBlank = (b: i32): boolean =>
  b === JSON_TOK_SPACE || b === JSON_TOK_TAB || b === JSON_TOK_NEWLINE || b === JSON_TOK_CARRIAGE_RETURN

const jsonTokIsDigit = (b: i32): boolean => b >= JSON_TOK_DIGIT_0 && b <= JSON_TOK_DIGIT_9

/**
 * A byte a string's scan steps over without a second look: printable ASCII
 * that is neither the closing quote nor a backslash.
 */
const jsonTokIsPlain = (b: i32): boolean =>
  b >= JSON_TOK_SPACE && b < JSON_TOK_ASCII_END && b !== JSON_TOK_QUOTE && b !== JSON_TOK_BACKSLASH

/**
 * The first index at or after `i` that is not a blank, or `end`. The run is
 * read straight out of `src`, bounded by both `end` and the array's length,
 * so it stops wherever `jsonTokByteAt` would have answered `-1`.
 */
const jsonTokSkipBlank = (src: u8[], i: i32, end: i32): i32 => {
  if (i < 0) {
    return i
  }
  const n: i32 = toI32(src.length)
  let j: i32 = i
  while (j < end && j < n && jsonTokIsBlank(toI32(src[j]))) {
    j += 1
  }
  return j
}

/** The first index at or after `i` that is not a digit, or `end`, read as `jsonTokSkipBlank` reads its run. */
const jsonTokSkipDigits = (src: u8[], i: i32, end: i32): i32 => {
  if (i < 0) {
    return i
  }
  const n: i32 = toI32(src.length)
  let j: i32 = i
  while (j < end && j < n && jsonTokIsDigit(toI32(src[j]))) {
    j += 1
  }
  return j
}

/** The first index at or after `i` that is not a plain string byte, or `limit`, read as `jsonTokSkipBlank` reads its run. */
const jsonTokSkipPlain = (src: u8[], i: i32, limit: i32): i32 => {
  if (i < 0) {
    return i
  }
  const n: i32 = toI32(src.length)
  let j: i32 = i
  while (j < limit && j < n && jsonTokIsPlain(toI32(src[j]))) {
    j += 1
  }
  return j
}

/** The value of one hex digit, or `-1`. */
const jsonTokHexDigit = (b: i32): i32 => {
  if (jsonTokIsDigit(b)) {
    return b - JSON_TOK_DIGIT_0
  }
  if (b >= JSON_TOK_LOWER_A && b <= JSON_TOK_LOWER_F) {
    return b - JSON_TOK_LOWER_A + JSON_TOK_TEN
  }
  if (b >= JSON_TOK_UPPER_A && b <= JSON_TOK_UPPER_F) {
    return b - JSON_TOK_UPPER_A + JSON_TOK_TEN
  }
  return -1
}

/**
 * The four hex digits at `at` as one value; `JSON_TOK_ERR_TRUNCATED` when the
 * window ends before the fourth, and `JSON_TOK_ERR_ESCAPE` when one is not a
 * hex digit.
 */
const jsonTokHex4 = (src: u8[], at: i32, end: i32): i32 => {
  let value: i32 = 0
  let k: i32 = 0
  while (k < 4) {
    const b: i32 = jsonTokByteAt(src, at + k, end)
    if (b < 0) {
      return JSON_TOK_ERR_TRUNCATED
    }
    const digit: i32 = jsonTokHexDigit(b)
    if (digit < 0) {
      return JSON_TOK_ERR_ESCAPE
    }
    value = value * JSON_TOK_HEX_BASE + digit
    k += 1
  }
  return value
}

/** Whether byte `b`, a lead or a continuation, lies between `low` and `high`, inclusive; `-1`, past the window, never does. */
const jsonTokInRange = (b: i32, low: i32, high: i32): boolean => b >= low && b <= high

/**
 * The length of the UTF-8 sequence whose lead byte, at `at`, is not ASCII, or
 * `JSON_TOK_ERR_UTF8`. RFC 3629 §4's table, row by row: the second byte's
 * range depends on the lead, which is what refuses an overlong form (`C0`,
 * `C1`, `E0 80`–`E0 9F`, `F0 80`–`F0 8F`), a surrogate (`ED A0`–`ED BF`) and a
 * code point past U+10FFFF (`F4 90` and up, `F5`–`FF`). A sequence that is
 * well formed as far as the window goes and is cut short by its end is
 * `JSON_TOK_ERR_TRUNCATED`, as any other value the window cuts short is.
 */
const jsonTokUtf8Length = (src: u8[], at: i32, end: i32): i32 => {
  const lead: i32 = jsonTokByteAt(src, at, end)
  const second: i32 = jsonTokByteAt(src, at + 1, end)
  let low: i32 = JSON_TOK_CONTINUATION_LOW
  let high: i32 = JSON_TOK_CONTINUATION_HIGH
  let length: i32 = 0
  if (jsonTokInRange(lead, JSON_TOK_LEAD_TWO_LOW, JSON_TOK_LEAD_TWO_HIGH)) {
    length = 2
  } else if (jsonTokInRange(lead, JSON_TOK_LEAD_E0, JSON_TOK_LEAD_THREE_HIGH)) {
    length = 3
    if (lead === JSON_TOK_LEAD_E0) {
      low = JSON_TOK_E0_SECOND_LOW
    } else if (lead === JSON_TOK_LEAD_ED) {
      high = JSON_TOK_ED_SECOND_HIGH
    }
  } else if (jsonTokInRange(lead, JSON_TOK_LEAD_F0, JSON_TOK_LEAD_F4)) {
    length = 4
    if (lead === JSON_TOK_LEAD_F0) {
      low = JSON_TOK_F0_SECOND_LOW
    } else if (lead === JSON_TOK_LEAD_F4) {
      high = JSON_TOK_F4_SECOND_HIGH
    }
  } else {
    return JSON_TOK_ERR_UTF8
  }
  if (!jsonTokInRange(second, low, high)) {
    return second < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_UTF8
  }
  let k: i32 = 2
  while (k < length) {
    const next: i32 = jsonTokByteAt(src, at + k, end)
    if (!jsonTokInRange(next, JSON_TOK_CONTINUATION_LOW, JSON_TOK_CONTINUATION_HIGH)) {
      return next < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_UTF8
    }
    k += 1
  }
  return length
}

/** How many bytes code point `cp` takes in UTF-8. */
const jsonTokUtf8Width = (cp: i32): i32 => {
  if (cp < JSON_TOK_TWO_BYTE_FLOOR) {
    return 1
  }
  if (cp < JSON_TOK_THREE_BYTE_FLOOR) {
    return 2
  }
  return cp < JSON_TOK_FOUR_BYTE_FLOOR ? 3 : 4
}

/** Byte `k` of code point `cp`'s `width`-byte UTF-8 form. */
const jsonTokUtf8Byte = (cp: i32, width: i32, k: i32): i32 => {
  if (width === 1) {
    return cp
  }
  const shift: i32 = (width - 1 - k) * JSON_TOK_CONTINUATION_BITS
  const bits: i32 = (cp >> shift) & JSON_TOK_LOW_SIX
  if (k > 0) {
    return JSON_TOK_CONTINUATION_LOW | bits
  }
  if (width === 2) {
    return JSON_TOK_TWO_BYTE_LEAD | (cp >> 6)
  }
  return width === 3 ? JSON_TOK_THREE_BYTE_LEAD | (cp >> 12) : JSON_TOK_FOUR_BYTE_LEAD | (cp >> 18)
}

/** The byte a short escape's letter stands for, or `-1` when the letter is not one of `"\/bfnrt`. */
const jsonTokShortEscape = (b: i32): i32 => {
  switch (b) {
    case JSON_TOK_QUOTE:
      return JSON_TOK_QUOTE
    case JSON_TOK_BACKSLASH:
      return JSON_TOK_BACKSLASH
    case JSON_TOK_SLASH:
      return JSON_TOK_SLASH
    case JSON_TOK_LOWER_B:
      return JSON_TOK_BACKSPACE
    case JSON_TOK_LOWER_F:
      return JSON_TOK_FORM_FEED
    case JSON_TOK_LOWER_N:
      return JSON_TOK_NEWLINE
    case JSON_TOK_LOWER_R:
      return JSON_TOK_CARRIAGE_RETURN
    case JSON_TOK_LOWER_T:
      return JSON_TOK_TAB
    default:
      return -1
  }
}

/**
 * How many raw bytes the escape at `at` takes, given the code point it decodes
 * to: 12 for a surrogate pair, the only escape past U+FFFF, 6 for any other
 * `\u`, 2 for a short one.
 */
const jsonTokEscapeLength = (src: u8[], at: i32, end: i32, cp: i32): i32 => {
  if (cp >= JSON_TOK_FOUR_BYTE_FLOOR) {
    return 12
  }
  return jsonTokByteAt(src, at + 1, end) === JSON_TOK_LOWER_U ? 6 : 2
}

/**
 * The tokenizer. One per connection or per document; `reset` reuses it, and
 * nothing it does after the constructor allocates, except `numberF64`'s
 * `parseFloat` path, which releases what it allocated before it returns.
 *
 * The fields a caller reads are `depth`, `kind`, `tokStart`, `tokEnd`,
 * `failed` and `errorAt`. The rest are the cursor and what the scan of the
 * current token found, and are read through the methods.
 */
export class JsonTokenizer {
  src: u8[]
  /** The integral number `integerScan` read last, negated. */
  integerValue: i64
  /** The integral number `unsignedScan` read last. */
  unsignedValue: u64
  /** One byte per open container, `JSON_TOK_IN_OBJECT` or `JSON_TOK_IN_ARRAY`, `maxDepth` long. */
  stack: u8[]
  /** The window: bytes `[off, end)` of `src`. */
  off: i32
  end: i32
  /** The next byte `next()` reads. */
  pos: i32
  maxDepth: i32
  maxStringBytes: i32
  maxNumberBytes: i32
  maxTotalBytes: i32
  /** Containers open after the current token. */
  depth: i32
  /** What `next()` expects at `pos`. */
  want: i32
  /** The current token's kind, the last `next()` answered; `JSON_TOK_END` before the first. */
  kind: i32
  /** The current token's bytes, `src[tokStart, tokEnd)`; a string's and a key's include their quotes. */
  tokStart: i32
  tokEnd: i32
  /** The sticky error, a negative `JSON_TOK_ERR_*` code; `0` until one. */
  failed: i32
  /**
   * The byte offset in `src` the error was found at, and `-1` until one. Read
   * it only once `failed` is set: a `JSON_TOK_ERR_WINDOW` records the `off`
   * the caller passed, which may itself be negative or past the end of `src`.
   */
  errorAt: i32
  /** The current string's or key's length once decoded; shorter than its raw length exactly when it holds an escape. */
  stringBytes: i32
  /**
   * Whether the current number is written with neither a fraction nor an
   * exponent: the spelling, so `1.0` is not. `isIntegral()` reads the value.
   */
  integral: boolean

  constructor(src: u8[], off: i32, len: i32, limits: JsonLimits) {
    this.maxDepth = limits.maxDepth < 0 ? 0 : limits.maxDepth
    this.maxStringBytes = limits.maxStringBytes < 0 ? 0 : limits.maxStringBytes
    this.maxNumberBytes = limits.maxNumberBytes < 0 ? 0 : limits.maxNumberBytes
    this.maxTotalBytes = limits.maxTotalBytes < 0 ? 0 : limits.maxTotalBytes
    this.stack = new Array<u8>(this.maxDepth)
    this.src = src
    this.off = 0
    this.end = 0
    this.pos = 0
    this.depth = 0
    this.want = JSON_TOK_WANT_VALUE
    this.kind = JSON_TOK_END
    this.tokStart = 0
    this.tokEnd = 0
    this.failed = 0
    this.errorAt = -1
    this.stringBytes = 0
    this.integral = false
    this.integerValue = toI64(0)
    this.unsignedValue = toU64(0)
    this.reset(src, off, len)
  }

  /**
   * Starts over on `src[off, off + len)`, keeping the limits and the depth
   * stack, and clearing any error. A window outside `src` or longer than the
   * total limit is refused here, and the first `next()` answers it.
   */
  reset(src: u8[], off: i32, len: i32): void {
    this.src = src
    this.depth = 0
    this.want = JSON_TOK_WANT_VALUE
    this.kind = JSON_TOK_END
    this.tokStart = off
    this.tokEnd = off
    this.failed = 0
    this.errorAt = -1
    this.stringBytes = 0
    this.integral = false
    // The second test is only reached when the first proves `off + len` fits.
    if (off < 0 || len < 0 || off > toI32(src.length) - len || off + len > JSON_TOK_END_CEILING) {
      this.off = 0
      this.end = 0
      this.pos = 0
      this.fail(JSON_TOK_ERR_WINDOW, off)
      return
    }
    this.off = off
    this.end = off + len
    this.pos = off
    if (len > this.maxTotalBytes) {
      this.fail(JSON_TOK_ERR_TOTAL_LIMIT, off + this.maxTotalBytes)
    }
  }

  /** Records the first error and answers it. */
  fail(code: i32, at: i32): i32 {
    if (this.failed === 0) {
      this.failed = code
      this.errorAt = at
    }
    return this.failed
  }

  /** The next token's kind, `JSON_TOK_END`, or a negative error, which is sticky. */
  next(): i32 {
    if (this.failed !== 0) {
      return this.failed
    }
    const src: u8[] = this.src
    const end: i32 = this.end
    const at: i32 = jsonTokSkipBlank(src, this.pos, end)
    const b: i32 = jsonTokByteAt(src, at, end)
    switch (this.want) {
      case JSON_TOK_WANT_NOTHING:
        if (b < 0) {
          this.pos = at
          this.kind = JSON_TOK_END
          return JSON_TOK_END
        }
        return this.fail(JSON_TOK_ERR_TRAILING, at)
      case JSON_TOK_WANT_COLON:
        if (b === JSON_TOK_COLON) {
          return this.value(jsonTokSkipBlank(src, at + 1, end))
        }
        return this.fail(b < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_SYNTAX, at)
      case JSON_TOK_WANT_KEY_OR_CLOSE:
        if (b === JSON_TOK_CLOSE_BRACE) {
          return this.close(at, JSON_TOK_IN_OBJECT)
        }
        return this.key(at)
      case JSON_TOK_WANT_VALUE_OR_CLOSE:
        if (b === JSON_TOK_CLOSE_BRACKET) {
          return this.close(at, JSON_TOK_IN_ARRAY)
        }
        return this.value(at)
      case JSON_TOK_WANT_COMMA_OR_CLOSE:
        if (b === JSON_TOK_COMMA) {
          const after: i32 = jsonTokSkipBlank(src, at + 1, end)
          if (this.top() === JSON_TOK_IN_OBJECT) {
            return this.key(after)
          }
          return this.value(after)
        }
        if (b === JSON_TOK_CLOSE_BRACE) {
          return this.close(at, JSON_TOK_IN_OBJECT)
        }
        if (b === JSON_TOK_CLOSE_BRACKET) {
          return this.close(at, JSON_TOK_IN_ARRAY)
        }
        return this.fail(b < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_SYNTAX, at)
      default:
        return this.value(at)
    }
  }

  /** The kind of the innermost open container, or `0` at the top level. */
  top(): i32 {
    const d: i32 = this.depth
    if (d <= 0 || d > toI32(this.stack.length)) {
      return 0
    }
    return toI32(this.stack[d - 1])
  }

  /** Records the token `src[start, stop)` of kind `k` and what may follow it. */
  emit(k: i32, start: i32, stop: i32): i32 {
    this.kind = k
    this.tokStart = start
    this.tokEnd = stop
    this.pos = stop
    if (k === JSON_TOK_KEY) {
      this.want = JSON_TOK_WANT_COLON
    } else if (k === JSON_TOK_OBJECT_BEGIN) {
      this.want = JSON_TOK_WANT_KEY_OR_CLOSE
    } else if (k === JSON_TOK_ARRAY_BEGIN) {
      this.want = JSON_TOK_WANT_VALUE_OR_CLOSE
    } else {
      this.want = this.depth === 0 ? JSON_TOK_WANT_NOTHING : JSON_TOK_WANT_COMMA_OR_CLOSE
    }
    return k
  }

  /** A closer at `at`, which must match the innermost container, `inside`. */
  close(at: i32, inside: i32): i32 {
    if (this.top() !== inside) {
      return this.fail(JSON_TOK_ERR_SYNTAX, at)
    }
    this.depth -= 1
    return this.emit(inside === JSON_TOK_IN_OBJECT ? JSON_TOK_OBJECT_END : JSON_TOK_ARRAY_END, at, at + 1)
  }

  /** An opener at `at`, refused past the depth limit. */
  open(at: i32, inside: i32): i32 {
    const d: i32 = this.depth
    if (d >= this.maxDepth || d < 0 || d >= toI32(this.stack.length)) {
      return this.fail(JSON_TOK_ERR_DEPTH, at)
    }
    this.stack[d] = toU8(inside)
    this.depth = d + 1
    return this.emit(inside === JSON_TOK_IN_OBJECT ? JSON_TOK_OBJECT_BEGIN : JSON_TOK_ARRAY_BEGIN, at, at + 1)
  }

  /** A key at `at`: a string, whose colon the next call reads. */
  key(at: i32): i32 {
    const b: i32 = jsonTokByteAt(this.src, at, this.end)
    if (b === JSON_TOK_QUOTE) {
      return this.string(at, JSON_TOK_KEY)
    }
    return this.fail(b < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_SYNTAX, at)
  }

  /** A value at `at`. */
  value(at: i32): i32 {
    const src: u8[] = this.src
    const end: i32 = this.end
    const b: i32 = jsonTokByteAt(src, at, end)
    if (b === JSON_TOK_QUOTE) {
      return this.string(at, JSON_TOK_STRING)
    }
    if (b === JSON_TOK_MINUS || jsonTokIsDigit(b)) {
      return this.number(at)
    }
    switch (b) {
      case JSON_TOK_OPEN_BRACE:
        return this.open(at, JSON_TOK_IN_OBJECT)
      case JSON_TOK_OPEN_BRACKET:
        return this.open(at, JSON_TOK_IN_ARRAY)
      case JSON_TOK_LOWER_T:
        return this.literal(at, "true", JSON_TOK_TRUE)
      case JSON_TOK_LOWER_F:
        return this.literal(at, "false", JSON_TOK_FALSE)
      case JSON_TOK_LOWER_N:
        return this.literal(at, "null", JSON_TOK_NULL)
      default:
        return this.fail(b < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_SYNTAX, at)
    }
  }

  /** `true`, `false` or `null` at `at`; a window that ends inside the word is truncated. */
  literal(at: i32, word: string, k: i32): i32 {
    const n: i32 = toI32(word.length)
    let matched: i32 = 0
    while (
      matched < n &&
      jsonTokByteAt(this.src, at + matched, this.end) === toI32(word.charCodeAt(matched))
    ) {
      matched += 1
    }
    if (matched === n) {
      return this.emit(k, at, at + n)
    }
    return this.fail(at + matched >= this.end ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_SYNTAX, at + matched)
  }

  /**
   * A number at `at`, to RFC 8259 §6: `-`? then `0` or a digit run not
   * starting with `0`, then `.` and digits, then `e` or `E`, a sign and
   * digits. What follows it is the next call's to judge, so `01` is a `0`
   * and then an error: `JSON_TOK_ERR_SYNTAX` inside a container (`[01]`),
   * `JSON_TOK_ERR_TRAILING` at the top level. `1x` is a `1` and then the same.
   *
   * Nothing past the limit is read: the scan stops one byte past it, and a
   * number that reaches that byte is refused for its length, whatever the
   * grammar would have said of the rest.
   */
  number(at: i32): i32 {
    const src: u8[] = this.src
    const end: i32 = this.maxNumberBytes >= this.end - at ? this.end : at + this.maxNumberBytes + 1
    let i: i32 = at
    if (jsonTokByteAt(src, i, end) === JSON_TOK_MINUS) {
      i += 1
    }
    const first: i32 = jsonTokByteAt(src, i, end)
    if (first === JSON_TOK_DIGIT_0) {
      i += 1
    } else if (first >= JSON_TOK_DIGIT_1 && first <= JSON_TOK_DIGIT_9) {
      i = jsonTokSkipDigits(src, i + 1, end)
    } else {
      return this.numberRefused(first < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_NUMBER, at, i)
    }
    let integral = true
    if (jsonTokByteAt(src, i, end) === JSON_TOK_DOT) {
      integral = false
      i += 1
      const digit: i32 = jsonTokByteAt(src, i, end)
      if (!jsonTokIsDigit(digit)) {
        return this.numberRefused(digit < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_NUMBER, at, i)
      }
      i = jsonTokSkipDigits(src, i + 1, end)
    }
    const e: i32 = jsonTokByteAt(src, i, end)
    if (e === JSON_TOK_LOWER_E || e === JSON_TOK_UPPER_E) {
      integral = false
      i += 1
      const sign: i32 = jsonTokByteAt(src, i, end)
      if (sign === JSON_TOK_PLUS || sign === JSON_TOK_MINUS) {
        i += 1
      }
      const digit: i32 = jsonTokByteAt(src, i, end)
      if (!jsonTokIsDigit(digit)) {
        return this.numberRefused(digit < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_NUMBER, at, i)
      }
      i = jsonTokSkipDigits(src, i + 1, end)
    }
    if (i - at > this.maxNumberBytes) {
      return this.fail(JSON_TOK_ERR_NUMBER_LIMIT, at + this.maxNumberBytes)
    }
    this.integral = integral
    return this.emit(JSON_TOK_NUMBER, at, i)
  }

  /** `code` at `i`, unless the number starting at `at` has run past its limit, which is the error then. */
  numberRefused(code: i32, at: i32, i: i32): i32 {
    if (i - at > this.maxNumberBytes) {
      return this.fail(JSON_TOK_ERR_NUMBER_LIMIT, at + this.maxNumberBytes)
    }
    return this.fail(code, i)
  }

  /**
   * A string at `at`, its opening quote, as a key or a value: checked to the
   * closing quote and measured once decoded, decoding nothing. The length
   * limit counts raw bytes and is checked at every byte, so a string past it
   * is refused where it crosses the limit, not where it ends.
   */
  string(at: i32, k: i32): i32 {
    const src: u8[] = this.src
    const end: i32 = this.end
    // Where the string would pass its limit, or `end` when it cannot pass it
    // before the window ends, which also keeps the sum from overflowing.
    const room: i32 = end - at - 1
    const limit: i32 = this.maxStringBytes >= room ? end : at + 1 + this.maxStringBytes
    let i: i32 = at + 1
    let decoded: i32 = 0
    while (true) {
      // A run of plain bytes is stepped over in one loop. Each byte of it is
      // one the checks below would pass with `decoded += 1; i += 1`, and the
      // run stops short of `limit`, so the first byte it leaves is judged by
      // those checks exactly as before.
      const run: i32 = i
      i = jsonTokSkipPlain(src, i, limit)
      decoded += i - run
      const b: i32 = jsonTokByteAt(src, i, end)
      if (b === JSON_TOK_QUOTE) {
        break
      }
      if (i >= limit) {
        return this.fail(b < 0 ? JSON_TOK_ERR_TRUNCATED : JSON_TOK_ERR_STRING_LIMIT, i)
      }
      if (b < 0) {
        return this.fail(JSON_TOK_ERR_TRUNCATED, i)
      }
      if (b < JSON_TOK_SPACE) {
        return this.fail(JSON_TOK_ERR_CONTROL, i)
      }
      if (b === JSON_TOK_BACKSLASH) {
        const cp: i32 = this.escapeCodePoint(i)
        if (cp < 0) {
          return cp
        }
        decoded += jsonTokUtf8Width(cp)
        i += jsonTokEscapeLength(src, i, end, cp)
      } else if (b < JSON_TOK_ASCII_END) {
        decoded += 1
        i += 1
      } else {
        const width: i32 = jsonTokUtf8Length(src, i, end)
        if (width < 0) {
          return this.fail(width, i)
        }
        decoded += width
        i += width
      }
    }
    if (i > limit) {
      return this.fail(JSON_TOK_ERR_STRING_LIMIT, limit)
    }
    this.stringBytes = decoded
    return this.emit(k, at, i + 1)
  }

  /**
   * The code point of the escape whose backslash is at `at`, a surrogate pair
   * joined into one, or a negative error, recorded. Used both to check a
   * string and, on one already checked, to decode it.
   */
  escapeCodePoint(at: i32): i32 {
    const src: u8[] = this.src
    const end: i32 = this.end
    const letter: i32 = jsonTokByteAt(src, at + 1, end)
    if (letter < 0) {
      return this.fail(JSON_TOK_ERR_TRUNCATED, at + 1)
    }
    if (letter !== JSON_TOK_LOWER_U) {
      const short: i32 = jsonTokShortEscape(letter)
      return short < 0 ? this.fail(JSON_TOK_ERR_ESCAPE, at + 1) : short
    }
    const unit: i32 = jsonTokHex4(src, at + 2, end)
    if (unit < 0) {
      return this.fail(unit, at + 2)
    }
    if (unit < JSON_TOK_HIGH_SURROGATE || unit >= JSON_TOK_SURROGATE_END) {
      return unit
    }
    if (unit >= JSON_TOK_LOW_SURROGATE) {
      return this.fail(JSON_TOK_ERR_SURROGATE, at)
    }
    const slash: i32 = jsonTokByteAt(src, at + 6, end)
    const u: i32 = jsonTokByteAt(src, at + 7, end)
    // A window that ends where the second half should start may only be cut short.
    if (slash < 0 || (slash === JSON_TOK_BACKSLASH && u < 0)) {
      return this.fail(JSON_TOK_ERR_TRUNCATED, slash < 0 ? at + 6 : at + 7)
    }
    if (slash !== JSON_TOK_BACKSLASH || u !== JSON_TOK_LOWER_U) {
      return this.fail(JSON_TOK_ERR_SURROGATE, at)
    }
    const low: i32 = jsonTokHex4(src, at + 8, end)
    if (low < 0) {
      return this.fail(low, at + 8)
    }
    if (low < JSON_TOK_LOW_SURROGATE || low >= JSON_TOK_SURROGATE_END) {
      return this.fail(JSON_TOK_ERR_SURROGATE, at)
    }
    return (
      JSON_TOK_FOUR_BYTE_FLOOR + ((unit - JSON_TOK_HIGH_SURROGATE) << 10) + (low - JSON_TOK_LOW_SURROGATE)
    )
  }

  /** Whether the current token is a key or a string. */
  isText(): boolean {
    return this.kind === JSON_TOK_KEY || this.kind === JSON_TOK_STRING
  }

  /**
   * Writes the current key's or string's decoded bytes to `out` from `at`,
   * and answers how many; `-1`, writing nothing, when the current token is
   * neither or `out` has fewer than `stringLength()` bytes from `at`.
   */
  stringInto(out: u8[], at: i32): i32 {
    const n: i32 = this.stringBytes
    if (!this.isText() || at < 0 || at > toI32(out.length) - n) {
      return -1
    }
    const src: u8[] = this.src
    const end: i32 = this.tokEnd - 1
    let i: i32 = this.tokStart + 1
    let o: i32 = at
    if (n === end - i) {
      // No escape (see `keyEquals`): the bytes are copied as they are. Both
      // cursors only climb, so their floors are tested once, before the loop.
      if (i >= 0 && o >= 0) {
        const srcLength: i32 = toI32(src.length)
        const outLength: i32 = toI32(out.length)
        while (i < end && i < srcLength && o < outLength) {
          out[o] = src[i]
          o += 1
          i += 1
        }
      }
      return o - at
    }
    while (i < end) {
      const b: i32 = jsonTokByteAt(src, i, end)
      if (b !== JSON_TOK_BACKSLASH) {
        if (o >= 0 && o < toI32(out.length)) {
          out[o] = toU8(b)
        }
        o += 1
        i += 1
        continue
      }
      const cp: i32 = this.escapeCodePoint(i)
      const width: i32 = jsonTokUtf8Width(cp)
      let k: i32 = 0
      while (k < width) {
        if (o >= 0 && o < toI32(out.length)) {
          out[o] = toU8(jsonTokUtf8Byte(cp, width, k))
        }
        o += 1
        k += 1
      }
      i += jsonTokEscapeLength(src, i, end, cp)
    }
    return o - at
  }

  /** The current key's or string's length once decoded, or `-1` when the token is neither. */
  stringLength(): i32 {
    return this.isText() ? this.stringBytes : -1
  }

  /**
   * Whether the current key or string, decoded, is exactly `name`'s bytes;
   * `false` when the token is neither. Nothing is allocated or written.
   * `name.length` and `charCodeAt` are bytes natively. Under Node they are
   * UTF-16 code units, compared one by one against the decoded UTF-8 bytes:
   * an ASCII name answers the same both ways, a genuine non-ASCII name does
   * not match there, and a name whose code units 0x80 to 0xFF spell those
   * bytes does (`"Ã©"` matches a key `"é"`). That is the bytes against code
   * units divergence `docs/wp33-round-trip.md` §3.2 records.
   */
  keyEquals(name: string): boolean {
    const n: i32 = toI32(name.length)
    if (!this.isText() || n !== this.stringBytes) {
      return false
    }
    const src: u8[] = this.src
    const end: i32 = this.tokEnd - 1
    let i: i32 = this.tokStart + 1
    let o: i32 = 0
    // Every escape decodes to fewer bytes than it is written with, so a string
    // whose decoded length is its raw length has none.
    if (n === this.tokEnd - this.tokStart - 2) {
      while (o < n) {
        if (jsonTokByteAt(src, i + o, end) !== toI32(name.charCodeAt(o))) {
          return false
        }
        o += 1
      }
      return true
    }
    while (i < end) {
      const b: i32 = jsonTokByteAt(src, i, end)
      if (b !== JSON_TOK_BACKSLASH) {
        if (o >= n || b !== toI32(name.charCodeAt(o))) {
          return false
        }
        o += 1
        i += 1
        continue
      }
      const cp: i32 = this.escapeCodePoint(i)
      const width: i32 = jsonTokUtf8Width(cp)
      let k: i32 = 0
      while (k < width) {
        if (o >= n || jsonTokUtf8Byte(cp, width, k) !== toI32(name.charCodeAt(o))) {
          return false
        }
        o += 1
        k += 1
      }
      i += jsonTokEscapeLength(src, i, end, cp)
    }
    return o === n
  }

  /**
   * Whether the current token is a number written without a fraction or an
   * exponent whose value fits in an `i64`: `-0` and `9223372036854775807`
   * are, `1.0`, `1e2` and `9223372036854775808` are not. That is the
   * spelling rule; `isIntegral()` asks whether the value is whole.
   */
  isInteger(): boolean {
    return this.kind === JSON_TOK_NUMBER && this.integral && this.integerScan()
  }

  /**
   * The current number as an `i64` when `isInteger()` holds, and `0`
   * otherwise. Read it after checking `isInteger()`: a `0` alone does not say
   * which.
   */
  numberI64(): i64 {
    if (!this.isInteger()) {
      return toI64(0)
    }
    const src: u8[] = this.src
    const negated: i64 = this.integerValue
    return jsonTokByteAt(src, this.tokStart, this.tokEnd) === JSON_TOK_MINUS ? negated : -negated
  }

  /**
   * Reads the integral number's digits into `integerValue`, negated, and
   * answers whether its magnitude fits `i64` for its sign. Accumulating a
   * negative number reaches -2^63, where a positive one stops at 2^63 - 1, so
   * the bound for a positive number is one less.
   */
  integerScan(): boolean {
    const src: u8[] = this.src
    const end: i32 = this.tokEnd
    const negative: boolean = jsonTokByteAt(src, this.tokStart, end) === JSON_TOK_MINUS
    // Every `i64` here comes from `toI64`, which is a BigInt under Node, where a
    // bare literal would be a double and the two do not mix.
    // -2^63 has no literal (NL2055): -2^31 shifted up 32 bits.
    const min: i64 = toI64(-2147483648) << toI64(32)
    const ten: i64 = toI64(10)
    const bound: i64 = negative ? min : min + toI64(1)
    let acc: i64 = toI64(0)
    let i: i32 = negative ? this.tokStart + 1 : this.tokStart
    const n: i32 = toI32(src.length)
    if (i < 0 || end > n) {
      return false
    }
    while (i < end && i < n) {
      const digit: i64 = toI64(toI32(src[i]) - JSON_TOK_DIGIT_0)
      if (acc < (bound + digit) / ten) {
        return false
      }
      acc = acc * ten - digit
      i += 1
    }
    this.integerValue = acc
    return true
  }

  /**
   * Whether the current token is a number written in digits alone, with no
   * sign, fraction or exponent, whose value fits in a `u64`: `0` and
   * `18446744073709551615` are; `-0`, `-1`, `1.0`, `1e2` and
   * `18446744073709551616` are not.
   */
  isU64(): boolean {
    return this.kind === JSON_TOK_NUMBER && this.integral && this.unsignedScan()
  }

  /**
   * The current number as a `u64` when `isU64()` holds, and `0` otherwise.
   * Read it after checking `isU64()`: a `0` alone does not say which.
   */
  numberU64(): u64 {
    return this.isU64() ? this.unsignedValue : toU64(0)
  }

  /**
   * Reads the integral number's digits into `unsignedValue` and answers
   * whether it is unsigned and fits a `u64`. RFC 8259 allows no leading zero,
   * so a number of up to 19 digits is below 10^19 and always fits, and one of
   * 21 or more never does. One of 20 fits exactly when it is a `1` and then
   * 19 digits no greater than 2^64 - 1's last 19, 8446744073709551615, so the
   * sum never wraps and needs no divide.
   */
  unsignedScan(): boolean {
    const src: u8[] = this.src
    const end: i32 = this.tokEnd
    const n: i32 = toI32(src.length)
    let i: i32 = this.tokStart
    const digits: i32 = end - i
    if (i < 0 || end > n || digits < 1 || digits > 20 || i >= n) {
      return false
    }
    if (toI32(src[i]) === JSON_TOK_MINUS) {
      return false
    }
    const wide: boolean = digits === 20
    if (wide) {
      if (toI32(src[i]) !== JSON_TOK_DIGIT_1) {
        return false
      }
      i += 1
    }
    // Every `u64` here comes from `toU64`, a BigInt under Node, as `integerScan`'s `i64`s do.
    const ten: u64 = toU64(10)
    let acc: u64 = toU64(0)
    while (i < end && i < n) {
      acc = acc * ten + toU64(toI32(src[i]) - JSON_TOK_DIGIT_0)
      i += 1
    }
    if (wide) {
      // 8446744073709551615 and 10^19, built from parts that fit an `i32`.
      const million: u64 = toU64(1000000)
      const tail: u64 = (toU64(8446744) * million + toU64(73709)) * million + toU64(551615)
      if (acc > tail) {
        return false
      }
      const billion: u64 = toU64(1000000000)
      acc = acc + billion * billion * ten
    }
    this.unsignedValue = acc
    return true
  }

  /**
   * Whether the current token is a number whose value is a whole number,
   * however it is written: JSON Schema 2020-12's "integer". `-0.0`, `1.0`,
   * `1e2`, `100e-2` and `1e400` are; `1.5`, `10e-2` and `1e-400` are not. It
   * says nothing about fitting an `i64`, and it is not the `integral` field
   * or `isInteger()`, which go by spelling and refuse `1.0` and `1e2`.
   *
   * It reads the text, never an `f64`, so `12345678901234567890.0` and
   * `1e400` answer exactly. With F fraction digits, z trailing zeros across
   * all the digits and the exponent E, the value is whole when every digit is
   * zero or E - F + z >= 0. F and z count bytes of the token, so F - z fits an
   * `i32` whatever the limits, and `jsonTokDigitsExceed` compares E with it
   * without adding up more of E than it needs, so `1e99999999999` answers too.
   */
  isIntegral(): boolean {
    if (this.kind !== JSON_TOK_NUMBER) {
      return false
    }
    const src: u8[] = this.src
    const end: i32 = this.tokEnd
    const n: i32 = toI32(src.length)
    let i: i32 = this.tokStart
    if (i < 0 || end > n) {
      return false
    }
    if (jsonTokByteAt(src, i, end) === JSON_TOK_MINUS) {
      i += 1
    }
    let fraction: i32 = 0
    let zeros: i32 = 0
    let allZero = true
    let afterDot = false
    while (i < end && i < n) {
      const b: i32 = toI32(src[i])
      if (b === JSON_TOK_DOT) {
        afterDot = true
      } else if (jsonTokIsDigit(b)) {
        if (b === JSON_TOK_DIGIT_0) {
          zeros += 1
        } else {
          zeros = 0
          allZero = false
        }
        if (afterDot) {
          fraction += 1
        }
      } else {
        break
      }
      i += 1
    }
    if (allZero) {
      return true
    }
    // The exponent the value needs to be whole: E >= need.
    const need: i32 = fraction - zeros
    if (i >= end) {
      return need <= 0
    }
    // `i` is at the `e` or `E`.
    i += 1
    const sign: i32 = jsonTokByteAt(src, i, end)
    const minus: boolean = sign === JSON_TOK_MINUS
    if (minus || sign === JSON_TOK_PLUS) {
      i += 1
    }
    if (minus) {
      return need <= 0 && !jsonTokDigitsExceed(src, i, end, -need)
    }
    return need <= 0 || jsonTokDigitsExceed(src, i, end, need - 1)
  }

  /**
   * The current number as the nearest `f64`, ties to even, as `JSON.parse`
   * reads it: `-0` is negative zero, a magnitude past the largest double is
   * an infinity and one below the smallest is zero. `0` when the current
   * token is not a number.
   */
  numberF64(): f64 {
    if (this.kind !== JSON_TOK_NUMBER) {
      return 0
    }
    const src: u8[] = this.src
    const start: i32 = this.tokStart
    const end: i32 = this.tokEnd
    const negative: boolean = jsonTokByteAt(src, start, end) === JSON_TOK_MINUS
    // At most 15 digits are accumulated, so the mantissa is an exact double.
    const ten: f64 = 10
    let mantissa: f64 = 0
    let digits: i32 = 0
    let scale: i32 = 0
    let afterDot = false
    let i: i32 = negative ? start + 1 : start
    if (i < 0 || end > toI32(src.length)) {
      return this.numberSlow()
    }
    // The length is read in each test rather than hoisted: the call to
    // `numberSlow` in the loop would otherwise end what a hoisted copy proves.
    while (i < end && i < toI32(src.length)) {
      const b: i32 = toI32(src[i])
      if (b === JSON_TOK_DOT) {
        afterDot = true
      } else if (jsonTokIsDigit(b)) {
        if (digits > 0 || b !== JSON_TOK_DIGIT_0) {
          digits += 1
          if (digits <= JSON_TOK_FAST_DIGITS) {
            mantissa = mantissa * ten + toF64(b - JSON_TOK_DIGIT_0)
          }
        }
        if (afterDot) {
          scale -= 1
        }
        if (digits > JSON_TOK_FAST_DIGITS) {
          return this.numberSlow()
        }
      } else {
        break
      }
      i += 1
    }
    if (i < end) {
      // The exponent: `i` is at the `e` or `E`.
      i += 1
      const sign: i32 = jsonTokByteAt(src, i, end)
      const minus: boolean = sign === JSON_TOK_MINUS
      if (minus || sign === JSON_TOK_PLUS) {
        i += 1
      }
      let exponent: i32 = 0
      while (i < end && i < toI32(src.length) && exponent < JSON_TOK_EXPONENT_CAP) {
        exponent = exponent * JSON_TOK_TEN + toI32(src[i]) - JSON_TOK_DIGIT_0
        i += 1
      }
      if (i < end) {
        return this.numberSlow()
      }
      scale += minus ? -exponent : exponent
    }
    let value: f64 = mantissa
    if (mantissa !== 0) {
      if (scale < -JSON_TOK_FAST_EXPONENT || scale > JSON_TOK_FAST_EXPONENT) {
        return this.numberSlow()
      }
      const power: f64 = jsonTokPowerOfTen(scale < 0 ? -scale : scale)
      value = scale < 0 ? value / power : value * power
    }
    return negative ? -value : value
  }

  /**
   * The current number through `parseFloat`, which is `strtod` and correctly
   * rounded, for the numbers Clinger's fast path cannot take. The text is
   * copied into a string first, in one allocation by `String.fromBytes`. The
   * function answers a number, so its own arena scope releases the copy when
   * it returns (docs/LANGUAGE.md, "Memory model", item 2), as
   * `JsonWriter.f64`'s digits are released. A `using a = arena()` block would
   * say the same thing, but Node 22 cannot parse `using`, and this module also
   * runs under Node. A token outside `src` can only mean the caller shortened
   * the array after `next()` read it, and answers `0` rather than panic.
   */
  numberSlow(): f64 {
    const src: u8[] = this.src
    const start: i32 = this.tokStart
    const end: i32 = this.tokEnd
    if (start < 0 || start > end || end > toI32(src.length)) {
      return 0
    }
    return parseFloat(String.fromBytes(src, start, end))
  }

  /**
   * Steps over the value the current token starts, so that the next `next()`
   * answers what follows it. After a key, that is the key's value; after an
   * opener, everything up to and including its closer; after a scalar or a
   * closer, nothing. Answers the kind of the last token it read (the closer,
   * or the scalar), or a negative error.
   */
  skipValue(): i32 {
    if (this.failed !== 0) {
      return this.failed
    }
    let k: i32 = this.kind
    if (k === JSON_TOK_KEY) {
      k = this.next()
    }
    if (k !== JSON_TOK_OBJECT_BEGIN && k !== JSON_TOK_ARRAY_BEGIN) {
      return k
    }
    const target: i32 = this.depth - 1
    while (this.depth > target && k >= 0) {
      k = this.next()
    }
    return k
  }
}

/** 10^n as an exact double, for `n` from 0 to 22. */
const jsonTokPowerOfTen = (n: i32): f64 => {
  const ten: f64 = 10
  let p: f64 = 1
  let k: i32 = 0
  while (k < n) {
    p = p * ten
    k += 1
  }
  return p
}
