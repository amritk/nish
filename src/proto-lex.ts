// The tokens of a `.proto` file, for `nish proto` (docs/wp72-proto-classes.md).
// A token is an identifier, an integer, a float, a string or one punctuation
// character, with the line it starts on. Comments and whitespace are dropped.
// A byte the grammar has no use for ends the scan with an error token, so the
// parser reports it at its line and nothing past it is read.

import { StringBuilder } from "./strings"

/** What a token is. */
export enum ProtoTok {
  Ident,
  Int,
  Float,
  Str,
  Punct,
  End,
  Bad,
}

/** One token: its kind, its text (a string's value, unquoted) and its line. */
export class ProtoToken {
  text: string
  kind: ProtoTok
  line: i32

  constructor(kind: ProtoTok, text: string, line: i32) {
    this.kind = kind
    this.text = text
    this.line = line
  }
}

/** Whether `c` starts an identifier: an ASCII letter or `_`. */
const isProtoIdentStart = (c: i32): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95

/** Whether `c` is an ASCII digit. */
const isProtoDigit = (c: i32): boolean => c >= 48 && c <= 57

/** Whether `c` continues an identifier or a number. */
const isProtoWordByte = (c: i32): boolean => isProtoIdentStart(c) || isProtoDigit(c)

/** The character code at `i`, or -1 past the end. */
const at = (text: string, i: i32): i32 => (i >= 0 && i < text.length ? text.charCodeAt(i) : -1)

/**
 * The tokens of `text`, ending with one `End` token, or with a `Bad` token
 * whose text says what was wrong where the scan stopped.
 */
export const lexProto = (text: string): ProtoToken[] => {
  const out: ProtoToken[] = []
  let i: i32 = 0
  let line: i32 = 1
  while (i < text.length) {
    const c = text.charCodeAt(i)
    if (c === 10) {
      line++
      i++
    } else if (c === 32 || c === 9 || c === 13 || c === 12 || c === 11) {
      i++
    } else if (c === 47 && at(text, i + 1) === 47) {
      while (i < text.length && text.charCodeAt(i) !== 10) {
        i++
      }
    } else if (c === 47 && at(text, i + 1) === 42) {
      const start = line
      i += 2
      while (i < text.length && !(text.charCodeAt(i) === 42 && at(text, i + 1) === 47)) {
        if (text.charCodeAt(i) === 10) {
          line++
        }
        i++
      }
      if (i >= text.length) {
        out.push(new ProtoToken(ProtoTok.Bad, "a comment that is not closed", start))
        return out
      }
      i += 2
    } else if (isProtoIdentStart(c)) {
      const from = i
      while (i < text.length && isProtoWordByte(text.charCodeAt(i))) {
        i++
      }
      out.push(new ProtoToken(ProtoTok.Ident, text.slice(from, i), line))
    } else if (isProtoDigit(c) || (c === 46 && isProtoDigit(at(text, i + 1)))) {
      const from = i
      let float = false
      while (i < text.length) {
        const d = text.charCodeAt(i)
        const prev = at(text, i - 1)
        const exp = prev === 101 || prev === 69
        if (d === 46 || ((d === 43 || d === 45) && exp && !isHexText(text, from))) {
          float = true
          i++
        } else if (isProtoWordByte(d)) {
          i++
        } else {
          break
        }
      }
      const word = text.slice(from, i)
      const isFloat = float || (!isHexText(text, from) && (word.indexOf("e") >= 0 || word.indexOf("E") >= 0))
      out.push(new ProtoToken(isFloat ? ProtoTok.Float : ProtoTok.Int, word, line))
    } else if (c === 34 || c === 39) {
      const start = line
      const value = new StringBuilder()
      i++
      let closed = false
      while (i < text.length) {
        const d = text.charCodeAt(i)
        if (d === c) {
          closed = true
          i++
          break
        }
        if (d === 10) {
          break
        }
        if (d === 92 && i + 1 < text.length) {
          value.addChar(d)
          i++
        }
        value.addChar(at(text, i))
        i++
      }
      if (!closed) {
        out.push(new ProtoToken(ProtoTok.Bad, "a string that is not closed on its line", start))
        return out
      }
      out.push(new ProtoToken(ProtoTok.Str, value.toText(), start))
    } else if (
      c === 59 ||
      c === 123 ||
      c === 125 ||
      c === 40 ||
      c === 41 ||
      c === 91 ||
      c === 93 ||
      c === 60 ||
      c === 62 ||
      c === 61 ||
      c === 44 ||
      c === 46 ||
      c === 45 ||
      c === 43 ||
      c === 58
    ) {
      out.push(new ProtoToken(ProtoTok.Punct, text.substring(i, i + 1), line))
      i++
    } else {
      out.push(new ProtoToken(ProtoTok.Bad, `a byte the grammar has no use for (${c})`, line))
      return out
    }
  }
  out.push(new ProtoToken(ProtoTok.End, "", line))
  return out
}

/** Whether the number starting at `from` is hexadecimal (`0x...`). */
const isHexText = (text: string, from: i32): boolean => {
  const x = at(text, from + 1)
  return at(text, from) === 48 && (x === 120 || x === 88)
}

/**
 * The value of an integer token's text, decimal, hex (`0x`) or octal (a
 * leading `0`), or -1 when it is not one or exceeds 2^32.
 */
export const protoIntValue = (text: string): i64 => {
  let base: i32 = 10
  let i: i32 = 0
  if (isHexText(text, 0)) {
    base = 16
    i = 2
  } else if (text.length > 1 && text.charCodeAt(0) === 48) {
    base = 8
    i = 1
  }
  if (i >= text.length) {
    return toI64(-1)
  }
  let v: i64 = toI64(0)
  while (i < text.length) {
    const c = text.charCodeAt(i)
    let d: i32 = -1
    if (isProtoDigit(c)) {
      d = c - 48
    } else if (c >= 97 && c <= 102) {
      d = c - 87
    } else if (c >= 65 && c <= 70) {
      d = c - 55
    }
    if (d < 0 || d >= base) {
      return toI64(-1)
    }
    v = v * toI64(base) + toI64(d)
    if (v > toI64(65536) * toI64(65536)) {
      return toI64(-1)
    }
    i++
  }
  return v
}
