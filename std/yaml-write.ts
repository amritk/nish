/**
 * `nish/yaml-write` — a JSON value written as YAML text that `parseYaml` reads
 * back as the same tree.
 *
 *     import { JsonDocument } from "nish/json-value"
 *     import { JsonLimits } from "nish/json-tokenizer"
 *     import { stringifyYaml } from "nish/yaml-write"
 *
 *     const doc = new JsonDocument(new JsonLimits())
 *     const root = doc.parseText('{"name":"tea","on":"yes","ports":[80,443],"tags":{}}')
 *     stringifyYaml(doc, root)
 *     // name: tea
 *     // "on": "yes"
 *     // ports:
 *     //   - 80
 *     //   - 443
 *     // tags: {}
 *
 * **Block style.** An object is a block map and an array a block sequence,
 * indented two spaces a level, members in their order; an empty one is `{}` or
 * `[]`. A sequence item that is itself a collection starts on the item's line
 * (`- a: 1`). `null`, `true` and `false` are written as themselves and a number
 * as its text, which the core schema reads as an integer or a float. The text
 * ends with a line break.
 *
 * **A string is plain unless it could read as something else.** It is written
 * double-quoted when it is empty; when it reads as null, a boolean or a number
 * under YAML 1.2 or YAML 1.1 (`~`, `null`, `yes`, `on`, `y`, `true` in any
 * case; anything starting with a digit, or a sign or `.` and then a digit;
 * `.inf` and `.nan`, signed or not); when it starts with an indicator (`@`, `` ` ``, `\`, `*`,
 * `&`, `!`, `|`, `>`, `%`, `'`, `"`, `#`, `,`, `[`, `]`, `{`, `}`, or `-`, `?`
 * or `:` before a space or the end) or with `---` or `...`; when it holds
 * `: ` or ` #` or ends in `:`; when it starts or ends with a space; when it
 * holds a control character, a line break, U+2028, U+2029, U+FEFF, U+FFFE or
 * U+FFFF; and, as a key, when it is `<<`, which YAML reads as a merge key.
 * Keys and values follow the same rule. A quoted string escapes `"`, `\` and
 * every character just listed, so it stays on one line. A key whose written
 * form runs past the 1024 bytes YAML allows an implicit key is written as an
 * explicit one, `? key` and then `: value`.
 *
 * **What it answers.** The YAML text, or `""` when `v` names no value or the
 * tree nests deeper than `JSON_WRITER_MAX_DEPTH` collections, the limit
 * `stringify` keeps: a parsed tree never does, and a built one is refused
 * rather than recursed into without bound.
 *
 * A string is written as its UTF-8 bytes. Under Node a string is UTF-16 and
 * each unit is read as a byte, so non-ASCII text differs from the native
 * build, as it does in `nish/json-value`'s builders.
 */
import { JSON_WRITER_MAX_DEPTH } from "nish/json"
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_NONE,
  JSON_VALUE_NULL,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JsonDocument,
  JsonValue,
} from "nish/json-value"

/** The most bytes an implicit key may run before its `:` (YAML 1.2 §7.4.2). */
const YAML_WRITE_MAX_KEY_LENGTH: i32 = 1024

const YAML_WRITE_HEX: string = "0123456789ABCDEF"

/** The bytes the writer puts between scalars. */
const YAML_WRITE_LF: i32 = 10
const YAML_WRITE_SPACE: i32 = 32
const YAML_WRITE_QUOTE: i32 = 34
const YAML_WRITE_COLON: i32 = 58
const YAML_WRITE_BACKSLASH: i32 = 92

/** Byte `i` of `text`, or `-1` past either end. */
const yamlWriteByte = (text: string, i: i32): i32 =>
  i >= 0 && i < toI32(text.length) ? toI32(text.charCodeAt(i)) : -1

const yamlWriteIsDigit = (c: i32): boolean => c >= 48 && c <= 57

