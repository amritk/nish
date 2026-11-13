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
 * is the node its anchor named. A map holds the pairs it was written with, and
 * merge keys (`<<`) are not copied into it: a `<<` key is exempt from the
 * duplicate-key check, its value must be a map, an alias to one or a sequence
 * of those, and `pathNode` and `pathPair` look a key a map lacks up in the maps
 * it merges.
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
/** A `'...'` scalar. */
export const YAML_SINGLE_QUOTED: i32 = 1
/** A `"..."` scalar, the one style with escapes. */
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
/** `true` or `false`. */
export const YAML_BOOL: i32 = 1
/** An integer: decimal, `0o` octal or `0x` hex. */
export const YAML_INT: i32 = 2
/** A number with a fraction or exponent, an infinity (`.inf`, `-.inf`) or not-a-number (`.nan`). */
export const YAML_FLOAT: i32 = 3
/** Every other scalar; a quoted or block scalar is one unless a `!!` core tag that fits its text says otherwise. */
export const YAML_STRING: i32 = 4

// ---- Diagnostic codes ---------------------------------------------------------

/** Warning: an anchor or alias name ends in `:`, which YAML reads as part of the name. */
export const YAML_ERR_AMBIGUOUS_ANCHOR_NAME: i32 = 1
/** An anchor or alias whose name is empty or runs on into a flow indicator. */
export const YAML_ERR_BAD_ANCHOR: i32 = 2
/** A block scalar header that is not `|` or `>` with at most one indentation digit and one chomping indicator. */
export const YAML_ERR_BAD_BLOCK_HEADER: i32 = 3
/** A `#` that no whitespace precedes, so it cannot start a comment. */
export const YAML_ERR_BAD_COMMENT: i32 = 4
/**
 * A `%YAML` directive with a bad version or content after it; as a warning, a
 * `%TAG` directive missing its handle or prefix.
 */
export const YAML_ERR_BAD_DIRECTIVE: i32 = 5
/**
 * A double-quoted escape that is not one: an unknown letter, the wrong count of
 * hex digits, or a code point past U+10FFFF.
 */
export const YAML_ERR_BAD_ESCAPE: i32 = 6
/** An implicit key that does not fit on one line, or runs more than 1024 bytes before its `:`. */
export const YAML_ERR_BAD_IMPLICIT_KEY: i32 = 7
/**
 * A quoted scalar or flow collection continued on a line not indented deeper
 * than its parent, or a block scalar whose leading blank line is indented
 * deeper than its first content line.
 */
export const YAML_ERR_BAD_INDENT: i32 = 8
/** A `<<` merge whose value is not a map, an alias to one, or a sequence of those. */
export const YAML_ERR_BAD_MERGE: i32 = 9
/**
 * A node with two anchors or two tags, an alias with an anchor or tag, or node properties written before a `?`
 * explicit key indicator on its line.
 */
export const YAML_ERR_BAD_PROPERTY: i32 = 10
/** A plain scalar that holds `: `, which only a key may. */
export const YAML_ERR_BAD_SCALAR_CONTENT: i32 = 11
/** A plain scalar that starts with an indicator character, or a flow entry that starts with `-`. */
export const YAML_ERR_BAD_SCALAR_START: i32 = 12
/** A tag that is empty or not well formed. */
export const YAML_ERR_BAD_TAG: i32 = 13
/**
 * Warning: a `!!` core tag on the wrong kind of node (`!!map` on a scalar, say),
 * which only warns, or a scalar whose text its `!!int`, `!!float`, `!!bool` or
 * `!!null` tag cannot read, which is kept as a string.
 */
export const YAML_ERR_BAD_TAG_VALUE: i32 = 14
/** Collections nested deeper than `maxDepth`; the parse stops there. */
export const YAML_ERR_DEPTH_LIMIT: i32 = 15
/** A second `%YAML` directive in one document; as a warning, a `%TAG` handle declared twice. */
export const YAML_ERR_DUPLICATE_DIRECTIVE: i32 = 16
/** A map that repeats a key, when `uniqueKeys` asks for the check. */
export const YAML_ERR_DUPLICATE_KEY: i32 = 17
/** Warning: the stream has more documents than the first, which `firstDocumentOnly` left unread. */
export const YAML_ERR_MULTIPLE_DOCUMENTS: i32 = 18
/** An alias inside the node its anchor names. */
export const YAML_ERR_RECURSIVE_ALIAS: i32 = 19
/** A tab used to indent; YAML indents with spaces only. */
export const YAML_ERR_TAB_INDENT: i32 = 20
/** A `,` in a flow collection with no entry before it. */
export const YAML_ERR_UNEXPECTED_COMMA: i32 = 21
/** Text where no node may start, such as after the end of a node or a document marker inside a flow collection. */
export const YAML_ERR_UNEXPECTED_CONTENT: i32 = 22
/** A directive that no `...` precedes or no `---` follows. */
export const YAML_ERR_UNEXPECTED_DIRECTIVE: i32 = 23
/** Warning: a directive other than `%YAML` and `%TAG`; it is skipped. */
export const YAML_ERR_UNKNOWN_DIRECTIVE: i32 = 24
/** A tag whose handle no `%TAG` directive declared. */
export const YAML_ERR_UNKNOWN_TAG_HANDLE: i32 = 25
/** An alias with no anchor of that name before it. */
export const YAML_ERR_UNRESOLVED_ALIAS: i32 = 26
/** Warning: a `%YAML` version other than 1.2; the document is parsed as 1.2. */
export const YAML_ERR_UNSUPPORTED_YAML_VERSION: i32 = 27
/** A flow collection with no closing `]` or `}`. */
export const YAML_ERR_UNTERMINATED_FLOW: i32 = 28
/** A quoted scalar with no closing quote. */
export const YAML_ERR_UNTERMINATED_QUOTE: i32 = 29

/**
 * The name of a diagnostic code, for a message or a log line.
 *
 * @param code A `YAML_ERR_*` code, such as `YAML_ERR_DUPLICATE_KEY`.
 * @returns The code's name without its prefix, such as `"DUPLICATE_KEY"`, or `""` for a number that is not a code.
 */
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

/** What `skipStreamHead` met before a document's body: a `---`, a `...`, and a node on the `---` line. */
const YAML_SAW_DOC_START: i32 = 1
const YAML_SAW_DOC_END: i32 = 2
const YAML_SAW_INLINE_NODE: i32 = 4

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
  /**
   * Whether a plain `<<` key is a merge key: exempt from `uniqueKeys`, checked
   * to name maps, and followed by paths. The nodes are not changed either way.
   */
  merge: boolean = true
  /** Whether the stream keeps the byte range of every comment (`commentCount`). */
  keepComments: boolean = false
  /** Whether only the first document is read, with `MULTIPLE_DOCUMENTS` if more follow. */
  firstDocumentOnly: boolean = false
}

// ---- The stream ----------------------------------------------------------------

/**
 * Every document, node and diagnostic one parse found. A member marked
 * `@internal` is the parser's working state, public only so that the parser
 * and the walkers can fill and read it; use the others.
 *
 * A read never panics: a handle that names no node (`-1`, or one past the
 * stream), or a read that does not fit the node's kind (`count` of a scalar,
 * `intValue` of a string), answers a default — `-1` for a node or an offset,
 * `0`, `false` or `""` otherwise — as each method says.
 */
export class YamlStream {
  /** The text the stream was parsed from; every offset is into it. */
  source: string
  /** Per node: the first byte of its source, and one past its last. */
  private starts: i32[]
  private ends: i32[]
  /**
   * Per node, by kind: a collection's first child in `kids` and its child
   * count; a pair's key and value; an alias's target and `-1`; a scalar's body
   * (the bytes inside its quotes, or a block scalar's lines).
   * @internal Used by `yamlDecode` and `YamlParser`.
   */
  firsts: i32[]
  /** @internal Used by `yamlDecode` and `YamlParser`. */
  counts: i32[]
  /**
   * Per node: a block scalar's content indent, whether it was written, and its
   * chomping, as `(indent + 1) * 8 + explicit * 4 + chomp`.
   * @internal Used by `yamlDecode` and `YamlParser`.
   */
  extras: i32[]
  /**
   * Per node: its properties' slot, or `-1`.
   * @internal Used by `YamlParser`.
   */
  props: i32[]
  /**
   * Every collection's children, one collection after another.
   * @internal Used by `YamlParser`, and read by std/yaml-json.ts, which walks
   *   each collection's children in turn.
   */
  kids: i32[]
  /**
   * Per property slot: the anchor's name (after `&`), the tag as written, and the anchor table entry.
   * @internal Used by `YamlParser`.
   */
  propAnchorStarts: i32[]
  /** @internal Used by `YamlParser`. */
  propAnchorEnds: i32[]
  /** @internal Used by `YamlParser`. */
  propTagStarts: i32[]
  /** @internal Used by `YamlParser`. */
  propTagEnds: i32[]
  /** @internal Used by `YamlParser`. */
  propStarts: i32[]
  /** @internal Used by `YamlParser`. */
  propEnds: i32[]
  /** @internal Used by `YamlParser`. */
  propEntries: i32[]
  /**
   * Per property slot: the resolved tag, with `tag:yaml.org,2002:` stripped, or `""`.
   * @internal Used by `YamlParser`.
   */
  propTags: string[]
  /**
   * Per diagnostic: its code, range, document and message, and whether it is a warning.
   * @internal Used by `YamlParser`.
   */
  diagCodes: i32[]
  private diagStarts: i32[]
  private diagEnds: i32[]
  /** @internal Used by `YamlParser`. */
  diagDocuments: i32[]
  private diagMessages: string[]
  private diagWarnings: boolean[]
  /**
   * Per document: its root node and its range.
   * @internal Used by `YamlParser`.
   */
  docRoots: i32[]
  /** @internal Used by `YamlParser`. */
  docStarts: i32[]
  /** @internal Used by `YamlParser`. */
  docEnds: i32[]
  /**
   * Per comment kept: its range, from the `#`.
   * @internal Used by `YamlParser`.
   */
  commentStarts: i32[]
  /** @internal Used by `YamlParser`. */
  commentEnds: i32[]
  /**
   * Per node: the path step whose merge search last went through it, as
   * `mergeStep` numbers them; grown to the node count by the first search, so
   * a search marks a map searched in one store.
   * @internal Used by `YamlPathWalker`.
   */
  mergeStamps: i32[]
  /**
   * Per node: its `YAML_*` kind, style and core-schema type (`YAML_UNRESOLVED` until read).
   * @internal Used by `YamlJsonLoader` in yaml-json.ts.
   */
  kinds: u8[]
  private styles: u8[]
  /** @internal Used by `YamlParser`. */
  types: u8[]

  /** How many nodes the arrays have room for, and how many are in use. */
  private cap: i32 = 0
  /** @internal Used by `YamlPathWalker`. */
  top: i32 = 0
  /**
   * How many slots of `kids` are in use.
   * @internal Used by `YamlParser`.
   */
  kidTop: i32 = 0
  /** How many of the diagnostics are errors; the same as `errorCount()`. */
  errors: i32 = 0
  /** How many of the diagnostics are warnings; the same as `warningCount()`. */
  warnings: i32 = 0
  /**
   * How many path steps have searched merge keys; the stamp of the latest.
   * @internal Used by `YamlPathWalker`.
   */
  mergeStep: i32 = 0
  /**
   * How many sequence items the parser's merge checks have read, so a test
   * can see that a shared merge sequence is read once, not once per use.
   * @internal Used by `YamlParser`.
   */
  mergeItemsChecked: i32 = 0
  /**
   * Whether a plain `<<` key is a merge key, as `YamlOptions.merge` said; paths follow merge keys while it is.
   */
  merge: boolean = true
  /**
   * @internal Set by `YamlParser`, and read by std/yaml-json.ts. Whether the
   * parser reported every map that repeats a key, as `YamlOptions.uniqueKeys`
   * said; `false` for a stream built by hand, so a reader that relies on it
   * checks for itself.
   */
  uniqueKeys: boolean = false

