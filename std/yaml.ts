/**
 * `nish/yaml` — a YAML 1.2 parser that keeps where everything came from.
 *
 *     import { parseYaml, YAML_MAP } from "nish/yaml"
 *
 *     const stream = parseYaml(text)
 *     const root: i32 = stream.documentRoot(0)
 *     if (stream.kind(root) === YAML_MAP) {
 *       let i: i32 = 0
 *       while (i < stream.count(root)) {
 *         const pair: i32 = stream.child(root, i)
 *         // stream.key(pair), stream.value(pair), stream.text(node) ...
 *         i += 1
 *       }
 *     }
 *
 * A parse never fails. It answers a `YamlStream`: every document of the text,
 * every node of every document, and every problem found on the way, each with
 * the byte range of the source it is about. A program that only wants the data
 * reads the nodes; a linter, an editor or a schema checker reads the ranges too,
 * and `nish/yaml-lines` turns a range into the `line:column` a person reads.
 *
 * **A node is an `i32` handle** into the stream's arrays, one array per field
 * (struct of arrays), and `-1` is no node. A node is a range of the source,
 * nothing more, until it is asked for: a scalar's `text` is decoded, and its
 * `type` resolved against the core schema, only when a caller reads them. So a
 * parse allocates its arrays and its problems and very little else, and a
 * caller that walks to one key pays to decode one key.
 *
 * The kinds are `YAML_SCALAR`, `YAML_MAP`, `YAML_SEQ`, `YAML_ALIAS` and
 * `YAML_PAIR`. A map's children are its pairs, in source order; a pair's `key`
 * and `value` are nodes. A seq's children are its items. An alias's `target`
 * is the node its anchor named. Merge keys (`<<`) are checked but not applied:
 * a map holds the pairs it was written with.
 *
 * **Diagnostics** carry a `YAML_ERR_*` code, whether they are a warning, a
 * message, a byte range and the document they belong to, sorted by where they
 * start. An error means the stream is not valid YAML and the nodes are the
 * parser's best reading of it; a warning means it is valid and probably not what
 * was meant. The codes and their spelling (`yamlErrorName`) are the ones other
 * YAML tooling reports, so a message from here reads the same as one from there.
 *
 * Strings are UTF-8, offsets are bytes. Tabs are not indentation (YAML forbids
 * it), and YAML 1.1's booleans (`yes`, `on`) are strings, as 1.2 says.
 */