/** Whether `c` is an indicator that cannot start a plain scalar, whatever follows it. */
const yamlWriteIsIndicator = (c: i32): boolean =>
  c === 64 ||
  c === 96 ||
  c === 92 ||
  c === 42 ||
  c === 38 ||
  c === 33 ||
  c === 124 ||
  c === 62 ||
  c === 37 ||
  c === 39 ||
  c === 34 ||
  c === 35 ||
  c === 44 ||
  c === 91 ||
  c === 93 ||
  c === 123 ||
  c === 125

/** Whether `text` from byte `from` to its end is `word`, ASCII letters in either case. */
const yamlWriteMatches = (text: string, from: i32, word: string): boolean => {
  const n: i32 = toI32(word.length)
  if (toI32(text.length) - from !== n) {
    return false
  }
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = yamlWriteByte(text, from + i)
    if ((c >= 65 && c <= 90 ? c + 32 : c) !== yamlWriteByte(word, i)) {
      return false
    }
  }
  return true
}

/** Whether `text` is one of the words YAML 1.2 or 1.1 reads as null or a boolean. */
const yamlWriteIsWord = (text: string): boolean =>
  text === "~" ||
  yamlWriteMatches(text, 0, "null") ||
  yamlWriteMatches(text, 0, "true") ||
  yamlWriteMatches(text, 0, "false") ||
  yamlWriteMatches(text, 0, "yes") ||
  yamlWriteMatches(text, 0, "no") ||
  yamlWriteMatches(text, 0, "on") ||
  yamlWriteMatches(text, 0, "off") ||
  yamlWriteMatches(text, 0, "y") ||
  yamlWriteMatches(text, 0, "n")

/** Whether `text` could read as a number: a digit first, or a sign or `.` and then a digit, or `.inf` or `.nan`. */
const yamlWriteIsNumeric = (text: string): boolean => {
  let i: i32 = 0
  const sign: i32 = yamlWriteByte(text, 0)
  if (sign === 43 || sign === 45) {
    i = 1
  }
  const c: i32 = yamlWriteByte(text, i)
  if (yamlWriteIsDigit(c)) {
    return true
  }
  if (c !== 46) {
    return false
  }
  if (yamlWriteIsDigit(yamlWriteByte(text, i + 1))) {
    return true
  }
  return yamlWriteMatches(text, i, ".inf") || yamlWriteMatches(text, i, ".nan")
}

/**
 * How many bytes of `text` from `i` make one character a plain scalar may not
 * hold and a quoted one escapes: a control character, U+0085 and the other C1
 * controls, U+2028, U+2029, U+FEFF, U+FFFE or U+FFFF; `0` for any other.
 */
const yamlWriteEscapedLength = (text: string, i: i32): i32 => {
  const c: i32 = yamlWriteByte(text, i)
  if (c < 32 || c === 127) {
    return 1
  }
  const next: i32 = yamlWriteByte(text, i + 1)
  if (c === 194 && next >= 128 && next <= 159) {
    return 2
  }
  const third: i32 = yamlWriteByte(text, i + 2)
  if (c === 226 && next === 128 && (third === 168 || third === 169)) {
    return 3
  }
  if (c === 239 && ((next === 187 && third === 191) || (next === 191 && (third === 190 || third === 191)))) {
    return 3
  }
  return 0
}

/** Whether `text` must be double-quoted to read back as the same string; `key` adds the merge key `<<`. */
const yamlWriteNeedsQuotes = (text: string, key: boolean): boolean => {
  const n: i32 = toI32(text.length)
  if (n === 0 || yamlWriteIsWord(text) || yamlWriteIsNumeric(text) || (key && text === "<<")) {
    return true
  }
  const first: i32 = yamlWriteByte(text, 0)
  const second: i32 = yamlWriteByte(text, 1)
  if (yamlWriteIsIndicator(first) || first === 32 || yamlWriteByte(text, n - 1) === 32) {
    return true
  }
  if ((first === 45 || first === 63 || first === 58) && (second === 32 || second === -1)) {
    return true
  }
  if (text.startsWith("---") || text.startsWith("...") || yamlWriteByte(text, n - 1) === 58) {
    return true
  }
  for (let i: i32 = 0; i < n; i += 1) {
    const c: i32 = yamlWriteByte(text, i)
    const next: i32 = yamlWriteByte(text, i + 1)
    if ((c === 58 && next === 32) || (c === 32 && next === 35) || yamlWriteEscapedLength(text, i) > 0) {
      return true
    }
  }
  return false
}