  /**
   * An empty stream over `text`, for the parser to fill; get a parsed one from
   * `parseYaml`.
   *
   * @param text The YAML source every node and diagnostic range points into.
   */
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
    this.mergeStamps = []
  }

  // ---- Documents ---------------------------------------------------------------

  /**
   * How many documents the stream holds.
   *
   * @returns `0` for an empty text, and always `1` under `firstDocumentOnly`.
   */
  documentCount(): i32 {
    return toI32(this.docRoots.length)
  }

  /**
   * Document `d`'s root node.
   *
   * @param d The document's index, from 0.
   * @returns The root node, or `-1` for a document that is not there.
   */
  documentRoot(d: i32): i32 {
    return yamlAt(this.docRoots, d)
  }

  /**
   * Where document `d` starts.
   *
   * @param d The document's index, from 0.
   * @returns The byte offset of its first byte (its `---`, if it has one), or `-1` for a document that is not there.
   */
  documentStart(d: i32): i32 {
    return yamlAt(this.docStarts, d)
  }

  /**
   * Where document `d` ends.
   *
   * @param d The document's index, from 0.
   * @returns The byte offset one past its last byte (through its `...`, if it has one), or `-1` for
   *   a document that is not there.
   */
  documentEnd(d: i32): i32 {
    return yamlAt(this.docEnds, d)
  }

  // ---- Nodes -------------------------------------------------------------------

  /**
   * What node `n` is.
   *
   * @param n A node handle, such as a `documentRoot` or a `child`.
   * @returns `YAML_SCALAR`, `YAML_MAP`, `YAML_SEQ`, `YAML_ALIAS` or `YAML_PAIR`, or `0` for `-1`
   *   and any handle that is not a node.
   */
  kind(n: i32): i32 {
    const kinds: u8[] = this.kinds
    return n >= 0 && n < this.top && n < toI32(kinds.length) ? toI32(kinds[n]) : 0
  }

  /**
   * How node `n` is written.
   *
   * @param n A node handle.
   * @returns `YAML_PLAIN`, a quoted or block-scalar style, `YAML_FLOW` or `YAML_BLOCK`.
   */
  style(n: i32): i32 {
    const styles: u8[] = this.styles
    return n >= 0 && n < this.top && n < toI32(styles.length) ? toI32(styles[n]) : 0
  }

  /**
   * Where node `n`'s source starts, its anchor and tag not included.
   *
   * @param n A node handle.
   * @returns The byte offset of its first byte, or `-1` for a handle that is not a node.
   */
  start(n: i32): i32 {
    return n < this.top ? yamlAt(this.starts, n) : -1
  }

  /**
   * Where node `n`'s source ends.
   *
   * @param n A node handle.
   * @returns The byte offset one past its last byte, or `-1` for a handle that is not a node.
   */
  end(n: i32): i32 {
    return n < this.top ? yamlAt(this.ends, n) : -1
  }

  /**
   * How many children node `n` has.
   *
   * @param n A node handle.
   * @returns A map's pair count or a seq's item count; `0` for any other node.
   */
  count(n: i32): i32 {
    const k: i32 = this.kind(n)
    return k === YAML_MAP || k === YAML_SEQ ? yamlAt(this.counts, n) : 0
  }

  /**
   * One child of a map or a seq.
   *
   * @param n The map or seq.
   * @param i The child's position, from 0.
   * @returns The `i`th pair of a map or item of a seq, or `-1` past the last child.
   */
  child(n: i32, i: i32): i32 {
    if (i < 0 || i >= this.count(n)) {
      return -1
    }
    return yamlAt(this.kids, yamlAt(this.firsts, n) + i)
  }

  /**
   * A pair's key.
   *
   * @param pair A `YAML_PAIR` node, a child of a map.
   * @returns The key node, or `-1` for a node that is not a pair.
   */
  key(pair: i32): i32 {
    return this.kind(pair) === YAML_PAIR ? yamlAt(this.firsts, pair) : -1
  }

  /**
   * A pair's value.
   *
   * @param pair A `YAML_PAIR` node, a child of a map.
   * @returns The value node, or `-1` for an empty value (`a:`, which reads as null) and any node that is not a pair.
   */
  value(pair: i32): i32 {
    return this.kind(pair) === YAML_PAIR ? yamlAt(this.counts, pair) : -1
  }

  /**
   * The node an alias names.
   *
   * @param n An alias node.
   * @returns The anchored node, or `-1` for an alias with no anchor and any node that is not an alias.
   */
  target(n: i32): i32 {
    return this.kind(n) === YAML_ALIAS ? yamlAt(this.firsts, n) : -1
  }

  /**
   * Node `n` with an alias followed.
   *
   * @param n A node handle.
   * @returns The node an alias names, or `n` itself when it is not an alias.
   */
  resolved(n: i32): i32 {
    return this.kind(n) === YAML_ALIAS ? yamlAt(this.firsts, n) : n
  }

  /**
   * Node `n`'s anchor name.
   *
   * @param n A node handle.
   * @returns The name without its `&`, or `""` for a node with no anchor.
   */
  anchor(n: i32): string {
    const slot: i32 = n < this.top ? yamlAt(this.props, n) : -1
    if (slot < 0) {
      return ""
    }
    const from: i32 = yamlAt(this.propAnchorStarts, slot)
    return from < 0 ? "" : this.source.substring(from, yamlAt(this.propAnchorEnds, slot))
  }

  /**
   * Node `n`'s tag, resolved.
   *
   * @param n A node handle.
   * @returns `"int"` for `!!int` (the `tag:yaml.org,2002:` prefix stripped), `"!local"` for
   *   `!local`, `"!"` for the non-specific `!`, a `%TAG` handle's prefix joined to its suffix, or
   *   `""` for an untagged node.
   */
  tag(n: i32): string {
    const slot: i32 = n < this.top ? yamlAt(this.props, n) : -1
    const tags: string[] = this.propTags
    return slot >= 0 && slot < toI32(tags.length) ? tags[slot] : ""
  }

  /**
   * A scalar's text, decoded: quotes and escapes undone, lines folded, a block
   * scalar's indentation and chomping applied. A `\u` surrogate pair is one
   * character; a lone surrogate escape is kept as its three bytes, which are
   * not UTF-8. Decoded on every call; keep the result.
   *
   * @param n A scalar, or an alias to one.
   * @returns The decoded text; an alias answers its target's, and any other node `""`.
   */
  text(n: i32): string {
    const at: i32 = this.resolved(n)
    if (this.kind(at) !== YAML_SCALAR) {
      return ""
    }
    return yamlDecode(this, at)
  }

  /**
   * A scalar's core-schema type. Untagged, a plain scalar is typed from its
   * text and a quoted or block scalar is a string. Under a `!!null`, `!!bool` or
   * `!!int` tag it is that type when its text (decoded, for a quoted or block
   * scalar) reads as one, and a string otherwise; under `!!float` an int or
   * float text is a float. Any other tag, `!!str` included, makes it a string.
   *
   * @param n A scalar, or an alias to one.
   * @returns `YAML_NULL`, `YAML_BOOL`, `YAML_INT`, `YAML_FLOAT` or `YAML_STRING`; `-1` for a collection.
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

  /**
   * A boolean scalar's value.
   *
   * @param n A scalar, or an alias to one.
   * @returns Whether it is the boolean `true`; `false` for anything that is not a `YAML_BOOL`.
   */
  boolValue(n: i32): boolean {
    if (this.type(n) !== YAML_BOOL) {
      return false
    }
    const at: i32 = this.resolved(n)
    const code: i32 =
      this.style(at) === YAML_PLAIN
        ? yamlByte(this.source, this.start(at))
        : yamlByte(yamlDecode(this, at), 0)
    return code === 116 || code === 84
  }

  /**
   * An integer scalar's value.
   *
   * @param n A scalar, or an alias to one.
   * @returns The value of a `YAML_INT`, wrapped past 64 bits; `0` for anything else.
   */
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

  /**
   * A number scalar's value.
   *
   * @param n A scalar, or an alias to one.
   * @returns The value of a `YAML_FLOAT` or `YAML_INT` as an `f64`; `0` for anything else.
   */
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

  /**
   * How many diagnostics the parse found, errors and warnings, in order of
   * where they start.
   *
   * @returns The count; diagnostics are numbered from 0 below it.
   */
  diagnosticCount(): i32 {
    return toI32(this.diagCodes.length)
  }

  /**
   * How many of the diagnostics are errors.
   *
   * @returns The count: `0` for a valid stream.
   */
  errorCount(): i32 {
    return this.errors
  }

  /**
   * How many of the diagnostics are warnings.
   *
   * @returns The count; a warning does not make the stream invalid.
   */
  warningCount(): i32 {
    return this.warnings
  }

  /**
   * What diagnostic `i` is about.
   *
   * @param i The diagnostic's index, from 0.
   * @returns Its `YAML_ERR_*` code, or `0` for an index past the last.
   */
  diagnosticCode(i: i32): i32 {
    const code: i32 = i < 0 ? 0 : yamlAt(this.diagCodes, i)
    return code < 0 ? 0 : code
  }

  /**
   * Whether diagnostic `i` is a warning rather than an error.
   *
   * @param i The diagnostic's index, from 0.
   * @returns `true` for a warning; `false` for an error and for an index past the last.
   */
  diagnosticIsWarning(i: i32): boolean {
    const warnings: boolean[] = this.diagWarnings
    return i >= 0 && i < toI32(warnings.length) ? warnings[i] : false
  }

  /**
   * Where diagnostic `i`'s range starts.
   *
   * @param i The diagnostic's index, from 0.
   * @returns The byte offset of the first byte it is about, or `-1` for an index past the last.
   */
  diagnosticStart(i: i32): i32 {
    return yamlAt(this.diagStarts, i)
  }

  /**
   * Where diagnostic `i`'s range ends.
   *
   * @param i The diagnostic's index, from 0.
   * @returns The byte offset one past the last byte it is about, the same as its start for a point,
   *   or `-1` for an index past the last.
   */
  diagnosticEnd(i: i32): i32 {
    return yamlAt(this.diagEnds, i)
  }

  /**
   * Diagnostic `i`'s message, for a person.
   *
   * @param i The diagnostic's index, from 0.
   * @returns A sentence such as `Map key "a" is duplicated` (a capital first, as other YAML tooling
   *   spells them), or `""` for an index past the last.
   */
  diagnosticMessage(i: i32): string {
    const messages: string[] = this.diagMessages
    return i >= 0 && i < toI32(messages.length) ? messages[i] : ""
  }

  /**
   * The document diagnostic `i` was found in.
   *
   * @param i The diagnostic's index, from 0.
   * @returns The document's index, or `-1` for an index past the last.
   */
  diagnosticDocument(i: i32): i32 {
    return yamlAt(this.diagDocuments, i)
  }

  // ---- Comments ----------------------------------------------------------------

  /**
   * How many comments the stream kept.
   *
   * @returns The count: `0` unless `keepComments` was set.
   */
  commentCount(): i32 {
    return toI32(this.commentStarts.length)
  }

  /**
   * Where comment `i` starts.
   *
   * @param i The comment's index, from 0, in source order.
   * @returns The byte offset of its `#`, or `-1` for an index past the last.
   */
  commentStart(i: i32): i32 {
    return yamlAt(this.commentStarts, i)
  }

  /**
   * Where comment `i` ends.
   *
   * @param i The comment's index, from 0, in source order.
   * @returns The byte offset one past its last byte, before its line break, or `-1` for an index past the last.
   */
  commentEnd(i: i32): i32 {
    return yamlAt(this.commentEnds, i)
  }

  /**
   * Comment `i`'s text.
   *
   * @param i The comment's index, from 0, in source order.
   * @returns The text after its `#`, or `""` for an index past the last.
   */
  comment(i: i32): string {
    const from: i32 = this.commentStart(i)
    return from < 0 ? "" : this.source.substring(from + 1, this.commentEnd(i))
  }

  // ---- Building ----------------------------------------------------------------

  /**
   * A new node of `kind` and `style` over `[start, end)`, its other fields empty.
   * @internal Called by `YamlParser`.
   */
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

  /** Doubles every node array together. */
  private grow(): void {
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

  /**
   * Appends `n` to `kids`, growing it by doubling; answers its slot.
   * @internal Called by `YamlParser`.
   */
  pushKid(n: i32): i32 {
    const slot: i32 = this.kidTop
    this.kids = yamlRoomI32(this.kids, slot + 1)
    yamlPut(this.kids, slot, n)
    this.kidTop = slot + 1
    return slot
  }

  /**
   * Records a diagnostic.
   * @internal Called by `YamlParser`.
   */
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

  /**
   * A new, empty property slot.
   * @internal Called by `YamlParser`.
   */
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

  /**
   * Sorts the diagnostics by start, keeping the order of those that start together.
   * @internal Called by `parseYamlWith`.
   */
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

  /** Copies diagnostic `from` over diagnostic `to`. */
  private moveDiagnostic(from: i32, to: i32): void {
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

/**
 * The first break in `text[from, to)`, or `to`. Short of the end of the text
 * the search reads only `[from, to)`, so a caller testing a short range on a
 * long line pays for the range, not the line.
 */
const yamlLineEnd = (text: string, from: i32, to: i32): i32 => {
  if (to < toI32(text.length)) {
    let i: i32 = from
    while (i < to && !yamlIsBreak(yamlByte(text, i))) {
      i += 1
    }
    return i
  }
  const at: i32 = indexOfAny(text, YAML_BREAKS, from)
  return at < 0 || at > to ? to : at
}

// ---- Decoding ------------------------------------------------------------------

/** The bytes a scalar decodes to, collected before they become one string. */
class YamlBuffer {
  private bytes: u8[]
  /** @internal Used by `yamlDecodeFlow`. */
  count: i32 = 0

  constructor(room: i32) {
    const least: i32 = 16
    this.bytes = new Array<u8>(room > least ? room : least)
  }

  /**
   * Appends one byte.
   * @internal Called by `yamlDecodeFlow`, `yamlDecodeEscape` and `yamlDecodeBlock`.
   */
  push(code: i32): void {
    if (this.count >= toI32(this.bytes.length)) {
      this.bytes = yamlRoomU8(this.bytes, this.count + 1)
    }
    yamlPutU8(this.bytes, this.count, code)
    this.count += 1
  }

  /**
   * Appends `count` copies of `code`.
   * @internal Called by `yamlDecodeFlow` and `yamlDecodeBlock`.
   */
  repeat(code: i32, count: i32): void {
    let i: i32 = 0
    while (i < count) {
      this.push(code)
      i += 1
    }
  }

  /**
   * Appends `text[from, to)`.
   * @internal Called by `yamlDecodeFlow` and `yamlDecodeBlock`.
   */
  copy(text: string, from: i32, to: i32): void {
    let i: i32 = from
    while (i < to) {
      this.push(yamlByte(text, i))
      i += 1
    }
  }

  /**
   * Appends code point `cp` as UTF-8.
   * @internal Called by `yamlDecodeEscape`.
   */
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

  /**
   * Drops trailing spaces and tabs, but none at or below `floor`.
   * @internal Called by `yamlDecodeFlow`.
   */
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

  /**
   * The bytes as a string.
   * @internal Called by `yamlDecodeFlow` and `yamlDecodeBlock`.
   */
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

/** The low surrogate a `\u` escape at `text[at]` writes, or `-1` when it writes none before `to`. */
const yamlLowSurrogateAt = (text: string, at: i32, to: i32): i32 => {
  if (at + 6 > to || yamlByte(text, at) !== YAML_BACKSLASH || yamlByte(text, at + 1) !== 117) {
    return -1
  }
  let cp: i32 = 0
  let k: i32 = 0
  while (k < 4) {
    const v: i32 = yamlHexValue(yamlByte(text, at + 2 + k))
    if (v < 0) {
      return -1
    }
    cp = cp * 16 + v
    k += 1
  }
  return cp >= 0xdc00 && cp < 0xe000 ? cp : -1
}

/** Appends what the escape at `text[at]`, a `\`, stands for; answers the byte past it. */
const yamlDecodeEscape = (text: string, at: i32, to: i32, out: YamlBuffer): i32 => {
  if (at + 1 >= to) {
    out.push(YAML_BACKSLASH)
    return at + 1
  }
  const e: i32 = yamlByte(text, at + 1)
  let digits: i32 = 0
  if (e === 120) {
    digits = 2
  } else if (e === 117) {
    digits = 4
  } else if (e === 85) {
    digits = 8
  }
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
      // A `\u` high surrogate and a `\u` low one after it are one code point, written as one.
      const low: i32 = digits === 4 && cp >= 0xd800 && cp < 0xdc00 ? yamlLowSurrogateAt(text, at + 6, to) : -1
      if (low >= 0) {
        out.codePoint((cp - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000)
        return at + 12
      }
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
      // Short of the indent, or before the indent was found: empty when only
      // spaces, as the scanner counts it; a tab makes the first content line.
      let k: i32 = j
      while (k < e && yamlByte(text, k) === YAML_SPACE) {
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
  if (seenContent && pending === 0) {
    // The last line ran to the end of the text: its break is implied.
    pending = 1
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
  const plain: boolean = stream.style(n) === YAML_PLAIN
  // A node with no properties has no tag, which spares reading its text.
  if (n < 0 || n >= stream.top || yamlAt(stream.props, n) < 0) {
    return plain ? yamlPlainType(stream.source, stream.start(n), stream.end(n)) : YAML_STRING
  }
  const tag: string = stream.tag(n)
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
  // Each word is told by its first byte, so a text is compared with its own three at most.
  if (c === 126 && to - from === 1) {
    return YAML_NULL
  }
  if (letter) {
    return yamlWordType(text, from, to, c)
  }
  if (yamlIntBase(text, from, to) > 0) {
    return YAML_INT
  }
  if (yamlSpecialFloat(text, from, to) > 0 || yamlIsFloatForm(text, from, to)) {
    return YAML_FLOAT
  }
  return YAML_STRING
}

/**
 * The type of the plain scalar `text[from, to)`, whose first byte `c` is one
 * of `nNtTfF`: `YAML_NULL` for a `null`, `YAML_BOOL` for a `true` or `false`,
 * in the core schema's three spellings each, and `YAML_STRING` otherwise.
 */
const yamlWordType = (text: string, from: i32, to: i32, c: i32): i32 => {
  if (c === 110 || c === 78) {
    const isNull: boolean =
      yamlIsWord(text, from, to, "null") ||
      yamlIsWord(text, from, to, "Null") ||
      yamlIsWord(text, from, to, "NULL")
    return isNull ? YAML_NULL : YAML_STRING
  }
  if (c === 116 || c === 84) {
    const isTrue: boolean =
      yamlIsWord(text, from, to, "true") ||
      yamlIsWord(text, from, to, "True") ||
      yamlIsWord(text, from, to, "TRUE")
    return isTrue ? YAML_BOOL : YAML_STRING
  }
  const isFalse: boolean =
    yamlIsWord(text, from, to, "false") ||
    yamlIsWord(text, from, to, "False") ||
    yamlIsWord(text, from, to, "FALSE")
  return isFalse ? YAML_BOOL : YAML_STRING
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
  if (
    yamlIsWord(text, at, to, ".inf") ||
    yamlIsWord(text, at, to, ".Inf") ||
    yamlIsWord(text, at, to, ".INF")
  ) {
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

// ---- The parser ------------------------------------------------------------------

/** `a[top] = v`, or a push when `a` is no longer than `top`; answers `top + 1`. */
const yamlStackPush = (a: i32[], top: i32, v: i32): i32 => {
  if (top < toI32(a.length)) {
    yamlPut(a, top, v)
  } else {
    a.push(v)
  }
  return top + 1
}

/** A tag with the core schema's `tag:yaml.org,2002:` prefix taken off. */
const yamlShortenTag = (tag: string): string => {
  const prefix: i32 = toI32(YAML_CORE_PREFIX.length)
  if (toI32(tag.length) >= prefix && tag.substring(0, prefix) === YAML_CORE_PREFIX) {
    return tag.substring(prefix, toI32(tag.length))
  }
  return tag
}

/** A byte a `%TAG` handle may hold between its `!`s: a letter, a digit or `-`. */
const yamlIsHandleChar = (code: i32): boolean =>
  yamlIsDigit(code) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === YAML_DASH

/** The bytes of a UTF-8 character that starts with `lead`. */
const yamlCharWidth = (lead: i32): i32 => {
  if (lead >= 240) {
    return 4
  }
  if (lead >= 224) {
    return 3
  }
  return lead >= 192 ? 2 : 1
}

/** Whether `\` followed by `code` is an escape YAML defines: `1`, or `2` for the hex ones. */
const yamlEscapeKind = (code: i32): i32 => {
  if (code === 120 || code === 117 || code === 85) {
    return 2
  }
  if (
    code === YAML_ZERO ||
    code === 97 ||
    code === 98 ||
    code === 116 ||
    code === 110 ||
    code === 118 ||
    code === 102 ||
    code === 114 ||
    code === 101 ||
    code === YAML_SPACE ||
    code === YAML_DQUOTE ||
    code === 47 ||
    code === YAML_BACKSLASH ||
    code === 78 ||
    code === 95 ||
    code === 76 ||
    code === 80 ||
    code === YAML_TAB ||
    yamlIsBreak(code)
  ) {
    return 1
  }
  return 0
}

/** One parse in progress: the cursor, the anchors in scope and the document's directives. */
class YamlParser {
  /** @internal Used by `parseYamlWith`. */
  stream: YamlStream
  private text: string
  /** The anchors defined so far in this document: each name's range and its node, searched from the end. */
  private anchorStarts: i32[]
  private anchorEnds: i32[]
  private anchorNodes: i32[]
  /** The anchors whose node is still being read, so an alias to one is recursive. */
  private pendingStarts: i32[]
  private pendingEnds: i32[]
  /** The `%TAG` handles this document declared, and their prefixes. */
  private handleNames: string[]
  private handlePrefixes: string[]
  /** The children of every collection still open, innermost last. */
  private scratch: i32[]
  /** Hash sets for the duplicate check of maps past YAML_PAIRWISE_KEYS pairs, reused as maps nest and end. */
  private keySets: YamlKeySet[]
  /**
   * Per sequence node an alias merge has named: `0` not yet checked, `1`
   * every item merges a map, `2` one does not, so a shared sequence is read once.
   */
  private mergeVerdicts: u8[]
  private pos: i32 = 0
  private len: i32 = 0
  private depth: i32 = 0
  /** Whether `DEPTH_LIMIT` cut the text short, so the collections it left open are not reported. */
  private depthHit: boolean = false
  private maxDepth: i32 = 1000
  private doc: i32 = 0
  /** The indent a flow collection's continuation lines must pass. */
  private flowIndent: i32 = -1
  private tabReportedAt: i32 = -1
  private commentWatermark: i32 = 0
  private anchorTop: i32 = 0
  private pendingTop: i32 = 0
  private scratchTop: i32 = 0
  private keySetTop: i32 = 0
  /** The last error's range, so one mistake is not reported twice. */
  private lastErrStart: i32 = -1
  private lastErrEnd: i32 = -1
  /** What `peekLine` found: the next content line's indent and first byte. */
  private lineIndent: i32 = 0
  private lineContent: i32 = 0
  /** Where the current document's `---` is, or `-1` when it has none. */
  private markerAt: i32 = -1
  private flowIndentReported: boolean = false
  private uniqueKeys: boolean = true
  private keepComments: boolean = false
  /**
   * Whether only the first document is parsed, as `firstDocumentOnly` said.
   * @internal Nothing reads it.
   */
  firstOnly: boolean = false
  private yamlDirective: boolean = false
  private lineEof: boolean = false

  constructor(text: string, options: YamlOptions) {
    this.stream = new YamlStream(text)
    this.text = text
    this.anchorStarts = []
    this.anchorEnds = []
    this.anchorNodes = []
    this.pendingStarts = []
    this.pendingEnds = []
    this.handleNames = []
    this.handlePrefixes = []
    this.scratch = []
    this.keySets = []
    this.mergeVerdicts = []
    this.len = toI32(text.length)
    this.maxDepth = options.maxDepth
    this.uniqueKeys = options.uniqueKeys
    this.stream.merge = options.merge
    this.stream.uniqueKeys = options.uniqueKeys
    this.keepComments = options.keepComments
    this.firstOnly = options.firstDocumentOnly
  }

  // ---- Reporting and bytes -------------------------------------------------------

  /** Records an error over `[start, end)`. */
  private error(code: i32, message: string, start: i32, end: i32): void {
    this.stream.report(code, false, message, start, end, this.doc)
    this.lastErrStart = start
    this.lastErrEnd = end < start ? start : end
  }

  /** Records a warning over `[start, end)`. */
  private warn(code: i32, message: string, start: i32, end: i32): void {
    this.stream.report(code, true, message, start, end, this.doc)
  }

  /** The byte at `i`, or `-1` outside the text. */
  private at(i: i32): i32 {
    return yamlByte(this.text, i)
  }

  /** Whether `i` holds a `-` that starts a block sequence entry. */
  private isSeqEntryDash(i: i32): boolean {
    return this.at(i) === YAML_DASH && yamlIsWs(this.at(i + 1))
  }

  /** Whether `[from, to)` holds a line break. */
  private crossesLine(from: i32, to: i32): boolean {
    return from < to && yamlLineEnd(this.text, from, to) < to
  }

  /** The start of the line after the one `from` is on, or the end of the text. */
  private nextLineStart(from: i32): i32 {
    const e: i32 = yamlLineEnd(this.text, from, this.len)
    return e >= this.len ? this.len : yamlAfterBreak(this.text, e)
  }

  /** Whether `i` starts a `---` or `...` marker. */
  private isDocMarker(i: i32): boolean {
    const c: i32 = this.at(i)
    return (
      (c === YAML_DASH || c === YAML_DOT) &&
      this.at(i + 1) === c &&
      this.at(i + 2) === c &&
      yamlIsWs(this.at(i + 3))
    )
  }

  /** The end of `[from, …)` before any trailing blanks and a comment, on its line. */
  private plainLineEnd(from: i32): i32 {
    let i: i32 = from
    let lastNonSpace: i32 = from
    while (i < this.len) {
      const c: i32 = this.at(i)
      if (yamlIsBreak(c)) {
        break
      }
      if (c === YAML_HASH && i > from && yamlIsBlank(this.at(i - 1))) {
        break
      }
      i += 1
      if (!yamlIsBlank(c)) {
        lastNonSpace = i
      }
    }
    return lastNonSpace
  }

  /** The end of a token: the next blank, break or end of text. */
  private tokenEnd(from: i32): i32 {
    let i: i32 = from
    while (i < this.len && !yamlIsWs(this.at(i))) {
      i += 1
    }
    return i
  }

  /**
   * The end of an anchor or tag token; in flow, a flow indicator ends
   * it too, except in a verbatim tag, `!<…>`, which runs to its `>`.
   */
  private propTokenEnd(from: i32, flow: boolean): i32 {
    let i: i32 = from
    if (this.at(from - 1) === YAML_BANG && this.at(from) === YAML_LT) {
      while (i < this.len && !yamlIsWs(this.at(i))) {
        i += 1
        if (this.at(i - 1) === YAML_GT) {
          return i
        }
      }
      return i
    }
    while (i < this.len) {
      const c: i32 = this.at(i)
      if (yamlIsWs(c) || (flow && yamlIsFlowIndicator(c))) {
        break
      }
      i += 1
    }
    return i
  }

  // ---- Lines and comments ----------------------------------------------------------

  /**
   * Moves to the start of the next line with content, past blank and
   * comment lines, and sets `lineEof`, `lineIndent` and `lineContent`.
   */
  private peekLine(minIndent: i32): void {
    let p: i32 = this.pos
    while (p < this.len) {
      let i: i32 = p
      while (this.at(i) === YAML_SPACE) {
        i += 1
      }
      const c: i32 = this.at(i)
      if (c < 0) {
        break
      }
      if (yamlIsBreak(c) || c === YAML_HASH) {
        if (c === YAML_HASH) {
          this.recordComment(i)
        }
        p = this.nextLineStart(i)
        continue
      }
      if (c === YAML_TAB) {
        let j: i32 = i
        while (yamlIsBlank(this.at(j))) {
          j += 1
        }
        const d: i32 = this.at(j)
        if (d < 0 || yamlIsBreak(d) || d === YAML_HASH) {
          if (d === YAML_HASH) {
            this.recordComment(j)
          }
          p = this.nextLineStart(j)
          continue
        }
        if (i - p < minIndent && this.tabReportedAt !== p) {
          this.error(YAML_ERR_TAB_INDENT, "Tabs cannot be used for indentation", i, j)
          this.tabReportedAt = p
        }
        this.setLine(p, j - p, j)
        return
      }
      this.setLine(p, i - p, i)
      return
    }
    this.pos = this.len
    this.lineEof = true
    this.lineIndent = 0
    this.lineContent = this.len
  }

  /** The line `peekLine` found. */
  private setLine(start: i32, indent: i32, content: i32): void {
    this.pos = start
    this.lineEof = false
    this.lineIndent = indent
    this.lineContent = content
  }

  /** Steps past spaces and tabs. */
  private skipInlineSpaces(): void {
    while (yamlIsBlank(this.at(this.pos))) {
      this.pos += 1
    }
  }

  /** Steps past the spaces after an indicator, reporting a tab that indents a compact node. */
  private skipIndicatorSeparation(): void {
    while (this.at(this.pos) === YAML_SPACE) {
      this.pos += 1
    }
    if (this.at(this.pos) !== YAML_TAB) {
      return
    }
    const tab: i32 = this.pos
    this.skipInlineSpaces()
    const c: i32 = this.at(this.pos)
    if (c === YAML_HASH) {
      return
    }
    if (
      this.isSeqEntryDash(this.pos) ||
      (c === YAML_QUESTION && yamlIsWs(this.at(this.pos + 1))) ||
      this.findKeyColon(this.pos) >= 0
    ) {
      this.error(YAML_ERR_TAB_INDENT, "Tabs cannot be used for indentation", tab, this.pos)
    }
  }

  /** Keeps the comment that starts at `hash`, when comments are kept. */
  private recordComment(hash: i32): void {
    if (!this.keepComments || hash < this.commentWatermark) {
      return
    }
    const end: i32 = yamlLineEnd(this.text, hash, this.len)
    this.commentWatermark = end
    this.stream.commentStarts.push(hash)
    this.stream.commentEnds.push(end)
  }

  /** Keeps a comment after the content on this line, if there is one. */
  private recordTrailingComment(): void {
    if (!this.keepComments) {
      return
    }
    let i: i32 = this.pos
    while (yamlIsBlank(this.at(i))) {
      i += 1
    }
    if (this.at(i) !== YAML_HASH) {
      return
    }
    if (i === this.pos && !yamlIsWs(this.at(i - 1))) {
      return
    }
    this.recordComment(i)
  }

  /** Keeps the first comment on the line from `from`, if there is one. */
  private recordLineComment(from: i32): void {
    if (!this.keepComments) {
      return
    }
    let i: i32 = from
    while (i < this.len) {
      const c: i32 = this.at(i)
      if (yamlIsBreak(c)) {
        return
      }
      if (c === YAML_HASH && yamlIsWs(this.at(i - 1))) {
        this.recordComment(i)
        return
      }
      i += 1
    }
  }

  /** Whether the cursor is at the end of the text, a break or a comment. */
  private atLineEnd(): boolean {
    const c: i32 = this.at(this.pos)
    return c < 0 || yamlIsBreak(c) || c === YAML_HASH
  }

  /** Moves past the rest of this line, keeping its comment. */
  private finishLine(): void {
    this.recordTrailingComment()
    this.pos = this.nextLineStart(this.pos)
  }

  /** `finishLine`, unless the cursor is already at the start of a line. */
  private finishLineIfMidLine(): void {
    if (this.pos > 0 && this.pos < this.len && !yamlIsBreak(this.at(this.pos - 1))) {
      this.finishLine()
    }
  }

  /** Reports what follows a node on its line, if it is neither a comment nor nothing. */
  private checkTrailingContent(): void {
    const c: i32 = this.at(this.pos)
    if (c < 0 || yamlIsBreak(c)) {
      return
    }
    if (yamlIsBlank(c)) {
      this.skipInlineSpaces()
      if (this.atLineEnd()) {
        return
      }
    }
    const start: i32 = this.pos
    if (this.at(start) === YAML_HASH) {
      if (start > 0 && yamlIsBlank(this.at(start - 1))) {
        return
      }
      this.error(
        YAML_ERR_BAD_COMMENT,
        "A comment must be preceded by whitespace",
        start,
        this.plainLineEnd(start)
      )
      return
    }
    this.error(
      YAML_ERR_UNEXPECTED_CONTENT,
      "Unexpected content after the end of a node",
      start,
      this.plainLineEnd(start)
    )
  }

  // ---- Tags and properties ---------------------------------------------------------

  /** The tag written at `[start, end)`, resolved against this document's handles. */
  private resolveTag(start: i32, end: i32): string {
    const written: string = this.text.substring(start, end)
    if (end - start === 1) {
      return "!"
    }
    if (this.at(start + 1) === YAML_LT) {
      if (this.at(end - 1) !== YAML_GT) {
        this.error(YAML_ERR_BAD_TAG, 'Verbatim tag is missing its closing ">"', start, end)
        return written
      }
      if (end - start === 3) {
        this.error(YAML_ERR_BAD_TAG, "Verbatim tag is empty", start, end)
        return written
      }
      return yamlShortenTag(this.text.substring(start + 2, end - 1))
    }
    let handleEnd: i32 = start + 1
    if (this.at(start + 1) === YAML_BANG) {
      handleEnd = start + 2
    } else {
      let i: i32 = start + 1
      while (i < end && yamlIsHandleChar(this.at(i))) {
        i += 1
      }
      if (i > start + 1 && this.at(i) === YAML_BANG) {
        handleEnd = i + 1
      }
    }
    let k: i32 = handleEnd
    while (k < end) {
      if (yamlIsFlowIndicator(this.at(k))) {
        this.error(YAML_ERR_BAD_TAG, `Tag "${written}" contains a character a tag may not hold`, start, end)
        break
      }
      k += 1
    }
    const handle: string = this.text.substring(start, handleEnd)
    const suffix: string = this.text.substring(handleEnd, end)
    let i: i32 = toI32(this.handleNames.length) - 1
    while (i >= 0) {
      if (this.handleNames[i] === handle) {
        return yamlShortenTag(this.handlePrefixes[i] + suffix)
      }
      i -= 1
    }
    if (handle === "!!") {
      return suffix
    }
    if (handle === "!") {
      return written
    }
    this.error(
      YAML_ERR_UNKNOWN_TAG_HANDLE,
      `Tag handle "${handle}" was never declared by a %TAG directive`,
      start,
      end
    )
    return written
  }

  /** Reports an anchor or alias name that is empty or runs into a flow indicator. */
  private reportBadAnchorName(what: string, start: i32, end: i32): void {
    if (end === start + 1) {
      this.error(YAML_ERR_BAD_ANCHOR, `${what} name cannot be empty`, start, end)
      return
    }
    const name: string = this.text.substring(start + 1, end)
    const next: string = this.text.substring(end, end + 1)
    this.error(
      YAML_ERR_BAD_ANCHOR,
      `${what} name "${name}" cannot run on into "${next}": a flow indicator is not part of a name, so it needs a space before it`,
      start,
      end + 1
    )
  }

  /** Warns about an anchor or alias name `[start + 1, end)` that ends in `:`. */
  private checkAmbiguousName(what: string, start: i32, end: i32): void {
    if (end <= start + 1 || this.at(end - 1) !== YAML_COLON) {
      return
    }
    const name: string = this.text.substring(start + 1, end)
    this.warn(
      YAML_ERR_AMBIGUOUS_ANCHOR_NAME,
      `${what} name "${name}" ends in ":", which YAML reads as part of the name rather than as a mapping separator`,
      start,
      end
    )
  }

  /** Reads the anchor and tag before a node; answers their slot, or `-1` for none. */
  private scanProps(flow: boolean): i32 {
    const first: i32 = this.at(this.pos)
    if (first !== YAML_AMP && first !== YAML_BANG && !yamlIsBlank(first)) {
      return -1
    }
    let slot: i32 = -1
    while (true) {
      this.skipInlineSpaces()
      const c: i32 = this.at(this.pos)
      if (c !== YAML_AMP && c !== YAML_BANG) {
        break
      }
      const start: i32 = this.pos
      const end: i32 = this.propTokenEnd(start + 1, c === YAML_AMP || flow)
      if (slot < 0) {
        slot = this.stream.newProps()
        yamlPut(this.stream.propStarts, slot, start)
      }
      if (c === YAML_AMP) {
        if (end === start + 1 || (!flow && yamlIsFlowIndicator(this.at(end)))) {
          this.reportBadAnchorName("Anchor", start, end)
          if (end === start + 1) {
            this.pos = end
            continue
          }
        }
        if (yamlAt(this.stream.propAnchorStarts, slot) >= 0) {
          this.error(YAML_ERR_BAD_PROPERTY, "A node cannot carry more than one anchor", start, end)
        }
        yamlPut(this.stream.propAnchorStarts, slot, start + 1)
        yamlPut(this.stream.propAnchorEnds, slot, end)
        this.checkAmbiguousName("Anchor", start, end)
      } else {
        if (yamlAt(this.stream.propTagStarts, slot) >= 0) {
          this.error(YAML_ERR_BAD_PROPERTY, "A node cannot carry more than one tag", start, end)
        }
        const tag: string = this.resolveTag(start, end)
        const tags: string[] = this.stream.propTags
        if (slot >= 0 && slot < toI32(tags.length)) {
          tags[slot] = tag
        }
        yamlPut(this.stream.propTagStarts, slot, start)
        yamlPut(this.stream.propTagEnds, slot, end)
      }
      yamlPut(this.stream.propEnds, slot, end)
      this.pos = end
    }
    if (slot >= 0 && yamlAt(this.stream.propAnchorStarts, slot) >= 0) {
      yamlStackPush(this.pendingEnds, this.pendingTop, yamlAt(this.stream.propAnchorEnds, slot))
      this.pendingTop = yamlStackPush(
        this.pendingStarts,
        this.pendingTop,
        yamlAt(this.stream.propAnchorStarts, slot)
      )
    }
    return slot
  }

  /** The first byte after the anchors and tags at `from`, and the blanks after them. */
  private skipPropsAhead(from: i32): i32 {
    let i: i32 = from
    while (true) {
      const c: i32 = this.at(i)
      if (c !== YAML_AMP && c !== YAML_BANG) {
        return i
      }
      i = this.propTokenEnd(i + 1, c === YAML_AMP)
      while (yamlIsBlank(this.at(i))) {
        i += 1
      }
    }
  }

  /** The entry of the anchor named `[from, to)` among those defined so far, or `-1`. */
  private findAnchor(from: i32, to: i32): i32 {
    let i: i32 = this.anchorTop - 1
    while (i >= 0) {
      if (yamlSameBytes(this.text, yamlAt(this.anchorStarts, i), yamlAt(this.anchorEnds, i), from, to)) {
        return i
      }
      i -= 1
    }
    return -1
  }

  /** Defines the anchor `[from, to)` as naming `node`, and ends it being pending. */
  private defineAnchor(from: i32, to: i32, node: i32, slot: i32): void {
    yamlStackPush(this.anchorStarts, this.anchorTop, from)
    yamlStackPush(this.anchorEnds, this.anchorTop, to)
    yamlPut(this.stream.propEntries, slot, this.anchorTop)
    this.anchorTop = yamlStackPush(this.anchorNodes, this.anchorTop, node)
    let i: i32 = this.pendingTop - 1
    while (i >= 0) {
      if (yamlSameBytes(this.text, yamlAt(this.pendingStarts, i), yamlAt(this.pendingEnds, i), from, to)) {
        // Close the gap: what was pending after it moves down one.
        let j: i32 = i + 1
        while (j < this.pendingTop) {
          yamlPut(this.pendingStarts, j - 1, yamlAt(this.pendingStarts, j))
          yamlPut(this.pendingEnds, j - 1, yamlAt(this.pendingEnds, j))
          j += 1
        }
        this.pendingTop -= 1
        return
      }
      i -= 1
    }
  }

  /** Gives `node` the properties in `slot`, and answers `node`. */
  private attachProps(node: i32, slot: i32): i32 {
    if (slot < 0 || node < 0) {
      return node
    }
    const stream: YamlStream = this.stream
    const anchorFrom: i32 = yamlAt(stream.propAnchorStarts, slot)
    const anchorTo: i32 = yamlAt(stream.propAnchorEnds, slot)
    if (stream.kind(node) === YAML_ALIAS) {
      this.error(
        YAML_ERR_BAD_PROPERTY,
        "An alias cannot carry an anchor or a tag",
        stream.start(node),
        stream.end(node)
      )
      if (anchorFrom >= 0) {
        yamlPut(stream.props, node, slot)
        this.defineAnchor(anchorFrom, anchorTo, node, slot)
      }
      return node
    }
    const own: i32 = yamlAt(stream.props, node)
    let into: i32 = slot
    if (own >= 0) {
      // The node read its own properties on a later line: these join them.
      into = own
      if (anchorFrom >= 0) {
        if (yamlAt(stream.propAnchorStarts, own) >= 0) {
          this.error(
            YAML_ERR_BAD_PROPERTY,
            "A node cannot carry more than one anchor",
            stream.start(node),
            stream.end(node)
          )
        }
        yamlPut(stream.propAnchorStarts, own, anchorFrom)
        yamlPut(stream.propAnchorEnds, own, anchorTo)
      }
      if (yamlAt(stream.propTagStarts, slot) >= 0) {
        yamlPut(stream.propTagStarts, own, yamlAt(stream.propTagStarts, slot))
        yamlPut(stream.propTagEnds, own, yamlAt(stream.propTagEnds, slot))
        const tags: string[] = stream.propTags
        if (own < toI32(tags.length) && slot < toI32(tags.length)) {
          tags[own] = tags[slot]
        }
      }
      yamlPut(stream.propStarts, own, yamlAt(stream.propStarts, slot))
    } else {
      yamlPut(stream.props, node, slot)
    }
    if (anchorFrom >= 0) {
      this.defineAnchor(anchorFrom, anchorTo, node, into)
    }
    if (yamlAt(stream.propTagStarts, slot) >= 0) {
      yamlPutU8(stream.types, node, YAML_UNRESOLVED)
      this.checkTaggedNode(node, slot)
    }
    return node
  }

  // ---- Scalars -------------------------------------------------------------------

  /** Reports the bad escape whose `\` is at `at`. */
  private reportBadEscape(at: i32): void {
    const e: i32 = this.at(at + 1)
    let digits: i32 = 0
    if (e === 120) {
      digits = 2
    } else if (e === 117) {
      digits = 4
    } else if (e === 85) {
      digits = 8
    }
    if (digits > 0) {
      let limit: i32 = at + 2 + digits
      if (limit > this.len) {
        limit = this.len
      }
      let end: i32 = at + 2
      let value: i32 = 0
      let tooBig: boolean = false
      while (end < limit && yamlHexValue(this.at(end)) >= 0) {
        // 0x10FFFF fits in 21 bits: past it, stop growing and remember.
        if (value > 1114111) {
          tooBig = true
        } else {
          value = value * 16 + yamlHexValue(this.at(end))
        }
        end += 1
      }
      const written: string = this.text.substring(at, end)
      if (end - at - 2 < digits) {
        this.error(YAML_ERR_BAD_ESCAPE, `"${written}" needs exactly ${digits} hex digits`, at, end)
      } else if (digits === 8 && (tooBig || value > 1114111)) {
        this.error(YAML_ERR_BAD_ESCAPE, `"${written}" is past the last Unicode code point`, at, end)
      }
      return
    }
    const width: i32 = yamlCharWidth(e)
    const escaped: string = this.text.substring(at + 1, at + 1 + width)
    this.error(YAML_ERR_BAD_ESCAPE, `"\\${escaped}" is not a valid escape sequence`, at, at + 1 + width)
  }

  /** Reports a quoted scalar's continuation line at `lineStart` that is not indented past its parent. */
  private checkQuotedIndent(lineStart: i32, parentIndent: i32): boolean {
    let i: i32 = lineStart
    while (this.at(i) === YAML_SPACE) {
      i += 1
    }
    const c: i32 = this.at(i)
    if (c < 0 || yamlIsBreak(c) || i - lineStart > parentIndent) {
      return false
    }
    this.flowIndentReported = true
    this.error(
      YAML_ERR_BAD_INDENT,
      "A quoted scalar continued over lines must be indented deeper than its parent",
      lineStart,
      i
    )
    return true
  }

  /** Reads a single- or double-quoted scalar at the cursor. */
  private scanQuoted(quote: i32, parentIndent: i32): i32 {
    const start: i32 = this.pos
    const single: boolean = quote === YAML_SQUOTE
    let i: i32 = start + 1
    let indentReported: boolean = parentIndent < 0
    let closed: boolean = false
    let contentEnd: i32 = this.len
    while (i < this.len) {
      const at: i32 = toI32(indexOfAny(this.text, single ? YAML_SINGLE_STOPS : YAML_DOUBLE_STOPS, i))
      if (at < 0) {
        i = this.len
        break
      }
      i = at
      const c: i32 = this.at(i)
      if (c === YAML_SQUOTE) {
        if (this.at(i + 1) === YAML_SQUOTE) {
          i += 2
          continue
        }
        contentEnd = i
        i += 1
        closed = true
        break
      }
      if (c === YAML_DQUOTE) {
        contentEnd = i
        i += 1
        closed = true
        break
      }
      if (c === YAML_BACKSLASH) {
        const e: i32 = this.at(i + 1)
        if (e < 0) {
          i = this.len
          break
        }
        if (yamlIsBreak(e)) {
          i += 1
          continue
        }
        if (yamlEscapeKind(e) !== 1) {
          this.reportBadEscape(i)
        }
        i += 2
        continue
      }
      // A line break.
      const after: i32 = yamlAfterBreak(this.text, i)
      if (this.isDocMarker(after)) {
        contentEnd = i
        i = after
        break
      }
      if (!indentReported) {
        indentReported = this.checkQuotedIndent(after, parentIndent)
      }
      i = after
    }
    if (!closed) {
      this.error(YAML_ERR_UNTERMINATED_QUOTE, "Missing closing quote", start, i)
    }
    const node: i32 = this.stream.newNode(
      YAML_SCALAR,
      single ? YAML_SINGLE_QUOTED : YAML_DOUBLE_QUOTED,
      start,
      i
    )
    yamlPut(this.stream.firsts, node, start + 1)
    yamlPut(this.stream.counts, node, contentEnd)
    this.pos = i
    return node
  }

  /** Reads an alias at the cursor and resolves it against the anchors defined so far. */
  private scanAlias(): i32 {
    const start: i32 = this.pos
    let i: i32 = start + 1
    while (i < this.len) {
      const c: i32 = this.at(i)
      if (yamlIsWs(c) || yamlIsFlowIndicator(c)) {
        break
      }
      i += 1
    }
    this.checkAmbiguousName("Alias", start, i)
    this.pos = i
    const node: i32 = this.stream.newNode(YAML_ALIAS, YAML_PLAIN, start, i)
    if (i === start + 1) {
      this.reportBadAnchorName("Alias", start, i)
      return node
    }
    const entry: i32 = this.findAnchor(start + 1, i)
    if (entry >= 0) {
      yamlPut(this.stream.firsts, node, yamlAt(this.anchorNodes, entry))
      return node
    }
    const name: string = this.text.substring(start + 1, i)
    let p: i32 = this.pendingTop - 1
    while (p >= 0) {
      if (
        yamlSameBytes(this.text, yamlAt(this.pendingStarts, p), yamlAt(this.pendingEnds, p), start + 1, i)
      ) {
        this.error(
          YAML_ERR_RECURSIVE_ALIAS,
          `Alias "*${name}" refers to the node that contains it; recursive structures are not supported`,
          start,
          i
        )
        return node
      }
      p -= 1
    }
    this.error(YAML_ERR_UNRESOLVED_ALIAS, `Alias "*${name}" has no matching anchor`, start, i)
    return node
  }

  /** An empty plain scalar, a null, at `at`. */
  private emptyScalar(at: i32): i32 {
    return this.stream.newNode(YAML_SCALAR, YAML_PLAIN, at, at)
  }

  /** Whether `code` may not start a plain scalar: `1` always, `2` for `-?:` before a blank. */
  private plainStartClass(code: i32): i32 {
    if (code === YAML_DASH || code === YAML_QUESTION || code === YAML_COLON) {
      return 2
    }
    if (
      yamlIsFlowIndicator(code) ||
      code === YAML_HASH ||
      code === YAML_AMP ||
      code === YAML_STAR ||
      code === YAML_BANG ||
      code === YAML_PIPE ||
      code === YAML_GT ||
      code === YAML_SQUOTE ||
      code === YAML_DQUOTE ||
      code === YAML_PERCENT ||
      code === YAML_AT ||
      code === YAML_BACKTICK
    ) {
      return 1
    }
    return 0
  }

  /** Whether `after` ends a flow indicator: the end, a blank, a break, `,`, `]` or `}`. */
  private flowIndicatorBoundary(after: i32): boolean {
    const c: i32 = this.at(after)
    return yamlIsWs(c) || c === YAML_COMMA || c === YAML_RBRACKET || c === YAML_RBRACE
  }

  /** Reports the indicator at `pos` that cannot start a plain scalar. */
  private reportBadPlainStart(pos: i32, flow: boolean): void {
    if (this.lastErrStart <= pos && pos < this.lastErrEnd) {
      return
    }
    const c: i32 = this.at(pos)
    if (this.plainStartClass(c) === 2) {
      if (c === YAML_COLON) {
        return
      }
      if (flow ? !this.flowIndicatorBoundary(pos + 1) : !yamlIsWs(this.at(pos + 1))) {
        return
      }
      if (c === YAML_DASH) {
        if (flow) {
          this.error(
            YAML_ERR_BAD_SCALAR_START,
            'A "-" sequence indicator cannot start a flow collection entry',
            pos,
            pos + 1
          )
        } else {
          this.error(
            YAML_ERR_UNEXPECTED_CONTENT,
            "A block sequence cannot start on the line of the key it belongs to",
            pos,
            pos + 1
          )
        }
        return
      }
      this.error(
        YAML_ERR_BAD_SCALAR_START,
        '"?" is an explicit-key indicator here and cannot start a plain scalar — quote the value',
        pos,
        pos + 1
      )
      return
    }
    if (flow && yamlIsFlowIndicator(c)) {
      return
    }
    const written: string = this.text.substring(pos, pos + 1)
    this.error(
      YAML_ERR_BAD_SCALAR_START,
      `Indicator "${written}" cannot start a plain scalar — quote the value`,
      pos,
      pos + 1
    )
  }

  /** The first `:` in `[from, end)` that a blank or the end follows, or `-1`. */
  private plainColonAt(from: i32, end: i32): i32 {
    let i: i32 = from
    while (i < end) {
      if (this.at(i) === YAML_COLON && (i + 1 >= end || yamlIsBlank(this.at(i + 1)))) {
        return i
      }
      i += 1
    }
    return -1
  }

  /** Reports the `: ` at `at` inside a plain scalar. */
  private reportPlainColon(at: i32): void {
    this.error(
      YAML_ERR_BAD_SCALAR_CONTENT,
      'A plain scalar cannot contain ": " — quote the value, or indent it as a nested mapping',
      at,
      at + 1
    )
  }

  /** Whether only blanks and a comment follow `from` on its line. */
  private endsAtComment(from: i32): boolean {
    let i: i32 = from
    while (yamlIsBlank(this.at(i))) {
      i += 1
    }
    return this.at(i) === YAML_HASH
  }

  /** Reads a block-context plain scalar at the cursor, with its continuation lines. */
  private scanPlainScalar(parentIndent: i32): i32 {
    const start: i32 = this.pos
    let valueEnd: i32 = this.plainLineEnd(start)
    let colonReported: boolean = false
    const firstColon: i32 = this.plainColonAt(start, valueEnd)
    if (firstColon >= 0) {
      this.reportPlainColon(firstColon)
      colonReported = true
    }
    let scan: i32 = this.nextLineStart(valueEnd)
    while (scan < this.len) {
      let i: i32 = scan
      while (this.at(i) === YAML_SPACE) {
        i += 1
      }
      const c: i32 = this.at(i)
      // A line of blanks is an empty line, tabs included, though a tab cannot indent.
      let blank: i32 = i
      while (yamlIsBlank(this.at(blank))) {
        blank += 1
      }
      if (yamlIsBreak(this.at(blank))) {
        scan = this.nextLineStart(blank)
        continue
      }
      if (this.at(blank) < 0) {
        break
      }
      const indent: i32 = i - scan
      if (indent <= parentIndent || c === YAML_HASH) {
        break
      }
      if (this.endsAtComment(valueEnd)) {
        break
      }
      if (indent === 0 && this.isDocMarker(i)) {
        break
      }
      const lineEnd: i32 = this.plainLineEnd(i)
      if (!colonReported) {
        const colon: i32 = this.plainColonAt(i, lineEnd)
        if (colon >= 0) {
          this.reportPlainColon(colon)
          colonReported = true
        }
      }
      valueEnd = lineEnd
      scan = this.nextLineStart(lineEnd)
    }
    this.pos = valueEnd
    const node: i32 = this.stream.newNode(YAML_SCALAR, YAML_PLAIN, start, valueEnd)
    yamlPut(this.stream.firsts, node, start)
    yamlPut(this.stream.counts, node, valueEnd)
    return node
  }

  /** Reports anything but a comment after a block scalar's header. */
  private checkBlockHeaderEnd(): void {
    let i: i32 = this.pos
    while (yamlIsBlank(this.at(i))) {
      i += 1
    }
    const c: i32 = this.at(i)
    if (c < 0 || yamlIsBreak(c) || (c === YAML_HASH && i > this.pos)) {
      return
    }
    this.error(
      YAML_ERR_BAD_BLOCK_HEADER,
      c === YAML_HASH
        ? "A comment must be preceded by whitespace"
        : "A block scalar header holds only its chomping and indentation indicators",
      i,
      this.plainLineEnd(i)
    )
  }

  /** Reads a `|` or `>` block scalar at the cursor. */
  private scanBlockScalar(parentIndent: i32): i32 {
    const start: i32 = this.pos
    const folded: boolean = this.at(start) === YAML_GT
    this.pos += 1
    let chomp: i32 = YAML_CLIP
    let explicitIndent: i32 = 0
    let sawChomp: boolean = false
    while (true) {
      const c: i32 = this.at(this.pos)
      if (c === YAML_DASH || c === YAML_PLUS) {
        if (sawChomp) {
          this.error(YAML_ERR_BAD_BLOCK_HEADER, "Repeated chomping indicator", this.pos, this.pos + 1)
        }
        sawChomp = true
        chomp = c === YAML_DASH ? YAML_STRIP : YAML_KEEP
      } else if (c >= YAML_ONE && c <= YAML_NINE) {
        if (explicitIndent !== 0) {
          this.error(YAML_ERR_BAD_BLOCK_HEADER, "Repeated indentation indicator", this.pos, this.pos + 1)
        }
        explicitIndent = c - YAML_ZERO
      } else {
        break
      }
      this.pos += 1
    }
    // An empty scalar ends at its header, not at the line after it.
    let valueEnd: i32 = this.pos
    this.checkBlockHeaderEnd()
    this.finishLine()
    const bodyStart: i32 = this.pos
    let contentIndent: i32 =
      explicitIndent > 0 ? (parentIndent > 0 ? parentIndent : toI32(0)) + explicitIndent : -1
    let leadingBlank: i32 = -1
    while (this.pos < this.len) {
      const lineStart: i32 = this.pos
      let i: i32 = lineStart
      while (this.at(i) === YAML_SPACE) {
        i += 1
      }
      const c: i32 = this.at(i)
      const indent: i32 = i - lineStart
      if (c === YAML_TAB && indent < (contentIndent === -1 ? parentIndent + 1 : contentIndent)) {
        this.error(YAML_ERR_TAB_INDENT, "Tabs cannot be used for indentation", i, i + 1)
      }
      if (c < 0 || yamlIsBreak(c)) {
        if (contentIndent === -1 && indent > leadingBlank) {
          leadingBlank = indent
        }
        this.pos = this.nextLineStart(i)
        continue
      }
      if (indent === 0 && this.isDocMarker(i)) {
        break
      }
      if (contentIndent === -1) {
        if (indent <= parentIndent) {
          break
        }
        contentIndent = indent
        if (leadingBlank > indent) {
          this.error(
            YAML_ERR_BAD_INDENT,
            "A leading blank line of a block scalar is indented deeper than its first content line",
            lineStart,
            i
          )
        }
      }
      if (indent < contentIndent) {
        break
      }
      const lineEnd: i32 = yamlLineEnd(this.text, lineStart + contentIndent, this.len)
      valueEnd = lineEnd
      this.pos = this.nextLineStart(lineEnd)
    }
    const node: i32 = this.stream.newNode(YAML_SCALAR, folded ? YAML_FOLDED : YAML_LITERAL, start, valueEnd)
    yamlPut(this.stream.firsts, node, bodyStart)
    yamlPut(this.stream.counts, node, this.pos)
    const eight: i32 = 8
    const four: i32 = 4
    yamlPut(this.stream.extras, node, (contentIndent + 1) * eight + (explicitIndent > 0 ? four : 0) + chomp)
    return node
  }

  // ---- Directives and key colons -------------------------------------------------

  /** Reads the `%` directive at `at` into the document's handles and version. */
  private readDirective(at: i32): void {
    const nameEnd: i32 = this.tokenEnd(at + 1)
    const isTag: boolean = yamlIsWord(this.text, at + 1, nameEnd, "TAG")
    if (isTag || yamlIsWord(this.text, at + 1, nameEnd, "YAML")) {
      let i: i32 = nameEnd
      while (yamlIsBlank(this.at(i))) {
        i += 1
      }
      const firstEnd: i32 = this.tokenEnd(i)
      if (isTag) {
        let j: i32 = firstEnd
        while (yamlIsBlank(this.at(j))) {
          j += 1
        }
        const prefixEnd: i32 = this.tokenEnd(j)
        if (firstEnd === i || prefixEnd === j || this.at(i) !== YAML_BANG) {
          this.warn(YAML_ERR_BAD_DIRECTIVE, "%TAG directive needs a handle and a prefix", at, prefixEnd)
          return
        }
        const handle: string = this.text.substring(i, firstEnd)
        let k: i32 = toI32(this.handleNames.length) - 1
        while (k >= 0) {
          if (this.handleNames[k] === handle) {
            this.warn(
              YAML_ERR_DUPLICATE_DIRECTIVE,
              `Tag handle "${handle}" is declared more than once`,
              at,
              prefixEnd
            )
            break
          }
          k -= 1
        }
        this.handleNames.push(handle)
        this.handlePrefixes.push(this.text.substring(j, prefixEnd))
        return
      }
      this.readYamlVersion(at, i, firstEnd)
      return
    }
    this.warn(
      YAML_ERR_UNKNOWN_DIRECTIVE,
      `Unknown directive "%${this.text.substring(at + 1, nameEnd)}"`,
      at,
      nameEnd
    )
  }

  /** Checks the version `[from, to)` of the `%YAML` directive at `at`. */
  private readYamlVersion(at: i32, from: i32, to: i32): void {
    if (this.yamlDirective) {
      this.error(YAML_ERR_DUPLICATE_DIRECTIVE, "A document may carry only one %YAML directive", at, to)
    }
    this.yamlDirective = true
    const version: string = this.text.substring(from, to)
    let i: i32 = from
    while (i < to && yamlIsDigit(this.at(i))) {
      i += 1
    }
    const major: i32 = i
    let valid: boolean = i > from && this.at(i) === YAML_DOT
    if (valid) {
      i += 1
      const minor: i32 = i
      while (i < to && yamlIsDigit(this.at(i))) {
        i += 1
      }
      valid = i > minor && i === to
    }
    if (!valid) {
      this.error(YAML_ERR_BAD_DIRECTIVE, `"${version}" is not a valid YAML version`, at, to)
      return
    }
    if (!this.lineRestIsBlank(to)) {
      let after: i32 = to
      while (yamlIsBlank(this.at(after))) {
        after += 1
      }
      this.error(
        YAML_ERR_BAD_DIRECTIVE,
        "Unexpected content after the %YAML version",
        after,
        this.tokenEnd(after)
      )
    }
    if (version !== "1.2") {
      const message: string =
        major === from + 1 && this.at(from) === YAML_ONE
          ? `Document declares YAML ${version}; it is parsed with the 1.2 core schema`
          : `Unsupported YAML version "${version}"`
      this.warn(YAML_ERR_UNSUPPORTED_YAML_VERSION, message, at, to)
    }
  }

  /** The end of the quoted scalar opening at `from`, past its closing quote, or `-1` at a break. */
  private quotedKeyEnd(from: i32, stopAtBreak: boolean): i32 {
    const quote: i32 = this.at(from)
    let i: i32 = from + 1
    while (i < this.len) {
      const q: i32 = this.at(i)
      if (stopAtBreak && yamlIsBreak(q)) {
        return -1
      }
      if (q === quote) {
        if (quote === YAML_SQUOTE && this.at(i + 1) === YAML_SQUOTE) {
          i += 2
        } else {
          return i + 1
        }
      } else {
        i += quote === YAML_DQUOTE && q === YAML_BACKSLASH ? 2 : 1
      }
    }
    return i + 1
  }

  /** The end of the flow collection opening at `from`, when it closes on its line; else `-1`. */
  private flowKeyEnd(from: i32): i32 {
    let depth: i32 = 0
    let i: i32 = from
    while (i < this.len) {
      const c: i32 = this.at(i)
      if (yamlIsBreak(c)) {
        return -1
      }
      if (c === YAML_SQUOTE || c === YAML_DQUOTE) {
        i = this.quotedKeyEnd(i, true)
        if (i < 0) {
          return -1
        }
        continue
      }
      if (c === YAML_LBRACKET || c === YAML_LBRACE) {
        depth += 1
      } else if (c === YAML_RBRACKET || c === YAML_RBRACE) {
        depth -= 1
        if (depth === 0) {
          return i + 1
        }
      }
      i += 1
    }
    return -1
  }

  /** The `:` that makes the line from `from` an implicit key, or `-1`. */
  private findKeyColon(from: i32): i32 {
    let i: i32 = from
    const first: i32 = this.at(from)
    if (first === YAML_LBRACKET || first === YAML_LBRACE) {
      i = this.flowKeyEnd(from)
      if (i < 0) {
        return -1
      }
    } else if (first === YAML_SQUOTE || first === YAML_DQUOTE) {
      i = this.quotedKeyEnd(from, false)
    }
    while (i < this.len) {
      const c: i32 = this.at(i)
      if (yamlIsBreak(c)) {
        return -1
      }
      if (c === YAML_HASH && i > from && yamlIsBlank(this.at(i - 1))) {
        return -1
      }
      if (c === YAML_COLON && yamlIsWs(this.at(i + 1))) {
        return i
      }
      i += 1
    }
    return -1
  }

  /** Whether the rest of the line from `from` is blank or a comment. */
  private lineRestIsBlank(from: i32): boolean {
    let i: i32 = from
    while (yamlIsBlank(this.at(i))) {
      i += 1
    }
    const c: i32 = this.at(i)
    return c < 0 || yamlIsBreak(c) || c === YAML_HASH
  }

  /** `to` moved back over the blanks that end `[from, to)`. */
  private trimEnd(from: i32, to: i32): i32 {
    let e: i32 = to
    while (e > from && yamlIsBlank(this.at(e - 1))) {
      e -= 1
    }
    return e
  }

  /** Whether `at` holds a `?` explicit-key indicator. */
  private isExplicitKey(at: i32): boolean {
    return this.at(at) === YAML_QUESTION && yamlIsWs(this.at(at + 1))
  }

  // ---- Flow collections ----------------------------------------------------------

  /** Enters a flow collection nested in a block node indented `blockIndent`. */
  private enterFlow(blockIndent: i32): void {
    this.flowIndent = blockIndent
    this.flowIndentReported = false
  }

  /** Checks that the flow line starting at `lineStart` is indented deeper than its block parent. */
  private checkFlowIndent(lineStart: i32): void {
    let i: i32 = lineStart
    while (this.at(i) === YAML_SPACE) {
      i += 1
    }
    let c: i32 = this.at(i)
    if (c === YAML_TAB) {
      let j: i32 = i
      while (yamlIsBlank(this.at(j))) {
        j += 1
      }
      if (j >= this.len) {
        return
      }
      c = this.at(j)
    }
    if (c < 0 || yamlIsBreak(c) || c === YAML_HASH) {
      return
    }
    const indent: i32 = i - lineStart
    if (indent > this.flowIndent) {
      return
    }
    if ((c === YAML_RBRACKET || c === YAML_RBRACE) && indent >= this.flowIndent) {
      return
    }
    this.flowIndentReported = true
    this.error(
      YAML_ERR_BAD_INDENT,
      "A flow collection continued over lines must be indented deeper than its parent",
      lineStart,
      i
    )
  }

  /** Skips blanks, breaks and comments inside a flow collection. */
  private skipFlowWs(): void {
    let p: i32 = this.pos
    while (p < this.len) {
      const c: i32 = this.at(p)
      if (yamlIsBlank(c)) {
        p += 1
      } else if (yamlIsBreak(c)) {
        p = yamlAfterBreak(this.text, p)
        const d: i32 = this.at(p)
        if ((d === YAML_DASH || d === YAML_DOT) && this.isDocMarker(p)) {
          this.error(
            YAML_ERR_UNEXPECTED_CONTENT,
            "A document marker cannot appear inside a flow collection",
            p,
            p + 3
          )
        } else if (!this.flowIndentReported) {
          this.checkFlowIndent(p)
        }
      } else if (c === YAML_HASH) {
        if (p > 0 && !yamlIsWs(this.at(p - 1))) {
          this.error(
            YAML_ERR_BAD_COMMENT,
            "A comment must be preceded by whitespace",
            p,
            this.plainLineEnd(p)
          )
        } else {
          this.recordComment(p)
        }
        p = yamlLineEnd(this.text, p, this.len)
      } else {
        break
      }
    }
    this.pos = p
  }

  /** Whether a `:` before `after` ends a flow plain scalar. */
  private flowColonEnds(after: i32): boolean {
    const c: i32 = this.at(after)
    return c === YAML_LBRACKET || c === YAML_LBRACE || this.flowIndicatorBoundary(after)
  }

  /** Where a flow plain scalar's line from `from` stops. */
  private flowPlainLineEnd(from: i32, lineStart: i32): i32 {
    let i: i32 = from
    while (i < this.len) {
      const hit: i32 = toI32(indexOfAny(this.text, YAML_PLAIN_FLOW_STOPS, i))
      if (hit < 0) {
        return this.len
      }
      const c: i32 = this.at(hit)
      if (c === YAML_COLON) {
        if (this.flowColonEnds(hit + 1)) {
          return hit
        }
      } else if (c === YAML_HASH) {
        if (hit > lineStart && yamlIsBlank(this.at(hit - 1))) {
          return hit
        }
      } else {
        return hit
      }
      i = hit + 1
    }
    return this.len
  }

  /** Reads a flow-context plain scalar at the cursor, with its continuation lines. */
  private scanFlowPlain(): i32 {
    const start: i32 = this.pos
    const i: i32 = this.flowPlainLineEnd(start, start)
    let valueEnd: i32 = this.trimEnd(start, i)
    if (!yamlIsBreak(this.at(i))) {
      this.pos = i
      return this.plainNode(start, valueEnd)
    }
    let scan: i32 = yamlAfterBreak(this.text, i)
    while (true) {
      let j: i32 = scan
      while (yamlIsBlank(this.at(j))) {
        j += 1
      }
      const c: i32 = this.at(j)
      if (yamlIsBreak(c)) {
        scan = yamlAfterBreak(this.text, j)
        continue
      }
      if (c < 0 || c === YAML_COMMA || c === YAML_LBRACKET || c === YAML_RBRACKET) {
        break
      }
      if (c === YAML_LBRACE || c === YAML_RBRACE || c === YAML_HASH) {
        break
      }
      if (j === scan && this.isDocMarker(j)) {
        break
      }
      if (c === YAML_COLON && this.flowColonEnds(j + 1)) {
        break
      }
      if (!this.flowIndentReported) {
        this.checkFlowIndent(scan)
      }
      const lineEnd: i32 = this.flowPlainLineEnd(j, j)
      valueEnd = this.trimEnd(j, lineEnd)
      if (!yamlIsBreak(this.at(lineEnd))) {
        this.pos = lineEnd
        return this.plainNode(start, valueEnd)
      }
      scan = yamlAfterBreak(this.text, lineEnd)
    }
    this.pos = valueEnd
    return this.plainNode(start, valueEnd)
  }

  /** A plain scalar node over `[start, end)`. */
  private plainNode(start: i32, end: i32): i32 {
    const stream: YamlStream = this.stream
    const node: i32 = stream.newNode(YAML_SCALAR, YAML_PLAIN, start, end)
    yamlPut(stream.firsts, node, start)
    yamlPut(stream.counts, node, end)
    return node
  }

  /** Reports nesting past `maxDepth`, gives up on the rest of the text, and stands in an empty node. */
  private depthLimitNode(): i32 {
    const at: i32 = this.pos
    this.error(YAML_ERR_DEPTH_LIMIT, `Exceeded maximum nesting depth of ${this.maxDepth}`, at, at)
    this.pos = this.len
    this.depthHit = true
    return this.emptyScalar(at)
  }

  /** Reads one flow node with its properties. */
  private parseFlowNode(): i32 {
    this.skipFlowWs()
    const props: i32 = this.scanProps(true)
    this.skipFlowWs()
    const c: i32 = this.at(this.pos)
    let node: i32 = -1
    if (c === YAML_LBRACKET) {
      node = this.parseFlowSeq()
    } else if (c === YAML_LBRACE) {
      node = this.parseFlowMap()
    } else if (c === YAML_DQUOTE || c === YAML_SQUOTE) {
      node = this.scanQuoted(c, this.flowIndentReported ? YAML_NONE : this.flowIndent)
    } else if (c === YAML_STAR) {
      node = this.scanAlias()
    } else {
      if (this.plainStartClass(c) !== 0) {
        this.reportBadPlainStart(this.pos, true)
      }
      node = this.scanFlowPlain()
    }
    return this.attachProps(node, props)
  }

  /** Steps over a `?` explicit-key indicator in flow; whether there was one. */
  private skipFlowExplicitKey(): boolean {
    if (!this.isExplicitKey(this.pos)) {
      return false
    }
    this.pos += 1
    this.skipFlowWs()
    return true
  }

  /** Reports an implicit key whose `:` is not on the key's line. */
  private checkImplicitKeyLine(afterKey: i32): void {
    if (this.crossesLine(afterKey, this.pos)) {
      this.error(
        YAML_ERR_BAD_IMPLICIT_KEY,
        'An implicit key must be followed by its ":" on the same line',
        afterKey,
        this.pos + 1
      )
    }
  }

  /** Reports an implicit key longer than YAML allows. */
  private reportLongImplicitKey(keyStart: i32, colon: i32): void {
    this.error(
      YAML_ERR_BAD_IMPLICIT_KEY,
      `An implicit key may not run more than ${YAML_MAX_KEY_LENGTH} characters before its ":"`,
      keyStart,
      colon + 1
    )
  }

  /** Reports content between a key node and its `:`. */
  private checkKeyGap(colon: i32): void {
    let from: i32 = this.pos
    while (yamlIsBlank(this.at(from))) {
      from += 1
    }
    if (from >= colon) {
      return
    }
    const to: i32 = this.trimEnd(from, colon)
    this.error(
      YAML_ERR_UNEXPECTED_CONTENT,
      `Unexpected "${this.text.substring(from, to)}" between a mapping key and its ":"`,
      from,
      to
    )
  }

  /** Reports node properties written before a `?` on its line. */
  private reportPropsBeforeExplicitKey(at: i32): void {
    this.error(
      YAML_ERR_BAD_PROPERTY,
      'Node properties cannot come before a "?" explicit key indicator on its line; write them after the "?", or on a line of their own above',
      at,
      at + 1
    )
  }

  /** Steps over a `,` with no entry before it, reporting it; whether there was one. */
  private skipEmptyFlowEntry(): boolean {
    if (this.at(this.pos) !== YAML_COMMA) {
      return false
    }
    this.error(YAML_ERR_UNEXPECTED_COMMA, 'Missing value before ","', this.pos, this.pos + 1)
    this.pos += 1
    return true
  }

  /** Reads the flow value after a `:` in flow, or `-1` when the entry ends first. */
  private parseFlowValue(close: i32): i32 {
    this.pos += 1
    this.skipFlowWs()
    const c: i32 = this.at(this.pos)
    if (c < 0 || c === YAML_COMMA || c === close) {
      return -1
    }
    return this.parseFlowNode()
  }

  /** Reads the separator after a flow entry; whether the collection goes on. */
  private flowSeparator(close: i32, start: i32): boolean {
    const c: i32 = this.at(this.pos)
    if (c === YAML_COMMA) {
      this.pos += 1
      return true
    }
    if (c === close) {
      this.pos += 1
      return false
    }
    this.reportUnterminatedFlow(close, start)
    return false
  }

  /** Reports a flow collection opened at `start` that never closes. */
  private reportUnterminatedFlow(close: i32, start: i32): void {
    if (this.depthHit) {
      return
    }
    this.error(
      YAML_ERR_UNTERMINATED_FLOW,
      close === YAML_RBRACKET
        ? 'Missing closing "]" for flow sequence'
        : 'Missing closing "}" for flow mapping',
      start,
      this.pos
    )
  }

  /** Reads the flow sequence opening at the cursor. */
  private parseFlowSeq(): i32 {
    if (this.depth >= this.maxDepth) {
      return this.depthLimitNode()
    }
    this.depth += 1
    const node: i32 = this.parseFlowSeqBody()
    this.depth -= 1
    return node
  }

  /** The body of `parseFlowSeq`, inside its depth guard. */
  private parseFlowSeqBody(): i32 {
    const start: i32 = this.pos
    const base: i32 = this.scratchTop
    this.pos += 1
    while (true) {
      this.skipFlowWs()
      const c: i32 = this.at(this.pos)
      if (c === YAML_RBRACKET) {
        this.pos += 1
        break
      }
      if (c < 0) {
        this.reportUnterminatedFlow(YAML_RBRACKET, start)
        break
      }
      if (this.skipEmptyFlowEntry()) {
        continue
      }
      const explicit: boolean = this.skipFlowExplicitKey()
      let item: i32 = this.parseFlowNode()
      const afterItem: i32 = this.pos
      this.skipFlowWs()
      if (this.at(this.pos) === YAML_COLON) {
        if (!explicit) {
          this.checkImplicitKeyLine(afterItem)
        }
        const value: i32 = this.parseFlowValue(YAML_RBRACKET)
        item = this.singlePairMap(this.makePair(item, value))
        this.skipFlowWs()
      } else if (explicit) {
        item = this.singlePairMap(this.makePair(item, YAML_NONE))
      }
      this.scratchTop = yamlStackPush(this.scratch, this.scratchTop, item)
      if (!this.flowSeparator(YAML_RBRACKET, start)) {
        break
      }
    }
    const node: i32 = this.stream.newNode(YAML_SEQ, YAML_FLOW, start, this.pos)
    this.finishCollection(node, base)
    return node
  }

  /** The flow map of the one pair a `k: v` entry of a flow sequence makes. */
  private singlePairMap(pair: i32): i32 {
    const stream: YamlStream = this.stream
    const node: i32 = stream.newNode(YAML_MAP, YAML_FLOW, stream.start(pair), stream.end(pair))
    yamlPut(stream.firsts, node, stream.pushKid(pair))
    yamlPut(stream.counts, node, 1)
    return node
  }

  /** Reads the flow mapping opening at the cursor. */
  private parseFlowMap(): i32 {
    if (this.depth >= this.maxDepth) {
      return this.depthLimitNode()
    }
    this.depth += 1
    const node: i32 = this.parseFlowMapBody()
    this.depth -= 1
    return node
  }

  /** The body of `parseFlowMap`, inside its depth guard. */
  private parseFlowMapBody(): i32 {
    const start: i32 = this.pos
    const base: i32 = this.scratchTop
    let keySet: i32 = -1
    this.pos += 1
    while (true) {
      this.skipFlowWs()
      const c: i32 = this.at(this.pos)
      if (c === YAML_RBRACE) {
        this.pos += 1
        break
      }
      if (c < 0) {
        this.reportUnterminatedFlow(YAML_RBRACE, start)
        break
      }
      if (this.skipEmptyFlowEntry()) {
        continue
      }
      this.skipFlowExplicitKey()
      const key: i32 = this.parseFlowNode()
      this.skipFlowWs()
      let value: i32 = -1
      if (this.at(this.pos) === YAML_COLON) {
        value = this.parseFlowValue(YAML_RBRACE)
      }
      keySet = this.trackKey(base, key, keySet)
      this.scratchTop = yamlStackPush(this.scratch, this.scratchTop, this.makePair(key, value))
      this.skipFlowWs()
      if (!this.flowSeparator(YAML_RBRACE, start)) {
        break
      }
    }
    this.releaseKeySet(keySet)
    const node: i32 = this.stream.newNode(YAML_MAP, YAML_FLOW, start, this.pos)
    this.finishCollection(node, base)
    return node
  }

  // ---- Collections and pairs ------------------------------------------------------

  /** Moves the scratch slots from `base` up into `node`'s children. */
  private finishCollection(node: i32, base: i32): void {
    const stream: YamlStream = this.stream
    let first: i32 = stream.kidTop
    let i: i32 = base
    while (i < this.scratchTop) {
      const slot: i32 = stream.pushKid(yamlAt(this.scratch, i))
      if (i === base) {
        first = slot
      }
      i += 1
    }
    yamlPut(stream.firsts, node, first)
    yamlPut(stream.counts, node, this.scratchTop - base)
    this.scratchTop = base
  }

  /** A pair node joining `key` to `value`, which is `-1` when the key has none. */
  private makePair(key: i32, value: i32): i32 {
    const stream: YamlStream = this.stream
    const end: i32 = value >= 0 ? stream.end(value) : stream.end(key)
    const pair: i32 = stream.newNode(YAML_PAIR, YAML_PLAIN, stream.start(key), end)
    yamlPut(stream.firsts, pair, key)
    yamlPut(stream.counts, pair, value)
    if (this.isMergeKey(key)) {
      this.checkMerge(key, value)
    }
    return pair
  }

  /**
   * Reports the value of merge key `key` unless it is a map, an alias
   * to one or a sequence of those; an empty value is reported on the key, a
   * sequence on each item that is not, and an alias to a sequence on the alias.
   * An alias with no target is already reported. An aliased sequence's
   * verdict is kept, so a sequence many merges name is read once (YJ-5).
   */
  private checkMerge(key: i32, value: i32): void {
    const stream: YamlStream = this.stream
    if (value < 0) {
      this.badMerge(stream.start(key), stream.end(key))
      return
    }
    const onAlias: boolean = stream.kind(value) === YAML_ALIAS
    const seq: i32 = onAlias ? stream.target(value) : value
    if (seq >= 0 && stream.kind(seq) === YAML_SEQ) {
      if (onAlias) {
        if (!this.aliasedSeqMerges(seq)) {
          this.badMerge(stream.start(value), stream.end(value))
        }
        return
      }
      const count: i32 = stream.count(seq)
      let i: i32 = 0
      while (i < count) {
        const item: i32 = stream.child(seq, i)
        stream.mergeItemsChecked += 1
        if (!this.mergesMap(item)) {
          this.badMerge(stream.start(item), stream.end(item))
        }
        i += 1
      }
    } else if (!this.mergesMap(value)) {
      this.badMerge(stream.start(value), stream.end(value))
    }
  }

  /**
   * Whether every item of sequence `seq`, which an alias merge names, merges
   * a map: read up to its first item that does not the first time, then
   * answered from the verdict kept for it.
   */
  private aliasedSeqMerges(seq: i32): boolean {
    const stream: YamlStream = this.stream
    this.mergeVerdicts = yamlRoomU8(this.mergeVerdicts, seq + 1)
    const verdicts: u8[] = this.mergeVerdicts
    if (seq < 0 || seq >= toI32(verdicts.length)) {
      return false
    }
    const kept: i32 = toI32(verdicts[seq])
    if (kept !== 0) {
      return kept === 1
    }
    const count: i32 = stream.count(seq)
    let good: boolean = true
    let i: i32 = 0
    while (good && i < count) {
      stream.mergeItemsChecked += 1
      good = this.mergesMap(stream.child(seq, i))
      i += 1
    }
    verdicts[seq] = good ? toU8(1) : toU8(2)
    return good
  }

  /** Whether `n` is a map, an alias to one or an alias with no target, which merges nothing and is reported as such. */
  private mergesMap(n: i32): boolean {
    const stream: YamlStream = this.stream
    if (stream.kind(n) === YAML_ALIAS) {
      const target: i32 = stream.target(n)
      return target < 0 || stream.kind(target) === YAML_MAP
    }
    return stream.kind(n) === YAML_MAP
  }

  /** Reports a merge value that names no map over `start` to `end`. */
  private badMerge(start: i32, end: i32): void {
    this.error(
      YAML_ERR_BAD_MERGE,
      "Merge key value must be a map, an alias to a map or a sequence of those",
      start,
      end
    )
  }

  /** Whether `key` is a `<<` merge key, which the duplicate check skips when merging is on. */
  private isMergeKey(key: i32): boolean {
    return yamlIsMergeKey(this.stream, key)
  }

  /**
   * Whether two keys share a style, a tag and their source bytes,
   * which makes them equal without decoding. The tag counts because a key's
   * range leaves out its properties: `~` is a null, `!!str ~` the string `"~"`.
   */
  private sameKeyBytes(a: i32, b: i32): boolean {
    const stream: YamlStream = this.stream
    if (
      stream.kind(a) !== YAML_SCALAR ||
      stream.kind(b) !== YAML_SCALAR ||
      stream.style(a) !== stream.style(b) ||
      stream.tag(a) !== stream.tag(b)
    ) {
      return false
    }
    return yamlSameBytes(this.text, stream.start(a), stream.end(a), stream.start(b), stream.end(b))
  }

  /**
   * Reports `key` when an earlier pair of the map whose pairs start
   * at scratch slot `base` has an equal key. Up to YAML_PAIRWISE_KEYS pairs the
   * keys are compared pairwise, by bytes first; past that the map takes a hash
   * set from the pool, whose index it returns (`set` is the one it holds, or `-1`).
   */
  private trackKey(base: i32, key: i32, set: i32): i32 {
    if (!this.uniqueKeys || this.isMergeKey(key)) {
      return set
    }
    const stream: YamlStream = this.stream
    if (set < 0 && this.scratchTop - base < YAML_PAIRWISE_KEYS) {
      let text: string = ""
      let decoded: boolean = false
      let i: i32 = base
      while (i < this.scratchTop) {
        const other: i32 = stream.key(yamlAt(this.scratch, i))
        let same: boolean = this.sameKeyBytes(other, key)
        if (!same && !this.isMergeKey(other)) {
          if (!decoded) {
            text = yamlKeyText(stream, key)
            decoded = true
          }
          same = yamlKeyText(stream, other) === text
        }
        if (same) {
          this.reportDuplicateKey(key)
          return set
        }
        i += 1
      }
      return set
    }
    let held: i32 = set
    if (held < 0) {
      held = this.keySetTop
      if (held >= toI32(this.keySets.length)) {
        this.keySets.push(new YamlKeySet())
      }
      this.keySetTop = held + 1
      let i: i32 = base
      while (i < this.scratchTop) {
        const other: i32 = stream.key(yamlAt(this.scratch, i))
        if (!this.isMergeKey(other)) {
          this.keySets[held].add(yamlKeyText(stream, other))
        }
        i += 1
      }
    }
    if (!this.keySets[held].add(yamlKeyText(stream, key))) {
      this.reportDuplicateKey(key)
    }
    return held
  }

  /** Hands the key set a finished map held back to the pool. */
  private releaseKeySet(set: i32): void {
    if (set >= 0) {
      this.keySets[set].clear()
      this.keySetTop = set
    }
  }

  /** Reports `key` as a repeat of an earlier key in its map. */
  private reportDuplicateKey(key: i32): void {
    const stream: YamlStream = this.stream
    this.error(
      YAML_ERR_DUPLICATE_KEY,
      `Map key "${yamlKeyText(stream, key)}" is duplicated`,
      stream.start(key),
      stream.end(key)
    )
  }

  // ---- Documents --------------------------------------------------------------------

  /** The start of a node written on the `---` line at `marker`, or `-1` when the line ends first. */
  private docMarkerInlineNode(marker: i32): i32 {
    let i: i32 = marker + 3
    while (yamlIsBlank(this.at(i))) {
      i += 1
    }
    const c: i32 = this.at(i)
    if (c < 0 || yamlIsBreak(c) || c === YAML_HASH) {
      if (c === YAML_HASH && this.keepComments) {
        this.recordComment(i)
      }
      this.pos = this.nextLineStart(i)
      return -1
    }
    this.pos = i
    return i
  }

  /** Whether the content at `from` opens a block mapping: a `?` key, or an implicit key's `:`. */
  private opensBlockMapping(from: i32): boolean {
    const p: i32 = this.skipPropsAhead(from)
    return this.isExplicitKey(p) || this.findKeyColon(p) >= 0
  }

  /** Reports content after the `...` marker at `marker` on its line. */
  private checkDocEndTail(marker: i32): void {
    if (this.lineRestIsBlank(marker + 3)) {
      return
    }
    let after: i32 = marker + 3
    while (yamlIsBlank(this.at(after))) {
      after += 1
    }
    this.error(
      YAML_ERR_UNEXPECTED_CONTENT,
      'Unexpected content after the "..." document-end marker',
      after,
      this.plainLineEnd(after)
    )
  }

  /** Whether every line from `from` is blank, a comment, or a bare document marker. */
  private onlyEmptyDocumentsFollow(from: i32): boolean {
    let i: i32 = from
    while (i < this.len) {
      if (!this.lineRestIsBlank(i)) {
        if (!this.isDocMarker(i) || !this.lineRestIsBlank(i + 3)) {
          return false
        }
      }
      i = this.nextLineStart(i)
    }
    return true
  }

  /** Reads the document that starts at the `---` line's content at `contentPos`. */
  private parseDocMarkerNode(contentPos: i32): i32 {
    const seq: boolean = this.isSeqEntryDash(contentPos)
    if (seq || this.opensBlockMapping(contentPos)) {
      this.error(
        YAML_ERR_UNEXPECTED_CONTENT,
        seq
          ? 'A block sequence cannot start on the "---" line'
          : 'A block mapping cannot start on the "---" line',
        contentPos,
        this.plainLineEnd(contentPos)
      )
    }
    this.pos = contentPos
    return this.parseNode(toI32(0), YAML_NONE, true)
  }

  /** Reads a document's root from the line `peekLine` found, whose content is at `contentPos`. */
  private parseBareRoot(contentPos: i32, indent: i32): i32 {
    if (indent !== 0) {
      this.checkRootTabIndent(contentPos)
    }
    this.pos = contentPos
    return this.parseNode(indent, YAML_NONE, true)
  }

  /** Reports a tab in the indentation of a root collection's first line, which starts at the cursor. */
  private checkRootTabIndent(contentPos: i32): void {
    const lineStart: i32 = this.pos
    let tab: i32 = lineStart
    while (tab < contentPos && this.at(tab) !== YAML_TAB) {
      tab += 1
    }
    if (tab === contentPos || this.tabReportedAt === lineStart) {
      return
    }
    if (this.isSeqEntryDash(contentPos) || this.opensBlockMapping(contentPos)) {
      this.error(YAML_ERR_TAB_INDENT, "Tabs cannot be used for indentation", tab, contentPos)
      this.tabReportedAt = lineStart
    }
  }

  /** Whether the line `peekLine` found is a `---` or `...` marker. */
  private atMarkerLine(): boolean {
    return !this.lineEof && this.lineIndent === 0 && this.isDocMarker(this.lineContent)
  }

  /** Warns when the core-schema tag of the properties in `slot` does not fit `node`. */
  private checkTaggedNode(node: i32, slot: i32): void {
    const stream: YamlStream = this.stream
    const tag: string = stream.tag(node)
    let want: i32 = 0
    if (tag === "str" || tag === "int" || tag === "float" || tag === "bool" || tag === "null") {
      want = YAML_SCALAR
    } else if (tag === "binary" || tag === "timestamp") {
      want = YAML_SCALAR
    } else if (tag === "map" || tag === "set") {
      want = YAML_MAP
    } else if (tag === "seq" || tag === "omap" || tag === "pairs") {
      want = YAML_SEQ
    } else {
      return
    }
    let start: i32 = stream.start(node)
    let end: i32 = stream.end(node)
    if (start === end) {
      start = yamlAt(stream.propTagStarts, slot)
      end = yamlAt(stream.propTagEnds, slot)
    }
    if (stream.kind(node) !== want) {
      let what: string = "a sequence"
      if (want === YAML_SCALAR) {
        what = "a scalar"
      } else if (want === YAML_MAP) {
        what = "a mapping"
      }
      this.warn(YAML_ERR_BAD_TAG_VALUE, `!!${tag} describes ${what}, and cannot be applied here`, start, end)
      return
    }
    if (tag === "int" || tag === "float" || tag === "bool" || tag === "null") {
      if (stream.type(node) === YAML_STRING) {
        this.warn(
          YAML_ERR_BAD_TAG_VALUE,
          `"${stream.text(node)}" is not a valid !!${tag} value; it is kept as a string`,
          start,
          end
        )
      }
    }
  }

  /**
   * Checks what follows the first document's node, and answers the
   * end of its `...` footer when one closes it, or `-1`.
   */
  private checkDocumentEnd(): i32 {
    if (this.pos >= this.len) {
      return -1
    }
    this.finishLineIfMidLine()
    this.peekLine(toI32(0))
    if (this.lineEof) {
      return -1
    }
    if (this.atMarkerLine()) {
      return this.warnIfMoreDocuments(this.lineContent)
    }
    this.error(
      YAML_ERR_UNEXPECTED_CONTENT,
      'Unexpected content after the document node — start a new document with "---"',
      this.lineContent,
      this.plainLineEnd(this.lineContent)
    )
    return -1
  }

  /**
   * Warns that the documents after the marker at `marker` were not
   * read, unless none of them holds anything. Answers the end of a `...`
   * marker, which is the first document's footer, or `-1`.
   */
  private warnIfMoreDocuments(marker: i32): i32 {
    this.recordLineComment(marker + 3)
    const footer: boolean = this.at(marker) === YAML_DOT
    let hidden: boolean = false
    if (footer) {
      this.checkDocEndTail(marker)
    } else {
      hidden = !this.lineRestIsBlank(marker + 3)
    }
    this.pos = this.nextLineStart(marker + 3)
    const footerEnd: i32 = footer ? marker + 3 : -1
    if (!hidden) {
      this.peekLine(toI32(0))
      if (this.lineEof || this.onlyEmptyDocumentsFollow(this.pos)) {
        return footerEnd
      }
    }
    this.warn(
      YAML_ERR_MULTIPLE_DOCUMENTS,
      "Only the first document of this stream was parsed — turn off firstDocumentOnly to read the rest",
      marker,
      marker + 3
    )
    return footerEnd
  }

  /**
   * Reads the directives and markers before a document's body, and
   * answers which of `YAML_SAW_*` it met. `closed` says the document before
   * ended with `...` (or there is none), so a directive may follow.
   */
  private skipStreamHead(closed: boolean): i32 {
    let seen: i32 = 0
    let sawDirective: boolean = false
    while (true) {
      this.peekLine(toI32(0))
      if (this.lineEof) {
        break
      }
      const p: i32 = this.lineContent
      const c: i32 = this.at(p)
      if (c === YAML_PERCENT && this.lineIndent === 0) {
        if (!closed && (seen & YAML_SAW_DOC_END) === 0) {
          this.error(
            YAML_ERR_UNEXPECTED_DIRECTIVE,
            'A directive must be preceded by a "..." document-end marker',
            p,
            this.tokenEnd(p)
          )
        }
        this.readDirective(p)
        sawDirective = true
        this.recordLineComment(p)
        this.pos = this.nextLineStart(p)
        continue
      }
      if (!this.atMarkerLine()) {
        break
      }
      if (c === YAML_DOT) {
        this.checkDocEndTail(p)
        this.recordLineComment(p + 3)
        this.pos = this.nextLineStart(p + 3)
        seen = seen | YAML_SAW_DOC_END
        continue
      }
      this.markerAt = p
      const inline: i32 = this.docMarkerInlineNode(p)
      return inline >= 0 ? seen | YAML_SAW_DOC_START | YAML_SAW_INLINE_NODE : seen | YAML_SAW_DOC_START
    }
    if (sawDirective) {
      this.error(
        YAML_ERR_UNEXPECTED_DIRECTIVE,
        'A directive must be followed by a "---" document start',
        this.pos,
        this.pos
      )
    }
    return seen
  }

  /** Steps past a UTF-8 byte order mark. */
  private skipBom(): void {
    if (
      yamlByte(this.text, 0) === 0xef &&
      yamlByte(this.text, 1) === 0xbb &&
      yamlByte(this.text, 2) === 0xbf
    ) {
      this.pos = 3
    }
  }

  /**
   * Reads the first document only.
   * @internal Called by `parseYamlWith`.
   */
  parseFirst(): void {
    this.skipBom()
    const markers: i32 = this.skipStreamHead(true)
    let root: i32 = -1
    if ((markers & YAML_SAW_INLINE_NODE) !== 0) {
      root = this.parseDocMarkerNode(this.pos)
    } else {
      this.peekLine(toI32(0))
      if (!this.lineEof && !this.atMarkerLine()) {
        root = this.parseBareRoot(this.lineContent, this.lineIndent)
      }
    }
    const footerEnd: i32 = this.checkDocumentEnd()
    this.pushDocument(root, footerEnd)
  }

  /**
   * Reads every document of the stream.
   * @internal Called by `parseYamlWith`.
   */
  parseAll(): void {
    this.skipBom()
    let closed: boolean = true
    while (true) {
      this.markerAt = -1
      const markers: i32 = this.skipStreamHead(closed)
      const sawStart: boolean = (markers & YAML_SAW_DOC_START) !== 0
      let root: i32 = -1
      let body: boolean = false
      if ((markers & YAML_SAW_INLINE_NODE) !== 0) {
        root = this.parseDocMarkerNode(this.pos)
        this.finishLineIfMidLine()
        body = true
      } else {
        this.peekLine(toI32(0))
        if (!this.lineEof && !this.atMarkerLine()) {
          const p: i32 = this.lineContent
          const count: i32 = toI32(this.stream.docRoots.length)
          if (!sawStart && !closed && (markers & YAML_SAW_DOC_END) === 0 && count > 0) {
            this.error(
              YAML_ERR_UNEXPECTED_CONTENT,
              'Unexpected content — start a new document with "---"',
              p,
              this.plainLineEnd(p)
            )
          }
          root = this.parseBareRoot(p, this.lineIndent)
          this.finishLineIfMidLine()
          body = true
        }
      }
      if (!sawStart && !body) {
        break
      }
      let footerEnd: i32 = -1
      this.peekLine(toI32(0))
      if (this.atMarkerLine() && this.at(this.lineContent) === YAML_DOT) {
        const p: i32 = this.lineContent
        this.checkDocEndTail(p)
        this.recordLineComment(p + 3)
        this.pos = this.nextLineStart(p + 3)
        footerEnd = p + 3
      }
      this.pushDocument(root, footerEnd)
      closed = footerEnd >= 0
      this.anchorTop = 0
      this.pendingTop = 0
      this.handleNames = []
      this.handlePrefixes = []
      this.yamlDirective = false
      this.doc += 1
    }
    const stream: YamlStream = this.stream
    const count: i32 = toI32(stream.docRoots.length)
    if (count === 0) {
      if (toI32(stream.diagCodes.length) > 0 || toI32(stream.commentStarts.length) > 0) {
        this.pushDocument(YAML_NONE, YAML_NONE)
      }
      return
    }
    let i: i32 = 0
    while (i < toI32(stream.diagDocuments.length)) {
      if (stream.diagDocuments[i] >= count) {
        stream.diagDocuments[i] = count - 1
      }
      i += 1
    }
  }

  /** Records a document whose root is `root` (or `-1`), closed by a `...` ending at `footerEnd` (or `-1`). */
  private pushDocument(root: i32, footerEnd: i32): void {
    const stream: YamlStream = this.stream
    let start: i32 = root >= 0 ? stream.start(root) : this.pos
    if (this.markerAt >= 0) {
      start = this.markerAt
    }
    let end: i32 = footerEnd
    if (end < 0) {
      end = root >= 0 ? stream.end(root) : start
      if (this.markerAt + 3 > end) {
        end = this.markerAt + 3
      }
      if (start > end) {
        end = start
      }
    }
    if (start > end) {
      start = end
    }
    stream.docRoots.push(root)
    stream.docStarts.push(start)
    stream.docEnds.push(end)
  }

  // ---- Block collections ----------------------------------------------------------

  /**
   * The value of properties written alone at the end of their line,
   * whose slot is `props`: the node on the lines below, or an empty scalar.
   */
  private parsePropsOnlyValue(props: i32, parentIndent: i32, seqAtParentIndent: boolean): i32 {
    const propsEnd: i32 = this.pos
    this.finishLine()
    this.peekLine(parentIndent + 1)
    if (!this.lineEof && this.lineIndent > parentIndent) {
      this.pos = this.lineContent
      return this.attachProps(this.parseNode(this.lineIndent, parentIndent, seqAtParentIndent), props)
    }
    if (
      seqAtParentIndent &&
      !this.lineEof &&
      this.lineIndent === parentIndent &&
      this.isSeqEntryDash(this.lineContent)
    ) {
      this.pos = this.lineContent
      return this.attachProps(this.parseBlockSeq(parentIndent), props)
    }
    return this.attachProps(this.emptyScalar(propsEnd), props)
  }

  /** The value written on a key's line after its `:`, or `-1` when there is none. */
  private parseInlineValue(parentIndent: i32): i32 {
    const props: i32 = this.scanProps(false)
    this.skipInlineSpaces()
    if (this.atLineEnd()) {
      return props >= 0 ? this.parsePropsOnlyValue(props, parentIndent, true) : -1
    }
    const c: i32 = this.at(this.pos)
    let node: i32 = -1
    if (c === YAML_STAR) {
      node = this.scanAlias()
      this.checkTrailingContent()
    } else if (c === YAML_PIPE || c === YAML_GT) {
      node = this.scanBlockScalar(parentIndent)
    } else if (c === YAML_LBRACKET || c === YAML_LBRACE) {
      this.enterFlow(parentIndent)
      node = c === YAML_LBRACKET ? this.parseFlowSeq() : this.parseFlowMap()
      this.checkTrailingContent()
    } else if (c === YAML_DQUOTE || c === YAML_SQUOTE) {
      node = this.scanQuoted(c, parentIndent)
      this.checkTrailingContent()
    } else {
      if (this.plainStartClass(c) !== 0) {
        this.reportBadPlainStart(this.pos, false)
      }
      node = this.scanPlainScalar(parentIndent)
    }
    return this.attachProps(node, props)
  }

  /** The column of `at`: its distance from the start of its line. */
  private columnOf(at: i32): i32 {
    let i: i32 = at
    while (i > 0 && !yamlIsBreak(this.at(i - 1))) {
      i -= 1
    }
    return at - i
  }

  /**
   * A block collection written on an indicator's line (`- - a`,
   * `- k: v`, `? - a`), or `-1` when the cursor holds no such collection.
   */
  private parseCompactCollection(): i32 {
    const at: i32 = this.pos
    const seq: boolean = this.isSeqEntryDash(at)
    const keyAt: i32 = seq ? at : this.skipPropsAhead(at)
    const explicit: boolean = !seq && this.isExplicitKey(keyAt)
    const colon: i32 = seq || explicit ? -1 : this.findKeyColon(keyAt)
    if (!seq && !explicit && colon < 0) {
      return -1
    }
    const column: i32 = this.columnOf(at)
    let node: i32 = -1
    if (seq) {
      node = this.parseBlockSeq(column)
    } else {
      let props: i32 = -1
      if (keyAt !== at) {
        props = this.scanProps(false)
        this.skipInlineSpaces()
      }
      if (explicit) {
        if (props >= 0) {
          this.reportPropsBeforeExplicitKey(this.pos)
        }
        node = this.attachProps(this.parseBlockMap(column, YAML_NONE, YAML_NONE, YAML_NONE), props)
      } else {
        node = this.parseBlockMap(column, colon, YAML_NONE, props)
      }
    }
    return node
  }

  /**
   * The value after an indicator of a block collection at `indent`:
   * on the same line, or on the lines below. `compact` lets a collection
   * start on the indicator's line. `-1` when there is none.
   */
  private parseValueOrChild(indent: i32, compact: boolean): i32 {
    if (compact) {
      this.skipIndicatorSeparation()
    } else {
      this.skipInlineSpaces()
    }
    if (this.atLineEnd()) {
      this.finishLine()
      this.peekLine(indent + 1)
      if (!this.lineEof && this.lineIndent > indent) {
        this.pos = this.lineContent
        return this.parseNode(this.lineIndent, indent, true)
      }
      if (!this.lineEof && this.lineIndent === indent && this.isSeqEntryDash(this.lineContent)) {
        this.pos = this.lineContent
        return this.parseBlockSeq(indent)
      }
      return -1
    }
    if (compact) {
      const collection: i32 = this.parseCompactCollection()
      if (collection >= 0) {
        return collection
      }
    }
    const node: i32 = this.parseInlineValue(indent)
    this.finishLineIfMidLine()
    return node
  }

  /**
   * Reads a block mapping at `indent`. Its first entry is already
   * found: an implicit key whose `:` is at `firstColon`, with the properties in
   * `firstProps`; or the node `firstKey`, read up to its `:`; or, with both
   * `-1`, an explicit `?` key at the cursor.
   */
  private parseBlockMap(indent: i32, firstColon: i32, firstKey: i32, firstProps: i32): i32 {
    if (this.depth >= this.maxDepth) {
      return this.depthLimitNode()
    }
    this.depth += 1
    const node: i32 = this.parseBlockMapBody(indent, firstColon, firstKey, firstProps)
    this.depth -= 1
    return node
  }

  /** The body of `parseBlockMap`, inside its depth guard. */
  private parseBlockMapBody(indent: i32, firstColon: i32, firstKey: i32, firstProps: i32): i32 {
    const stream: YamlStream = this.stream
    const base: i32 = this.scratchTop
    let keySet: i32 = -1
    let contentPos: i32 = this.pos
    let firstEntry: boolean = true
    if (firstKey >= 0) {
      const firstValue: i32 = this.parseValueOrChild(indent, false)
      keySet = this.trackKey(base, firstKey, keySet)
      this.scratchTop = yamlStackPush(this.scratch, this.scratchTop, this.makePair(firstKey, firstValue))
      firstEntry = false
    }
    while (true) {
      let colon: i32 = -1
      let explicit: boolean = false
      let keyProps: i32 = -1
      if (firstEntry) {
        colon = firstColon
        explicit = firstColon < 0
        keyProps = firstProps
      } else {
        this.peekLine(indent)
        if (this.lineEof || this.lineIndent !== indent) {
          break
        }
        const lineStart: i32 = this.pos
        contentPos = this.lineContent
        if (this.isSeqEntryDash(contentPos) || (indent === 0 && this.isDocMarker(contentPos))) {
          break
        }
        const c: i32 = this.at(contentPos)
        if (c === YAML_AMP || c === YAML_BANG) {
          this.pos = contentPos
          keyProps = this.scanProps(false)
          this.skipInlineSpaces()
          contentPos = this.pos
          if (keyProps >= 0 && this.isExplicitKey(contentPos)) {
            this.reportPropsBeforeExplicitKey(contentPos)
          }
        }
        explicit = this.isExplicitKey(contentPos)
        colon = explicit ? -1 : this.findKeyColon(contentPos)
        if (colon < 0 && !explicit) {
          this.pos = lineStart
          break
        }
      }
      firstEntry = false
      let key: i32 = -1
      let value: i32 = -1
      if (explicit) {
        this.pos = contentPos + 1
        key = this.parseValueOrChild(indent, true)
        if (key < 0) {
          key = this.emptyScalar(contentPos + 1)
        }
        key = this.attachProps(key, keyProps)
        this.peekLine(indent)
        if (
          !this.lineEof &&
          this.lineIndent === indent &&
          this.at(this.lineContent) === YAML_COLON &&
          yamlIsWs(this.at(this.lineContent + 1))
        ) {
          this.pos = this.lineContent + 1
          value = this.parseValueOrChild(indent, true)
        }
      } else {
        key = this.parseImplicitKey(indent, contentPos, colon)
        key = this.attachProps(key, keyProps)
        this.pos = colon + 1
        value = this.parseValueOrChild(indent, false)
      }
      keySet = this.trackKey(base, key, keySet)
      this.scratchTop = yamlStackPush(this.scratch, this.scratchTop, this.makePair(key, value))
    }
    this.releaseKeySet(keySet)
    let start: i32 = this.pos
    let end: i32 = this.pos
    if (this.scratchTop > base) {
      start = stream.start(yamlAt(this.scratch, base))
      end = stream.end(yamlAt(this.scratch, this.scratchTop - 1))
    }
    const node: i32 = stream.newNode(YAML_MAP, YAML_BLOCK, start, end)
    this.finishCollection(node, base)
    return node
  }

  /** Reads the implicit key at `from` of a block mapping at `indent`, whose `:` is at `colon`. */
  private parseImplicitKey(indent: i32, from: i32, colon: i32): i32 {
    if (colon - from > YAML_MAX_KEY_LENGTH) {
      this.reportLongImplicitKey(from, colon)
    }
    this.pos = from
    const c: i32 = this.at(from)
    let key: i32 = -1
    if (c === YAML_DQUOTE || c === YAML_SQUOTE) {
      key = this.scanQuoted(c, YAML_NONE)
      const stream: YamlStream = this.stream
      if (this.crossesLine(stream.start(key), stream.end(key))) {
        this.error(
          YAML_ERR_BAD_IMPLICIT_KEY,
          "An implicit key must be on one line",
          stream.start(key),
          stream.end(key)
        )
      }
    } else if (c === YAML_STAR) {
      key = this.scanAlias()
    } else if (c === YAML_LBRACKET || c === YAML_LBRACE) {
      this.enterFlow(indent)
      key = c === YAML_LBRACKET ? this.parseFlowSeq() : this.parseFlowMap()
    } else {
      if (this.plainStartClass(c) !== 0) {
        this.reportBadPlainStart(from, false)
      }
      return this.plainNode(from, this.trimEnd(from, colon))
    }
    if (this.pos < colon) {
      this.checkKeyGap(colon)
    }
    return key
  }

  /** Reads a block sequence at `indent`, whose first `-` is at the cursor. */
  private parseBlockSeq(indent: i32): i32 {
    if (this.depth >= this.maxDepth) {
      return this.depthLimitNode()
    }
    this.depth += 1
    const node: i32 = this.parseBlockSeqBody(indent)
    this.depth -= 1
    return node
  }

  /** The body of `parseBlockSeq`, inside its depth guard. */
  private parseBlockSeqBody(indent: i32): i32 {
    const stream: YamlStream = this.stream
    const base: i32 = this.scratchTop
    let start: i32 = -1
    let contentPos: i32 = this.pos
    let firstEntry: boolean = true
    while (true) {
      if (!firstEntry) {
        this.peekLine(indent)
        if (this.lineEof || this.lineIndent !== indent) {
          break
        }
        contentPos = this.lineContent
      }
      firstEntry = false
      if (!this.isSeqEntryDash(contentPos)) {
        break
      }
      if (start < 0) {
        start = contentPos
      }
      const dash: i32 = contentPos
      this.pos = dash + 1
      this.skipIndicatorSeparation()
      let item: i32 = -1
      if (this.atLineEnd()) {
        this.finishLine()
        this.peekLine(indent + 1)
        if (!this.lineEof && this.lineIndent > indent) {
          this.pos = this.lineContent
          item = this.parseNode(this.lineIndent, indent, false)
        } else {
          item = this.emptyScalar(dash + 1)
        }
      } else {
        const c: i32 = this.at(this.pos)
        if (c === YAML_PIPE || c === YAML_GT) {
          item = this.scanBlockScalar(indent)
        } else {
          item = this.parseNode(this.pos - contentPos + indent, indent, false)
        }
        this.finishLineIfMidLine()
      }
      this.scratchTop = yamlStackPush(this.scratch, this.scratchTop, item)
    }
    if (start < 0) {
      start = this.pos
    }
    const end: i32 = this.scratchTop > base ? stream.end(yamlAt(this.scratch, this.scratchTop - 1)) : this.pos
    const node: i32 = stream.newNode(YAML_SEQ, YAML_BLOCK, start, end)
    this.finishCollection(node, base)
    return node
  }

  /**
   * Reads the block node at the cursor, at `indent`, whose parent
   * is at `parentIndent`. `seqAtParentIndent` lets a sequence at the parent's
   * own indent be the value of lone properties.
   */
  private parseNode(indent: i32, parentIndent: i32, seqAtParentIndent: boolean): i32 {
    if (this.isSeqEntryDash(this.pos)) {
      return this.parseBlockSeq(indent)
    }
    const props: i32 = this.scanProps(false)
    if (props >= 0) {
      this.skipInlineSpaces()
      if (this.isSeqEntryDash(this.pos)) {
        this.error(
          YAML_ERR_UNEXPECTED_CONTENT,
          "A block sequence cannot start on the line its node properties are written on",
          this.pos,
          this.pos + 1
        )
      }
      if (this.atLineEnd()) {
        return this.parsePropsOnlyValue(props, parentIndent, seqAtParentIndent)
      }
    }
    const c: i32 = this.at(this.pos)
    if (c === YAML_STAR || c === YAML_LBRACKET || c === YAML_LBRACE) {
      let node: i32 = -1
      if (c === YAML_STAR) {
        node = this.scanAlias()
      } else {
        this.enterFlow(parentIndent)
        node = c === YAML_LBRACKET ? this.parseFlowSeq() : this.parseFlowMap()
      }
      node = this.attachProps(node, props)
      this.skipInlineSpaces()
      if (this.at(this.pos) === YAML_COLON && yamlIsWs(this.at(this.pos + 1))) {
        const stream: YamlStream = this.stream
        if (this.crossesLine(stream.start(node), stream.end(node))) {
          this.error(
            YAML_ERR_BAD_IMPLICIT_KEY,
            "An implicit key must be on one line",
            stream.start(node),
            stream.end(node)
          )
        }
        this.pos += 1
        return this.parseBlockMap(indent, YAML_NONE, node, YAML_NONE)
      }
      this.checkTrailingContent()
      return node
    }
    if (c === YAML_PIPE || c === YAML_GT) {
      return this.attachProps(this.scanBlockScalar(parentIndent), props)
    }
    if (this.isExplicitKey(this.pos)) {
      if (props >= 0) {
        this.reportPropsBeforeExplicitKey(this.pos)
      }
      return this.attachProps(this.parseBlockMap(indent, YAML_NONE, YAML_NONE, YAML_NONE), props)
    }
    const colon: i32 = this.findKeyColon(this.pos)
    if (colon >= 0) {
      return this.parseBlockMap(indent, colon, YAML_NONE, props)
    }
    if (c === YAML_DQUOTE || c === YAML_SQUOTE) {
      const quoted: i32 = this.attachProps(this.scanQuoted(c, parentIndent), props)
      this.checkTrailingContent()
      return quoted
    }
    if (this.plainStartClass(c) !== 0) {
      this.reportBadPlainStart(this.pos, false)
    }
    return this.attachProps(this.scanPlainScalar(parentIndent), props)
  }
}

// ---- Key sets ---------------------------------------------------------------------

const YAML_FNV_OFFSET: i32 = -2128831035
const YAML_FNV_PRIME: i32 = 16777619
const YAML_KEY_SET_SLOTS: i32 = 64

/** FNV-1a over the characters of `text`. */
const yamlKeyHash = (text: string): i32 => {
  let hash: i32 = YAML_FNV_OFFSET
  const length: i32 = toI32(text.length)
  let i: i32 = 0
  while (i < length) {
    hash = wrappingMul(hash ^ toI32(text.charCodeAt(i)), YAML_FNV_PRIME)
    i += 1
  }
  return hash
}

/**
 * The keys of one large map, for the duplicate check: open addressing over
 * a power-of-two table, kept at most half full. `filled` lists the used
 * slots, so a set handed back to the pool clears only those.
 */
class YamlKeySet {
  private texts: string[]
  private used: boolean[]
  private filled: i32[]
  private mask: i32 = 0

  constructor() {
    this.texts = []
    this.used = []
    this.filled = []
    this.resize(YAML_KEY_SET_SLOTS)
  }

  /**
   * Adds `text`; false when it was already there.
   * @internal Called by `YamlParser`.
   */
  add(text: string): boolean {
    if ((toI32(this.filled.length) + 1) * 2 > this.mask + 1) {
      this.grow()
    }
    let slot: i32 = yamlKeyHash(text) & this.mask
    while (slot < toI32(this.used.length) && this.used[slot]) {
      if (this.texts[slot] === text) {
        return false
      }
      slot = (slot + 1) & this.mask
    }
    if (slot < toI32(this.used.length)) {
      this.used[slot] = true
      this.texts[slot] = text
    }
    this.filled.push(slot)
    return true
  }

  /**
   * Empties the set, keeping its table.
   * @internal Called by `YamlParser`.
   */
  clear(): void {
    let i: i32 = 0
    while (i < toI32(this.filled.length)) {
      const slot: i32 = this.filled[i]
      if (slot >= 0 && slot < toI32(this.used.length)) {
        this.used[slot] = false
        this.texts[slot] = ""
      }
      i += 1
    }
    this.filled = []
  }

  /** Doubles the table and puts every key back. */
  private grow(): void {
    const texts: string[] = []
    let i: i32 = 0
    while (i < toI32(this.filled.length)) {
      const slot: i32 = this.filled[i]
      texts.push(slot >= 0 && slot < toI32(this.texts.length) ? this.texts[slot] : "")
      i += 1
    }
    this.resize((this.mask + 1) * 2)
    let j: i32 = 0
    while (j < toI32(texts.length)) {
      this.add(texts[j])
      j += 1
    }
  }

  /** An empty table of `slots` slots. */
  private resize(slots: i32): void {
    this.texts = []
    this.used = []
    this.filled = []
    let i: i32 = 0
    while (i < slots) {
      this.texts.push("")
      this.used.push(false)
      i += 1
    }
    this.mask = slots - 1
  }
}

/** Whether map key `key` of `stream` is a merge key: a plain `<<`, untagged or `!!merge`, while the stream merges. */
const yamlIsMergeKey = (stream: YamlStream, key: i32): boolean => {
  if (!stream.merge || key < 0) {
    return false
  }
  const start: i32 = stream.start(key)
  if (
    stream.end(key) !== start + 2 ||
    yamlByte(stream.source, start) !== YAML_LT ||
    yamlByte(stream.source, start + 1) !== YAML_LT ||
    stream.kind(key) !== YAML_SCALAR ||
    stream.style(key) !== YAML_PLAIN
  ) {
    return false
  }
  const tag: string = stream.tag(key)
  return tag === "" || tag === "merge"
}

// ---- Key text -------------------------------------------------------------------

/** How many bytes `keyText` writes for a collection key before it cuts the rest to `…`. */
const YAML_KEY_TEXT_BUDGET: i32 = 4096
/** How deep `keyText` follows a collection key's nesting before it cuts the rest to `…`. */
const YAML_KEY_TEXT_DEPTH: i32 = 64
/** How many aliases in a row a path step follows before it stops. */
const YAML_ALIAS_HOPS: i32 = 100

/** Writes a collection key as one line of flow text, within `YAML_KEY_TEXT_BUDGET` bytes. */
class YamlFlowWriter {
  private stream: YamlStream
  /** @internal Used by `yamlKeyText`. */
  out: string
  private left: i32 = 0
  private cut: boolean = false

  constructor(stream: YamlStream) {
    this.stream = stream
    this.out = ""
    this.left = YAML_KEY_TEXT_BUDGET
  }

  /** Appends `s`, or as much of it as the budget allows and then `…`. */
  private append(s: string): void {
    if (this.cut) {
      return
    }
    const length: i32 = toI32(s.length)
    if (length > this.left) {
      // Back up to the start of a character, so the cut never splits one's bytes.
      let keep: i32 = this.left
      while (keep > 0 && (yamlByte(s, keep) & 0xc0) === 0x80) {
        keep -= 1
      }
      this.out = this.out + s.substring(0, keep) + "…"
      this.cut = true
      return
    }
    this.out = this.out + s
    this.left -= length
  }

  /**
   * Appends node `n` (`-1` for a missing value), nested `depth` deep.
   * @internal Called by `yamlKeyText`.
   */
  write(n: i32, depth: i32): void {
    const stream: YamlStream = this.stream
    if (depth > YAML_KEY_TEXT_DEPTH) {
      this.append("…")
      this.cut = true
      return
    }
    const at: i32 = n >= 0 ? stream.resolved(n) : -1
    if (at < 0) {
      this.append(n >= 0 ? yamlKeyText(stream, n) : "null")
      return
    }
    const kind: i32 = stream.kind(at)
    if (kind === YAML_SCALAR) {
      this.append(stream.type(at) === YAML_NULL ? "null" : stream.text(at))
      return
    }
    const count: i32 = stream.count(at)
    const map: boolean = kind === YAML_MAP
    if (count === 0) {
      this.append(map ? "{}" : "[]")
      return
    }
    this.append(map ? "{ " : "[ ")
    let i: i32 = 0
    while (i < count && !this.cut) {
      if (i > 0) {
        this.append(", ")
      }
      const item: i32 = stream.child(at, i)
      if (map) {
        this.write(stream.key(item), depth + 1)
        this.append(": ")
        this.write(stream.value(item), depth + 1)
      } else {
        this.write(item, depth + 1)
      }
      i += 1
    }
    this.append(map ? " }" : " ]")
  }
}

/**
 * The text a map key is matched and reported by: a scalar's decoded text (its
 * source text for a number or a boolean, `""` for a null), an alias's target's
 * text (`*name` when it names no anchor), and a collection written as one line
 * of flow text, `{ a: 1 }` or `[ a, b ]`, cut to `…` past 4096 bytes, at a
 * character's start.
 */
const yamlKeyText = (stream: YamlStream, node: i32): string => {
  const kind: i32 = stream.kind(node)
  if (kind === YAML_ALIAS && stream.target(node) < 0) {
    return stream.source.substring(stream.start(node), stream.end(node))
  }
  const at: i32 = stream.resolved(node)
  if (stream.kind(at) === YAML_SCALAR) {
    return stream.type(at) === YAML_NULL ? "" : stream.text(at)
  }
  const writer: YamlFlowWriter = new YamlFlowWriter(stream)
  writer.write(at, toI32(0))
  return writer.out
}

/**
 * The text a map key is matched by in a path and named by in a diagnostic.
 *
 * @param stream The parsed stream.
 * @param node The key node.
 * @returns A scalar's decoded text (its source text for a number or a boolean, `""` for a null), an
 *   alias's target's text (`*name` when it names no anchor), or a collection written as one line of
 *   flow text, `{ a: 1 }` or `[ a, b ]`, cut to `…` past 4096 bytes at a character's start or
 *   past nesting depth 64.
 */
export const keyText = (stream: YamlStream, node: i32): string => yamlKeyText(stream, node)

// ---- Paths ----------------------------------------------------------------------

/** Walks a path of map keys and sequence indexes down from a node. */
class YamlPathWalker {
  private stream: YamlStream
  /**
   * The deepest node reached.
   * @internal Used by `pathNode`.
   */
  node: i32 = -1
  /**
   * The last pair stepped through, or `-1`.
   * @internal Used by `pathPair`.
   */
  pair: i32 = -1
  /**
   * How many steps matched.
   * @internal Used by `pathMatch`.
   */
  matched: i32 = 0

  constructor(stream: YamlStream) {
    this.stream = stream
  }

  /** Node `n` with its aliases followed, up to `YAML_ALIAS_HOPS` of them; `-1` past that. */
  private follow(n: i32): i32 {
    const stream: YamlStream = this.stream
    let at: i32 = n
    let hops: i32 = 0
    while (at >= 0 && stream.kind(at) === YAML_ALIAS) {
      if (hops === YAML_ALIAS_HOPS) {
        return -1
      }
      at = stream.target(at)
      hops += 1
    }
    return at
  }

  /**
   * Whether map key `key` is matched by `step`. A one-line plain key
   * that is not a null is its own source text, so it is compared in place;
   * every other key goes through `yamlKeyText`.
   */
  private keyIs(key: i32, step: string): boolean {
    const stream: YamlStream = this.stream
    const start: i32 = stream.start(key)
    const end: i32 = stream.end(key)
    if (
      stream.kind(key) === YAML_SCALAR &&
      stream.style(key) === YAML_PLAIN &&
      stream.tag(key) === "" &&
      yamlLineEnd(stream.source, start, end) === end &&
      stream.type(key) !== YAML_NULL
    ) {
      return yamlIsWord(stream.source, start, end, step)
    }
    return yamlKeyText(stream, key) === step
  }

  /** The index `step` writes, or `-1` when it is not 1 to 9 decimal digits without a leading zero. */
  private indexOf(step: string): i32 {
    const length: i32 = toI32(step.length)
    if (length === 0 || length > 9 || (length > 1 && toI32(step.charCodeAt(0)) === 48)) {
      return -1
    }
    let index: i32 = 0
    let i: i32 = 0
    while (i < length) {
      const c: i32 = toI32(step.charCodeAt(i))
      if (c < 48 || c > 57) {
        return -1
      }
      index = index * 10 + (c - 48)
      i += 1
    }
    return index
  }

  /** The last pair of map `map` whose key `step` matches, as when a duplicate is let through; `-1` for none. */
  private ownPair(map: i32, step: string): i32 {
    const stream: YamlStream = this.stream
    let i: i32 = stream.count(map) - 1
    while (i >= 0) {
      const pair: i32 = stream.child(map, i)
      if (this.keyIs(stream.key(pair), step)) {
        return pair
      }
      i -= 1
    }
    return -1
  }

  /**
   * The pair `step` matches in the maps the merge keys of map `map`
   * name, in the order they are written, each searched as `ownPair` and then
   * through its own merge keys, so the first map listed wins. A merge key's
   * value is a map, an alias to one or a sequence of those; anything else
   * merges nothing. A map already searched is skipped (two merges sharing a
   * map search it once), and the search goes `YAML_ALIAS_HOPS` merges deep at
   * most. No YAML source can form a merge cycle, since an anchor binds only
   * once its node ends, so both guards are defensive: they bound the work, not
   * a loop.
   */
  private mergedPair(map: i32, step: string, depth: i32): i32 {
    const stream: YamlStream = this.stream
    const count: i32 = stream.count(map)
    let i: i32 = 0
    while (i < count && depth < YAML_ALIAS_HOPS) {
      const pair: i32 = stream.child(map, i)
      if (yamlIsMergeKey(stream, stream.key(pair))) {
        const value: i32 = this.follow(stream.value(pair))
        if (value >= 0 && stream.kind(value) === YAML_SEQ) {
          const items: i32 = stream.count(value)
          let j: i32 = 0
          while (j < items) {
            const found: i32 = this.mergedFrom(this.follow(stream.child(value, j)), step, depth)
            if (found >= 0) {
              return found
            }
            j += 1
          }
        } else {
          const found: i32 = this.mergedFrom(value, step, depth)
          if (found >= 0) {
            return found
          }
        }
      }
      i += 1
    }
    return -1
  }

  /** `mergedPair`'s search of one merged node `from`, which merges nothing unless it is a map not yet searched. */
  private mergedFrom(from: i32, step: string, depth: i32): i32 {
    const stream: YamlStream = this.stream
    if (from < 0 || stream.kind(from) !== YAML_MAP) {
      return -1
    }
    if (!this.markSeen(from)) {
      return -1
    }
    const own: i32 = this.ownPair(from, step)
    return own >= 0 ? own : this.mergedPair(from, step, depth + 1)
  }

  /**
   * Starts a step's merge search: a new `mergeStep` stamp, with
   * `mergeStamps` grown to every node. The stamps are cleared only when the
   * count wraps, so a step costs what it searches, not the document's size.
   */
  private startMerge(): void {
    const stream: YamlStream = this.stream
    const stamps: i32[] = stream.mergeStamps
    while (toI32(stamps.length) < stream.top) {
      stamps.push(0)
    }
    if (stream.mergeStep === 2147483647) {
      let k: i32 = 0
      while (k < toI32(stamps.length)) {
        stamps[k] = 0
        k += 1
      }
      stream.mergeStep = 0
    }
    stream.mergeStep += 1
  }

  /** Marks map `map` searched by this step; `false` when it already was. */
  private markSeen(map: i32): boolean {
    const stream: YamlStream = this.stream
    const stamps: i32[] = stream.mergeStamps
    if (map < 0 || map >= toI32(stamps.length) || stamps[map] === stream.mergeStep) {
      return false
    }
    stamps[map] = stream.mergeStep
    return true
  }

  /**
   * Walks `path` down from `root`, as far as it matches.
   * @internal Called by `pathNode`, `pathPair` and `pathMatch`.
   */
  walk(root: i32, path: string[]): void {
    const stream: YamlStream = this.stream
    this.node = root
    this.pair = -1
    this.matched = 0
    const steps: i32 = toI32(path.length)
    while (this.matched < steps) {
      const at: i32 = this.follow(this.node)
      if (at < 0) {
        return
      }
      const step: string = path[this.matched]
      const kind: i32 = stream.kind(at)
      if (kind === YAML_MAP) {
        let pair: i32 = this.ownPair(at, step)
        if (pair < 0 && stream.merge) {
          this.startMerge()
          this.markSeen(at)
          pair = this.mergedPair(at, step, toI32(0))
        }
        if (pair < 0) {
          return
        }
        // An empty value (`a:`) matches the step and reaches no node, which ends the walk.
        this.pair = pair
        this.node = stream.value(pair)
        this.matched += 1
        if (this.node < 0) {
          return
        }
      } else if (kind === YAML_SEQ) {
        const index: i32 = this.indexOf(step)
        if (index < 0 || index >= stream.count(at)) {
          return
        }
        this.node = stream.child(at, index)
        this.matched += 1
      } else {
        return
      }
    }
  }
}

/**
 * The node a path names. Each step is a map key (matched by `keyText`; of
 * duplicate keys, the last) or a sequence index (`"0"`, no leading zero),
 * through aliases. While the stream merges (`YamlOptions.merge`), a key a map
 * does not hold is looked for in the maps its `<<` keys name, in order: the
 * map's own keys win, then the first merged map that has it, and the pair found
 * is the one inside that map.
 *
 * @param stream The parsed stream.
 * @param root The node the path starts at, such as a `documentRoot`.
 * @param path The steps, outermost first.
 * @returns The node the last matching step reached, as written (an alias is not followed): `root` itself
 *   for an empty path, and `-1` when a step lands on an empty value (`a:`). A chain of more than
 *   `YAML_ALIAS_HOPS` (100) aliases stops the walk at its first alias, which is returned, not `-1`.
 */
export const pathNode = (stream: YamlStream, root: i32, path: string[]): i32 => {
  const walker: YamlPathWalker = new YamlPathWalker(stream)
  walker.walk(root, path)
  return walker.node
}

/**
 * The last map pair a path steps through (see `pathNode`).
 *
 * @param stream The parsed stream.
 * @param root The node the path starts at.
 * @param path The steps, outermost first.
 * @returns The pair, or `-1` for none.
 */
export const pathPair = (stream: YamlStream, root: i32, path: string[]): i32 => {
  const walker: YamlPathWalker = new YamlPathWalker(stream)
  walker.walk(root, path)
  return walker.pair
}

/**
 * How many steps of a path match (see `pathNode`).
 *
 * @param stream The parsed stream.
 * @param root The node the path starts at.
 * @param path The steps, outermost first.
 * @returns The matching steps, an empty value's included: `path.length` when every step matches.
 */
export const pathMatch = (stream: YamlStream, root: i32, path: string[]): i32 => {
  const walker: YamlPathWalker = new YamlPathWalker(stream)
  walker.walk(root, path)
  return walker.matched
}

// ---- Parsing --------------------------------------------------------------------

/**
 * Parses a YAML stream with options. Panics when `maxDepth` is outside 1 to
 * 1000.
 *
 * @param text The YAML source.
 * @param options What to keep and check, and how deep collections may nest.
 * @returns The documents, nodes and diagnostics the parse found.
 */
export const parseYamlWith = (text: string, options: YamlOptions): YamlStream => {
  if (options.maxDepth < 1 || options.maxDepth > YAML_MAX_DEPTH) {
    panic("nish/yaml: maxDepth must be between 1 and 1000")
  }
  const parser: YamlParser = new YamlParser(text, options)
  if (options.firstDocumentOnly) {
    parser.parseFirst()
  } else {
    parser.parseAll()
  }
  parser.stream.sortDiagnostics()
  return parser.stream
}

/**
 * Parses a YAML stream with the default options.
 *
 * @param text The YAML source.
 * @returns The documents, nodes and diagnostics the parse found.
 */
export const parseYaml = (text: string): YamlStream => parseYamlWith(text, new YamlOptions())
