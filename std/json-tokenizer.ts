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
 * `numberF64` is correctly rounded, ties to even, in one of three ways. A
 * number of at most 19 significant digits is read into a `u64`. When that is
 * at most 2^53 and the decimal exponent is within ±22, the answer is one exact
 * multiply or divide of two exact doubles (Clinger's fast path). Any other
 * number of at most 19 digits is the Eisel–Lemire algorithm as fast_float
 * computes it: one or two 64×64-bit products with a truncated power of five,
 * which Mushtak and Lemire prove always decide the rounding for so few digits,
 * so it never needs a fallback. A number of more digits, or with an exponent
 * past `JSON_TOK_EXPONENT_CAP`, goes to the runtime's `parseFloat`, which is
 * `strtod`, from a function whose own arena scope releases the copy it reads,
 * so it leaves the arena where it was. `isInteger` and `numberI64` read a number
 * written without a fraction or an exponent that fits in an `i64`, and
 * `isU64` and `numberU64` one written without a sign either that fits in a
 * `u64`.
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
 * (`docs/wp26-stdlib.md` §4). Written from RFC 8259 and RFC 3629, except
 * `numberF64`'s Eisel–Lemire path and its table of powers of five, which are
 * adapted from fast_float under the notice above `jsonTokW64`.
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

/** The most significant digits a `u64` holds whatever they are, 10^19 - 1 being below 2^64. Past them, `parseFloat` reads the text. */
const JSON_TOK_FAST_DIGITS: i32 = 19
/** Clinger's fast path: 10^22 is the largest exact power of ten. */
const JSON_TOK_FAST_EXPONENT: i32 = 22
/** The decimal exponents `jsonTokPowerOfFive` has an entry for. Past them, a number of at most 19 digits is zero or infinite. */
const JSON_TOK_SMALLEST_POWER: i32 = -342
const JSON_TOK_LARGEST_POWER: i32 = 308
/** Where an exponent's digits stop being added up: past it, `parseFloat` reads the text. */
const JSON_TOK_EXPONENT_CAP: i32 = 100000

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
  /** Whether the current number has neither a fraction nor an exponent. */
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
   * are, `1.0`, `1e2` and `9223372036854775808` are not.
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
    // At most 19 digits are accumulated, so the mantissa never wraps. Every
    // `u64` constant is spelled through `toU64`, because under Node a `u64` is
    // a `bigint` and a bare literal a `number`.
    const ten: u64 = toU64(10)
    let mantissa: u64 = toU64(0)
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
            mantissa = mantissa * ten + toU64(b - JSON_TOK_DIGIT_0)
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
    let value: f64 = 0
    if (digits > 0) {
      const exact: boolean = mantissa <= toU64(1) << toU64(53)
      if (exact && scale >= -JSON_TOK_FAST_EXPONENT && scale <= JSON_TOK_FAST_EXPONENT) {
        // Clinger: both operands are exact doubles, so one rounding.
        const power: f64 = jsonTokPowerOfTen(scale < 0 ? -scale : scale)
        value = scale < 0 ? toF64(mantissa) / power : toF64(mantissa) * power
      } else {
        value = jsonTokEiselLemire(mantissa, scale)
      }
    }
    return negative ? -value : value
  }

  /**
   * The current number through `parseFloat`, which is `strtod` and correctly
   * rounded, for a number of more than 19 significant digits or with an
   * exponent past `JSON_TOK_EXPONENT_CAP`. The text is
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
  switch (n) {
    case 1:
      return 1e1
    case 2:
      return 1e2
    case 3:
      return 1e3
    case 4:
      return 1e4
    case 5:
      return 1e5
    case 6:
      return 1e6
    case 7:
      return 1e7
    case 8:
      return 1e8
    case 9:
      return 1e9
    case 10:
      return 1e10
    case 11:
      return 1e11
    case 12:
      return 1e12
    case 13:
      return 1e13
    case 14:
      return 1e14
    case 15:
      return 1e15
    case 16:
      return 1e16
    case 17:
      return 1e17
    case 18:
      return 1e18
    case 19:
      return 1e19
    case 20:
      return 1e20
    case 21:
      return 1e21
    case 22:
      return 1e22
    default:
      return 1
  }
}

/*
 * Adapted from fast_float (https://github.com/fastfloat/fast_float),
 * include/fast_float/decimal_to_binary.h and script/table_generation.py.
 * Copyright 2021 The fast_float authors. Used under the Boost Software License,
 * Version 1.0; see std/LICENSE-fast-float.
 *
 * `jsonTokEiselLemire` follows upstream's `compute_float` and
 * `compute_product_approximation` for binary64, at commit 0de7a21, which is
 * why it keeps their names for the intermediates; `jsonTokPowerOfFive` is
 * upstream's `power_of_five_128`, regenerated by
 * `scripts/gen-json-pow5.mjs` rather than copied. What differs is the
 * arithmetic. Nish has no 128-bit integer, and under Node a `u64` is a
 * `bigint`, which never wraps, so nothing here may rely on a wrap: the high
 * half of a product is built from four 32-bit limb products, none of which
 * overflows, and the carry into it is found by comparison rather than by the
 * sum wrapping.
 */

/** A `u64` from its two 32-bit halves. */
const jsonTokW64 = (hi: u32, lo: u32): u64 => (toU64(hi) << toU64(32)) | toU64(lo)

/**
 * The high 64 bits of the 128-bit product `a × b`. Each limb product is at
 * most (2^32 - 1)^2, so `cross` is at most 2^64 - 1 and the answer at most
 * 2^64 - 2: no sum here can overflow, natively or as a `bigint`.
 */
const jsonTokMulHigh = (a: u64, b: u64): u64 => {
  const k32: u64 = toU64(32)
  const mask: u64 = jsonTokW64(0, 0xffffffff)
  const aHi: u64 = a >> k32
  const aLo: u64 = a & mask
  const bHi: u64 = b >> k32
  const bLo: u64 = b & mask
  const ll: u64 = aLo * bLo
  const hl: u64 = aHi * bLo
  const lh: u64 = aLo * bHi
  const cross: u64 = (ll >> k32) + (hl & mask) + lh
  return (hl >> k32) + (cross >> k32) + aHi * bHi
}

/** The leading zero bits of a `u64`, 64 for zero. */
const jsonTokLeadingZeros = (w: u64): i32 => {
  const hi: i32 = toI32(w >> toU64(32))
  return hi !== 0 ? Math.clz32(hi) : Math.clz32(toI32(w)) + 32
}

/**
 * `w × 10^q` as the nearest double, ties to even, for a `w` of 1 to 19
 * decimal digits, so from 1 to 10^19 - 1, and any `q`: a `q` below
 * `JSON_TOK_SMALLEST_POWER` answers 0, one above `JSON_TOK_LARGEST_POWER`
 * infinity. Positive; the caller applies the sign.
 *
 * Mushtak and Lemire prove ("Fast Number Parsing Without Fallback", 2023)
 * that for such a `w` the product with the first 64 bits of the power of five,
 * extended by the next 64 when its low bits are all ones, always decides the
 * rounding, so unlike the original Eisel–Lemire this never answers "unsure"
 * and needs no slow path. The cost is bounded: two table reads, at most two
 * 64×64-bit products and a fixed number of shifts, whatever the input.
 */
const jsonTokEiselLemire = (w0: u64, q: i32): f64 => {
  const one: u64 = toU64(1)
  const infinity: u64 = toU64(0x7ff) << toU64(52)
  if (q < JSON_TOK_SMALLEST_POWER) {
    return 0
  }
  if (q > JSON_TOK_LARGEST_POWER) {
    return bitsToF64(toI64(infinity))
  }
  // Normalize `w` so its top bit is set.
  const lz: i32 = jsonTokLeadingZeros(w0)
  const w: u64 = w0 << toU64(lz)
  // compute_product_approximation: w × 5^q to the 55 bits a double needs
  // (52 explicit, the implicit one, a rounding bit and the one `upperbit` may
  // cost), with the next word of the power only when those bits are all ones.
  const index: i32 = (q - JSON_TOK_SMALLEST_POWER) * 2
  const five: u64 = jsonTokPowerOfFive(index)
  let high: u64 = jsonTokMulHigh(w, five)
  // The low half: natively a `u64` product wraps to it, and as a `bigint` the
  // exact product is masked to it.
  const allOnes: u64 = jsonTokW64(0xffffffff, 0xffffffff)
  let low: u64 = (w * five) & allOnes
  const precisionMask: u64 = toU64(0x1ff)
  if ((high & precisionMask) === precisionMask) {
    const second: u64 = jsonTokMulHigh(w, jsonTokPowerOfFive(index + 1))
    // low += second, carrying into high: `high` is at most 2^64 - 2, so the
    // carry cannot overflow it.
    const room: u64 = allOnes - low
    if (second > room) {
      low = second - room - one
      high = high + one
    } else {
      low = low + second
    }
  }
  const upperbit: i32 = toI32(high >> toU64(63))
  const shift: i32 = upperbit + 9
  let mantissa: u64 = high >> toU64(shift)
  // detail::power: floor(q × log2(5)) + q + 63, with upstream's bias so the
  // shift is of a non-negative value. `q` is within ±342, so the product fits.
  // The literals are upstream's `152170 + 65536` and `2048 * 65536`, folded,
  // since a sum of literals is an `f64` under `--number-mode f64`.
  const power: i32 = (q * 217706 + 134217728) >> 16
  let power2: i32 = power - 2048 + 63 + upperbit - lz + 1023
  if (power2 <= 0) {
    // A subnormal, or zero. The rounded mantissa is at most 2^52, and when it
    // reaches 2^52 those are already the bits of the smallest normal double.
    const subnormalShift: i32 = 1 - power2
    if (subnormalShift >= 64) {
      return 0
    }
    mantissa = mantissa >> toU64(subnormalShift)
    mantissa = (mantissa + (mantissa & one)) >> one
    return bitsToF64(toI64(mantissa))
  }
  // Usually round up; but a product that is exact and falls halfway between
  // two doubles rounds to the even one. Only a power of five that fits one
  // word, q in [-4, 23], can be exact.
  const three: u64 = toU64(3)
  if (low <= one && q >= -4 && q <= 23 && (mantissa & three) === one && mantissa << toU64(shift) === high) {
    mantissa = mantissa & ~one
  }
  mantissa = (mantissa + (mantissa & one)) >> one
  const hidden: u64 = one << toU64(52)
  if (mantissa >= hidden << one) {
    mantissa = hidden
    power2 += 1
  }
  if (power2 >= 0x7ff) {
    return bitsToF64(toI64(infinity))
  }
  return bitsToF64(toI64((toU64(power2) << toU64(52)) | (mantissa & (hidden - one))))
}

// gen-json-pow5:begin -- generated by scripts/gen-json-pow5.mjs; edit that, not this.
/**
 * The 128-bit truncation of 5^q, high word at `2 × (q + 342)` and low word
 * after it, for q from -342 to 308: for q ≥ 0, 5^q shifted until its top bit
 * is bit 127; for q < 0, 2^b / 5^-q rounded up, for the b that puts its top
 * bit there. Upstream's `power_of_five_128`.
 *
 * A function over a `switch` rather than an array for `std/crypto/sha512.ts`'s
 * reason: a module constant cannot be an array, and LLVM turns a `switch`
 * whose every arm is a constant into one read-only table. `index` is computed
 * from the exponent, which `numberF64` has bounded.
 */