/**
 * How many bytes `text` takes as written: its own, or quoted, two more for the
 * quotes and, for each escape, the bytes it adds to the character it replaces.
 */
const yamlWriteLength = (text: string, quoted: boolean): i32 => {
  const n: i32 = toI32(text.length)
  if (!quoted) {
    return n
  }
  let length: i32 = n + 2
  let i: i32 = 0
  while (i < n) {
    const c: i32 = yamlWriteByte(text, i)
    const escaped: i32 = yamlWriteEscapedLength(text, i)
    if (c === 34 || c === 92 || c === 10 || c === 9 || c === 13) {
      length += 1
    } else if (escaped === 1) {
      length += 3
    } else if (escaped > 1) {
      length += escaped
    }
    i += escaped > 1 ? escaped : 1
  }
  return length
}

/** Writes one JSON value as block YAML, byte by byte, into `out`. */
class YamlWriter {
  doc: JsonDocument
  out: u8[]
  /** Whether a collection nested past `JSON_WRITER_MAX_DEPTH`. */
  tooDeep: boolean = false

  constructor(doc: JsonDocument) {
    this.doc = doc
    this.out = []
  }

  byte(c: i32): void {
    this.out.push(toU8(c))
  }

  /** Writes the bytes of `text` from `from` up to `to`. */
  bytes(text: string, from: i32, to: i32): void {
    for (let i: i32 = from; i < to; i += 1) {
      this.byte(yamlWriteByte(text, i))
    }
  }

  text(text: string): void {
    const from: i32 = 0
    this.bytes(text, from, toI32(text.length))
  }

  /** Writes `count` spaces. */
  spaces(count: i32): void {
    for (let i: i32 = 0; i < count; i += 1) {
      this.byte(YAML_WRITE_SPACE)
    }
  }

  /** Writes `\xXX` for byte `c`. */
  hex(c: i32): void {
    this.text("\\x")
    this.byte(yamlWriteByte(YAML_WRITE_HEX, c >> 4))
    this.byte(yamlWriteByte(YAML_WRITE_HEX, c & 15))
  }

  /** Writes the escape for the `length` bytes at `i`, a character yamlWriteEscapedLength names. */
  escape(text: string, i: i32, length: i32): void {
    const c: i32 = yamlWriteByte(text, i)
    const second: i32 = yamlWriteByte(text, i + 1)
    const third: i32 = yamlWriteByte(text, i + 2)
    if (length === 2) {
      this.hex(second)
    } else if (length === 3 && second === 128) {
      this.text(third === 168 ? "\\u2028" : "\\u2029")
    } else if (length === 3 && second === 187) {
      this.text("\\uFEFF")
    } else if (length === 3) {
      this.text(third === 190 ? "\\uFFFE" : "\\uFFFF")
    } else if (c === 10) {
      this.text("\\n")
    } else if (c === 9) {
      this.text("\\t")
    } else if (c === 13) {
      this.text("\\r")
    } else {
      this.hex(c)
    }
  }

  /** Writes `text` as a double-quoted scalar on one line. */
  quoted(text: string): void {
    const n: i32 = toI32(text.length)
    this.byte(YAML_WRITE_QUOTE)
    let i: i32 = 0
    while (i < n) {
      const c: i32 = yamlWriteByte(text, i)
      const length: i32 = yamlWriteEscapedLength(text, i)
      if (c === 34 || c === 92) {
        this.byte(YAML_WRITE_BACKSLASH)
        this.byte(c)
        i += 1
      } else if (length > 0) {
        this.escape(text, i, length)
        i += length
      } else {
        this.byte(c)
        i += 1
      }
    }
    this.byte(YAML_WRITE_QUOTE)
  }