import { indexOfAny } from "nish/text"
import { wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe"

// ---- Node kinds, styles and types -------------------------------------------

/** A scalar: plain, quoted or a block scalar. */
export const YAML_SCALAR: i32 = 1
/** A mapping; its children are `YAML_PAIR` nodes. */
export const YAML_MAP: i32 = 2
/** A sequence; its children are its items. */
export const YAML_SEQ: i32 = 3
/** An alias (`*name`); `target` is the anchored node. */
export const YAML_ALIAS: i32 = 4
/** One key and value of a mapping. */
export const YAML_PAIR: i32 = 5

/** A plain scalar, or a node with no style of its own (an alias, a pair). */
export const YAML_PLAIN: i32 = 0
export const YAML_SINGLE_QUOTED: i32 = 1
export const YAML_DOUBLE_QUOTED: i32 = 2
/** A `|` block scalar. */
export const YAML_LITERAL: i32 = 3
/** A `>` block scalar. */
export const YAML_FOLDED: i32 = 4
/** A `[...]` or `{...}` collection, or the one-pair map `[a: b]` holds. */
export const YAML_FLOW: i32 = 5
/** An indented collection. */
export const YAML_BLOCK: i32 = 6

/** A scalar's core-schema type, from `type`; `-1` for a node that is not a scalar. */
export const YAML_NULL: i32 = 0
export const YAML_BOOL: i32 = 1
export const YAML_INT: i32 = 2
export const YAML_FLOAT: i32 = 3
export const YAML_STRING: i32 = 4

// ---- Diagnostic codes ---------------------------------------------------------

export const YAML_ERR_AMBIGUOUS_ANCHOR_NAME: i32 = 1
export const YAML_ERR_BAD_ANCHOR: i32 = 2
export const YAML_ERR_BAD_BLOCK_HEADER: i32 = 3
export const YAML_ERR_BAD_COMMENT: i32 = 4
export const YAML_ERR_BAD_DIRECTIVE: i32 = 5
export const YAML_ERR_BAD_ESCAPE: i32 = 6
export const YAML_ERR_BAD_IMPLICIT_KEY: i32 = 7
export const YAML_ERR_BAD_INDENT: i32 = 8
export const YAML_ERR_BAD_MERGE: i32 = 9
export const YAML_ERR_BAD_PROPERTY: i32 = 10
export const YAML_ERR_BAD_SCALAR_CONTENT: i32 = 11
export const YAML_ERR_BAD_SCALAR_START: i32 = 12
export const YAML_ERR_BAD_TAG: i32 = 13
export const YAML_ERR_BAD_TAG_VALUE: i32 = 14
export const YAML_ERR_DEPTH_LIMIT: i32 = 15
export const YAML_ERR_DUPLICATE_DIRECTIVE: i32 = 16
export const YAML_ERR_DUPLICATE_KEY: i32 = 17
export const YAML_ERR_MULTIPLE_DOCUMENTS: i32 = 18
export const YAML_ERR_RECURSIVE_ALIAS: i32 = 19
export const YAML_ERR_TAB_INDENT: i32 = 20
export const YAML_ERR_UNEXPECTED_COMMA: i32 = 21
export const YAML_ERR_UNEXPECTED_CONTENT: i32 = 22
export const YAML_ERR_UNEXPECTED_DIRECTIVE: i32 = 23
export const YAML_ERR_UNKNOWN_DIRECTIVE: i32 = 24
export const YAML_ERR_UNKNOWN_TAG_HANDLE: i32 = 25
export const YAML_ERR_UNRESOLVED_ALIAS: i32 = 26
export const YAML_ERR_UNSUPPORTED_YAML_VERSION: i32 = 27
export const YAML_ERR_UNTERMINATED_FLOW: i32 = 28
export const YAML_ERR_UNTERMINATED_QUOTE: i32 = 29

/** The name of a `YAML_ERR_*` code, such as `"DUPLICATE_KEY"`, or `""` for one that is not a code. */
export const yamlErrorName = (code: i32): string => {
  const names: string[] = [
    "",
    "AMBIGUOUS_ANCHOR_NAME",
    "BAD_ANCHOR",
    "BAD_BLOCK_HEADER",
    "BAD_COMMENT",
    "BAD_DIRECTIVE",
    "BAD_ESCAPE",
    "BAD_IMPLICIT_KEY",
    "BAD_INDENT",
    "BAD_MERGE",
    "BAD_PROPERTY",
    "BAD_SCALAR_CONTENT",
    "BAD_SCALAR_START",
    "BAD_TAG",
    "BAD_TAG_VALUE",
    "DEPTH_LIMIT",
    "DUPLICATE_DIRECTIVE",
    "DUPLICATE_KEY",
    "MULTIPLE_DOCUMENTS",
    "RECURSIVE_ALIAS",
    "TAB_INDENT",
    "UNEXPECTED_COMMA",
    "UNEXPECTED_CONTENT",
    "UNEXPECTED_DIRECTIVE",
    "UNKNOWN_DIRECTIVE",
    "UNKNOWN_TAG_HANDLE",
    "UNRESOLVED_ALIAS",
    "UNSUPPORTED_YAML_VERSION",
    "UNTERMINATED_FLOW",
    "UNTERMINATED_QUOTE",
  ]
  return code >= 1 && code < toI32(names.length) ? names[code] : ""
}

// ---- Bytes -------------------------------------------------------------------

const YAML_TAB: i32 = 9
const YAML_LF: i32 = 10
const YAML_CR: i32 = 13
const YAML_SPACE: i32 = 32
const YAML_BANG: i32 = 33
const YAML_DQUOTE: i32 = 34
const YAML_HASH: i32 = 35
const YAML_PERCENT: i32 = 37
const YAML_AMP: i32 = 38
const YAML_SQUOTE: i32 = 39
const YAML_STAR: i32 = 42
const YAML_PLUS: i32 = 43
const YAML_COMMA: i32 = 44
const YAML_DASH: i32 = 45
const YAML_DOT: i32 = 46
const YAML_ZERO: i32 = 48
const YAML_ONE: i32 = 49
const YAML_NINE: i32 = 57
const YAML_COLON: i32 = 58
const YAML_LT: i32 = 60
const YAML_GT: i32 = 62
const YAML_QUESTION: i32 = 63
const YAML_AT: i32 = 64
const YAML_LBRACKET: i32 = 91
const YAML_BACKSLASH: i32 = 92
const YAML_RBRACKET: i32 = 93
const YAML_BACKTICK: i32 = 96
const YAML_LBRACE: i32 = 123
const YAML_PIPE: i32 = 124
const YAML_RBRACE: i32 = 125

/** The byte sets the scanners hand `indexOfAny`. */
const YAML_PLAIN_BLOCK_STOPS: string = ":#\n\r"
const YAML_PLAIN_FLOW_STOPS: string = ":#,[]{}\n\r"
const YAML_DOUBLE_STOPS: string = '"\\\n\r'
const YAML_SINGLE_STOPS: string = "'\n\r"
const YAML_BREAKS: string = "\n\r"

/** The most bytes an implicit key may run before its `:` (YAML 1.2 §7.4.2). */
const YAML_MAX_KEY_LENGTH: i32 = 1024
/** The deepest `maxDepth` may be, and its default. */
const YAML_MAX_DEPTH: i32 = 1000
/** Past this many pairs a map's duplicate check hashes instead of comparing every pair with every other. */
const YAML_PAIRWISE_KEYS: i32 = 16
/** No node, no slot, no offset: what every lookup answers outside its array. */
const YAML_NONE: i32 = -1
/** What `type` holds for a scalar it has not resolved yet. */
const YAML_UNRESOLVED: i32 = 255
/** The prefix a `!!` tag stands for; tags are kept with it stripped (`"int"`). */
const YAML_CORE_PREFIX: string = "tag:yaml.org,2002:"

/** Where a node is parsed from, which decides what may start on its line. */
const YAML_IN_VALUE: i32 = 0
const YAML_IN_SEQ: i32 = 1
const YAML_IN_ROOT: i32 = 2
const YAML_IN_KEY: i32 = 3
const YAML_IN_MARKER: i32 = 4

/** A block scalar's chomping, in the low two bits of its `extras`. */
const YAML_CLIP: i32 = 0
const YAML_STRIP: i32 = 1
const YAML_KEEP: i32 = 2

// ---- Options -------------------------------------------------------------------

/** How `parseYamlWith` reads a stream. Make one with `new YamlOptions()` and set what differs. */
export class YamlOptions {
  /** How deeply collections may nest before `DEPTH_LIMIT`; 1 to 1000, and anything else panics. */
  maxDepth: i32 = 1000
  /** Whether a map that repeats a key is reported (`DUPLICATE_KEY`). */
  uniqueKeys: boolean = true
  /** Whether a plain `<<` key is a merge key, checked as one (`BAD_MERGE`) and exempt from `uniqueKeys`. */
  merge: boolean = true
  /** Whether the stream keeps the byte range of every comment (`commentCount`). */
  keepComments: boolean = false
  /** Whether only the first document is read, with `MULTIPLE_DOCUMENTS` if more follow. */
  firstDocumentOnly: boolean = false
}

// ---- The stream ----------------------------------------------------------------

/**
 * Every document, node and diagnostic one parse found. Its fields and its
 * "Internal" methods are reachable, as every member in Nish is; use the others.
 */
export class YamlStream {
  /** The text the stream was parsed from; every offset is into it. */
  source: string
  /** Per node: the first byte of its source, and one past its last. */
  starts: i32[]
  ends: i32[]
  /**
   * Per node, by kind: a collection's first child in `kids` and its child
   * count; a pair's key and value; an alias's target and `-1`; a scalar's body
   * (the bytes inside its quotes, or a block scalar's lines).
   */
  firsts: i32[]
  counts: i32[]
  /**
   * Per node: a block scalar's content indent, whether it was written, and its
   * chomping, as `(indent + 1) * 8 + explicit * 4 + chomp`.
   */
  extras: i32[]
  /** Per node: its properties' slot, or `-1`. */
  props: i32[]
  /** Every collection's children, one collection after another. */
  kids: i32[]
  /** Per property slot: the anchor's name (after `&`), the tag as written, and the anchor table entry. */
  propAnchorStarts: i32[]
  propAnchorEnds: i32[]
  propTagStarts: i32[]
  propTagEnds: i32[]
  propStarts: i32[]
  propEnds: i32[]
  propEntries: i32[]
  /** Per property slot: the resolved tag, with `tag:yaml.org,2002:` stripped, or `""`. */
  propTags: string[]
  /** Per diagnostic: its code, range, document and message, and whether it is a warning. */
  diagCodes: i32[]
  diagStarts: i32[]
  diagEnds: i32[]
  diagDocuments: i32[]
  diagMessages: string[]
  diagWarnings: boolean[]
  /** Per document: its root node and its range. */
  docRoots: i32[]
  docStarts: i32[]
  docEnds: i32[]
  /** Per comment kept: its range, from the `#`. */
  commentStarts: i32[]
  commentEnds: i32[]
  /** Per node: its `YAML_*` kind, style and core-schema type (`YAML_UNRESOLVED` until read). */
  kinds: u8[]
  styles: u8[]
  types: u8[]

  /** How many nodes the arrays have room for, and how many are in use. */
  cap: i32 = 0
  top: i32 = 0
  /** How many slots of `kids` are in use. */
  kidTop: i32 = 0
  errors: i32 = 0
  warnings: i32 = 0

  constructor(text: string) {
    this.source = text
    const room: i32 = toI32(text.length) / 8 + 16
    this.cap = room
    this.starts = new Array<i32>(room)
    this.ends = new Array<i32>(room)
    this.firsts = new Array<i32>(room)
    this.counts = new Array<i32>(room)
    this.extras = new Array<i32>(room)
    this.props = new Array<i32>(room)
    this.kids = new Array<i32>(room)
    this.kinds = new Array<u8>(room)
    this.styles = new Array<u8>(room)
    this.types = new Array<u8>(room)
    this.propAnchorStarts = []
    this.propAnchorEnds = []
    this.propTagStarts = []
    this.propTagEnds = []
    this.propStarts = []
    this.propEnds = []
    this.propEntries = []
    this.propTags = []
    this.diagCodes = []
    this.diagStarts = []
    this.diagEnds = []
    this.diagDocuments = []
    this.diagMessages = []
    this.diagWarnings = []
    this.docRoots = []
    this.docStarts = []
    this.docEnds = []
    this.commentStarts = []
    this.commentEnds = []
  }

  // ---- Documents ---------------------------------------------------------------

  /** How many documents the stream holds: `0` for an empty text, unless `firstDocumentOnly`. */
  documentCount(): i32 {
    return toI32(this.docRoots.length)
  }

  /** Document `d`'s root node, or `-1` for a document that is not there. */
  documentRoot(d: i32): i32 {
    return yamlAt(this.docRoots, d)
  }

  /** The byte document `d` starts at (its `---`, if it has one), or `-1`. */
  documentStart(d: i32): i32 {
    return yamlAt(this.docStarts, d)
  }

  /** One past document `d`'s last byte (through its `...`, if it has one), or `-1`. */
  documentEnd(d: i32): i32 {
    return yamlAt(this.docEnds, d)
  }

  // ---- Nodes -------------------------------------------------------------------

  /** Node `n`'s `YAML_*` kind, or `0` for `-1` and any handle that is not a node. */
  kind(n: i32): i32 {
    const kinds: u8[] = this.kinds
    return n >= 0 && n < this.top && n < toI32(kinds.length) ? toI32(kinds[n]) : 0
  }

  /** Node `n`'s style: `YAML_PLAIN`, a quoted or block-scalar style, `YAML_FLOW` or `YAML_BLOCK`. */
  style(n: i32): i32 {
    const styles: u8[] = this.styles
    return n >= 0 && n < this.top && n < toI32(styles.length) ? toI32(styles[n]) : 0
  }

  /** The first byte of node `n`'s source, its properties not included, or `-1`. */
  start(n: i32): i32 {
    return n < this.top ? yamlAt(this.starts, n) : -1
  }

  /** One past the last byte of node `n`'s source, or `-1`. */
  end(n: i32): i32 {
    return n < this.top ? yamlAt(this.ends, n) : -1
  }

  /** How many children a map (its pairs) or a seq (its items) has; `0` for any other node. */
  count(n: i32): i32 {
    const k: i32 = this.kind(n)
    return k === YAML_MAP || k === YAML_SEQ ? yamlAt(this.counts, n) : 0
  }

  /** Child `i` of a map or a seq, or `-1` past its last. */
  child(n: i32, i: i32): i32 {
    if (i < 0 || i >= this.count(n)) {
      return -1
    }
    return yamlAt(this.kids, yamlAt(this.firsts, n) + i)
  }

  /** A pair's key node, or `-1` for a node that is not a pair. */
  key(pair: i32): i32 {
    return this.kind(pair) === YAML_PAIR ? yamlAt(this.firsts, pair) : -1
  }

  /** A pair's value node, or `-1` for a node that is not a pair. */
  value(pair: i32): i32 {
    return this.kind(pair) === YAML_PAIR ? yamlAt(this.counts, pair) : -1
  }

  /** The node an alias names, or `-1` for an alias with no anchor and any node that is not an alias. */
  target(n: i32): i32 {
    return this.kind(n) === YAML_ALIAS ? yamlAt(this.firsts, n) : -1
  }

  /** Node `n` itself, or the node it names when it is an alias. */
  resolved(n: i32): i32 {
    return this.kind(n) === YAML_ALIAS ? yamlAt(this.firsts, n) : n
  }

  /** Node `n`'s anchor name, without its `&`, or `""`. */
  anchor(n: i32): string {
    const slot: i32 = n < this.top ? yamlAt(this.props, n) : -1
    if (slot < 0) {
      return ""
    }
    const from: i32 = yamlAt(this.propAnchorStarts, slot)
    return from < 0 ? "" : this.source.substring(from, yamlAt(this.propAnchorEnds, slot))
  }

  /**
   * Node `n`'s tag, resolved: `"int"` for `!!int` (the `tag:yaml.org,2002:`
   * prefix stripped), `"!local"` for `!local`, `"!"` for the non-specific `!`,
   * a `%TAG` handle's prefix joined to its suffix, or `""` for an untagged node.
   */
  tag(n: i32): string {
    const slot: i32 = n < this.top ? yamlAt(this.props, n) : -1
    const tags: string[] = this.propTags
    return slot >= 0 && slot < toI32(tags.length) ? tags[slot] : ""
  }

  /**
   * A scalar's text, decoded: quotes and escapes undone, lines folded, a block
   * scalar's indentation and chomping applied. An alias answers its target's
   * text, and any other node `""`. Decoded on every call; keep the result.
   */
  text(n: i32): string {
    const at: i32 = this.resolved(n)
    if (this.kind(at) !== YAML_SCALAR) {
      return ""
    }
    return yamlDecode(this, at)
  }

  /**
   * A scalar's core-schema type: `YAML_NULL`, `YAML_BOOL`, `YAML_INT`,
   * `YAML_FLOAT` or `YAML_STRING`; through an alias; `-1` for a collection.
   * A quoted or block scalar is a string, and so is any tagged one the core
   * schema does not describe; a `!!str` plain scalar is a string too.
   */
  type(n: i32): i32 {
    const at: i32 = this.resolved(n)
    if (this.kind(at) !== YAML_SCALAR) {
      return -1
    }
    const types: u8[] = this.types
    const have: i32 = at >= 0 && at < toI32(types.length) ? toI32(types[at]) : YAML_STRING
    if (have !== YAML_UNRESOLVED) {
      return have
    }
    const resolvedType: i32 = yamlResolve(this, at)
    if (at >= 0 && at < toI32(types.length)) {
      types[at] = toU8(resolvedType)
    }
    return resolvedType
  }

  /** Whether a scalar is the boolean `true`; `false` for anything that is not a `YAML_BOOL`. */
  boolValue(n: i32): boolean {
    if (this.type(n) !== YAML_BOOL) {
      return false
    }
    const at: i32 = this.resolved(n)
    const code: i32 =
      this.style(at) === YAML_PLAIN ? yamlByte(this.source, this.start(at)) : yamlByte(yamlDecode(this, at), 0)
    return code === 116 || code === 84
  }

  /** A `YAML_INT` scalar's value; `0` for anything else, and the value wrapped past 64 bits. */
  intValue(n: i32): i64 {
    if (this.type(n) !== YAML_INT) {
      return toI64(0)
    }
    const at: i32 = this.resolved(n)
    if (this.style(at) === YAML_PLAIN) {
      return yamlParseInt(this.source, this.start(at), this.end(at))
    }
    const decoded: string = yamlDecode(this, at)
    return yamlParseInt(decoded, 0, toI32(decoded.length))
  }

  /** A `YAML_FLOAT` or `YAML_INT` scalar's value as an `f64`; `0` for anything else. */
  floatValue(n: i32): f64 {
    const t: i32 = this.type(n)
    const at: i32 = this.resolved(n)
    if (t === YAML_INT) {
      return toF64(this.intValue(n))
    }
    if (t !== YAML_FLOAT) {
      return toF64(0)
    }
    if (this.style(at) === YAML_PLAIN) {
      return yamlParseFloat(this.source, this.start(at), this.end(at))
    }
    const decoded: string = yamlDecode(this, at)
    return yamlParseFloat(decoded, 0, toI32(decoded.length))
  }

  // ---- Diagnostics -------------------------------------------------------------

  /** How many diagnostics the parse found, errors and warnings, in order of where they start. */
  diagnosticCount(): i32 {
    return toI32(this.diagCodes.length)
  }

  /** How many of the diagnostics are errors: `0` for a valid stream. */
  errorCount(): i32 {
    return this.errors
  }

  /** How many of the diagnostics are warnings. */
  warningCount(): i32 {
    return this.warnings
  }

  /** Diagnostic `i`'s `YAML_ERR_*` code, or `0`. */
  diagnosticCode(i: i32): i32 {
    return i < 0 ? 0 : yamlAt(this.diagCodes, i) < 0 ? 0 : yamlAt(this.diagCodes, i)
  }

  /** Whether diagnostic `i` is a warning rather than an error. */
  diagnosticIsWarning(i: i32): boolean {
    const warnings: boolean[] = this.diagWarnings
    return i >= 0 && i < toI32(warnings.length) ? warnings[i] : false
  }

  /** The first byte diagnostic `i` is about, or `-1`. */
  diagnosticStart(i: i32): i32 {
    return yamlAt(this.diagStarts, i)
  }

  /** One past the last byte diagnostic `i` is about, or `-1`; the same as its start for a point. */
  diagnosticEnd(i: i32): i32 {
    return yamlAt(this.diagEnds, i)
  }

  /** Diagnostic `i`'s message, such as `map key "a" is duplicated`, or `""`. */
  diagnosticMessage(i: i32): string {
    const messages: string[] = this.diagMessages
    return i >= 0 && i < toI32(messages.length) ? messages[i] : ""
  }

  /** The document diagnostic `i` was found in, or `-1`. */
  diagnosticDocument(i: i32): i32 {
    return yamlAt(this.diagDocuments, i)
  }

  // ---- Comments ----------------------------------------------------------------

  /** How many comments the stream kept: none unless `keepComments`. */
  commentCount(): i32 {
    return toI32(this.commentStarts.length)
  }

  /** Comment `i`'s first byte, its `#`, or `-1`. */
  commentStart(i: i32): i32 {
    return yamlAt(this.commentStarts, i)
  }

  /** One past comment `i`'s last byte, before its line break, or `-1`. */
  commentEnd(i: i32): i32 {
    return yamlAt(this.commentEnds, i)
  }

  /** Comment `i`'s text after its `#`, or `""`. */
  comment(i: i32): string {
    const from: i32 = this.commentStart(i)
    return from < 0 ? "" : this.source.substring(from + 1, this.commentEnd(i))
  }

  // ---- Building ----------------------------------------------------------------

  /** Internal: a new node of `kind` and `style` over `[start, end)`, its other fields empty. */
  newNode(kind: i32, style: i32, start: i32, end: i32): i32 {
    if (this.top >= this.cap) {
      this.grow()
    }
    const n: i32 = this.top
    this.top = n + 1
    yamlPut(this.starts, n, start)
    yamlPut(this.ends, n, end)
    yamlPut(this.firsts, n, -1)
    yamlPut(this.counts, n, 0)
    yamlPut(this.extras, n, 0)
    yamlPut(this.props, n, -1)
    yamlPutU8(this.kinds, n, kind)
    yamlPutU8(this.styles, n, style)
    yamlPutU8(this.types, n, YAML_UNRESOLVED)
    return n
  }

  /** Internal: doubles every node array together. */
  grow(): void {
    const room: i32 = this.cap * 2
    this.starts = yamlRoomI32(this.starts, room)
    this.ends = yamlRoomI32(this.ends, room)
    this.firsts = yamlRoomI32(this.firsts, room)
    this.counts = yamlRoomI32(this.counts, room)
    this.extras = yamlRoomI32(this.extras, room)
    this.props = yamlRoomI32(this.props, room)
    this.kinds = yamlRoomU8(this.kinds, room)
    this.styles = yamlRoomU8(this.styles, room)
    this.types = yamlRoomU8(this.types, room)
    this.cap = room
  }

  /** Internal: appends `n` to `kids`, growing it by doubling; answers its slot. */
  pushKid(n: i32): i32 {
    const slot: i32 = this.kidTop
    this.kids = yamlRoomI32(this.kids, slot + 1)
    yamlPut(this.kids, slot, n)
    this.kidTop = slot + 1
    return slot
  }

  /** Internal: records a diagnostic. */
  report(code: i32, warning: boolean, message: string, start: i32, end: i32, document: i32): void {
    this.diagCodes.push(code)
    this.diagWarnings.push(warning)
    this.diagMessages.push(message)
    this.diagStarts.push(start)
    this.diagEnds.push(end < start ? start : end)
    this.diagDocuments.push(document)
    if (warning) {
      this.warnings += 1
    } else {
      this.errors += 1
    }
  }

  /** Internal: a new, empty property slot. */
  newProps(): i32 {
    const slot: i32 = toI32(this.propTags.length)
    this.propAnchorStarts.push(YAML_NONE)
    this.propAnchorEnds.push(YAML_NONE)
    this.propTagStarts.push(YAML_NONE)
    this.propTagEnds.push(YAML_NONE)
    this.propStarts.push(YAML_NONE)
    this.propEnds.push(YAML_NONE)
    this.propEntries.push(YAML_NONE)
    this.propTags.push("")
    return slot
  }

  /** Internal: sorts the diagnostics by start, keeping the order of those that start together. */
  sortDiagnostics(): void {
    const count: i32 = toI32(this.diagCodes.length)
    let i: i32 = 1
    while (i < count) {
      const at: i32 = yamlAt(this.diagStarts, i)
      if (at < yamlAt(this.diagStarts, i - 1)) {
        // Insertion: diagnostics arrive nearly sorted, so each moves a step or two.
        const code: i32 = yamlAt(this.diagCodes, i)
        const end: i32 = yamlAt(this.diagEnds, i)
        const document: i32 = yamlAt(this.diagDocuments, i)
        const message: string = this.diagnosticMessage(i)
        const warning: boolean = this.diagnosticIsWarning(i)
        let j: i32 = i
        while (j > 0 && yamlAt(this.diagStarts, j - 1) > at) {
          this.moveDiagnostic(j - 1, j)
          j -= 1
        }
        yamlPut(this.diagCodes, j, code)
        yamlPut(this.diagStarts, j, at)
        yamlPut(this.diagEnds, j, end)
        yamlPut(this.diagDocuments, j, document)
        const messages: string[] = this.diagMessages
        if (j >= 0 && j < toI32(messages.length)) {
          messages[j] = message
        }
        const warnings: boolean[] = this.diagWarnings
        if (j >= 0 && j < toI32(warnings.length)) {
          warnings[j] = warning
        }
      }
      i += 1
    }
  }

  /** Internal: copies diagnostic `from` over diagnostic `to`. */
  moveDiagnostic(from: i32, to: i32): void {
    yamlPut(this.diagCodes, to, yamlAt(this.diagCodes, from))
    yamlPut(this.diagStarts, to, yamlAt(this.diagStarts, from))
    yamlPut(this.diagEnds, to, yamlAt(this.diagEnds, from))
    yamlPut(this.diagDocuments, to, yamlAt(this.diagDocuments, from))
    const messages: string[] = this.diagMessages
    if (to >= 0 && to < toI32(messages.length)) {
      messages[to] = this.diagnosticMessage(from)
    }
    const warnings: boolean[] = this.diagWarnings
    if (to >= 0 && to < toI32(warnings.length)) {
      warnings[to] = this.diagnosticIsWarning(from)
    }
  }
}

// ---- Array helpers ---------------------------------------------------------------

/** `a[i]`, or `-1` outside it. */
const yamlAt = (a: i32[], i: i32): i32 => (i >= 0 && i < toI32(a.length) ? a[i] : -1)

/** `a[i] = v`, when `i` is inside `a`. */
const yamlPut = (a: i32[], i: i32, v: i32): void => {
  if (i >= 0 && i < toI32(a.length)) {
    a[i] = v
  }
}

/** `a[i] = v` as a byte, when `i` is inside `a`. */
const yamlPutU8 = (a: u8[], i: i32, v: i32): void => {
  if (i >= 0 && i < toI32(a.length)) {
    a[i] = toU8(v)
  }
}

/** `a`, or a copy of it at least `n` long and at least twice as long. */
const yamlRoomI32 = (a: i32[], n: i32): i32[] => {
  const have: i32 = toI32(a.length)
  if (n <= have) {
    return a
  }
  const grown: i32[] = new Array<i32>(n > have * 2 ? n : have * 2)
  grown.set(a, 0)
  return grown
}

/** `a`, or a copy of it at least `n` long and at least twice as long. */
const yamlRoomU8 = (a: u8[], n: i32): u8[] => {
  const have: i32 = toI32(a.length)
  if (n <= have) {
    return a
  }
  const grown: u8[] = new Array<u8>(n > have * 2 ? n : have * 2)
  grown.set(a, 0)
  return grown
}

/** The byte of `text` at `i`, or `-1` outside it. */
const yamlByte = (text: string, i: i32): i32 =>
  i >= 0 && i < toI32(text.length) ? toI32(text.charCodeAt(i)) : -1

/** Whether `text[a0, a1)` and `text[b0, b1)` hold the same bytes. */
const yamlSameBytes = (text: string, a0: i32, a1: i32, b0: i32, b1: i32): boolean => {
  if (a1 - a0 !== b1 - b0) {
    return false
  }
  let i: i32 = 0
  while (i < a1 - a0) {
    if (yamlByte(text, a0 + i) !== yamlByte(text, b0 + i)) {
      return false
    }
    i += 1
  }
  return true
}

/** Whether `text[from, to)` is exactly `word`. */
const yamlIsWord = (text: string, from: i32, to: i32, word: string): boolean => {
  const n: i32 = toI32(word.length)
  if (to - from !== n) {
    return false
  }
  let i: i32 = 0
  while (i < n) {
    if (yamlByte(text, from + i) !== toI32(word.charCodeAt(i))) {
      return false
    }
    i += 1
  }
  return true
}

const yamlIsBreak = (code: i32): boolean => code === YAML_LF || code === YAML_CR
const yamlIsBlank = (code: i32): boolean => code === YAML_SPACE || code === YAML_TAB
/** A blank, a break or the end of the text: what may follow an indicator such as `- `. */
const yamlIsWs = (code: i32): boolean =>
  code < 0 || code === YAML_SPACE || code === YAML_TAB || code === YAML_LF || code === YAML_CR
const yamlIsFlowIndicator = (code: i32): boolean =>
  code === YAML_COMMA ||
  code === YAML_LBRACKET ||
  code === YAML_RBRACKET ||
  code === YAML_LBRACE ||
  code === YAML_RBRACE
const yamlIsDigit = (code: i32): boolean => code >= YAML_ZERO && code <= YAML_NINE
const yamlHexValue = (code: i32): i32 => {
  if (code >= YAML_ZERO && code <= YAML_NINE) {
    return code - YAML_ZERO
  }
  if (code >= 97 && code <= 102) {
    return code - 87
  }
  if (code >= 65 && code <= 70) {
    return code - 55
  }
  return -1
}

/** Past `text[i]`, a break: one byte, or two for CR LF. */
const yamlAfterBreak = (text: string, i: i32): i32 =>
  yamlByte(text, i) === YAML_CR && yamlByte(text, i + 1) === YAML_LF ? i + 2 : i + 1

/** The first break in `text[from, to)`, or `to`. */
const yamlLineEnd = (text: string, from: i32, to: i32): i32 => {
  const at: i32 = indexOfAny(text, YAML_BREAKS, from)
  return at < 0 || at > to ? to : at
}

// ---- Decoding ------------------------------------------------------------------

/** The bytes a scalar decodes to, collected before they become one string. */
class YamlBuffer {
  bytes: u8[]
  count: i32 = 0

  constructor(room: i32) {
    const least: i32 = 16
    this.bytes = new Array<u8>(room > least ? room : least)
  }

  /** Internal: appends one byte. */
  push(code: i32): void {
    if (this.count >= toI32(this.bytes.length)) {
      this.bytes = yamlRoomU8(this.bytes, this.count + 1)
    }
    yamlPutU8(this.bytes, this.count, code)
    this.count += 1
  }

  /** Internal: appends `count` copies of `code`. */
  repeat(code: i32, count: i32): void {
    let i: i32 = 0
    while (i < count) {
      this.push(code)
      i += 1
    }
  }

  /** Internal: appends `text[from, to)`. */
  copy(text: string, from: i32, to: i32): void {
    let i: i32 = from
    while (i < to) {
      this.push(yamlByte(text, i))
      i += 1
    }
  }

  /** Internal: appends code point `cp` as UTF-8. */
  codePoint(cp: i32): void {
    const six: i32 = 6
    const low: i32 = 63
    const continuation: i32 = 0x80
    if (cp < continuation) {
      this.push(cp)
      return
    }
    const two: i32 = 0x800
    const three: i32 = 0x10000
    if (cp < two) {
      const lead: i32 = 0xc0
      this.push(lead + (cp >> six))
    } else if (cp < three) {
      const lead: i32 = 0xe0
      this.push(lead + (cp >> (six * 2)))
      this.push(continuation + ((cp >> six) & low))
    } else {
      const lead: i32 = 0xf0
      this.push(lead + (cp >> (six * 3)))
      this.push(continuation + ((cp >> (six * 2)) & low))
      this.push(continuation + ((cp >> six) & low))
    }
    this.push(continuation + (cp & low))
  }

  /** Internal: drops trailing spaces and tabs, but none at or below `floor`. */
  trimBlanks(floor: i32): void {
    const bytes: u8[] = this.bytes
    while (this.count > floor) {
      const at: i32 = this.count - 1
      const code: i32 = at >= 0 && at < toI32(bytes.length) ? toI32(bytes[at]) : 0
      if (!yamlIsBlank(code)) {
        return
      }
      this.count = at
    }
  }

  /** Internal: the bytes as a string. */
  text(): string {
    return String.fromBytes(this.bytes, 0, this.count)
  }
}

/** Internal: scalar `n`'s text, decoded from its body. */
const yamlDecode = (stream: YamlStream, n: i32): string => {
  const style: i32 = stream.style(n)
  const from: i32 = yamlAt(stream.firsts, n)
  const to: i32 = yamlAt(stream.counts, n)
  if (from < 0 || to <= from) {
    return ""
  }
  if (style === YAML_LITERAL || style === YAML_FOLDED) {
    return yamlDecodeBlock(stream.source, from, to, yamlAt(stream.extras, n), style === YAML_FOLDED)
  }
  return yamlDecodeFlow(stream.source, from, to, style)
}

/**
 * A plain or quoted scalar's body decoded: each break with the blanks around it
 * folded to a space, or to one newline per empty line it holds; `''` undone in
 * a single-quoted body, escapes in a double-quoted one.
 */
const yamlDecodeFlow = (text: string, from: i32, to: i32, style: i32): string => {
  // Most scalars hold nothing to undo: their text is their body.
  let i: i32 = from
  while (i < to) {
    const code: i32 = yamlByte(text, i)
    if (
      yamlIsBreak(code) ||
      (style === YAML_SINGLE_QUOTED && code === YAML_SQUOTE) ||
      (style === YAML_DOUBLE_QUOTED && code === YAML_BACKSLASH)
    ) {
      break
    }
    i += 1
  }
  if (i >= to) {
    return text.substring(from, to)
  }
  const out: YamlBuffer = new YamlBuffer(to - from)
  out.copy(text, from, i)
  // Blanks the source spelled as escapes are content, and a fold never trims them.
  let floor: i32 = 0
  while (i < to) {
    const code: i32 = yamlByte(text, i)
    if (yamlIsBreak(code)) {
      out.trimBlanks(floor)
      i = yamlAfterBreak(text, i)
      let empties: i32 = 0
      while (true) {
        let j: i32 = i
        while (j < to && yamlIsBlank(yamlByte(text, j))) {
          j += 1
        }
        if (j < to && yamlIsBreak(yamlByte(text, j))) {
          empties += 1
          i = yamlAfterBreak(text, j)
        } else {
          i = j
          break
        }
      }
      if (empties === 0) {
        out.push(YAML_SPACE)
      } else {
        out.repeat(YAML_LF, empties)
      }
      floor = out.count
    } else if (style === YAML_SINGLE_QUOTED && code === YAML_SQUOTE) {
      out.push(YAML_SQUOTE)
      i += yamlByte(text, i + 1) === YAML_SQUOTE ? 2 : 1
    } else if (style === YAML_DOUBLE_QUOTED && code === YAML_BACKSLASH) {
      if (i + 1 < to && yamlIsBreak(yamlByte(text, i + 1))) {
        // An escaped break joins the lines; the empty lines after it stay.
        i = yamlAfterBreak(text, i + 1)
        while (true) {
          let j: i32 = i
          while (j < to && yamlIsBlank(yamlByte(text, j))) {
            j += 1
          }
          if (j < to && yamlIsBreak(yamlByte(text, j))) {
            out.push(YAML_LF)
            i = yamlAfterBreak(text, j)
          } else {
            i = j
            break
          }
        }
      } else {
        i = yamlDecodeEscape(text, i, to, out)
      }
      floor = out.count
    } else {
      out.push(code)
      i += 1
    }
  }
  return out.text()
}

/** Appends what the escape at `text[at]`, a `\`, stands for; answers the byte past it. */
const yamlDecodeEscape = (text: string, at: i32, to: i32, out: YamlBuffer): i32 => {
  if (at + 1 >= to) {
    out.push(YAML_BACKSLASH)
    return at + 1
  }
  const e: i32 = yamlByte(text, at + 1)
  const digits: i32 = e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0
  if (digits > 0) {
    let cp: i32 = 0
    let k: i32 = 0
    while (k < digits && at + 2 + k < to) {
      const v: i32 = yamlHexValue(yamlByte(text, at + 2 + k))
      if (v < 0 || cp > 0x10ffff) {
        break
      }
      cp = cp * 16 + v
      k += 1
    }
    if (k === digits && cp <= 0x10ffff) {
      out.codePoint(cp)
      return at + 2 + digits
    }
    out.push(YAML_BACKSLASH)
    out.push(e)
    return at + 2
  }
  const mapped: i32 = yamlEscapeValue(e)
  if (mapped < 0) {
    out.push(YAML_BACKSLASH)
    out.push(e)
  } else {
    out.codePoint(mapped)
  }
  return at + 2
}

/** The code point `\` and `e` stand for in a double-quoted scalar, or `-1` for no escape. */
const yamlEscapeValue = (e: i32): i32 => {
  if (e === YAML_ZERO) {
    return 0
  }
  if (e === 97) {
    return 7
  }
  if (e === 98) {
    return 8
  }
  if (e === 116 || e === YAML_TAB) {
    return 9
  }
  if (e === 110) {
    return 10
  }
  if (e === 118) {
    return 11
  }
  if (e === 102) {
    return 12
  }
  if (e === 114) {
    return 13
  }
  if (e === 101) {
    return 27
  }
  if (e === YAML_SPACE || e === YAML_DQUOTE || e === 47 || e === YAML_BACKSLASH) {
    return e
  }
  if (e === 78) {
    return 0x85
  }
  if (e === 95) {
    return 0xa0
  }
  if (e === 76) {
    return 0x2028
  }
  if (e === 80) {
    return 0x2029
  }
  return -1
}

/**
 * A block scalar's lines decoded: the content indent dropped from each, a
 * folded scalar's lines joined, and the trailing breaks chomped.
 */
const yamlDecodeBlock = (text: string, from: i32, to: i32, extras: i32, folded: boolean): string => {
  const indent: i32 = (extras >> 3) - 1
  const explicit: boolean = (extras & 4) !== 0
  const chomp: i32 = extras & 3
  const out: YamlBuffer = new YamlBuffer(to - from)
  let i: i32 = from
  let seenContent: boolean = false
  let previousMore: boolean = false
  // Breaks since the last content line's text, its own included.
  let pending: i32 = 0
  while (i < to) {
    let j: i32 = i
    while (j < to && j - i < indent && yamlByte(text, j) === YAML_SPACE) {
      j += 1
    }
    const e: i32 = yamlLineEnd(text, j, to)
    const hasBreak: boolean = e < to
    let empty: boolean = j === e
    if (!empty && (j - i < indent || (!seenContent && !explicit))) {
      // Short of the indent, or before the indent was found: only blanks, so empty.
      let k: i32 = j
      while (k < e && yamlIsBlank(yamlByte(text, k))) {
        k += 1
      }
      empty = k === e
    }
    if (empty) {
      if (hasBreak) {
        pending += 1
      }
    } else {
      const more: boolean = yamlIsBlank(yamlByte(text, j))
      if (!seenContent) {
        out.repeat(YAML_LF, pending)
      } else if (folded && !more && !previousMore) {
        if (pending === 1) {
          out.push(YAML_SPACE)
        } else {
          out.repeat(YAML_LF, pending - 1)
        }
      } else {
        out.repeat(YAML_LF, pending)
      }
      out.copy(text, j, e)
      seenContent = true
      previousMore = more
      pending = hasBreak ? 1 : 0
    }
    i = hasBreak ? yamlAfterBreak(text, e) : to
  }
  if (chomp === YAML_KEEP) {
    out.repeat(YAML_LF, pending)
  } else if (chomp === YAML_CLIP && seenContent && pending > 0) {
    out.push(YAML_LF)
  }
  return out.text()
}

// ---- The core schema -------------------------------------------------------------

/** Internal: scalar `n`'s core-schema type, from its text and its tag. */
const yamlResolve = (stream: YamlStream, n: i32): i32 => {
  const tag: string = stream.tag(n)
  const plain: boolean = stream.style(n) === YAML_PLAIN
  if (tag === "") {
    return plain ? yamlPlainType(stream.source, stream.start(n), stream.end(n)) : YAML_STRING
  }
  if (tag !== "null" && tag !== "bool" && tag !== "int" && tag !== "float") {
    return YAML_STRING
  }
  let found: i32 = YAML_STRING
  if (plain) {
    found = yamlPlainType(stream.source, stream.start(n), stream.end(n))
  } else {
    const decoded: string = yamlDecode(stream, n)
    found = yamlPlainType(decoded, 0, toI32(decoded.length))
  }
  if (tag === "null") {
    return found === YAML_NULL ? YAML_NULL : YAML_STRING
  }
  if (tag === "bool") {
    return found === YAML_BOOL ? YAML_BOOL : YAML_STRING
  }
  if (tag === "int") {
    return found === YAML_INT ? YAML_INT : YAML_STRING
  }
  return found === YAML_FLOAT || found === YAML_INT ? YAML_FLOAT : YAML_STRING
}

/** The core-schema type of the untagged plain scalar `text[from, to)`. */
const yamlPlainType = (text: string, from: i32, to: i32): i32 => {
  if (to <= from) {
    return YAML_NULL
  }
  const c: i32 = yamlByte(text, from)
  const letter: boolean = c === 110 || c === 78 || c === 116 || c === 84 || c === 102 || c === 70
  if (!letter && !yamlIsDigit(c) && c !== YAML_DOT && c !== YAML_DASH && c !== YAML_PLUS && c !== 126) {
    return YAML_STRING
  }
  if (
    yamlIsWord(text, from, to, "~") ||
    yamlIsWord(text, from, to, "null") ||
    yamlIsWord(text, from, to, "Null") ||
    yamlIsWord(text, from, to, "NULL")
  ) {
    return YAML_NULL
  }
  if (
    yamlIsWord(text, from, to, "true") ||
    yamlIsWord(text, from, to, "True") ||
    yamlIsWord(text, from, to, "TRUE") ||
    yamlIsWord(text, from, to, "false") ||
    yamlIsWord(text, from, to, "False") ||
    yamlIsWord(text, from, to, "FALSE")
  ) {
    return YAML_BOOL
  }
  if (letter) {
    return YAML_STRING
  }
  if (yamlIntBase(text, from, to) > 0) {
    return YAML_INT
  }
  if (yamlSpecialFloat(text, from, to) > 0 || yamlIsFloatForm(text, from, to)) {
    return YAML_FLOAT
  }
  return YAML_STRING
}

/** The base of the core-schema integer `text[from, to)`, signed, decimal, `0x` or `0o`; `0` for none. */
const yamlIntBase = (text: string, from: i32, to: i32): i32 => {
  let i: i32 = from
  const sign: i32 = yamlByte(text, i)
  if (sign === YAML_PLUS || sign === YAML_DASH) {
    i += 1
  }
  let base: i32 = 10
  const x: i32 = yamlByte(text, i + 1)
  if (yamlByte(text, i) === YAML_ZERO && (x === 120 || x === 111)) {
    base = x === 120 ? 16 : 8
    i += 2
  }
  if (i >= to) {
    return 0
  }
  while (i < to) {
    const v: i32 = yamlHexValue(yamlByte(text, i))
    if (v < 0 || v >= base) {
      return 0
    }
    i += 1
  }
  return base
}

/** Whether `text[from, to)` is a core-schema float: `[-+]? (. digits | digits [. digits]) [e [-+] digits]`. */
const yamlIsFloatForm = (text: string, from: i32, to: i32): boolean => {
  let i: i32 = from
  const sign: i32 = yamlByte(text, i)
  if (sign === YAML_PLUS || sign === YAML_DASH) {
    i += 1
  }
  const wholeStart: i32 = i
  while (i < to && yamlIsDigit(yamlByte(text, i))) {
    i += 1
  }
  const whole: i32 = i - wholeStart
  if (i < to && yamlByte(text, i) === YAML_DOT) {
    i += 1
    const fractionStart: i32 = i
    while (i < to && yamlIsDigit(yamlByte(text, i))) {
      i += 1
    }
    if (whole === 0 && i === fractionStart) {
      return false
    }
  } else if (whole === 0) {
    return false
  }
  if (i < to && (yamlByte(text, i) === 101 || yamlByte(text, i) === 69)) {
    i += 1
    const s: i32 = yamlByte(text, i)
    if (s === YAML_PLUS || s === YAML_DASH) {
      i += 1
    }
    const expStart: i32 = i
    while (i < to && yamlIsDigit(yamlByte(text, i))) {
      i += 1
    }
    if (i === expStart) {
      return false
    }
  }
  return i === to
}

/** `1` for a core-schema positive infinity, `2` for a negative one, `3` for not-a-number, `0` otherwise. */
const yamlSpecialFloat = (text: string, from: i32, to: i32): i32 => {
  const c: i32 = yamlByte(text, from)
  const at: i32 = c === YAML_PLUS || c === YAML_DASH ? from + 1 : from
  if (yamlIsWord(text, at, to, ".inf") || yamlIsWord(text, at, to, ".Inf") || yamlIsWord(text, at, to, ".INF")) {
    return c === YAML_DASH ? 2 : 1
  }
  if (
    at === from &&
    (yamlIsWord(text, at, to, ".nan") || yamlIsWord(text, at, to, ".NaN") || yamlIsWord(text, at, to, ".NAN"))
  ) {
    return 3
  }
  return 0
}

/** The integer `text[from, to)`, decimal, `0x` or `0o`, wrapped past 64 bits; `0` when it is not one. */
const yamlParseInt = (text: string, from: i32, to: i32): i64 => {
  const base: i32 = yamlIntBase(text, from, to)
  let value: i64 = toI64(0)
  if (base === 0) {
    return value
  }
  let i: i32 = from
  const sign: i32 = yamlByte(text, i)
  if (sign === YAML_PLUS || sign === YAML_DASH) {
    i += 1
  }
  if (base !== 10) {
    i += 2
  }
  const wide: i64 = toI64(base)
  while (i < to) {
    value = wrappingAdd(wrappingMul(value, wide), toI64(yamlHexValue(yamlByte(text, i))))
    i += 1
  }
  return sign === YAML_DASH ? wrappingSub(toI64(0), value) : value
}

/** The float `text[from, to)`: a core-schema float, infinity or not-a-number, or an integer widened. */
const yamlParseFloat = (text: string, from: i32, to: i32): f64 => {
  const special: i32 = yamlSpecialFloat(text, from, to)
  if (special === 1) {
    return parseFloat("Infinity")
  }
  if (special === 2) {
    return parseFloat("-Infinity")
  }
  if (special === 3) {
    return parseFloat("")
  }
  if (yamlIntBase(text, from, to) > 0) {
    return toF64(yamlParseInt(text, from, to))
  }
  return yamlIsFloatForm(text, from, to) ? parseFloat(text.substring(from, to)) : toF64(0)
}