const jsonTokPowerOfFive = (index: i32): u64 => {
  switch (index) {
    case 0:
      return jsonTokW64(0xeef453d6, 0x923bd65a)
    case 1:
      return jsonTokW64(0x113faa29, 0x06a13b3f)
    case 2:
      return jsonTokW64(0x9558b466, 0x1b6565f8)
    case 3:
      return jsonTokW64(0x4ac7ca59, 0xa424c507)
    case 4:
      return jsonTokW64(0xbaaee17f, 0xa23ebf76)
    case 5:
      return jsonTokW64(0x5d79bcf0, 0x0d2df649)
    case 6:
      return jsonTokW64(0xe95a99df, 0x8ace6f53)
    case 7:
      return jsonTokW64(0xf4d82c2c, 0x107973dc)
    case 8:
      return jsonTokW64(0x91d8a02b, 0xb6c10594)
    case 9:
      return jsonTokW64(0x79071b9b, 0x8a4be869)
    case 10:
      return jsonTokW64(0xb64ec836, 0xa47146f9)
    case 11:
      return jsonTokW64(0x9748e282, 0x6cdee284)
    case 12:
      return jsonTokW64(0xe3e27a44, 0x4d8d98b7)
    case 13:
      return jsonTokW64(0xfd1b1b23, 0x08169b25)
    case 14:
      return jsonTokW64(0x8e6d8c6a, 0xb0787f72)
    case 15:
      return jsonTokW64(0xfe30f0f5, 0xe50e20f7)
    case 16:
      return jsonTokW64(0xb208ef85, 0x5c969f4f)
    case 17:
      return jsonTokW64(0xbdbd2d33, 0x5e51a935)
    case 18:
      return jsonTokW64(0xde8b2b66, 0xb3bc4723)
    case 19:
      return jsonTokW64(0xad2c7880, 0x35e61382)
    case 20:
      return jsonTokW64(0x8b16fb20, 0x3055ac76)
    case 21:
      return jsonTokW64(0x4c3bcb50, 0x21afcc31)
    case 22:
      return jsonTokW64(0xaddcb9e8, 0x3c6b1793)
    case 23:
      return jsonTokW64(0xdf4abe24, 0x2a1bbf3d)
    case 24:
      return jsonTokW64(0xd953e862, 0x4b85dd78)
    case 25:
      return jsonTokW64(0xd71d6dad, 0x34a2af0d)
    case 26:
      return jsonTokW64(0x87d4713d, 0x6f33aa6b)
    case 27:
      return jsonTokW64(0x8672648c, 0x40e5ad68)
    case 28:
      return jsonTokW64(0xa9c98d8c, 0xcb009506)
    case 29:
      return jsonTokW64(0x680efdaf, 0x511f18c2)
    case 30:
      return jsonTokW64(0xd43bf0ef, 0xfdc0ba48)
    case 31:
      return jsonTokW64(0x0212bd1b, 0x2566def2)
    case 32:
      return jsonTokW64(0x84a57695, 0xfe98746d)
    case 33:
      return jsonTokW64(0x014bb630, 0xf7604b57)
    case 34:
      return jsonTokW64(0xa5ced43b, 0x7e3e9188)
    case 35:
      return jsonTokW64(0x419ea3bd, 0x35385e2d)
    case 36:
      return jsonTokW64(0xcf42894a, 0x5dce35ea)
    case 37:
      return jsonTokW64(0x52064cac, 0x828675b9)
    case 38:
      return jsonTokW64(0x818995ce, 0x7aa0e1b2)
    case 39:
      return jsonTokW64(0x7343efeb, 0xd1940993)
    case 40:
      return jsonTokW64(0xa1ebfb42, 0x19491a1f)
    case 41:
      return jsonTokW64(0x1014ebe6, 0xc5f90bf8)
    case 42:
      return jsonTokW64(0xca66fa12, 0x9f9b60a6)
    case 43:
      return jsonTokW64(0xd41a26e0, 0x77774ef6)
    case 44:
      return jsonTokW64(0xfd00b897, 0x478238d0)
    case 45:
      return jsonTokW64(0x8920b098, 0x955522b4)
    case 46:
      return jsonTokW64(0x9e20735e, 0x8cb16382)
    case 47:
      return jsonTokW64(0x55b46e5f, 0x5d5535b0)
    case 48:
      return jsonTokW64(0xc5a89036, 0x2fddbc62)
    case 49:
      return jsonTokW64(0xeb2189f7, 0x34aa831d)
    case 50:
      return jsonTokW64(0xf712b443, 0xbbd52b7b)
    case 51:
      return jsonTokW64(0xa5e9ec75, 0x01d523e4)
    case 52:
      return jsonTokW64(0x9a6bb0aa, 0x55653b2d)
    case 53:
      return jsonTokW64(0x47b233c9, 0x2125366e)
    case 54:
      return jsonTokW64(0xc1069cd4, 0xeabe89f8)
    case 55:
      return jsonTokW64(0x999ec0bb, 0x696e840a)
    case 56:
      return jsonTokW64(0xf148440a, 0x256e2c76)
    case 57:
      return jsonTokW64(0xc00670ea, 0x43ca250d)
    case 58:
      return jsonTokW64(0x96cd2a86, 0x5764dbca)
    case 59:
      return jsonTokW64(0x38040692, 0x6a5e5728)
    case 60:
      return jsonTokW64(0xbc807527, 0xed3e12bc)
    case 61:
      return jsonTokW64(0xc6050837, 0x04f5ecf2)
    case 62:
      return jsonTokW64(0xeba09271, 0xe88d976b)
    case 63:
      return jsonTokW64(0xf7864a44, 0xc633682e)
    case 64:
      return jsonTokW64(0x93445b87, 0x31587ea3)
    case 65:
      return jsonTokW64(0x7ab3ee6a, 0xfbe0211d)
    case 66:
      return jsonTokW64(0xb8157268, 0xfdae9e4c)
    case 67:
      return jsonTokW64(0x5960ea05, 0xbad82964)
    case 68:
      return jsonTokW64(0xe61acf03, 0x3d1a45df)
    case 69:
      return jsonTokW64(0x6fb92487, 0x298e33bd)
    case 70:
      return jsonTokW64(0x8fd0c162, 0x06306bab)
    case 71:
      return jsonTokW64(0xa5d3b6d4, 0x79f8e056)
    case 72:
      return jsonTokW64(0xb3c4f1ba, 0x87bc8696)
    case 73:
      return jsonTokW64(0x8f48a489, 0x9877186c)
    case 74:
      return jsonTokW64(0xe0b62e29, 0x29aba83c)
    case 75:
      return jsonTokW64(0x331acdab, 0xfe94de87)
    case 76:
      return jsonTokW64(0x8c71dcd9, 0xba0b4925)
    case 77:
      return jsonTokW64(0x9ff0c08b, 0x7f1d0b14)
    case 78:
      return jsonTokW64(0xaf8e5410, 0x288e1b6f)
    case 79:
      return jsonTokW64(0x07ecf0ae, 0x5ee44dd9)
    case 80:
      return jsonTokW64(0xdb71e914, 0x32b1a24a)
    case 81:
      return jsonTokW64(0xc9e82cd9, 0xf69d6150)
    case 82:
      return jsonTokW64(0x892731ac, 0x9faf056e)
    case 83:
      return jsonTokW64(0xbe311c08, 0x3a225cd2)
    case 84:
      return jsonTokW64(0xab70fe17, 0xc79ac6ca)
    case 85:
      return jsonTokW64(0x6dbd630a, 0x48aaf406)
    case 86:
      return jsonTokW64(0xd64d3d9d, 0xb981787d)
    case 87:
      return jsonTokW64(0x092cbbcc, 0xdad5b108)
    case 88:
      return jsonTokW64(0x85f04682, 0x93f0eb4e)
    case 89:
      return jsonTokW64(0x25bbf560, 0x08c58ea5)
    case 90:
      return jsonTokW64(0xa76c5823, 0x38ed2621)
    case 91:
      return jsonTokW64(0xaf2af2b8, 0x0af6f24e)
    case 92:
      return jsonTokW64(0xd1476e2c, 0x07286faa)
    case 93:
      return jsonTokW64(0x1af5af66, 0x0db4aee1)
    case 94:
      return jsonTokW64(0x82cca4db, 0x847945ca)
    case 95:
      return jsonTokW64(0x50d98d9f, 0xc890ed4d)
    case 96:
      return jsonTokW64(0xa37fce12, 0x6597973c)
    case 97:
      return jsonTokW64(0xe50ff107, 0xbab528a0)
    case 98:
      return jsonTokW64(0xcc5fc196, 0xfefd7d0c)
    case 99:
      return jsonTokW64(0x1e53ed49, 0xa96272c8)
    case 100:
      return jsonTokW64(0xff77b1fc, 0xbebcdc4f)
    case 101:
      return jsonTokW64(0x25e8e89c, 0x13bb0f7a)
    case 102:
      return jsonTokW64(0x9faacf3d, 0xf73609b1)
    case 103:
      return jsonTokW64(0x77b19161, 0x8c54e9ac)
    case 104:
      return jsonTokW64(0xc795830d, 0x75038c1d)
    case 105:
      return jsonTokW64(0xd59df5b9, 0xef6a2417)
    case 106:
      return jsonTokW64(0xf97ae3d0, 0xd2446f25)
    case 107:
      return jsonTokW64(0x4b057328, 0x6b44ad1d)
    case 108:
      return jsonTokW64(0x9becce62, 0x836ac577)
    case 109:
      return jsonTokW64(0x4ee367f9, 0x430aec32)
    case 110:
      return jsonTokW64(0xc2e801fb, 0x244576d5)
    case 111:
      return jsonTokW64(0x229c41f7, 0x93cda73f)
    case 112:
      return jsonTokW64(0xf3a20279, 0xed56d48a)
    case 113:
      return jsonTokW64(0x6b435275, 0x78c1110f)
    case 114:
      return jsonTokW64(0x9845418c, 0x345644d6)
    case 115:
      return jsonTokW64(0x830a1389, 0x6b78aaa9)
    case 116:
      return jsonTokW64(0xbe5691ef, 0x416bd60c)
    case 117:
      return jsonTokW64(0x23cc986b, 0xc656d553)
    case 118:
      return jsonTokW64(0xedec366b, 0x11c6cb8f)
    case 119:
      return jsonTokW64(0x2cbfbe86, 0xb7ec8aa8)
    case 120:
      return jsonTokW64(0x94b3a202, 0xeb1c3f39)
    case 121:
      return jsonTokW64(0x7bf7d714, 0x32f3d6a9)
    case 122:
      return jsonTokW64(0xb9e08a83, 0xa5e34f07)
    case 123:
      return jsonTokW64(0xdaf5ccd9, 0x3fb0cc53)
    case 124:
      return jsonTokW64(0xe858ad24, 0x8f5c22c9)
    case 125:
      return jsonTokW64(0xd1b3400f, 0x8f9cff68)
    case 126:
      return jsonTokW64(0x91376c36, 0xd99995be)
    case 127:
      return jsonTokW64(0x23100809, 0xb9c21fa1)
    case 128:
      return jsonTokW64(0xb5854744, 0x8ffffb2d)
    case 129:
      return jsonTokW64(0xabd40a0c, 0x2832a78a)
    case 130:
      return jsonTokW64(0xe2e69915, 0xb3fff9f9)
    case 131:
      return jsonTokW64(0x16c90c8f, 0x323f516c)
    case 132:
      return jsonTokW64(0x8dd01fad, 0x907ffc3b)
    case 133:
      return jsonTokW64(0xae3da7d9, 0x7f6792e3)
    case 134:
      return jsonTokW64(0xb1442798, 0xf49ffb4a)
    case 135:
      return jsonTokW64(0x99cd11cf, 0xdf41779c)
    case 136:
      return jsonTokW64(0xdd95317f, 0x31c7fa1d)
    case 137:
      return jsonTokW64(0x40405643, 0xd711d583)
    case 138:
      return jsonTokW64(0x8a7d3eef, 0x7f1cfc52)
    case 139:
      return jsonTokW64(0x482835ea, 0x666b2572)
    case 140:
      return jsonTokW64(0xad1c8eab, 0x5ee43b66)
    case 141:
      return jsonTokW64(0xda324365, 0x0005eecf)
    case 142:
      return jsonTokW64(0xd863b256, 0x369d4a40)
    case 143:
      return jsonTokW64(0x90bed43e, 0x40076a82)
    case 144:
      return jsonTokW64(0x873e4f75, 0xe2224e68)
    case 145:
      return jsonTokW64(0x5a7744a6, 0xe804a291)
    case 146:
      return jsonTokW64(0xa90de353, 0x5aaae202)
    case 147:
      return jsonTokW64(0x711515d0, 0xa205cb36)
    case 148:
      return jsonTokW64(0xd3515c28, 0x31559a83)
    case 149:
      return jsonTokW64(0x0d5a5b44, 0xca873e03)
    case 150:
      return jsonTokW64(0x8412d999, 0x1ed58091)
    case 151:
      return jsonTokW64(0xe858790a, 0xfe9486c2)
    case 152:
      return jsonTokW64(0xa5178fff, 0x668ae0b6)
    case 153:
      return jsonTokW64(0x626e974d, 0xbe39a872)
    case 154:
      return jsonTokW64(0xce5d73ff, 0x402d98e3)
    case 155:
      return jsonTokW64(0xfb0a3d21, 0x2dc8128f)
    case 156:
      return jsonTokW64(0x80fa687f, 0x881c7f8e)
    case 157:
      return jsonTokW64(0x7ce66634, 0xbc9d0b99)
    case 158:
      return jsonTokW64(0xa139029f, 0x6a239f72)
    case 159:
      return jsonTokW64(0x1c1fffc1, 0xebc44e80)
    case 160:
      return jsonTokW64(0xc9874347, 0x44ac874e)
    case 161:
      return jsonTokW64(0xa327ffb2, 0x66b56220)
    case 162:
      return jsonTokW64(0xfbe91419, 0x15d7a922)
    case 163:
      return jsonTokW64(0x4bf1ff9f, 0x0062baa8)
    case 164:
      return jsonTokW64(0x9d71ac8f, 0xada6c9b5)
    case 165:
      return jsonTokW64(0x6f773fc3, 0x603db4a9)
    case 166:
      return jsonTokW64(0xc4ce17b3, 0x99107c22)
    case 167:
      return jsonTokW64(0xcb550fb4, 0x384d21d3)
    case 168:
      return jsonTokW64(0xf6019da0, 0x7f549b2b)
    case 169:
      return jsonTokW64(0x7e2a53a1, 0x46606a48)
    case 170:
      return jsonTokW64(0x99c10284, 0x4f94e0fb)
    case 171:
      return jsonTokW64(0x2eda7444, 0xcbfc426d)
    case 172:
      return jsonTokW64(0xc0314325, 0x637a1939)
    case 173:
      return jsonTokW64(0xfa911155, 0xfefb5308)
    case 174:
      return jsonTokW64(0xf03d93ee, 0xbc589f88)
    case 175:
      return jsonTokW64(0x793555ab, 0x7eba27ca)
    case 176:
      return jsonTokW64(0x96267c75, 0x35b763b5)
    case 177:
      return jsonTokW64(0x4bc1558b, 0x2f3458de)
    case 178:
      return jsonTokW64(0xbbb01b92, 0x83253ca2)
    case 179:
      return jsonTokW64(0x9eb1aaed, 0xfb016f16)
    case 180:
      return jsonTokW64(0xea9c2277, 0x23ee8bcb)
    case 181:
      return jsonTokW64(0x465e15a9, 0x79c1cadc)
    case 182:
      return jsonTokW64(0x92a1958a, 0x7675175f)
    case 183:
      return jsonTokW64(0x0bfacd89, 0xec191ec9)
    case 184:
      return jsonTokW64(0xb749faed, 0x14125d36)
    case 185:
      return jsonTokW64(0xcef980ec, 0x671f667b)
    case 186:
      return jsonTokW64(0xe51c79a8, 0x5916f484)
    case 187:
      return jsonTokW64(0x82b7e127, 0x80e7401a)
    case 188:
      return jsonTokW64(0x8f31cc09, 0x37ae58d2)
    case 189:
      return jsonTokW64(0xd1b2ecb8, 0xb0908810)
    case 190:
      return jsonTokW64(0xb2fe3f0b, 0x8599ef07)
    case 191:
      return jsonTokW64(0x861fa7e6, 0xdcb4aa15)
    case 192:
      return jsonTokW64(0xdfbdcece, 0x67006ac9)
    case 193:
      return jsonTokW64(0x67a791e0, 0x93e1d49a)
    case 194:
      return jsonTokW64(0x8bd6a141, 0x006042bd)
    case 195:
      return jsonTokW64(0xe0c8bb2c, 0x5c6d24e0)
    case 196:
      return jsonTokW64(0xaecc4991, 0x4078536d)
    case 197:
      return jsonTokW64(0x58fae9f7, 0x73886e18)
    case 198:
      return jsonTokW64(0xda7f5bf5, 0x90966848)
    case 199:
      return jsonTokW64(0xaf39a475, 0x506a899e)
    case 200:
      return jsonTokW64(0x888f9979, 0x7a5e012d)
    case 201:
      return jsonTokW64(0x6d8406c9, 0x52429603)
    case 202:
      return jsonTokW64(0xaab37fd7, 0xd8f58178)
    case 203:
      return jsonTokW64(0xc8e5087b, 0xa6d33b83)
    case 204:
      return jsonTokW64(0xd5605fcd, 0xcf32e1d6)
    case 205:
      return jsonTokW64(0xfb1e4a9a, 0x90880a64)
    case 206:
      return jsonTokW64(0x855c3be0, 0xa17fcd26)
    case 207:
      return jsonTokW64(0x5cf2eea0, 0x9a55067f)
    case 208:
      return jsonTokW64(0xa6b34ad8, 0xc9dfc06f)
    case 209:
      return jsonTokW64(0xf42faa48, 0xc0ea481e)
    case 210:
      return jsonTokW64(0xd0601d8e, 0xfc57b08b)
    case 211:
      return jsonTokW64(0xf13b94da, 0xf124da26)
    case 212:
      return jsonTokW64(0x823c1279, 0x5db6ce57)
    case 213:
      return jsonTokW64(0x76c53d08, 0xd6b70858)
    case 214:
      return jsonTokW64(0xa2cb1717, 0xb52481ed)
    case 215:
      return jsonTokW64(0x54768c4b, 0x0c64ca6e)
    case 216:
      return jsonTokW64(0xcb7ddcdd, 0xa26da268)
    case 217:
      return jsonTokW64(0xa9942f5d, 0xcf7dfd09)
    case 218:
      return jsonTokW64(0xfe5d5415, 0x0b090b02)
    case 219:
      return jsonTokW64(0xd3f93b35, 0x435d7c4c)
    case 220:
      return jsonTokW64(0x9efa548d, 0x26e5a6e1)
    case 221:
      return jsonTokW64(0xc47bc501, 0x4a1a6daf)
    case 222:
      return jsonTokW64(0xc6b8e9b0, 0x709f109a)
    case 223:
      return jsonTokW64(0x359ab641, 0x9ca1091b)
    case 224:
      return jsonTokW64(0xf867241c, 0x8cc6d4c0)
    case 225:
      return jsonTokW64(0xc30163d2, 0x03c94b62)
    case 226:
      return jsonTokW64(0x9b407691, 0xd7fc44f8)
    case 227:
      return jsonTokW64(0x79e0de63, 0x425dcf1d)
    case 228:
      return jsonTokW64(0xc2109436, 0x4dfb5636)
    case 229:
      return jsonTokW64(0x985915fc, 0x12f542e4)
    case 230:
      return jsonTokW64(0xf294b943, 0xe17a2bc4)
    case 231:
      return jsonTokW64(0x3e6f5b7b, 0x17b2939d)
    case 232:
      return jsonTokW64(0x979cf3ca, 0x6cec5b5a)
    case 233:
      return jsonTokW64(0xa705992c, 0xeecf9c42)
    case 234:
      return jsonTokW64(0xbd8430bd, 0x08277231)
    case 235:
      return jsonTokW64(0x50c6ff78, 0x2a838353)
    case 236:
      return jsonTokW64(0xece53cec, 0x4a314ebd)
    case 237:
      return jsonTokW64(0xa4f8bf56, 0x35246428)
    case 238:
      return jsonTokW64(0x940f4613, 0xae5ed136)
    case 239:
      return jsonTokW64(0x871b7795, 0xe136be99)
    case 240:
      return jsonTokW64(0xb9131798, 0x99f68584)
    case 241:
      return jsonTokW64(0x28e2557b, 0x59846e3f)
    case 242:
      return jsonTokW64(0xe757dd7e, 0xc07426e5)
    case 243:
      return jsonTokW64(0x331aeada, 0x2fe589cf)
    case 244:
      return jsonTokW64(0x9096ea6f, 0x3848984f)
    case 245:
      return jsonTokW64(0x3ff0d2c8, 0x5def7621)
    case 246:
      return jsonTokW64(0xb4bca50b, 0x065abe63)
    case 247:
      return jsonTokW64(0x0fed077a, 0x756b53a9)
    case 248:
      return jsonTokW64(0xe1ebce4d, 0xc7f16dfb)
    case 249:
      return jsonTokW64(0xd3e84959, 0x12c62894)
    case 250:
      return jsonTokW64(0x8d3360f0, 0x9cf6e4bd)
    case 251:
      return jsonTokW64(0x64712dd7, 0xabbbd95c)
    case 252:
      return jsonTokW64(0xb080392c, 0xc4349dec)
    case 253:
      return jsonTokW64(0xbd8d794d, 0x96aacfb3)
    case 254:
      return jsonTokW64(0xdca04777, 0xf541c567)
    case 255:
      return jsonTokW64(0xecf0d7a0, 0xfc5583a0)
    case 256:
      return jsonTokW64(0x89e42caa, 0xf9491b60)
    case 257:
      return jsonTokW64(0xf41686c4, 0x9db57244)
    case 258:
      return jsonTokW64(0xac5d37d5, 0xb79b6239)
    case 259:
      return jsonTokW64(0x311c2875, 0xc522ced5)
    case 260:
      return jsonTokW64(0xd77485cb, 0x25823ac7)
    case 261:
      return jsonTokW64(0x7d633293, 0x366b828b)
    case 262:
      return jsonTokW64(0x86a8d39e, 0xf77164bc)
    case 263:
      return jsonTokW64(0xae5dff9c, 0x02033197)
    case 264:
      return jsonTokW64(0xa8530886, 0xb54dbdeb)
    case 265:
      return jsonTokW64(0xd9f57f83, 0x0283fdfc)
    case 266:
      return jsonTokW64(0xd267caa8, 0x62a12d66)
    case 267:
      return jsonTokW64(0xd072df63, 0xc324fd7b)
    case 268:
      return jsonTokW64(0x8380dea9, 0x3da4bc60)
    case 269:
      return jsonTokW64(0x4247cb9e, 0x59f71e6d)
    case 270:
      return jsonTokW64(0xa4611653, 0x8d0deb78)
    case 271:
      return jsonTokW64(0x52d9be85, 0xf074e608)
    case 272:
      return jsonTokW64(0xcd795be8, 0x70516656)
    case 273:
      return jsonTokW64(0x67902e27, 0x6c921f8b)
    case 274:
      return jsonTokW64(0x806bd971, 0x4632dff6)
    case 275:
      return jsonTokW64(0x00ba1cd8, 0xa3db53b6)
    case 276:
      return jsonTokW64(0xa086cfcd, 0x97bf97f3)
    case 277:
      return jsonTokW64(0x80e8a40e, 0xccd228a4)
    case 278:
      return jsonTokW64(0xc8a883c0, 0xfdaf7df0)
    case 279:
      return jsonTokW64(0x6122cd12, 0x8006b2cd)
    case 280:
      return jsonTokW64(0xfad2a4b1, 0x3d1b5d6c)
    case 281:
      return jsonTokW64(0x796b8057, 0x20085f81)
    case 282:
      return jsonTokW64(0x9cc3a6ee, 0xc6311a63)
    case 283:
      return jsonTokW64(0xcbe33036, 0x74053bb0)
    case 284:
      return jsonTokW64(0xc3f490aa, 0x77bd60fc)
    case 285:
      return jsonTokW64(0xbedbfc44, 0x11068a9c)
    case 286:
      return jsonTokW64(0xf4f1b4d5, 0x15acb93b)
    case 287:
      return jsonTokW64(0xee92fb55, 0x15482d44)
    case 288:
      return jsonTokW64(0x99171105, 0x2d8bf3c5)
    case 289:
      return jsonTokW64(0x751bdd15, 0x2d4d1c4a)
    case 290:
      return jsonTokW64(0xbf5cd546, 0x78eef0b6)
    case 291:
      return jsonTokW64(0xd262d45a, 0x78a0635d)
    case 292:
      return jsonTokW64(0xef340a98, 0x172aace4)
    case 293:
      return jsonTokW64(0x86fb8971, 0x16c87c34)
    case 294:
      return jsonTokW64(0x9580869f, 0x0e7aac0e)
    case 295:
      return jsonTokW64(0xd45d35e6, 0xae3d4da0)
    case 296:
      return jsonTokW64(0xbae0a846, 0xd2195712)
    case 297:
      return jsonTokW64(0x89748360, 0x59cca109)
    case 298:
      return jsonTokW64(0xe998d258, 0x869facd7)
    case 299:
      return jsonTokW64(0x2bd1a438, 0x703fc94b)
    case 300:
      return jsonTokW64(0x91ff8377, 0x5423cc06)
    case 301:
      return jsonTokW64(0x7b6306a3, 0x4627ddcf)
    case 302:
      return jsonTokW64(0xb67f6455, 0x292cbf08)
    case 303:
      return jsonTokW64(0x1a3bc84c, 0x17b1d542)
    case 304:
      return jsonTokW64(0xe41f3d6a, 0x7377eeca)
    case 305:
      return jsonTokW64(0x20caba5f, 0x1d9e4a93)
    case 306:
      return jsonTokW64(0x8e938662, 0x882af53e)
    case 307:
      return jsonTokW64(0x547eb47b, 0x7282ee9c)
    case 308:
      return jsonTokW64(0xb23867fb, 0x2a35b28d)
    case 309:
      return jsonTokW64(0xe99e619a, 0x4f23aa43)
    case 310:
      return jsonTokW64(0xdec681f9, 0xf4c31f31)
    case 311:
      return jsonTokW64(0x6405fa00, 0xe2ec94d4)
    case 312:
      return jsonTokW64(0x8b3c113c, 0x38f9f37e)
    case 313:
      return jsonTokW64(0xde83bc40, 0x8dd3dd04)
    case 314:
      return jsonTokW64(0xae0b158b, 0x4738705e)
    case 315:
      return jsonTokW64(0x9624ab50, 0xb148d445)
    case 316:
      return jsonTokW64(0xd98ddaee, 0x19068c76)
    case 317:
      return jsonTokW64(0x3badd624, 0xdd9b0957)
    case 318:
      return jsonTokW64(0x87f8a8d4, 0xcfa417c9)
    case 319:
      return jsonTokW64(0xe54ca5d7, 0x0a80e5d6)
    case 320:
      return jsonTokW64(0xa9f6d30a, 0x038d1dbc)
    case 321:
      return jsonTokW64(0x5e9fcf4c, 0xcd211f4c)
    case 322:
      return jsonTokW64(0xd47487cc, 0x8470652b)
    case 323:
      return jsonTokW64(0x7647c320, 0x0069671f)
    case 324:
      return jsonTokW64(0x84c8d4df, 0xd2c63f3b)
    case 325:
      return jsonTokW64(0x29ecd9f4, 0x0041e073)
    case 326:
      return jsonTokW64(0xa5fb0a17, 0xc777cf09)
    case 327:
      return jsonTokW64(0xf4681071, 0x00525890)
    case 328:
      return jsonTokW64(0xcf79cc9d, 0xb955c2cc)
    case 329:
      return jsonTokW64(0x7182148d, 0x4066eeb4)
    case 330:
      return jsonTokW64(0x81ac1fe2, 0x93d599bf)
    case 331:
      return jsonTokW64(0xc6f14cd8, 0x48405530)
    case 332:
      return jsonTokW64(0xa21727db, 0x38cb002f)
    case 333:
      return jsonTokW64(0xb8ada00e, 0x5a506a7c)
    case 334:
      return jsonTokW64(0xca9cf1d2, 0x06fdc03b)
    case 335:
      return jsonTokW64(0xa6d90811, 0xf0e4851c)
    case 336:
      return jsonTokW64(0xfd442e46, 0x88bd304a)
    case 337:
      return jsonTokW64(0x908f4a16, 0x6d1da663)
    case 338:
      return jsonTokW64(0x9e4a9cec, 0x15763e2e)
    case 339:
      return jsonTokW64(0x9a598e4e, 0x043287fe)
    case 340:
      return jsonTokW64(0xc5dd4427, 0x1ad3cdba)
    case 341:
      return jsonTokW64(0x40eff1e1, 0x853f29fd)
    case 342:
      return jsonTokW64(0xf7549530, 0xe188c128)
    case 343:
      return jsonTokW64(0xd12bee59, 0xe68ef47c)
    case 344:
      return jsonTokW64(0x9a94dd3e, 0x8cf578b9)
    case 345:
      return jsonTokW64(0x82bb74f8, 0x301958ce)
    case 346:
      return jsonTokW64(0xc13a148e, 0x3032d6e7)
    case 347:
      return jsonTokW64(0xe36a5236, 0x3c1faf01)
    case 348:
      return jsonTokW64(0xf18899b1, 0xbc3f8ca1)
    case 349:
      return jsonTokW64(0xdc44e6c3, 0xcb279ac1)
    case 350:
      return jsonTokW64(0x96f5600f, 0x15a7b7e5)
    case 351:
      return jsonTokW64(0x29ab103a, 0x5ef8c0b9)
    case 352:
      return jsonTokW64(0xbcb2b812, 0xdb11a5de)
    case 353:
      return jsonTokW64(0x7415d448, 0xf6b6f0e7)
    case 354:
      return jsonTokW64(0xebdf6617, 0x91d60f56)
    case 355:
      return jsonTokW64(0x111b495b, 0x3464ad21)
    case 356:
      return jsonTokW64(0x936b9fce, 0xbb25c995)
    case 357:
      return jsonTokW64(0xcab10dd9, 0x00beec34)
    case 358:
      return jsonTokW64(0xb84687c2, 0x69ef3bfb)
    case 359:
      return jsonTokW64(0x3d5d514f, 0x40eea742)
    case 360:
      return jsonTokW64(0xe65829b3, 0x046b0afa)
    case 361:
      return jsonTokW64(0x0cb4a5a3, 0x112a5112)
    case 362:
      return jsonTokW64(0x8ff71a0f, 0xe2c2e6dc)
    case 363:
      return jsonTokW64(0x47f0e785, 0xeaba72ab)
    case 364:
      return jsonTokW64(0xb3f4e093, 0xdb73a093)
    case 365:
      return jsonTokW64(0x59ed2167, 0x65690f56)
    case 366:
      return jsonTokW64(0xe0f218b8, 0xd25088b8)
    case 367:
      return jsonTokW64(0x306869c1, 0x3ec3532c)
    case 368:
      return jsonTokW64(0x8c974f73, 0x83725573)
    case 369:
      return jsonTokW64(0x1e414218, 0xc73a13fb)
    case 370:
      return jsonTokW64(0xafbd2350, 0x644eeacf)
    case 371:
      return jsonTokW64(0xe5d1929e, 0xf90898fa)
    case 372:
      return jsonTokW64(0xdbac6c24, 0x7d62a583)
    case 373:
      return jsonTokW64(0xdf45f746, 0xb74abf39)
    case 374:
      return jsonTokW64(0x894bc396, 0xce5da772)
    case 375:
      return jsonTokW64(0x6b8bba8c, 0x328eb783)
    case 376:
      return jsonTokW64(0xab9eb47c, 0x81f5114f)
    case 377:
      return jsonTokW64(0x066ea92f, 0x3f326564)
    case 378:
      return jsonTokW64(0xd686619b, 0xa27255a2)
    case 379:
      return jsonTokW64(0xc80a537b, 0x0efefebd)
    case 380:
      return jsonTokW64(0x8613fd01, 0x45877585)
    case 381:
      return jsonTokW64(0xbd06742c, 0xe95f5f36)
    case 382:
      return jsonTokW64(0xa798fc41, 0x96e952e7)
    case 383:
      return jsonTokW64(0x2c481138, 0x23b73704)
    case 384:
      return jsonTokW64(0xd17f3b51, 0xfca3a7a0)
    case 385:
      return jsonTokW64(0xf75a1586, 0x2ca504c5)
    case 386:
      return jsonTokW64(0x82ef8513, 0x3de648c4)
    case 387:
      return jsonTokW64(0x9a984d73, 0xdbe722fb)
    case 388:
      return jsonTokW64(0xa3ab6658, 0x0d5fdaf5)
    case 389:
      return jsonTokW64(0xc13e60d0, 0xd2e0ebba)
    case 390:
      return jsonTokW64(0xcc963fee, 0x10b7d1b3)
    case 391:
      return jsonTokW64(0x318df905, 0x079926a8)
    case 392:
      return jsonTokW64(0xffbbcfe9, 0x94e5c61f)
    case 393:
      return jsonTokW64(0xfdf17746, 0x497f7052)
    case 394:
      return jsonTokW64(0x9fd561f1, 0xfd0f9bd3)
    case 395:
      return jsonTokW64(0xfeb6ea8b, 0xedefa633)
    case 396:
      return jsonTokW64(0xc7caba6e, 0x7c5382c8)
    case 397:
      return jsonTokW64(0xfe64a52e, 0xe96b8fc0)
    case 398:
      return jsonTokW64(0xf9bd690a, 0x1b68637b)
    case 399:
      return jsonTokW64(0x3dfdce7a, 0xa3c673b0)
    case 400:
      return jsonTokW64(0x9c1661a6, 0x51213e2d)
    case 401:
      return jsonTokW64(0x06bea10c, 0xa65c084e)
    case 402:
      return jsonTokW64(0xc31bfa0f, 0xe5698db8)
    case 403:
      return jsonTokW64(0x486e494f, 0xcff30a62)
    case 404:
      return jsonTokW64(0xf3e2f893, 0xdec3f126)
    case 405:
      return jsonTokW64(0x5a89dba3, 0xc3efccfa)
    case 406:
      return jsonTokW64(0x986ddb5c, 0x6b3a76b7)
    case 407:
      return jsonTokW64(0xf8962946, 0x5a75e01c)
    case 408:
      return jsonTokW64(0xbe895233, 0x86091465)
    case 409:
      return jsonTokW64(0xf6bbb397, 0xf1135823)
    case 410:
      return jsonTokW64(0xee2ba6c0, 0x678b597f)
    case 411:
      return jsonTokW64(0x746aa07d, 0xed582e2c)
    case 412:
      return jsonTokW64(0x94db4838, 0x40b717ef)
    case 413:
      return jsonTokW64(0xa8c2a44e, 0xb4571cdc)
    case 414:
      return jsonTokW64(0xba121a46, 0x50e4ddeb)
    case 415:
      return jsonTokW64(0x92f34d62, 0x616ce413)
    case 416:
      return jsonTokW64(0xe896a0d7, 0xe51e1566)
    case 417:
      return jsonTokW64(0x77b020ba, 0xf9c81d17)
    case 418:
      return jsonTokW64(0x915e2486, 0xef32cd60)
    case 419:
      return jsonTokW64(0x0ace1474, 0xdc1d122e)
    case 420:
      return jsonTokW64(0xb5b5ada8, 0xaaff80b8)
    case 421:
      return jsonTokW64(0x0d819992, 0x132456ba)
    case 422:
      return jsonTokW64(0xe3231912, 0xd5bf60e6)
    case 423:
      return jsonTokW64(0x10e1fff6, 0x97ed6c69)
    case 424:
      return jsonTokW64(0x8df5efab, 0xc5979c8f)
    case 425:
      return jsonTokW64(0xca8d3ffa, 0x1ef463c1)
    case 426:
      return jsonTokW64(0xb1736b96, 0xb6fd83b3)
    case 427:
      return jsonTokW64(0xbd308ff8, 0xa6b17cb2)
    case 428:
      return jsonTokW64(0xddd0467c, 0x64bce4a0)
    case 429:
      return jsonTokW64(0xac7cb3f6, 0xd05ddbde)
    case 430:
      return jsonTokW64(0x8aa22c0d, 0xbef60ee4)
    case 431:
      return jsonTokW64(0x6bcdf07a, 0x423aa96b)
    case 432:
      return jsonTokW64(0xad4ab711, 0x2eb3929d)
    case 433:
      return jsonTokW64(0x86c16c98, 0xd2c953c6)
    case 434:
      return jsonTokW64(0xd89d64d5, 0x7a607744)
    case 435:
      return jsonTokW64(0xe871c7bf, 0x077ba8b7)
    case 436:
      return jsonTokW64(0x87625f05, 0x6c7c4a8b)
    case 437:
      return jsonTokW64(0x11471cd7, 0x64ad4972)
    case 438:
      return jsonTokW64(0xa93af6c6, 0xc79b5d2d)
    case 439:
      return jsonTokW64(0xd598e40d, 0x3dd89bcf)
    case 440:
      return jsonTokW64(0xd389b478, 0x79823479)
    case 441:
      return jsonTokW64(0x4aff1d10, 0x8d4ec2c3)
    case 442:
      return jsonTokW64(0x843610cb, 0x4bf160cb)
    case 443:
      return jsonTokW64(0xcedf722a, 0x585139ba)
    case 444:
      return jsonTokW64(0xa54394fe, 0x1eedb8fe)
    case 445:
      return jsonTokW64(0xc2974eb4, 0xee658828)
    case 446:
      return jsonTokW64(0xce947a3d, 0xa6a9273e)
    case 447:
      return jsonTokW64(0x733d2262, 0x29feea32)
    case 448:
      return jsonTokW64(0x811ccc66, 0x8829b887)
    case 449:
      return jsonTokW64(0x0806357d, 0x5a3f525f)
    case 450:
      return jsonTokW64(0xa163ff80, 0x2a3426a8)
    case 451:
      return jsonTokW64(0xca07c2dc, 0xb0cf26f7)
    case 452:
      return jsonTokW64(0xc9bcff60, 0x34c13052)
    case 453:
      return jsonTokW64(0xfc89b393, 0xdd02f0b5)
    case 454:
      return jsonTokW64(0xfc2c3f38, 0x41f17c67)
    case 455:
      return jsonTokW64(0xbbac2078, 0xd443ace2)
    case 456:
      return jsonTokW64(0x9d9ba783, 0x2936edc0)
    case 457:
      return jsonTokW64(0xd54b944b, 0x84aa4c0d)
    case 458:
      return jsonTokW64(0xc5029163, 0xf384a931)
    case 459:
      return jsonTokW64(0x0a9e795e, 0x65d4df11)
    case 460:
      return jsonTokW64(0xf64335bc, 0xf065d37d)
    case 461:
      return jsonTokW64(0x4d4617b5, 0xff4a16d5)
    case 462:
      return jsonTokW64(0x99ea0196, 0x163fa42e)
    case 463:
      return jsonTokW64(0x504bced1, 0xbf8e4e45)
    case 464:
      return jsonTokW64(0xc06481fb, 0x9bcf8d39)
    case 465:
      return jsonTokW64(0xe45ec286, 0x2f71e1d6)
    case 466:
      return jsonTokW64(0xf07da27a, 0x82c37088)
    case 467:
      return jsonTokW64(0x5d767327, 0xbb4e5a4c)
    case 468:
      return jsonTokW64(0x964e858c, 0x91ba2655)
    case 469:
      return jsonTokW64(0x3a6a07f8, 0xd510f86f)
    case 470:
      return jsonTokW64(0xbbe226ef, 0xb628afea)
    case 471:
      return jsonTokW64(0x890489f7, 0x0a55368b)
    case 472:
      return jsonTokW64(0xeadab0ab, 0xa3b2dbe5)
    case 473:
      return jsonTokW64(0x2b45ac74, 0xccea842e)
    case 474:
      return jsonTokW64(0x92c8ae6b, 0x464fc96f)
    case 475:
      return jsonTokW64(0x3b0b8bc9, 0x0012929d)
    case 476:
      return jsonTokW64(0xb77ada06, 0x17e3bbcb)
    case 477:
      return jsonTokW64(0x09ce6ebb, 0x40173744)
    case 478:
      return jsonTokW64(0xe5599087, 0x9ddcaabd)
    case 479:
      return jsonTokW64(0xcc420a6a, 0x101d0515)
    case 480:
      return jsonTokW64(0x8f57fa54, 0xc2a9eab6)
    case 481:
      return jsonTokW64(0x9fa94682, 0x4a12232d)
    case 482:
      return jsonTokW64(0xb32df8e9, 0xf3546564)
    case 483:
      return jsonTokW64(0x47939822, 0xdc96abf9)
    case 484:
      return jsonTokW64(0xdff97724, 0x70297ebd)
    case 485:
      return jsonTokW64(0x59787e2b, 0x93bc56f7)
    case 486:
      return jsonTokW64(0x8bfbea76, 0xc619ef36)
    case 487:
      return jsonTokW64(0x57eb4edb, 0x3c55b65a)
    case 488:
      return jsonTokW64(0xaefae514, 0x77a06b03)
    case 489:
      return jsonTokW64(0xede62292, 0x0b6b23f1)
    case 490:
      return jsonTokW64(0xdab99e59, 0x958885c4)
    case 491:
      return jsonTokW64(0xe95fab36, 0x8e45eced)
    case 492:
      return jsonTokW64(0x88b402f7, 0xfd75539b)
    case 493:
      return jsonTokW64(0x11dbcb02, 0x18ebb414)
    case 494:
      return jsonTokW64(0xaae103b5, 0xfcd2a881)
    case 495:
      return jsonTokW64(0xd652bdc2, 0x9f26a119)
    case 496:
      return jsonTokW64(0xd59944a3, 0x7c0752a2)
    case 497:
      return jsonTokW64(0x4be76d33, 0x46f0495f)
    case 498:
      return jsonTokW64(0x857fcae6, 0x2d8493a5)
    case 499:
      return jsonTokW64(0x6f70a440, 0x0c562ddb)
    case 500:
      return jsonTokW64(0xa6dfbd9f, 0xb8e5b88e)
    case 501:
      return jsonTokW64(0xcb4ccd50, 0x0f6bb952)
    case 502:
      return jsonTokW64(0xd097ad07, 0xa71f26b2)
    case 503:
      return jsonTokW64(0x7e2000a4, 0x1346a7a7)
    case 504:
      return jsonTokW64(0x825ecc24, 0xc873782f)
    case 505:
      return jsonTokW64(0x8ed40066, 0x8c0c28c8)
    case 506:
      return jsonTokW64(0xa2f67f2d, 0xfa90563b)
    case 507:
      return jsonTokW64(0x72890080, 0x2f0f32fa)
    case 508:
      return jsonTokW64(0xcbb41ef9, 0x79346bca)
    case 509:
      return jsonTokW64(0x4f2b40a0, 0x3ad2ffb9)
    case 510:
      return jsonTokW64(0xfea126b7, 0xd78186bc)
    case 511:
      return jsonTokW64(0xe2f610c8, 0x4987bfa8)
    case 512:
      return jsonTokW64(0x9f24b832, 0xe6b0f436)
    case 513:
      return jsonTokW64(0x0dd9ca7d, 0x2df4d7c9)
    case 514:
      return jsonTokW64(0xc6ede63f, 0xa05d3143)
    case 515:
      return jsonTokW64(0x91503d1c, 0x79720dbb)
    case 516:
      return jsonTokW64(0xf8a95fcf, 0x88747d94)
    case 517:
      return jsonTokW64(0x75a44c63, 0x97ce912a)
    case 518:
      return jsonTokW64(0x9b69dbe1, 0xb548ce7c)
    case 519:
      return jsonTokW64(0xc986afbe, 0x3ee11aba)
    case 520:
      return jsonTokW64(0xc24452da, 0x229b021b)
    case 521:
      return jsonTokW64(0xfbe85bad, 0xce996168)
    case 522:
      return jsonTokW64(0xf2d56790, 0xab41c2a2)
    case 523:
      return jsonTokW64(0xfae27299, 0x423fb9c3)
    case 524:
      return jsonTokW64(0x97c560ba, 0x6b0919a5)
    case 525:
      return jsonTokW64(0xdccd879f, 0xc967d41a)
    case 526:
      return jsonTokW64(0xbdb6b8e9, 0x05cb600f)
    case 527:
      return jsonTokW64(0x5400e987, 0xbbc1c920)
    case 528:
      return jsonTokW64(0xed246723, 0x473e3813)
    case 529:
      return jsonTokW64(0x290123e9, 0xaab23b68)
    case 530:
      return jsonTokW64(0x9436c076, 0x0c86e30b)
    case 531:
      return jsonTokW64(0xf9a0b672, 0x0aaf6521)
    case 532:
      return jsonTokW64(0xb9447093, 0x8fa89bce)
    case 533:
      return jsonTokW64(0xf808e40e, 0x8d5b3e69)
    case 534:
      return jsonTokW64(0xe7958cb8, 0x7392c2c2)
    case 535:
      return jsonTokW64(0xb60b1d12, 0x30b20e04)
    case 536:
      return jsonTokW64(0x90bd77f3, 0x483bb9b9)
    case 537:
      return jsonTokW64(0xb1c6f22b, 0x5e6f48c2)
    case 538:
      return jsonTokW64(0xb4ecd5f0, 0x1a4aa828)
    case 539:
      return jsonTokW64(0x1e38aeb6, 0x360b1af3)
    case 540:
      return jsonTokW64(0xe2280b6c, 0x20dd5232)
    case 541:
      return jsonTokW64(0x25c6da63, 0xc38de1b0)
    case 542:
      return jsonTokW64(0x8d590723, 0x948a535f)
    case 543:
      return jsonTokW64(0x579c487e, 0x5a38ad0e)
    case 544:
      return jsonTokW64(0xb0af48ec, 0x79ace837)
    case 545:
      return jsonTokW64(0x2d835a9d, 0xf0c6d851)
    case 546:
      return jsonTokW64(0xdcdb1b27, 0x98182244)
    case 547:
      return jsonTokW64(0xf8e43145, 0x6cf88e65)
    case 548:
      return jsonTokW64(0x8a08f0f8, 0xbf0f156b)
    case 549:
      return jsonTokW64(0x1b8e9ecb, 0x641b58ff)
    case 550:
      return jsonTokW64(0xac8b2d36, 0xeed2dac5)
    case 551:
      return jsonTokW64(0xe272467e, 0x3d222f3f)
    case 552:
      return jsonTokW64(0xd7adf884, 0xaa879177)
    case 553:
      return jsonTokW64(0x5b0ed81d, 0xcc6abb0f)
    case 554:
      return jsonTokW64(0x86ccbb52, 0xea94baea)
    case 555:
      return jsonTokW64(0x98e94712, 0x9fc2b4e9)
    case 556:
      return jsonTokW64(0xa87fea27, 0xa539e9a5)
    case 557:
      return jsonTokW64(0x3f2398d7, 0x47b36224)
    case 558:
      return jsonTokW64(0xd29fe4b1, 0x8e88640e)
    case 559:
      return jsonTokW64(0x8eec7f0d, 0x19a03aad)
    case 560:
      return jsonTokW64(0x83a3eeee, 0xf9153e89)
    case 561:
      return jsonTokW64(0x1953cf68, 0x300424ac)
    case 562:
      return jsonTokW64(0xa48ceaaa, 0xb75a8e2b)
    case 563:
      return jsonTokW64(0x5fa8c342, 0x3c052dd7)
    case 564:
      return jsonTokW64(0xcdb02555, 0x653131b6)
    case 565:
      return jsonTokW64(0x3792f412, 0xcb06794d)
    case 566:
      return jsonTokW64(0x808e1755, 0x5f3ebf11)
    case 567:
      return jsonTokW64(0xe2bbd88b, 0xbee40bd0)
    case 568:
      return jsonTokW64(0xa0b19d2a, 0xb70e6ed6)
    case 569:
      return jsonTokW64(0x5b6aceae, 0xae9d0ec4)
    case 570:
      return jsonTokW64(0xc8de0475, 0x64d20a8b)
    case 571:
      return jsonTokW64(0xf245825a, 0x5a445275)
    case 572:
      return jsonTokW64(0xfb158592, 0xbe068d2e)
    case 573:
      return jsonTokW64(0xeed6e2f0, 0xf0d56712)
    case 574:
      return jsonTokW64(0x9ced737b, 0xb6c4183d)
    case 575:
      return jsonTokW64(0x55464dd6, 0x9685606b)
    case 576:
      return jsonTokW64(0xc428d05a, 0xa4751e4c)
    case 577:
      return jsonTokW64(0xaa97e14c, 0x3c26b886)
    case 578:
      return jsonTokW64(0xf5330471, 0x4d9265df)
    case 579:
      return jsonTokW64(0xd53dd99f, 0x4b3066a8)
    case 580:
      return jsonTokW64(0x993fe2c6, 0xd07b7fab)
    case 581:
      return jsonTokW64(0xe546a803, 0x8efe4029)
    case 582:
      return jsonTokW64(0xbf8fdb78, 0x849a5f96)
    case 583:
      return jsonTokW64(0xde985204, 0x72bdd033)
    case 584:
      return jsonTokW64(0xef73d256, 0xa5c0f77c)
    case 585:
      return jsonTokW64(0x963e6685, 0x8f6d4440)
    case 586:
      return jsonTokW64(0x95a86376, 0x27989aad)
    case 587:
      return jsonTokW64(0xdde70013, 0x79a44aa8)
    case 588:
      return jsonTokW64(0xbb127c53, 0xb17ec159)
    case 589:
      return jsonTokW64(0x5560c018, 0x580d5d52)
    case 590:
      return jsonTokW64(0xe9d71b68, 0x9dde71af)
    case 591:
      return jsonTokW64(0xaab8f01e, 0x6e10b4a6)
    case 592:
      return jsonTokW64(0x92267121, 0x62ab070d)
    case 593:
      return jsonTokW64(0xcab39613, 0x04ca70e8)
    case 594:
      return jsonTokW64(0xb6b00d69, 0xbb55c8d1)
    case 595:
      return jsonTokW64(0x3d607b97, 0xc5fd0d22)
    case 596:
      return jsonTokW64(0xe45c10c4, 0x2a2b3b05)
    case 597:
      return jsonTokW64(0x8cb89a7d, 0xb77c506a)
    case 598:
      return jsonTokW64(0x8eb98a7a, 0x9a5b04e3)
    case 599:
      return jsonTokW64(0x77f3608e, 0x92adb242)
    case 600:
      return jsonTokW64(0xb267ed19, 0x40f1c61c)
    case 601:
      return jsonTokW64(0x55f038b2, 0x37591ed3)
    case 602:
      return jsonTokW64(0xdf01e85f, 0x912e37a3)
    case 603:
      return jsonTokW64(0x6b6c46de, 0xc52f6688)
    case 604:
      return jsonTokW64(0x8b61313b, 0xbabce2c6)
    case 605:
      return jsonTokW64(0x2323ac4b, 0x3b3da015)
    case 606:
      return jsonTokW64(0xae397d8a, 0xa96c1b77)
    case 607:
      return jsonTokW64(0xabec975e, 0x0a0d081a)
    case 608:
      return jsonTokW64(0xd9c7dced, 0x53c72255)
    case 609:
      return jsonTokW64(0x96e7bd35, 0x8c904a21)
    case 610:
      return jsonTokW64(0x881cea14, 0x545c7575)
    case 611:
      return jsonTokW64(0x7e50d641, 0x77da2e54)
    case 612:
      return jsonTokW64(0xaa242499, 0x697392d2)
    case 613:
      return jsonTokW64(0xdde50bd1, 0xd5d0b9e9)
    case 614:
      return jsonTokW64(0xd4ad2dbf, 0xc3d07787)
    case 615:
      return jsonTokW64(0x955e4ec6, 0x4b44e864)
    case 616:
      return jsonTokW64(0x84ec3c97, 0xda624ab4)
    case 617:
      return jsonTokW64(0xbd5af13b, 0xef0b113e)
    case 618:
      return jsonTokW64(0xa6274bbd, 0xd0fadd61)
    case 619:
      return jsonTokW64(0xecb1ad8a, 0xeacdd58e)
    case 620:
      return jsonTokW64(0xcfb11ead, 0x453994ba)
    case 621:
      return jsonTokW64(0x67de18ed, 0xa5814af2)
    case 622:
      return jsonTokW64(0x81ceb32c, 0x4b43fcf4)
    case 623:
      return jsonTokW64(0x80eacf94, 0x8770ced7)
    case 624:
      return jsonTokW64(0xa2425ff7, 0x5e14fc31)
    case 625:
      return jsonTokW64(0xa1258379, 0xa94d028d)
    case 626:
      return jsonTokW64(0xcad2f7f5, 0x359a3b3e)
    case 627:
      return jsonTokW64(0x096ee458, 0x13a04330)
    case 628:
      return jsonTokW64(0xfd87b5f2, 0x8300ca0d)
    case 629:
      return jsonTokW64(0x8bca9d6e, 0x188853fc)
    case 630:
      return jsonTokW64(0x9e74d1b7, 0x91e07e48)
    case 631:
      return jsonTokW64(0x775ea264, 0xcf55347e)
    case 632:
      return jsonTokW64(0xc6120625, 0x76589dda)
    case 633:
      return jsonTokW64(0x95364afe, 0x032a819e)
    case 634:
      return jsonTokW64(0xf79687ae, 0xd3eec551)
    case 635:
      return jsonTokW64(0x3a83ddbd, 0x83f52205)
    case 636:
      return jsonTokW64(0x9abe14cd, 0x44753b52)
    case 637:
      return jsonTokW64(0xc4926a96, 0x72793543)
    case 638:
      return jsonTokW64(0xc16d9a00, 0x95928a27)
    case 639:
      return jsonTokW64(0x75b7053c, 0x0f178294)
    case 640:
      return jsonTokW64(0xf1c90080, 0xbaf72cb1)
    case 641:
      return jsonTokW64(0x5324c68b, 0x12dd6339)
    case 642:
      return jsonTokW64(0x971da050, 0x74da7bee)
    case 643:
      return jsonTokW64(0xd3f6fc16, 0xebca5e04)
    case 644:
      return jsonTokW64(0xbce50864, 0x92111aea)
    case 645:
      return jsonTokW64(0x88f4bb1c, 0xa6bcf585)
    case 646:
      return jsonTokW64(0xec1e4a7d, 0xb69561a5)
    case 647:
      return jsonTokW64(0x2b31e9e3, 0xd06c32e6)
    case 648:
      return jsonTokW64(0x9392ee8e, 0x921d5d07)
    case 649:
      return jsonTokW64(0x3aff322e, 0x62439fd0)
    case 650:
      return jsonTokW64(0xb877aa32, 0x36a4b449)
    case 651:
      return jsonTokW64(0x09befeb9, 0xfad487c3)
    case 652:
      return jsonTokW64(0xe69594be, 0xc44de15b)
    case 653:
      return jsonTokW64(0x4c2ebe68, 0x7989a9b4)
    case 654:
      return jsonTokW64(0x901d7cf7, 0x3ab0acd9)
    case 655:
      return jsonTokW64(0x0f9d3701, 0x4bf60a11)
    case 656:
      return jsonTokW64(0xb424dc35, 0x095cd80f)
    case 657:
      return jsonTokW64(0x538484c1, 0x9ef38c95)
    case 658:
      return jsonTokW64(0xe12e1342, 0x4bb40e13)
    case 659:
      return jsonTokW64(0x2865a5f2, 0x06b06fba)
    case 660:
      return jsonTokW64(0x8cbccc09, 0x6f5088cb)
    case 661:
      return jsonTokW64(0xf93f87b7, 0x442e45d4)
    case 662:
      return jsonTokW64(0xafebff0b, 0xcb24aafe)
    case 663:
      return jsonTokW64(0xf78f69a5, 0x1539d749)
    case 664:
      return jsonTokW64(0xdbe6fece, 0xbdedd5be)
    case 665:
      return jsonTokW64(0xb573440e, 0x5a884d1c)
    case 666:
      return jsonTokW64(0x89705f41, 0x36b4a597)
    case 667:
      return jsonTokW64(0x31680a88, 0xf8953031)
    case 668:
      return jsonTokW64(0xabcc7711, 0x8461cefc)
    case 669:
      return jsonTokW64(0xfdc20d2b, 0x36ba7c3e)
    case 670:
      return jsonTokW64(0xd6bf94d5, 0xe57a42bc)
    case 671:
      return jsonTokW64(0x3d329076, 0x04691b4d)
    case 672:
      return jsonTokW64(0x8637bd05, 0xaf6c69b5)
    case 673:
      return jsonTokW64(0xa63f9a49, 0xc2c1b110)
    case 674:
      return jsonTokW64(0xa7c5ac47, 0x1b478423)
    case 675:
      return jsonTokW64(0x0fcf80dc, 0x33721d54)
    case 676:
      return jsonTokW64(0xd1b71758, 0xe219652b)
    case 677:
      return jsonTokW64(0xd3c36113, 0x404ea4a9)
    case 678:
      return jsonTokW64(0x83126e97, 0x8d4fdf3b)
    case 679:
      return jsonTokW64(0x645a1cac, 0x083126ea)
    case 680:
      return jsonTokW64(0xa3d70a3d, 0x70a3d70a)
    case 681:
      return jsonTokW64(0x3d70a3d7, 0x0a3d70a4)
    case 682:
      return jsonTokW64(0xcccccccc, 0xcccccccc)
    case 683:
      return jsonTokW64(0xcccccccc, 0xcccccccd)
    case 684:
      return jsonTokW64(0x80000000, 0x00000000)
    case 685:
      return jsonTokW64(0x00000000, 0x00000000)
    case 686:
      return jsonTokW64(0xa0000000, 0x00000000)
    case 687:
      return jsonTokW64(0x00000000, 0x00000000)
    case 688:
      return jsonTokW64(0xc8000000, 0x00000000)
    case 689:
      return jsonTokW64(0x00000000, 0x00000000)
    case 690:
      return jsonTokW64(0xfa000000, 0x00000000)
    case 691:
      return jsonTokW64(0x00000000, 0x00000000)
    case 692:
      return jsonTokW64(0x9c400000, 0x00000000)
    case 693:
      return jsonTokW64(0x00000000, 0x00000000)
    case 694:
      return jsonTokW64(0xc3500000, 0x00000000)
    case 695:
      return jsonTokW64(0x00000000, 0x00000000)
    case 696:
      return jsonTokW64(0xf4240000, 0x00000000)
    case 697:
      return jsonTokW64(0x00000000, 0x00000000)
    case 698:
      return jsonTokW64(0x98968000, 0x00000000)
    case 699:
      return jsonTokW64(0x00000000, 0x00000000)
    case 700:
      return jsonTokW64(0xbebc2000, 0x00000000)
    case 701:
      return jsonTokW64(0x00000000, 0x00000000)
    case 702:
      return jsonTokW64(0xee6b2800, 0x00000000)
    case 703:
      return jsonTokW64(0x00000000, 0x00000000)
    case 704:
      return jsonTokW64(0x9502f900, 0x00000000)
    case 705:
      return jsonTokW64(0x00000000, 0x00000000)
    case 706:
      return jsonTokW64(0xba43b740, 0x00000000)
    case 707:
      return jsonTokW64(0x00000000, 0x00000000)
    case 708:
      return jsonTokW64(0xe8d4a510, 0x00000000)
    case 709:
      return jsonTokW64(0x00000000, 0x00000000)
    case 710:
      return jsonTokW64(0x9184e72a, 0x00000000)
    case 711:
      return jsonTokW64(0x00000000, 0x00000000)
    case 712:
      return jsonTokW64(0xb5e620f4, 0x80000000)
    case 713:
      return jsonTokW64(0x00000000, 0x00000000)
    case 714:
      return jsonTokW64(0xe35fa931, 0xa0000000)
    case 715:
      return jsonTokW64(0x00000000, 0x00000000)
    case 716:
      return jsonTokW64(0x8e1bc9bf, 0x04000000)
    case 717:
      return jsonTokW64(0x00000000, 0x00000000)
    case 718:
      return jsonTokW64(0xb1a2bc2e, 0xc5000000)
    case 719:
      return jsonTokW64(0x00000000, 0x00000000)
    case 720:
      return jsonTokW64(0xde0b6b3a, 0x76400000)
    case 721:
      return jsonTokW64(0x00000000, 0x00000000)
    case 722:
      return jsonTokW64(0x8ac72304, 0x89e80000)
    case 723:
      return jsonTokW64(0x00000000, 0x00000000)
    case 724:
      return jsonTokW64(0xad78ebc5, 0xac620000)
    case 725:
      return jsonTokW64(0x00000000, 0x00000000)
    case 726:
      return jsonTokW64(0xd8d726b7, 0x177a8000)
    case 727:
      return jsonTokW64(0x00000000, 0x00000000)
    case 728:
      return jsonTokW64(0x87867832, 0x6eac9000)
    case 729:
      return jsonTokW64(0x00000000, 0x00000000)
    case 730:
      return jsonTokW64(0xa968163f, 0x0a57b400)
    case 731:
      return jsonTokW64(0x00000000, 0x00000000)
    case 732:
      return jsonTokW64(0xd3c21bce, 0xcceda100)
    case 733:
      return jsonTokW64(0x00000000, 0x00000000)
    case 734:
      return jsonTokW64(0x84595161, 0x401484a0)
    case 735:
      return jsonTokW64(0x00000000, 0x00000000)
    case 736:
      return jsonTokW64(0xa56fa5b9, 0x9019a5c8)
    case 737:
      return jsonTokW64(0x00000000, 0x00000000)
    case 738:
      return jsonTokW64(0xcecb8f27, 0xf4200f3a)
    case 739:
      return jsonTokW64(0x00000000, 0x00000000)
    case 740:
      return jsonTokW64(0x813f3978, 0xf8940984)
    case 741:
      return jsonTokW64(0x40000000, 0x00000000)
    case 742:
      return jsonTokW64(0xa18f07d7, 0x36b90be5)
    case 743:
      return jsonTokW64(0x50000000, 0x00000000)
    case 744:
      return jsonTokW64(0xc9f2c9cd, 0x04674ede)
    case 745:
      return jsonTokW64(0xa4000000, 0x00000000)
    case 746:
      return jsonTokW64(0xfc6f7c40, 0x45812296)
    case 747:
      return jsonTokW64(0x4d000000, 0x00000000)
    case 748:
      return jsonTokW64(0x9dc5ada8, 0x2b70b59d)
    case 749:
      return jsonTokW64(0xf0200000, 0x00000000)
    case 750:
      return jsonTokW64(0xc5371912, 0x364ce305)
    case 751:
      return jsonTokW64(0x6c280000, 0x00000000)
    case 752:
      return jsonTokW64(0xf684df56, 0xc3e01bc6)
    case 753:
      return jsonTokW64(0xc7320000, 0x00000000)
    case 754:
      return jsonTokW64(0x9a130b96, 0x3a6c115c)
    case 755:
      return jsonTokW64(0x3c7f4000, 0x00000000)
    case 756:
      return jsonTokW64(0xc097ce7b, 0xc90715b3)
    case 757:
      return jsonTokW64(0x4b9f1000, 0x00000000)
    case 758:
      return jsonTokW64(0xf0bdc21a, 0xbb48db20)
    case 759:
      return jsonTokW64(0x1e86d400, 0x00000000)
    case 760:
      return jsonTokW64(0x96769950, 0xb50d88f4)
    case 761:
      return jsonTokW64(0x13144480, 0x00000000)
    case 762:
      return jsonTokW64(0xbc143fa4, 0xe250eb31)
    case 763:
      return jsonTokW64(0x17d955a0, 0x00000000)
    case 764:
      return jsonTokW64(0xeb194f8e, 0x1ae525fd)
    case 765:
      return jsonTokW64(0x5dcfab08, 0x00000000)
    case 766:
      return jsonTokW64(0x92efd1b8, 0xd0cf37be)
    case 767:
      return jsonTokW64(0x5aa1cae5, 0x00000000)
    case 768:
      return jsonTokW64(0xb7abc627, 0x050305ad)
    case 769:
      return jsonTokW64(0xf14a3d9e, 0x40000000)
    case 770:
      return jsonTokW64(0xe596b7b0, 0xc643c719)
    case 771:
      return jsonTokW64(0x6d9ccd05, 0xd0000000)
    case 772:
      return jsonTokW64(0x8f7e32ce, 0x7bea5c6f)
    case 773:
      return jsonTokW64(0xe4820023, 0xa2000000)
    case 774:
      return jsonTokW64(0xb35dbf82, 0x1ae4f38b)
    case 775:
      return jsonTokW64(0xdda2802c, 0x8a800000)
    case 776:
      return jsonTokW64(0xe0352f62, 0xa19e306e)
    case 777:
      return jsonTokW64(0xd50b2037, 0xad200000)
    case 778:
      return jsonTokW64(0x8c213d9d, 0xa502de45)
    case 779:
      return jsonTokW64(0x4526f422, 0xcc340000)
    case 780:
      return jsonTokW64(0xaf298d05, 0x0e4395d6)
    case 781:
      return jsonTokW64(0x9670b12b, 0x7f410000)
    case 782:
      return jsonTokW64(0xdaf3f046, 0x51d47b4c)
    case 783:
      return jsonTokW64(0x3c0cdd76, 0x5f114000)
    case 784:
      return jsonTokW64(0x88d8762b, 0xf324cd0f)
    case 785:
      return jsonTokW64(0xa5880a69, 0xfb6ac800)
    case 786:
      return jsonTokW64(0xab0e93b6, 0xefee0053)
    case 787:
      return jsonTokW64(0x8eea0d04, 0x7a457a00)
    case 788:
      return jsonTokW64(0xd5d238a4, 0xabe98068)
    case 789:
      return jsonTokW64(0x72a49045, 0x98d6d880)
    case 790:
      return jsonTokW64(0x85a36366, 0xeb71f041)
    case 791:
      return jsonTokW64(0x47a6da2b, 0x7f864750)
    case 792:
      return jsonTokW64(0xa70c3c40, 0xa64e6c51)
    case 793:
      return jsonTokW64(0x999090b6, 0x5f67d924)
    case 794:
      return jsonTokW64(0xd0cf4b50, 0xcfe20765)
    case 795:
      return jsonTokW64(0xfff4b4e3, 0xf741cf6d)
    case 796:
      return jsonTokW64(0x82818f12, 0x81ed449f)
    case 797:
      return jsonTokW64(0xbff8f10e, 0x7a8921a4)
    case 798:
      return jsonTokW64(0xa321f2d7, 0x226895c7)
    case 799:
      return jsonTokW64(0xaff72d52, 0x192b6a0d)
    case 800:
      return jsonTokW64(0xcbea6f8c, 0xeb02bb39)
    case 801:
      return jsonTokW64(0x9bf4f8a6, 0x9f764490)
    case 802:
      return jsonTokW64(0xfee50b70, 0x25c36a08)
    case 803:
      return jsonTokW64(0x02f236d0, 0x4753d5b4)
    case 804:
      return jsonTokW64(0x9f4f2726, 0x179a2245)
    case 805:
      return jsonTokW64(0x01d76242, 0x2c946590)
    case 806:
      return jsonTokW64(0xc722f0ef, 0x9d80aad6)
    case 807:
      return jsonTokW64(0x424d3ad2, 0xb7b97ef5)
    case 808:
      return jsonTokW64(0xf8ebad2b, 0x84e0d58b)
    case 809:
      return jsonTokW64(0xd2e08987, 0x65a7deb2)
    case 810:
      return jsonTokW64(0x9b934c3b, 0x330c8577)
    case 811:
      return jsonTokW64(0x63cc55f4, 0x9f88eb2f)
    case 812:
      return jsonTokW64(0xc2781f49, 0xffcfa6d5)
    case 813:
      return jsonTokW64(0x3cbf6b71, 0xc76b25fb)
    case 814:
      return jsonTokW64(0xf316271c, 0x7fc3908a)
    case 815:
      return jsonTokW64(0x8bef464e, 0x3945ef7a)
    case 816:
      return jsonTokW64(0x97edd871, 0xcfda3a56)
    case 817:
      return jsonTokW64(0x97758bf0, 0xe3cbb5ac)
    case 818:
      return jsonTokW64(0xbde94e8e, 0x43d0c8ec)
    case 819:
      return jsonTokW64(0x3d52eeed, 0x1cbea317)
    case 820:
      return jsonTokW64(0xed63a231, 0xd4c4fb27)
    case 821:
      return jsonTokW64(0x4ca7aaa8, 0x63ee4bdd)
    case 822:
      return jsonTokW64(0x945e455f, 0x24fb1cf8)
    case 823:
      return jsonTokW64(0x8fe8caa9, 0x3e74ef6a)
    case 824:
      return jsonTokW64(0xb975d6b6, 0xee39e436)
    case 825:
      return jsonTokW64(0xb3e2fd53, 0x8e122b44)
    case 826:
      return jsonTokW64(0xe7d34c64, 0xa9c85d44)
    case 827:
      return jsonTokW64(0x60dbbca8, 0x7196b616)
    case 828:
      return jsonTokW64(0x90e40fbe, 0xea1d3a4a)
    case 829:
      return jsonTokW64(0xbc8955e9, 0x46fe31cd)
    case 830:
      return jsonTokW64(0xb51d13ae, 0xa4a488dd)
    case 831:
      return jsonTokW64(0x6babab63, 0x98bdbe41)
    case 832:
      return jsonTokW64(0xe264589a, 0x4dcdab14)
    case 833:
      return jsonTokW64(0xc696963c, 0x7eed2dd1)
    case 834:
      return jsonTokW64(0x8d7eb760, 0x70a08aec)
    case 835:
      return jsonTokW64(0xfc1e1de5, 0xcf543ca2)
    case 836:
      return jsonTokW64(0xb0de6538, 0x8cc8ada8)
    case 837:
      return jsonTokW64(0x3b25a55f, 0x43294bcb)
    case 838:
      return jsonTokW64(0xdd15fe86, 0xaffad912)
    case 839:
      return jsonTokW64(0x49ef0eb7, 0x13f39ebe)
    case 840:
      return jsonTokW64(0x8a2dbf14, 0x2dfcc7ab)
    case 841:
      return jsonTokW64(0x6e356932, 0x6c784337)
    case 842:
      return jsonTokW64(0xacb92ed9, 0x397bf996)
    case 843:
      return jsonTokW64(0x49c2c37f, 0x07965404)
    case 844:
      return jsonTokW64(0xd7e77a8f, 0x87daf7fb)
    case 845:
      return jsonTokW64(0xdc33745e, 0xc97be906)
    case 846:
      return jsonTokW64(0x86f0ac99, 0xb4e8dafd)
    case 847:
      return jsonTokW64(0x69a028bb, 0x3ded71a3)
    case 848:
      return jsonTokW64(0xa8acd7c0, 0x222311bc)
    case 849:
      return jsonTokW64(0xc40832ea, 0x0d68ce0c)
    case 850:
      return jsonTokW64(0xd2d80db0, 0x2aabd62b)
    case 851:
      return jsonTokW64(0xf50a3fa4, 0x90c30190)
    case 852:
      return jsonTokW64(0x83c7088e, 0x1aab65db)
    case 853:
      return jsonTokW64(0x792667c6, 0xda79e0fa)
    case 854:
      return jsonTokW64(0xa4b8cab1, 0xa1563f52)
    case 855:
      return jsonTokW64(0x577001b8, 0x91185938)
    case 856:
      return jsonTokW64(0xcde6fd5e, 0x09abcf26)
    case 857:
      return jsonTokW64(0xed4c0226, 0xb55e6f86)
    case 858:
      return jsonTokW64(0x80b05e5a, 0xc60b6178)
    case 859:
      return jsonTokW64(0x544f8158, 0x315b05b4)
    case 860:
      return jsonTokW64(0xa0dc75f1, 0x778e39d6)
    case 861:
      return jsonTokW64(0x696361ae, 0x3db1c721)
    case 862:
      return jsonTokW64(0xc913936d, 0xd571c84c)
    case 863:
      return jsonTokW64(0x03bc3a19, 0xcd1e38e9)
    case 864:
      return jsonTokW64(0xfb587849, 0x4ace3a5f)
    case 865:
      return jsonTokW64(0x04ab48a0, 0x4065c723)
    case 866:
      return jsonTokW64(0x9d174b2d, 0xcec0e47b)
    case 867:
      return jsonTokW64(0x62eb0d64, 0x283f9c76)
    case 868:
      return jsonTokW64(0xc45d1df9, 0x42711d9a)
    case 869:
      return jsonTokW64(0x3ba5d0bd, 0x324f8394)
    case 870:
      return jsonTokW64(0xf5746577, 0x930d6500)
    case 871:
      return jsonTokW64(0xca8f44ec, 0x7ee36479)
    case 872:
      return jsonTokW64(0x9968bf6a, 0xbbe85f20)
    case 873:
      return jsonTokW64(0x7e998b13, 0xcf4e1ecb)
    case 874:
      return jsonTokW64(0xbfc2ef45, 0x6ae276e8)
    case 875:
      return jsonTokW64(0x9e3fedd8, 0xc321a67e)
    case 876:
      return jsonTokW64(0xefb3ab16, 0xc59b14a2)
    case 877:
      return jsonTokW64(0xc5cfe94e, 0xf3ea101e)
    case 878:
      return jsonTokW64(0x95d04aee, 0x3b80ece5)
    case 879:
      return jsonTokW64(0xbba1f1d1, 0x58724a12)
    case 880:
      return jsonTokW64(0xbb445da9, 0xca61281f)
    case 881:
      return jsonTokW64(0x2a8a6e45, 0xae8edc97)
    case 882:
      return jsonTokW64(0xea157514, 0x3cf97226)
    case 883:
      return jsonTokW64(0xf52d09d7, 0x1a3293bd)
    case 884:
      return jsonTokW64(0x924d692c, 0xa61be758)
    case 885:
      return jsonTokW64(0x593c2626, 0x705f9c56)
    case 886:
      return jsonTokW64(0xb6e0c377, 0xcfa2e12e)
    case 887:
      return jsonTokW64(0x6f8b2fb0, 0x0c77836c)
    case 888:
      return jsonTokW64(0xe498f455, 0xc38b997a)
    case 889:
      return jsonTokW64(0x0b6dfb9c, 0x0f956447)
    case 890:
      return jsonTokW64(0x8edf98b5, 0x9a373fec)
    case 891:
      return jsonTokW64(0x4724bd41, 0x89bd5eac)
    case 892:
      return jsonTokW64(0xb2977ee3, 0x00c50fe7)
    case 893:
      return jsonTokW64(0x58edec91, 0xec2cb657)
    case 894:
      return jsonTokW64(0xdf3d5e9b, 0xc0f653e1)
    case 895:
      return jsonTokW64(0x2f2967b6, 0x6737e3ed)
    case 896:
      return jsonTokW64(0x8b865b21, 0x5899f46c)
    case 897:
      return jsonTokW64(0xbd79e0d2, 0x0082ee74)
    case 898:
      return jsonTokW64(0xae67f1e9, 0xaec07187)
    case 899:
      return jsonTokW64(0xecd85906, 0x80a3aa11)
    case 900:
      return jsonTokW64(0xda01ee64, 0x1a708de9)
    case 901:
      return jsonTokW64(0xe80e6f48, 0x20cc9495)
    case 902:
      return jsonTokW64(0x884134fe, 0x908658b2)
    case 903:
      return jsonTokW64(0x3109058d, 0x147fdcdd)
    case 904:
      return jsonTokW64(0xaa51823e, 0x34a7eede)
    case 905:
      return jsonTokW64(0xbd4b46f0, 0x599fd415)
    case 906:
      return jsonTokW64(0xd4e5e2cd, 0xc1d1ea96)
    case 907:
      return jsonTokW64(0x6c9e18ac, 0x7007c91a)
    case 908:
      return jsonTokW64(0x850fadc0, 0x9923329e)
    case 909:
      return jsonTokW64(0x03e2cf6b, 0xc604ddb0)
    case 910:
      return jsonTokW64(0xa6539930, 0xbf6bff45)
    case 911:
      return jsonTokW64(0x84db8346, 0xb786151c)
    case 912:
      return jsonTokW64(0xcfe87f7c, 0xef46ff16)
    case 913:
      return jsonTokW64(0xe6126418, 0x65679a63)
    case 914:
      return jsonTokW64(0x81f14fae, 0x158c5f6e)
    case 915:
      return jsonTokW64(0x4fcb7e8f, 0x3f60c07e)
    case 916:
      return jsonTokW64(0xa26da399, 0x9aef7749)
    case 917:
      return jsonTokW64(0xe3be5e33, 0x0f38f09d)
    case 918:
      return jsonTokW64(0xcb090c80, 0x01ab551c)
    case 919:
      return jsonTokW64(0x5cadf5bf, 0xd3072cc5)
    case 920:
      return jsonTokW64(0xfdcb4fa0, 0x02162a63)
    case 921:
      return jsonTokW64(0x73d9732f, 0xc7c8f7f6)
    case 922:
      return jsonTokW64(0x9e9f11c4, 0x014dda7e)
    case 923:
      return jsonTokW64(0x2867e7fd, 0xdcdd9afa)
    case 924:
      return jsonTokW64(0xc646d635, 0x01a1511d)
    case 925:
      return jsonTokW64(0xb281e1fd, 0x541501b8)
    case 926:
      return jsonTokW64(0xf7d88bc2, 0x4209a565)
    case 927:
      return jsonTokW64(0x1f225a7c, 0xa91a4226)
    case 928:
      return jsonTokW64(0x9ae75759, 0x6946075f)
    case 929:
      return jsonTokW64(0x3375788d, 0xe9b06958)
    case 930:
      return jsonTokW64(0xc1a12d2f, 0xc3978937)
    case 931:
      return jsonTokW64(0x0052d6b1, 0x641c83ae)
    case 932:
      return jsonTokW64(0xf209787b, 0xb47d6b84)
    case 933:
      return jsonTokW64(0xc0678c5d, 0xbd23a49a)
    case 934:
      return jsonTokW64(0x9745eb4d, 0x50ce6332)
    case 935:
      return jsonTokW64(0xf840b7ba, 0x963646e0)
    case 936:
      return jsonTokW64(0xbd176620, 0xa501fbff)
    case 937:
      return jsonTokW64(0xb650e5a9, 0x3bc3d898)
    case 938:
      return jsonTokW64(0xec5d3fa8, 0xce427aff)
    case 939:
      return jsonTokW64(0xa3e51f13, 0x8ab4cebe)
    case 940:
      return jsonTokW64(0x93ba47c9, 0x80e98cdf)
    case 941:
      return jsonTokW64(0xc66f336c, 0x36b10137)
    case 942:
      return jsonTokW64(0xb8a8d9bb, 0xe123f017)
    case 943:
      return jsonTokW64(0xb80b0047, 0x445d4184)
    case 944:
      return jsonTokW64(0xe6d3102a, 0xd96cec1d)
    case 945:
      return jsonTokW64(0xa60dc059, 0x157491e5)
    case 946:
      return jsonTokW64(0x9043ea1a, 0xc7e41392)
    case 947:
      return jsonTokW64(0x87c89837, 0xad68db2f)
    case 948:
      return jsonTokW64(0xb454e4a1, 0x79dd1877)
    case 949:
      return jsonTokW64(0x29babe45, 0x98c311fb)
    case 950:
      return jsonTokW64(0xe16a1dc9, 0xd8545e94)
    case 951:
      return jsonTokW64(0xf4296dd6, 0xfef3d67a)
    case 952:
      return jsonTokW64(0x8ce2529e, 0x2734bb1d)
    case 953:
      return jsonTokW64(0x1899e4a6, 0x5f58660c)
    case 954:
      return jsonTokW64(0xb01ae745, 0xb101e9e4)
    case 955:
      return jsonTokW64(0x5ec05dcf, 0xf72e7f8f)
    case 956:
      return jsonTokW64(0xdc21a117, 0x1d42645d)
    case 957:
      return jsonTokW64(0x76707543, 0xf4fa1f73)
    case 958:
      return jsonTokW64(0x899504ae, 0x72497eba)
    case 959:
      return jsonTokW64(0x6a06494a, 0x791c53a8)
    case 960:
      return jsonTokW64(0xabfa45da, 0x0edbde69)
    case 961:
      return jsonTokW64(0x0487db9d, 0x17636892)
    case 962:
      return jsonTokW64(0xd6f8d750, 0x9292d603)
    case 963:
      return jsonTokW64(0x45a9d284, 0x5d3c42b6)
    case 964:
      return jsonTokW64(0x865b8692, 0x5b9bc5c2)
    case 965:
      return jsonTokW64(0x0b8a2392, 0xba45a9b2)
    case 966:
      return jsonTokW64(0xa7f26836, 0xf282b732)
    case 967:
      return jsonTokW64(0x8e6cac77, 0x68d7141e)
    case 968:
      return jsonTokW64(0xd1ef0244, 0xaf2364ff)
    case 969:
      return jsonTokW64(0x3207d795, 0x430cd926)
    case 970:
      return jsonTokW64(0x8335616a, 0xed761f1f)
    case 971:
      return jsonTokW64(0x7f44e6bd, 0x49e807b8)
    case 972:
      return jsonTokW64(0xa402b9c5, 0xa8d3a6e7)
    case 973:
      return jsonTokW64(0x5f16206c, 0x9c6209a6)
    case 974:
      return jsonTokW64(0xcd036837, 0x130890a1)
    case 975:
      return jsonTokW64(0x36dba887, 0xc37a8c0f)
    case 976:
      return jsonTokW64(0x80222122, 0x6be55a64)
    case 977:
      return jsonTokW64(0xc2494954, 0xda2c9789)
    case 978:
      return jsonTokW64(0xa02aa96b, 0x06deb0fd)
    case 979:
      return jsonTokW64(0xf2db9baa, 0x10b7bd6c)
    case 980:
      return jsonTokW64(0xc83553c5, 0xc8965d3d)
    case 981:
      return jsonTokW64(0x6f928294, 0x94e5acc7)
    case 982:
      return jsonTokW64(0xfa42a8b7, 0x3abbf48c)
    case 983:
      return jsonTokW64(0xcb772339, 0xba1f17f9)
    case 984:
      return jsonTokW64(0x9c69a972, 0x84b578d7)
    case 985:
      return jsonTokW64(0xff2a7604, 0x14536efb)
    case 986:
      return jsonTokW64(0xc38413cf, 0x25e2d70d)
    case 987:
      return jsonTokW64(0xfef51385, 0x19684aba)
    case 988:
      return jsonTokW64(0xf46518c2, 0xef5b8cd1)
    case 989:
      return jsonTokW64(0x7eb25866, 0x5fc25d69)
    case 990:
      return jsonTokW64(0x98bf2f79, 0xd5993802)
    case 991:
      return jsonTokW64(0xef2f773f, 0xfbd97a61)
    case 992:
      return jsonTokW64(0xbeeefb58, 0x4aff8603)
    case 993:
      return jsonTokW64(0xaafb550f, 0xfacfd8fa)
    case 994:
      return jsonTokW64(0xeeaaba2e, 0x5dbf6784)
    case 995:
      return jsonTokW64(0x95ba2a53, 0xf983cf38)
    case 996:
      return jsonTokW64(0x952ab45c, 0xfa97a0b2)
    case 997:
      return jsonTokW64(0xdd945a74, 0x7bf26183)
    case 998:
      return jsonTokW64(0xba756174, 0x393d88df)
    case 999:
      return jsonTokW64(0x94f97111, 0x9aeef9e4)
    case 1000:
      return jsonTokW64(0xe912b9d1, 0x478ceb17)
    case 1001:
      return jsonTokW64(0x7a37cd56, 0x01aab85d)
    case 1002:
      return jsonTokW64(0x91abb422, 0xccb812ee)
    case 1003:
      return jsonTokW64(0xac62e055, 0xc10ab33a)
    case 1004:
      return jsonTokW64(0xb616a12b, 0x7fe617aa)
    case 1005:
      return jsonTokW64(0x577b986b, 0x314d6009)
    case 1006:
      return jsonTokW64(0xe39c4976, 0x5fdf9d94)
    case 1007:
      return jsonTokW64(0xed5a7e85, 0xfda0b80b)
    case 1008:
      return jsonTokW64(0x8e41ade9, 0xfbebc27d)
    case 1009:
      return jsonTokW64(0x14588f13, 0xbe847307)
    case 1010:
      return jsonTokW64(0xb1d21964, 0x7ae6b31c)
    case 1011:
      return jsonTokW64(0x596eb2d8, 0xae258fc8)
    case 1012:
      return jsonTokW64(0xde469fbd, 0x99a05fe3)
    case 1013:
      return jsonTokW64(0x6fca5f8e, 0xd9aef3bb)
    case 1014:
      return jsonTokW64(0x8aec23d6, 0x80043bee)
    case 1015:
      return jsonTokW64(0x25de7bb9, 0x480d5854)
    case 1016:
      return jsonTokW64(0xada72ccc, 0x20054ae9)
    case 1017:
      return jsonTokW64(0xaf561aa7, 0x9a10ae6a)
    case 1018:
      return jsonTokW64(0xd910f7ff, 0x28069da4)
    case 1019:
      return jsonTokW64(0x1b2ba151, 0x8094da04)
    case 1020:
      return jsonTokW64(0x87aa9aff, 0x79042286)
    case 1021:
      return jsonTokW64(0x90fb44d2, 0xf05d0842)
    case 1022:
      return jsonTokW64(0xa99541bf, 0x57452b28)
    case 1023:
      return jsonTokW64(0x353a1607, 0xac744a53)
    case 1024:
      return jsonTokW64(0xd3fa922f, 0x2d1675f2)
    case 1025:
      return jsonTokW64(0x42889b89, 0x97915ce8)
    case 1026:
      return jsonTokW64(0x847c9b5d, 0x7c2e09b7)
    case 1027:
      return jsonTokW64(0x69956135, 0xfebada11)
    case 1028:
      return jsonTokW64(0xa59bc234, 0xdb398c25)
    case 1029:
      return jsonTokW64(0x43fab983, 0x7e699095)
    case 1030:
      return jsonTokW64(0xcf02b2c2, 0x1207ef2e)
    case 1031:
      return jsonTokW64(0x94f967e4, 0x5e03f4bb)
    case 1032:
      return jsonTokW64(0x8161afb9, 0x4b44f57d)
    case 1033:
      return jsonTokW64(0x1d1be0ee, 0xbac278f5)
    case 1034:
      return jsonTokW64(0xa1ba1ba7, 0x9e1632dc)
    case 1035:
      return jsonTokW64(0x6462d92a, 0x69731732)
    case 1036:
      return jsonTokW64(0xca28a291, 0x859bbf93)
    case 1037:
      return jsonTokW64(0x7d7b8f75, 0x03cfdcfe)
    case 1038:
      return jsonTokW64(0xfcb2cb35, 0xe702af78)
    case 1039:
      return jsonTokW64(0x5cda7352, 0x44c3d43e)
    case 1040:
      return jsonTokW64(0x9defbf01, 0xb061adab)
    case 1041:
      return jsonTokW64(0x3a088813, 0x6afa64a7)
    case 1042:
      return jsonTokW64(0xc56baec2, 0x1c7a1916)
    case 1043:
      return jsonTokW64(0x088aaa18, 0x45b8fdd0)
    case 1044:
      return jsonTokW64(0xf6c69a72, 0xa3989f5b)
    case 1045:
      return jsonTokW64(0x8aad549e, 0x57273d45)
    case 1046:
      return jsonTokW64(0x9a3c2087, 0xa63f6399)
    case 1047:
      return jsonTokW64(0x36ac54e2, 0xf678864b)
    case 1048:
      return jsonTokW64(0xc0cb28a9, 0x8fcf3c7f)
    case 1049:
      return jsonTokW64(0x84576a1b, 0xb416a7dd)
    case 1050:
      return jsonTokW64(0xf0fdf2d3, 0xf3c30b9f)
    case 1051:
      return jsonTokW64(0x656d44a2, 0xa11c51d5)
    case 1052:
      return jsonTokW64(0x969eb7c4, 0x7859e743)
    case 1053:
      return jsonTokW64(0x9f644ae5, 0xa4b1b325)
    case 1054:
      return jsonTokW64(0xbc4665b5, 0x96706114)
    case 1055:
      return jsonTokW64(0x873d5d9f, 0x0dde1fee)
    case 1056:
      return jsonTokW64(0xeb57ff22, 0xfc0c7959)
    case 1057:
      return jsonTokW64(0xa90cb506, 0xd155a7ea)
    case 1058:
      return jsonTokW64(0x9316ff75, 0xdd87cbd8)
    case 1059:
      return jsonTokW64(0x09a7f124, 0x42d588f2)
    case 1060:
      return jsonTokW64(0xb7dcbf53, 0x54e9bece)
    case 1061:
      return jsonTokW64(0x0c11ed6d, 0x538aeb2f)
    case 1062:
      return jsonTokW64(0xe5d3ef28, 0x2a242e81)
    case 1063:
      return jsonTokW64(0x8f1668c8, 0xa86da5fa)
    case 1064:
      return jsonTokW64(0x8fa47579, 0x1a569d10)
    case 1065:
      return jsonTokW64(0xf96e017d, 0x694487bc)
    case 1066:
      return jsonTokW64(0xb38d92d7, 0x60ec4455)
    case 1067:
      return jsonTokW64(0x37c981dc, 0xc395a9ac)
    case 1068:
      return jsonTokW64(0xe070f78d, 0x3927556a)
    case 1069:
      return jsonTokW64(0x85bbe253, 0xf47b1417)
    case 1070:
      return jsonTokW64(0x8c469ab8, 0x43b89562)
    case 1071:
      return jsonTokW64(0x93956d74, 0x78ccec8e)
    case 1072:
      return jsonTokW64(0xaf584166, 0x54a6babb)
    case 1073:
      return jsonTokW64(0x387ac8d1, 0x970027b2)
    case 1074:
      return jsonTokW64(0xdb2e51bf, 0xe9d0696a)
    case 1075:
      return jsonTokW64(0x06997b05, 0xfcc0319e)
    case 1076:
      return jsonTokW64(0x88fcf317, 0xf22241e2)
    case 1077:
      return jsonTokW64(0x441fece3, 0xbdf81f03)
    case 1078:
      return jsonTokW64(0xab3c2fdd, 0xeeaad25a)
    case 1079:
      return jsonTokW64(0xd527e81c, 0xad7626c3)
    case 1080:
      return jsonTokW64(0xd60b3bd5, 0x6a5586f1)
    case 1081:
      return jsonTokW64(0x8a71e223, 0xd8d3b074)
    case 1082:
      return jsonTokW64(0x85c70565, 0x62757456)
    case 1083:
      return jsonTokW64(0xf6872d56, 0x67844e49)
    case 1084:
      return jsonTokW64(0xa738c6be, 0xbb12d16c)
    case 1085:
      return jsonTokW64(0xb428f8ac, 0x016561db)
    case 1086:
      return jsonTokW64(0xd106f86e, 0x69d785c7)
    case 1087:
      return jsonTokW64(0xe13336d7, 0x01beba52)
    case 1088:
      return jsonTokW64(0x82a45b45, 0x0226b39c)
    case 1089:
      return jsonTokW64(0xecc00246, 0x61173473)
    case 1090:
      return jsonTokW64(0xa34d7216, 0x42b06084)
    case 1091:
      return jsonTokW64(0x27f002d7, 0xf95d0190)
    case 1092:
      return jsonTokW64(0xcc20ce9b, 0xd35c78a5)
    case 1093:
      return jsonTokW64(0x31ec038d, 0xf7b441f4)
    case 1094:
      return jsonTokW64(0xff290242, 0xc83396ce)
    case 1095:
      return jsonTokW64(0x7e670471, 0x75a15271)
    case 1096:
      return jsonTokW64(0x9f79a169, 0xbd203e41)
    case 1097:
      return jsonTokW64(0x0f0062c6, 0xe984d386)
    case 1098:
      return jsonTokW64(0xc75809c4, 0x2c684dd1)
    case 1099:
      return jsonTokW64(0x52c07b78, 0xa3e60868)
    case 1100:
      return jsonTokW64(0xf92e0c35, 0x37826145)
    case 1101:
      return jsonTokW64(0xa7709a56, 0xccdf8a82)
    case 1102:
      return jsonTokW64(0x9bbcc7a1, 0x42b17ccb)
    case 1103:
      return jsonTokW64(0x88a66076, 0x400bb691)
    case 1104:
      return jsonTokW64(0xc2abf989, 0x935ddbfe)
    case 1105:
      return jsonTokW64(0x6acff893, 0xd00ea435)
    case 1106:
      return jsonTokW64(0xf356f7eb, 0xf83552fe)
    case 1107:
      return jsonTokW64(0x0583f6b8, 0xc4124d43)
    case 1108:
      return jsonTokW64(0x98165af3, 0x7b2153de)
    case 1109:
      return jsonTokW64(0xc3727a33, 0x7a8b704a)
    case 1110:
      return jsonTokW64(0xbe1bf1b0, 0x59e9a8d6)
    case 1111:
      return jsonTokW64(0x744f18c0, 0x592e4c5c)
    case 1112:
      return jsonTokW64(0xeda2ee1c, 0x7064130c)
    case 1113:
      return jsonTokW64(0x1162def0, 0x6f79df73)
    case 1114:
      return jsonTokW64(0x9485d4d1, 0xc63e8be7)
    case 1115:
      return jsonTokW64(0x8addcb56, 0x45ac2ba8)
    case 1116:
      return jsonTokW64(0xb9a74a06, 0x37ce2ee1)
    case 1117:
      return jsonTokW64(0x6d953e2b, 0xd7173692)
    case 1118:
      return jsonTokW64(0xe8111c87, 0xc5c1ba99)
    case 1119:
      return jsonTokW64(0xc8fa8db6, 0xccdd0437)
    case 1120:
      return jsonTokW64(0x910ab1d4, 0xdb9914a0)
    case 1121:
      return jsonTokW64(0x1d9c9892, 0x400a22a2)
    case 1122:
      return jsonTokW64(0xb54d5e4a, 0x127f59c8)
    case 1123:
      return jsonTokW64(0x2503beb6, 0xd00cab4b)
    case 1124:
      return jsonTokW64(0xe2a0b5dc, 0x971f303a)
    case 1125:
      return jsonTokW64(0x2e44ae64, 0x840fd61d)
    case 1126:
      return jsonTokW64(0x8da471a9, 0xde737e24)
    case 1127:
      return jsonTokW64(0x5ceaecfe, 0xd289e5d2)
    case 1128:
      return jsonTokW64(0xb10d8e14, 0x56105dad)
    case 1129:
      return jsonTokW64(0x7425a83e, 0x872c5f47)
    case 1130:
      return jsonTokW64(0xdd50f199, 0x6b947518)
    case 1131:
      return jsonTokW64(0xd12f124e, 0x28f77719)
    case 1132:
      return jsonTokW64(0x8a5296ff, 0xe33cc92f)
    case 1133:
      return jsonTokW64(0x82bd6b70, 0xd99aaa6f)
    case 1134:
      return jsonTokW64(0xace73cbf, 0xdc0bfb7b)
    case 1135:
      return jsonTokW64(0x636cc64d, 0x1001550b)
    case 1136:
      return jsonTokW64(0xd8210bef, 0xd30efa5a)
    case 1137:
      return jsonTokW64(0x3c47f7e0, 0x5401aa4e)
    case 1138:
      return jsonTokW64(0x8714a775, 0xe3e95c78)
    case 1139:
      return jsonTokW64(0x65acfaec, 0x34810a71)
    case 1140:
      return jsonTokW64(0xa8d9d153, 0x5ce3b396)
    case 1141:
      return jsonTokW64(0x7f1839a7, 0x41a14d0d)
    case 1142:
      return jsonTokW64(0xd31045a8, 0x341ca07c)
    case 1143:
      return jsonTokW64(0x1ede4811, 0x1209a050)
    case 1144:
      return jsonTokW64(0x83ea2b89, 0x2091e44d)
    case 1145:
      return jsonTokW64(0x934aed0a, 0xab460432)
    case 1146:
      return jsonTokW64(0xa4e4b66b, 0x68b65d60)
    case 1147:
      return jsonTokW64(0xf81da84d, 0x5617853f)
    case 1148:
      return jsonTokW64(0xce1de406, 0x42e3f4b9)
    case 1149:
      return jsonTokW64(0x36251260, 0xab9d668e)
    case 1150:
      return jsonTokW64(0x80d2ae83, 0xe9ce78f3)
    case 1151:
      return jsonTokW64(0xc1d72b7c, 0x6b426019)
    case 1152:
      return jsonTokW64(0xa1075a24, 0xe4421730)
    case 1153:
      return jsonTokW64(0xb24cf65b, 0x8612f81f)
    case 1154:
      return jsonTokW64(0xc94930ae, 0x1d529cfc)
    case 1155:
      return jsonTokW64(0xdee033f2, 0x6797b627)
    case 1156:
      return jsonTokW64(0xfb9b7cd9, 0xa4a7443c)
    case 1157:
      return jsonTokW64(0x169840ef, 0x017da3b1)
    case 1158:
      return jsonTokW64(0x9d412e08, 0x06e88aa5)
    case 1159:
      return jsonTokW64(0x8e1f2895, 0x60ee864e)
    case 1160:
      return jsonTokW64(0xc491798a, 0x08a2ad4e)
    case 1161:
      return jsonTokW64(0xf1a6f2ba, 0xb92a27e2)
    case 1162:
      return jsonTokW64(0xf5b5d7ec, 0x8acb58a2)
    case 1163:
      return jsonTokW64(0xae10af69, 0x6774b1db)
    case 1164:
      return jsonTokW64(0x9991a6f3, 0xd6bf1765)
    case 1165:
      return jsonTokW64(0xacca6da1, 0xe0a8ef29)
    case 1166:
      return jsonTokW64(0xbff610b0, 0xcc6edd3f)
    case 1167:
      return jsonTokW64(0x17fd090a, 0x58d32af3)
    case 1168:
      return jsonTokW64(0xeff394dc, 0xff8a948e)
    case 1169:
      return jsonTokW64(0xddfc4b4c, 0xef07f5b0)
    case 1170:
      return jsonTokW64(0x95f83d0a, 0x1fb69cd9)
    case 1171:
      return jsonTokW64(0x4abdaf10, 0x1564f98e)
    case 1172:
      return jsonTokW64(0xbb764c4c, 0xa7a4440f)
    case 1173:
      return jsonTokW64(0x9d6d1ad4, 0x1abe37f1)
    case 1174:
      return jsonTokW64(0xea53df5f, 0xd18d5513)
    case 1175:
      return jsonTokW64(0x84c86189, 0x216dc5ed)
    case 1176:
      return jsonTokW64(0x92746b9b, 0xe2f8552c)
    case 1177:
      return jsonTokW64(0x32fd3cf5, 0xb4e49bb4)
    case 1178:
      return jsonTokW64(0xb7118682, 0xdbb66a77)
    case 1179:
      return jsonTokW64(0x3fbc8c33, 0x221dc2a1)
    case 1180:
      return jsonTokW64(0xe4d5e823, 0x92a40515)
    case 1181:
      return jsonTokW64(0x0fabaf3f, 0xeaa5334a)
    case 1182:
      return jsonTokW64(0x8f05b116, 0x3ba6832d)
    case 1183:
      return jsonTokW64(0x29cb4d87, 0xf2a7400e)
    case 1184:
      return jsonTokW64(0xb2c71d5b, 0xca9023f8)
    case 1185:
      return jsonTokW64(0x743e20e9, 0xef511012)
    case 1186:
      return jsonTokW64(0xdf78e4b2, 0xbd342cf6)
    case 1187:
      return jsonTokW64(0x914da924, 0x6b255416)
    case 1188:
      return jsonTokW64(0x8bab8eef, 0xb6409c1a)
    case 1189:
      return jsonTokW64(0x1ad089b6, 0xc2f7548e)
    case 1190:
      return jsonTokW64(0xae9672ab, 0xa3d0c320)
    case 1191:
      return jsonTokW64(0xa184ac24, 0x73b529b1)
    case 1192:
      return jsonTokW64(0xda3c0f56, 0x8cc4f3e8)
    case 1193:
      return jsonTokW64(0xc9e5d72d, 0x90a2741e)
    case 1194:
      return jsonTokW64(0x88658996, 0x17fb1871)
    case 1195:
      return jsonTokW64(0x7e2fa67c, 0x7a658892)
    case 1196:
      return jsonTokW64(0xaa7eebfb, 0x9df9de8d)
    case 1197:
      return jsonTokW64(0xddbb901b, 0x98feeab7)
    case 1198:
      return jsonTokW64(0xd51ea6fa, 0x85785631)
    case 1199:
      return jsonTokW64(0x552a7422, 0x7f3ea565)
    case 1200:
      return jsonTokW64(0x8533285c, 0x936b35de)
    case 1201:
      return jsonTokW64(0xd53a8895, 0x8f87275f)
    case 1202:
      return jsonTokW64(0xa67ff273, 0xb8460356)
    case 1203:
      return jsonTokW64(0x8a892aba, 0xf368f137)
    case 1204:
      return jsonTokW64(0xd01fef10, 0xa657842c)
    case 1205:
      return jsonTokW64(0x2d2b7569, 0xb0432d85)
    case 1206:
      return jsonTokW64(0x8213f56a, 0x67f6b29b)
    case 1207:
      return jsonTokW64(0x9c3b2962, 0x0e29fc73)
    case 1208:
      return jsonTokW64(0xa298f2c5, 0x01f45f42)
    case 1209:
      return jsonTokW64(0x8349f3ba, 0x91b47b8f)
    case 1210:
      return jsonTokW64(0xcb3f2f76, 0x42717713)
    case 1211:
      return jsonTokW64(0x241c70a9, 0x36219a73)
    case 1212:
      return jsonTokW64(0xfe0efb53, 0xd30dd4d7)
    case 1213:
      return jsonTokW64(0xed238cd3, 0x83aa0110)
    case 1214:
      return jsonTokW64(0x9ec95d14, 0x63e8a506)
    case 1215:
      return jsonTokW64(0xf4363804, 0x324a40aa)
    case 1216:
      return jsonTokW64(0xc67bb459, 0x7ce2ce48)
    case 1217:
      return jsonTokW64(0xb143c605, 0x3edcd0d5)
    case 1218:
      return jsonTokW64(0xf81aa16f, 0xdc1b81da)
    case 1219:
      return jsonTokW64(0xdd94b786, 0x8e94050a)
    case 1220:
      return jsonTokW64(0x9b10a4e5, 0xe9913128)
    case 1221:
      return jsonTokW64(0xca7cf2b4, 0x191c8326)
    case 1222:
      return jsonTokW64(0xc1d4ce1f, 0x63f57d72)
    case 1223:
      return jsonTokW64(0xfd1c2f61, 0x1f63a3f0)
    case 1224:
      return jsonTokW64(0xf24a01a7, 0x3cf2dccf)
    case 1225:
      return jsonTokW64(0xbc633b39, 0x673c8cec)
    case 1226:
      return jsonTokW64(0x976e4108, 0x8617ca01)
    case 1227:
      return jsonTokW64(0xd5be0503, 0xe085d813)
    case 1228:
      return jsonTokW64(0xbd49d14a, 0xa79dbc82)
    case 1229:
      return jsonTokW64(0x4b2d8644, 0xd8a74e18)
    case 1230:
      return jsonTokW64(0xec9c459d, 0x51852ba2)
    case 1231:
      return jsonTokW64(0xddf8e7d6, 0x0ed1219e)
    case 1232:
      return jsonTokW64(0x93e1ab82, 0x52f33b45)
    case 1233:
      return jsonTokW64(0xcabb90e5, 0xc942b503)
    case 1234:
      return jsonTokW64(0xb8da1662, 0xe7b00a17)
    case 1235:
      return jsonTokW64(0x3d6a751f, 0x3b936243)
    case 1236:
      return jsonTokW64(0xe7109bfb, 0xa19c0c9d)
    case 1237:
      return jsonTokW64(0x0cc51267, 0x0a783ad4)
    case 1238:
      return jsonTokW64(0x906a617d, 0x450187e2)
    case 1239:
      return jsonTokW64(0x27fb2b80, 0x668b24c5)
    case 1240:
      return jsonTokW64(0xb484f9dc, 0x9641e9da)
    case 1241:
      return jsonTokW64(0xb1f9f660, 0x802dedf6)
    case 1242:
      return jsonTokW64(0xe1a63853, 0xbbd26451)
    case 1243:
      return jsonTokW64(0x5e7873f8, 0xa0396973)
    case 1244:
      return jsonTokW64(0x8d07e334, 0x55637eb2)
    case 1245:
      return jsonTokW64(0xdb0b487b, 0x6423e1e8)
    case 1246:
      return jsonTokW64(0xb049dc01, 0x6abc5e5f)
    case 1247:
      return jsonTokW64(0x91ce1a9a, 0x3d2cda62)
    case 1248:
      return jsonTokW64(0xdc5c5301, 0xc56b75f7)
    case 1249:
      return jsonTokW64(0x7641a140, 0xcc7810fb)
    case 1250:
      return jsonTokW64(0x89b9b3e1, 0x1b6329ba)
    case 1251:
      return jsonTokW64(0xa9e904c8, 0x7fcb0a9d)
    case 1252:
      return jsonTokW64(0xac2820d9, 0x623bf429)
    case 1253:
      return jsonTokW64(0x546345fa, 0x9fbdcd44)
    case 1254:
      return jsonTokW64(0xd732290f, 0xbacaf133)
    case 1255:
      return jsonTokW64(0xa97c1779, 0x47ad4095)
    case 1256:
      return jsonTokW64(0x867f59a9, 0xd4bed6c0)
    case 1257:
      return jsonTokW64(0x49ed8eab, 0xcccc485d)
    case 1258:
      return jsonTokW64(0xa81f3014, 0x49ee8c70)
    case 1259:
      return jsonTokW64(0x5c68f256, 0xbfff5a74)
    case 1260:
      return jsonTokW64(0xd226fc19, 0x5c6a2f8c)
    case 1261:
      return jsonTokW64(0x73832eec, 0x6fff3111)
    case 1262:
      return jsonTokW64(0x83585d8f, 0xd9c25db7)
    case 1263:
      return jsonTokW64(0xc831fd53, 0xc5ff7eab)
    case 1264:
      return jsonTokW64(0xa42e74f3, 0xd032f525)
    case 1265:
      return jsonTokW64(0xba3e7ca8, 0xb77f5e55)
    case 1266:
      return jsonTokW64(0xcd3a1230, 0xc43fb26f)
    case 1267:
      return jsonTokW64(0x28ce1bd2, 0xe55f35eb)
    case 1268:
      return jsonTokW64(0x80444b5e, 0x7aa7cf85)
    case 1269:
      return jsonTokW64(0x7980d163, 0xcf5b81b3)
    case 1270:
      return jsonTokW64(0xa0555e36, 0x1951c366)
    case 1271:
      return jsonTokW64(0xd7e105bc, 0xc332621f)
    case 1272:
      return jsonTokW64(0xc86ab5c3, 0x9fa63440)
    case 1273:
      return jsonTokW64(0x8dd9472b, 0xf3fefaa7)
    case 1274:
      return jsonTokW64(0xfa856334, 0x878fc150)
    case 1275:
      return jsonTokW64(0xb14f98f6, 0xf0feb951)
    case 1276:
      return jsonTokW64(0x9c935e00, 0xd4b9d8d2)
    case 1277:
      return jsonTokW64(0x6ed1bf9a, 0x569f33d3)
    case 1278:
      return jsonTokW64(0xc3b83581, 0x09e84f07)
    case 1279:
      return jsonTokW64(0x0a862f80, 0xec4700c8)
    case 1280:
      return jsonTokW64(0xf4a642e1, 0x4c6262c8)
    case 1281:
      return jsonTokW64(0xcd27bb61, 0x2758c0fa)
    case 1282:
      return jsonTokW64(0x98e7e9cc, 0xcfbd7dbd)
    case 1283:
      return jsonTokW64(0x8038d51c, 0xb897789c)
    case 1284:
      return jsonTokW64(0xbf21e440, 0x03acdd2c)
    case 1285:
      return jsonTokW64(0xe0470a63, 0xe6bd56c3)
    case 1286:
      return jsonTokW64(0xeeea5d50, 0x04981478)
    case 1287:
      return jsonTokW64(0x1858ccfc, 0xe06cac74)
    case 1288:
      return jsonTokW64(0x95527a52, 0x02df0ccb)
    case 1289:
      return jsonTokW64(0x0f37801e, 0x0c43ebc8)
    case 1290:
      return jsonTokW64(0xbaa718e6, 0x8396cffd)
    case 1291:
      return jsonTokW64(0xd3056025, 0x8f54e6ba)
    case 1292:
      return jsonTokW64(0xe950df20, 0x247c83fd)
    case 1293:
      return jsonTokW64(0x47c6b82e, 0xf32a2069)
    case 1294:
      return jsonTokW64(0x91d28b74, 0x16cdd27e)
    case 1295:
      return jsonTokW64(0x4cdc331d, 0x57fa5441)
    case 1296:
      return jsonTokW64(0xb6472e51, 0x1c81471d)
    case 1297:
      return jsonTokW64(0xe0133fe4, 0xadf8e952)
    case 1298:
      return jsonTokW64(0xe3d8f9e5, 0x63a198e5)
    case 1299:
      return jsonTokW64(0x58180fdd, 0xd97723a6)
    case 1300:
      return jsonTokW64(0x8e679c2f, 0x5e44ff8f)
    case 1301:
      return jsonTokW64(0x570f09ea, 0xa7ea7648)
    // Unreachable: `jsonTokEiselLemire` asks only for 0 to 1301.
    default:
      return toU64(0)
  }
}
// gen-json-pow5:end