  /** Writes `text` as a scalar: plain when that reads back as the same string, double-quoted otherwise. */
  string(text: string, quoted: boolean): void {
    if (quoted) {
      this.quoted(text)
    } else {
      this.text(text)
    }
  }

  /** Whether `v` is a collection with members, which takes lines of its own. */
  isBlock(v: JsonValue): boolean {
    const kind: i32 = this.doc.kind(v)
    return (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) && this.doc.length(v) > 0
  }

  /** Writes `v` on one line: a scalar, `{}` or `[]`. */
  inline(v: JsonValue): void {
    const doc: JsonDocument = this.doc
    const kind: i32 = doc.kind(v)
    if (kind === JSON_VALUE_NULL) {
      this.text("null")
    } else if (kind === JSON_VALUE_BOOLEAN) {
      this.text(doc.boolean(v) ? "true" : "false")
    } else if (kind === JSON_VALUE_NUMBER) {
      this.text(doc.numberText(v))
    } else if (kind === JSON_VALUE_ARRAY) {
      this.text("[]")
    } else if (kind === JSON_VALUE_OBJECT) {
      this.text("{}")
    } else {
      const text: string = doc.string(v)
      this.string(text, yamlWriteNeedsQuotes(text, false))
    }
  }

  /**
   * Writes `v` starting at column `indent`, where the line has already reached
   * it, and ends its last line; `depth` is how many collections hold it.
   */
  node(v: JsonValue, indent: i32, depth: i32): void {
    const doc: JsonDocument = this.doc
    const kind: i32 = doc.kind(v)
    if ((kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) && depth >= JSON_WRITER_MAX_DEPTH) {
      this.tooDeep = true
      return
    }
    if (!this.isBlock(v)) {
      this.inline(v)
      this.byte(YAML_WRITE_LF)
      return
    }
    const object: boolean = kind === JSON_VALUE_OBJECT
    for (let i: i32 = 0; i < doc.length(v) && !this.tooDeep; i += 1) {
      if (i > 0) {
        this.spaces(indent)
      }
      const member: JsonValue = doc.at(v, i)
      if (!object) {
        this.text("- ")
        this.node(member, indent + 2, depth + 1)
        continue
      }
      const key: string = doc.keyAt(v, i)
      const quoted: boolean = yamlWriteNeedsQuotes(key, true)
      const explicit: boolean = yamlWriteLength(key, quoted) > YAML_WRITE_MAX_KEY_LENGTH
      if (explicit) {
        this.text("? ")
      }
      this.string(key, quoted)
      if (explicit) {
        this.byte(YAML_WRITE_LF)
        this.spaces(indent)
      }
      this.byte(YAML_WRITE_COLON)
      if (this.isBlock(member)) {
        this.byte(YAML_WRITE_LF)
        this.spaces(indent + 2)
      } else {
        this.byte(YAML_WRITE_SPACE)
      }
      this.node(member, indent + 2, depth + 1)
    }
  }
}

/**
 * `v` of `doc` as block YAML text that `parseYaml` reads back as the same
 * tree; `""` when `v` names no value or nests deeper than
 * `JSON_WRITER_MAX_DEPTH` collections. See the module comment for the rule
 * that quotes a string.
 */
export const stringifyYaml = (doc: JsonDocument, v: JsonValue): string => {
  if (doc.kind(v) === JSON_VALUE_NONE) {
    return ""
  }
  const writer: YamlWriter = new YamlWriter(doc)
  const top: i32 = 0
  writer.node(v, top, top)
  return writer.tooDeep ? "" : String.fromBytes(writer.out, top, toI32(writer.out.length))
}
