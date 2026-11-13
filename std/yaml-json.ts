/**
 * `nish/yaml-json` — one YAML document loaded into a `JsonDocument`, with
 * every value's and key's source range, so that one validator and one
 * `YamlLineIndex` serve a JSON text and a YAML text alike:
 *
 *     import { parseYaml } from "nish/yaml"
 *     import { JsonDocument, JsonLimits } from "nish/json-value"
 *     import { YamlJsonLoader } from "nish/yaml-json"
 *
 *     const stream = parseYaml(text)
 *     const doc = new JsonDocument(new JsonLimits())
 *     const loader = new YamlJsonLoader()
 *     const root = loader.load(stream, 0, doc)
 *     // root < 0: loader.failed, loader.errorStart, loader.errorEnd
 *
 * `load` clears the document and builds document `d` of the stream into it.
 * Every value's `start` and `end` are the byte range of the YAML node it came
 * from, as `YamlStream.start` and `end` give it (an anchor or a tag in front
 * is not included), and every key's `keyStart` and `keyEnd` the range of its
 * key node, quotes included. A key or value the text leaves out, the value of
 * `a:` or the key of `: b`, is an empty range at the end of its pair.
 *
 * **Scalars** follow the core schema the stream resolves: null, booleans,
 * numbers and strings. A number is kept as JSON text, exactly: a `+` sign is
 * dropped, leading zeros are dropped, `.5` is `0.5` and `1.` is `1.0`, and a
 * `0x` or `0o` integer is written in decimal, however wide (up to
 * `YAML_JSON_MAX_RADIX_DIGITS` digits). `.inf`, `-.inf` and `.nan` have no
 * JSON spelling and are `YAML_JSON_ERR_NOT_FINITE`.
 *
 * **Keys** are `keyText`'s: a string's decoded text, a number's or a
 * boolean's source text, `""` for null, a collection's flow text. Two YAML
 * keys that are different nodes can have the same text (`1` and `"1"`); the
 * second follows the document's `duplicates`, refused by default
 * (`JSON_VALUE_ERR_DUPLICATE`, at the second key) or holding the last value
 * under `JSON_VALUE_DUPLICATE_LAST`, as a parse of that JSON would.
 *
 * **Aliases are expanded** into copies, and **merge keys** (`<<`, when the
 * stream was parsed with `merge`) are applied as `pathNode` reads them: the
 * map's own keys first, in order, then each merged map's keys it does not
 * already have, the first map listed winning, searched through its own merge
 * keys. A copied value keeps the ranges of the nodes it was copied from, so
 * an error inside it points at the anchored text, and the copy's root takes
 * the alias's range, where it is used.
 *
 * **An alias bomb is refused before anything is built.** The values the
 * document expands to are counted first, from the nodes, with each node's count
 * kept, so the count costs one step per node however far the aliases multiply
 * it. Past the document's `maxValues` the load is `YAML_JSON_ERR_EXPANSION`, at
 * the first alias whose copy is the largest (the first whose copy alone is past
 * the limit, in a bomb), or `JSON_VALUE_ERR_VALUES` when the document has no
 * alias.
 *
 *  A merged map counts all its keys, also those the merging map overrides, so a
 *  document within a few values of the limit can be refused for merges that
 *  would have fit. The loader's merging is linear too: a map is merged into a
 *  given map at most once, however many paths through the merge keys reach it,
 *  and the pairs every merge visits and the items of every merge sequence it
 *  walks are charged to a budget of `maxValues` plus the stream's node count,
 *  past which the load is `YAML_JSON_ERR_EXPANSION` at the merge key.
 *
 *  `parseYaml`'s own merge check is not bounded this way: it walks a shared
 *  merge sequence once for each merge key that names it.
 *
 * **A merge key's value** is a mapping, an alias to one, or a sequence of
 * those; anything else is refused at the value, by the parser as
 * `YAML_ERR_BAD_MERGE` (so `YAML_JSON_ERR_YAML`) and by the loader as
 * `YAML_JSON_ERR_MERGE`.
 * The text the copies store is bounded too, while they are built: past the
 * document's `JsonLimits.maxTotalBytes` of string, key and number text, the
 * load is `YAML_JSON_ERR_EXPANSION` at the outermost alias being copied, or
 * `JSON_TOK_ERR_TOTAL_LIMIT` at the node when no alias is.
 *
 * **Nesting** is held to `maxDepth`, `JSON_WRITER_MAX_DEPTH` (64) by default,
 * counting copies, so that every loaded document can be written back as JSON;
 * deeper is `YAML_JSON_ERR_DEPTH`, at the node that is one too deep.
 *
 * A document with an error diagnostic is `YAML_JSON_ERR_YAML`, at the first
 * one's range, and loads nothing: a node the parser gave up on has no value
 * to load. Warnings are not errors.
 *
 * A failed load clears the document and answers the code, which is also in
 * `failed`, with the range it is about in `errorStart` and `errorEnd`.
 * `yamlJsonErrorName` names a code. A map of `n` keys costs `O(n)` steps: the
 * loader finds repeated keys itself, with a hash map past
 * `YAML_JSON_SCAN_KEYS` keys, and adds each member through `JsonDocument`'s
 * internal `append`, where `set` would scan the members for every key it
 * adds. Every member it adds is a value it has just made, which is the
 * check `append` skips.
 *
 * Every name here is `yamlJson`-prefixed, because a `std/` module is compiled
 * into the program that imports it and the symbol namespace is flat
 * (`std/README.md`). Every offset, count and code is an `i32`, and the module
 * runs under the Node prelude, where offsets count UTF-16 code units, as the
 * stream's do.
 */

import { JSON_WRITER_MAX_DEPTH } from "nish/json"
import { JSON_TOK_ERR_TOTAL_LIMIT, JsonLimits } from "nish/json-tokenizer"
import {
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_ERR_DUPLICATE,
  JSON_VALUE_ERR_RANGE,
  JSON_VALUE_ERR_VALUES,
  JSON_VALUE_MAX_VALUES,
  JsonDocument,
  JsonValue,
} from "nish/json-value"
import {
  YAML_ALIAS,
  YAML_BOOL,
  YAML_DOUBLE_QUOTED,
  YAML_FLOAT,
  YAML_INT,
  YAML_MAP,
  YAML_NULL,
  YAML_PAIR,
  YAML_PLAIN,
  YAML_SCALAR,
  YAML_SEQ,
  YAML_SINGLE_QUOTED,
  YamlStream,
  keyText,
  parseYaml,
} from "nish/yaml"

/** Document `d` is not in the stream. */
export const YAML_JSON_ERR_DOCUMENT: i32 = -40
/** The document has an error diagnostic; the range is the first one's. */
export const YAML_JSON_ERR_YAML: i32 = -41
/** `.inf`, `-.inf` or `.nan`, which JSON cannot spell. */
export const YAML_JSON_ERR_NOT_FINITE: i32 = -42
/** The aliases and merge keys expand the document past `maxValues`; the range is the first largest alias's. */
export const YAML_JSON_ERR_EXPANSION: i32 = -43
/** Collections nest deeper than `maxDepth`, counting copies. */
export const YAML_JSON_ERR_DEPTH: i32 = -44
/** A `0x` or `0o` integer with more than `YAML_JSON_MAX_RADIX_DIGITS` digits. */
export const YAML_JSON_ERR_NUMBER: i32 = -45
/**
 * A merge key's value is not a mapping or a sequence of mappings; the range is
 * the value's. `parseYaml` refuses these itself (`YAML_ERR_BAD_MERGE`, a load's
 * `YAML_JSON_ERR_YAML`); this is the loader's own check of the stream it is given.
 */
export const YAML_JSON_ERR_MERGE: i32 = -46

/**
 * The most digits a `0x` or `0o` integer may have, which is
 * `JSON_DEFAULT_MAX_NUMBER_BYTES`: writing one in decimal costs its digit count
 * times its decimal length, so a limit keeps a long one from costing the square
 * of the text.
 */
export const YAML_JSON_MAX_RADIX_DIGITS: i32 = 256

/** Up to this many keys a map's keys are compared with each other; past it, through a hash map. */
export const YAML_JSON_SCAN_KEYS: i32 = 16

/** How many merge keys deep a merged map is searched, as `YAML_ALIAS_HOPS` bounds `pathNode`. */
const YAML_JSON_MERGE_HOPS: i32 = 100

/** The decimal limb `yamlJsonRadix` works in: four digits, so a limb times 16 plus a carry fits an `i32`. */
const YAML_JSON_LIMB: i32 = 10000

const YAML_JSON_PLUS: i32 = 43
const YAML_JSON_DASH: i32 = 45
const YAML_JSON_DOT: i32 = 46
const YAML_JSON_ZERO: i32 = 48
const YAML_JSON_LT: i32 = 60
/** The bytes a core-schema null can start with: `~`, `n` and `N`. */
const YAML_JSON_TILDE: i32 = 126
const YAML_JSON_LOWER_N: i32 = 110
const YAML_JSON_UPPER_N: i32 = 78
/** The bytes that end a quoted scalar's run of text with nothing to decode: `'` and `\`. */
const YAML_JSON_SQUOTE: i32 = 39
const YAML_JSON_BACKSLASH: i32 = 92
/** The key words of a member with no key, and both words of an array's member. */
const YAML_JSON_NO_WORD: i32 = 0

/**
 * A load failure's name, for a message.
 *
 * @param code A `YAML_JSON_ERR_*` code, as `failed` holds it.
 * @returns The code's name without the `YAML_JSON_ERR_` prefix, such as `"DEPTH"`; `""` for any other code.
 */
export const yamlJsonErrorName = (code: i32): string => {
  const names: string[] = ["DOCUMENT", "YAML", "NOT_FINITE", "EXPANSION", "DEPTH", "NUMBER", "MERGE"]
  const i: i32 = YAML_JSON_ERR_DOCUMENT - code
  return i >= 0 && i < toI32(names.length) ? names[i] : ""
}

/**
 * Loads documents of a `YamlStream` into a `JsonDocument`. Keeps its scratch,
 * in private fields, from one load to the next; use `load` and the result
 * fields.
 */
export class YamlJsonLoader {
  /** How deeply collections may nest, counting copies; `JSON_WRITER_MAX_DEPTH` so the result can be written. */
  maxDepth: i32 = 0
  /** The last `load`'s code: `0`, a `YAML_JSON_ERR_*` code or a `JSON_VALUE_ERR_*` code. */
  failed: i32 = 0
  /** The first byte the failure is about; `-1` after a load that succeeds. */
  errorStart: i32 = -1
  /** One past the last byte the failure is about; `-1` after a load that succeeds. */
  errorEnd: i32 = -1

  /** The stream and document of the load in progress. */
  private stream: YamlStream
  private doc: JsonDocument
  /** Per node, the values it expands to (`0` not counted yet, `-1` being counted). */
  private sizes: i32[]
  /** The nodes the last count set a size on, the first `countedTop` of them: all a count clears. */
  private counted: i32[]
  private countedTop: i32 = 0
  /** `quickCount`'s sizes, by node; each pass writes every one it reads. */
  private quickSizes: i32[]
  /** The count's own stack of nodes. */
  private pending: i32[]
  /** The most values the document may hold; a size saturates one past it. */
  private cap: i32 = 0
  /** The alias with the largest copy, and its size. */
  private bigAlias: i32 = -1
  private bigSize: i32 = 0
  /** The outermost alias being copied (`-1` for none), and the text the document may store. */
  private copying: i32 = -1
  private byteCap: i32 = 0
  /** Where the next map member goes in the `entry` arrays. */
  private entryTop: i32 = 0
  /**
   * The members of the maps being built, one map's after another's:
   * each one's key text and pair, and the value node it holds (`-1` for none).
   */
  private entryKeys: string[]
  private entryPairs: i32[]
  private entryValues: i32[]
  /** A large map's key texts, to their entry. */
  private seen: Map<string, i32>
  /** Per node, the stamp of the last map it was merged into; and that map's stamp. */
  private mergeMarks: i32[]
  private mergeStamp: i32 = 0
  /** The merged pairs the load may still visit. */
  private mergeBudget: i32 = 0

  /** A loader that holds collections to `JSON_WRITER_MAX_DEPTH`, so whatever it loads can be written back out. */
  constructor() {
    this.maxDepth = JSON_WRITER_MAX_DEPTH
    this.stream = parseYaml("")
    this.doc = new JsonDocument(new JsonLimits())
    this.sizes = []
    this.quickSizes = []
    this.counted = []
    this.pending = []
    this.entryKeys = []
    this.entryPairs = []
    this.entryValues = []
    this.seen = new Map<string, i32>()
    this.mergeMarks = []
  }

  /**
   * Clears `doc` and loads document `d` of `stream` into it. Nothing is kept
   * from a load that fails.
   *
   * @param stream The parsed stream, with the options it was parsed under; its `merge` decides whether `<<` keys merge.
   * @param d The document's 0-based index in `stream`.
   * @param doc Where the values go; cleared first, and cleared again when the load fails.
   * @returns The root value, or a negative code that is also in `failed`, with the range in
   *   `errorStart` and `errorEnd`.
   */
  load(stream: YamlStream, d: i32, doc: JsonDocument): JsonValue {
    this.stream = stream
    this.doc = doc
    this.failed = 0
    this.errorStart = -1
    this.errorEnd = -1
    this.entryTop = 0
    this.copying = -1
    this.byteCap = doc.tok.maxTotalBytes
    doc.clear()
    const origin: i32 = 0
    if (d < 0 || d >= stream.documentCount()) {
      return this.fail(YAML_JSON_ERR_DOCUMENT, origin, origin)
    }
    for (let i: i32 = 0; i < stream.diagnosticCount(); i += 1) {
      if (stream.diagnosticDocument(i) === d && !stream.diagnosticIsWarning(i)) {
        return this.fail(YAML_JSON_ERR_YAML, stream.diagnosticStart(i), stream.diagnosticEnd(i))
      }
    }
    const root: i32 = stream.documentRoot(d)
    if (root < 0) {
      const at: i32 = stream.documentStart(d) < 0 ? 0 : stream.documentStart(d)
      return this.nullAt(at)
    }
    const room: i32 = doc.maxValues < JSON_VALUE_MAX_VALUES ? doc.maxValues : JSON_VALUE_MAX_VALUES
    if (this.quickCount(this.firstNode(d), root, room) > room && this.count(root, room) > room) {
      if (this.bigAlias >= 0) {
        return this.fail(YAML_JSON_ERR_EXPANSION, stream.start(this.bigAlias), stream.end(this.bigAlias))
      }
      return this.fail(JSON_VALUE_ERR_VALUES, stream.start(root), stream.end(root))
    }
    this.mergeBudget = room + toI32(stream.kinds.length)
    return this.build(root, origin)
  }

  /** Records a failed load, clearing the document, and answers `code`. */
  private fail(code: i32, start: i32, end: i32): i32 {
    this.failed = code
    this.errorStart = start
    this.errorEnd = end
    this.entryTop = 0
    this.doc.clear()
    return code
  }

  /** `v`, given the range `[start, end)`, or the failure the document answers. */
  private ranged(v: JsonValue, start: i32, end: i32): JsonValue {
    if (v < 0) {
      return this.fail(v, start, end)
    }
    if (start < 0 || end < start) {
      return this.fail(JSON_VALUE_ERR_RANGE, start, end)
    }
    // `v` was just made, so its index is current: what `setRange` would check.
    this.doc.rangeAt(this.doc.index(v), start, end)
    return v
  }

  /** A null with the empty range at `at`. */
  private nullAt(at: i32): JsonValue {
    return this.ranged(this.doc.newNull(), at, at)
  }

  // ---- Counting ------------------------------------------------------------------

  /**
   * How many values node `root` expands to, saturating at `cap + 1`.
   * Each node is counted once and its count kept, on a stack of its own
   * rather than by recursion, because a chain of aliases can be as long as
   * the text. Sets `bigAlias`. Clears only the sizes the last count set, so a
   * stream of many documents is not cleared whole for each.
   */
  private count(root: i32, cap: i32): i32 {
    const stream: YamlStream = this.stream
    const nodes: i32 = toI32(stream.kinds.length)
    const sizes: i32[] = this.sizes
    while (toI32(sizes.length) < nodes) {
      sizes.push(0)
    }
    const counted: i32[] = this.counted
    for (let i: i32 = 0; i < this.countedTop && i < toI32(counted.length); i += 1) {
      const c: i32 = counted[i]
      if (c >= 0 && c < toI32(sizes.length)) {
        sizes[c] = 0
      }
    }
    this.countedTop = 0
    this.cap = cap
    this.bigAlias = -1
    this.bigSize = 0
    const pending: i32[] = this.pending
    let top: i32 = 0
    top = this.pushNode(top, root)
    while (top > 0) {
      const n: i32 = pending[top - 1]
      // A pushed node is in range; the test proves it to the bounds check.
      if (n < 0 || n >= toI32(sizes.length) || sizes[n] > 0) {
        top -= 1
      } else if (sizes[n] === 0) {
        // First visit: count the nodes it is made of first.
        sizes[n] = -1
        if (this.countedTop < toI32(counted.length)) {
          counted[this.countedTop] = n
        } else {
          counted.push(n)
        }
        this.countedTop += 1
        top = this.pushParts(top, n)
      } else {
        const size: i32 = this.sizeOf(n)
        if (n < toI32(sizes.length)) {
          sizes[n] = size
        }
        top -= 1
      }
    }
    return sizes[root]
  }

  /** The first node of document `d`: the one after the last earlier document's root. */
  private firstNode(d: i32): i32 {
    for (let e: i32 = d - 1; e >= 0; e -= 1) {
      const root: i32 = this.stream.documentRoot(e)
      if (root >= 0) {
        return root + 1
      }
    }
    return 0
  }

  /**
   * What `count(root, cap)` answers, found in one pass over nodes `lo` to
   * `root` when that is enough: the parser numbers a node after its parts and
   * an alias after its anchor, so each part's size is known when its node is
   * reached. A part outside that span (a cycle, or a node of another
   * document) counts as too many, so an answer over `cap` sends `load` to
   * `count`, which also finds the alias to blame. Sizes are kept apart from
   * `count`'s, and every one read was written by this pass, so none is cleared.
   */
  private quickCount(lo: i32, root: i32, cap: i32): i32 {
    const stream: YamlStream = this.stream
    const kinds: u8[] = stream.kinds
    const over: i32 = cap + 1
    if (lo < 0 || root < lo || root >= toI32(kinds.length) || root >= stream.top) {
      return over
    }
    const sizes: i32[] = this.quickSizes
    while (toI32(sizes.length) <= root) {
      sizes.push(0)
    }
    this.cap = cap
    const firsts: i32[] = stream.firsts
    const counts: i32[] = stream.counts
    const kids: i32[] = stream.kids
    const top: i32 = stream.top
    const merging: boolean = stream.merge
    for (let n: i32 = lo; n <= root && n < toI32(kinds.length); n += 1) {
      const kind: i32 = toI32(kinds[n])
      let total: i32 = 1
      if (kind === YAML_ALIAS) {
        total = this.quickPart(yamlJsonAt(firsts, n), lo, n)
      } else if (kind === YAML_SEQ || kind === YAML_MAP) {
        const from: i32 = yamlJsonAt(firsts, n)
        const parts: i32 = yamlJsonAt(counts, n)
        for (let i: i32 = 0; i < parts; i += 1) {
          const child: i32 = yamlJsonAt(kids, from + i)
          if (kind === YAML_SEQ) {
            total = this.plus(total, this.quickPart(child, lo, n))
          } else {
            // As `sizeOf` takes a merge's members in, less the merge itself;
            // read straight, as `stream.value` and `stream.key` read a pair.
            const pair: boolean =
              child >= 0 && child < top && child < toI32(kinds.length) && toI32(kinds[child]) === YAML_PAIR
            const value: i32 = pair ? yamlJsonAt(counts, child) : -1
            const merged: boolean = pair && merging && this.mergeShaped(yamlJsonAt(firsts, child))
            const part: i32 = this.quickPart(value, lo, n)
            let less: i32 = merged ? 1 : 0
            if (merged && stream.kind(stream.resolved(value)) === YAML_SEQ) {
              less += stream.count(stream.resolved(value))
            }
            total = part > cap ? over : this.plus(total, part - less)
          }
        }
      }
      if (n < toI32(sizes.length)) {
        sizes[n] = total
      }
    }
    return sizes[root]
  }

  /** Part `p`'s size in `quickCount` at node `n`: `1` for a missing node, too many for one outside `[lo, n)`. */
  private quickPart(p: i32, lo: i32, n: i32): i32 {
    if (p < 0) {
      return 1
    }
    if (p < lo || p >= n || p >= toI32(this.quickSizes.length)) {
      return this.cap + 1
    }
    return this.quickSizes[p]
  }

  /** Pushes node `n` onto the count's stack unless it is counted; answers the new top. */
  private pushNode(top: i32, n: i32): i32 {
    if (n < 0 || this.sizes[n] !== 0) {
      return top
    }
    if (top < toI32(this.pending.length)) {
      this.pending[top] = n
    } else {
      this.pending.push(n)
    }
    return top + 1
  }

  /** Pushes the nodes node `n`'s count is the sum of. */
  private pushParts(top: i32, n: i32): i32 {
    const stream: YamlStream = this.stream
    const kind: i32 = stream.kind(n)
    let t: i32 = top
    if (kind === YAML_ALIAS) {
      return this.pushNode(t, stream.resolved(n))
    }
    if (kind === YAML_SEQ) {
      for (let i: i32 = 0; i < stream.count(n); i += 1) {
        t = this.pushNode(t, stream.child(n, i))
      }
    } else if (kind === YAML_MAP) {
      for (let i: i32 = 0; i < stream.count(n); i += 1) {
        t = this.pushNode(t, stream.value(stream.child(n, i)))
      }
    }
    return t
  }

  /**
   * Node `n`'s count from its parts' counts, all of them kept by
   * now; a part still being counted is a cycle, which counts as too many.
   */
  private sizeOf(n: i32): i32 {
    const stream: YamlStream = this.stream
    const kind: i32 = stream.kind(n)
    if (kind === YAML_ALIAS) {
      const size: i32 = this.partSize(stream.resolved(n))
      if (size > this.bigSize) {
        this.bigAlias = n
        this.bigSize = size
      }
      return size
    }
    let total: i32 = 1
    if (kind === YAML_SEQ) {
      for (let i: i32 = 0; i < stream.count(n); i += 1) {
        total = this.plus(total, this.partSize(stream.child(n, i)))
      }
    } else if (kind === YAML_MAP) {
      for (let i: i32 = 0; i < stream.count(n); i += 1) {
        const pair: i32 = stream.child(n, i)
        const value: i32 = stream.value(pair)
        // A merged map's members join this one's; its own value is not one.
        const merged: boolean = this.isMergeKey(stream.key(pair))
        const part: i32 = this.partSize(value)
        let less: i32 = merged ? 1 : 0
        if (merged && stream.kind(stream.resolved(value)) === YAML_SEQ) {
          // A list of maps: the list itself is not one either, nor any map in it.
          less += stream.count(stream.resolved(value))
        }
        // A saturated part stays saturated: taking the adjustment off it
        // would bring a bomb back under the cap.
        total = part > this.cap ? this.cap + 1 : this.plus(total, part - less)
      }
    }
    return total
  }

  /** A counted part's size: `1` for a missing node, too many for one still being counted. */
  private partSize(n: i32): i32 {
    if (n < 0) {
      return 1
    }
    const size: i32 = this.sizes[n]
    return size < 0 ? this.cap + 1 : size
  }

  /** `a + b`, saturating at `cap + 1`; both are at most that, so the sum fits. */
  private plus(a: i32, b: i32): i32 {
    const sum: i32 = a + b
    return sum > this.cap ? this.cap + 1 : sum
  }

  // ---- Building ------------------------------------------------------------------

  /** Builds node `n`, nested `depth` collections deep, with `n`'s range on the value it answers. */
  private build(n: i32, depth: i32): JsonValue {
    const stream: YamlStream = this.stream
    // Read straight, as `kind` reads it, for the node every value starts from.
    const kinds: u8[] = stream.kinds
    const nodeKind: i32 = n >= 0 && n < stream.top && n < toI32(kinds.length) ? toI32(kinds[n]) : -1
    const at: i32 = nodeKind === YAML_ALIAS ? yamlJsonAt(stream.firsts, n) : n
    const kind: i32 = at === n ? nodeKind : stream.kind(at)
    let v: JsonValue = 0
    const outer: boolean = this.copying < 0 && nodeKind === YAML_ALIAS
    if (outer) {
      this.copying = n
    }
    if (kind === YAML_MAP || kind === YAML_SEQ) {
      if (depth >= this.maxDepth) {
        return this.fail(YAML_JSON_ERR_DEPTH, stream.start(n), stream.end(n))
      }
      v = kind === YAML_MAP ? this.buildMap(at, depth + 1) : this.buildSeq(at, depth + 1)
    } else {
      v = this.buildScalar(at)
      if (v >= 0 && this.doc.byteTop > this.byteCap) {
        return this.tooMuchText(n)
      }
    }
    if (outer) {
      this.copying = -1
    }
    if (v < 0) {
      // The failure is recorded already, with its own range.
      return this.failed < 0 ? v : this.fail(v, stream.start(n), stream.end(n))
    }
    return this.ranged(v, stream.start(n), stream.end(n))
  }

  /** The failure for text past `byteCap`, stored for node `n`. */
  private tooMuchText(n: i32): i32 {
    const stream: YamlStream = this.stream
    const a: i32 = this.copying
    if (a >= 0) {
      return this.fail(YAML_JSON_ERR_EXPANSION, stream.start(a), stream.end(a))
    }
    return this.fail(JSON_TOK_ERR_TOTAL_LIMIT, stream.start(n), stream.end(n))
  }

  /** A scalar's value, by its core-schema type. */
  private buildScalar(at: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    // A quoted or block scalar with no properties is a string, as `type`
    // would resolve it, with no tag to read; anything else asks `type`.
    const style: i32 = stream.style(at)
    if (style !== YAML_PLAIN && yamlJsonAt(stream.props, at) < 0) {
      const quotedAt: i32 = doc.byteTop
      return doc.newStoredString(quotedAt, this.storeScalar(at, style))
    }
    const type: i32 = stream.type(at)
    if (type === YAML_NULL) {
      return doc.newNull()
    }
    if (type === YAML_BOOL) {
      return doc.newBoolean(stream.boolValue(at))
    }
    if (type === YAML_INT || type === YAML_FLOAT) {
      const numberAt: i32 = doc.byteTop
      const stored: i32 = this.storeJsonNumber(at)
      if (stored >= 0) {
        return doc.newStoredNumber(numberAt, stored)
      }
      const text: string = yamlJsonNumber(stream.text(at))
      if (text === "") {
        return this.fail(YAML_JSON_ERR_NOT_FINITE, stream.start(at), stream.end(at))
      }
      if (text === "#") {
        return this.fail(YAML_JSON_ERR_NUMBER, stream.start(at), stream.end(at))
      }
      return doc.newNumber(text)
    }
    const textAt: i32 = doc.byteTop
    return doc.newStoredString(textAt, this.storeScalar(at, style))
  }

  /**
   * Stores scalar `at`'s decoded text in the document and answers its
   * length. A flow scalar with no break, and no `'` or `\\` when quoted, is
   * its own body, copied straight from the source in the scan that finds so.
   */
  private storeScalar(at: i32, style: i32): i32 {
    const stream: YamlStream = this.stream
    if (style === YAML_PLAIN || style === YAML_SINGLE_QUOTED || style === YAML_DOUBLE_QUOTED) {
      const firsts: i32[] = stream.firsts
      const counts: i32[] = stream.counts
      if (at >= 0 && at < toI32(firsts.length) && at < toI32(counts.length)) {
        let stop: i32 = -1
        if (style === YAML_SINGLE_QUOTED) {
          stop = YAML_JSON_SQUOTE
        } else if (style === YAML_DOUBLE_QUOTED) {
          stop = YAML_JSON_BACKSLASH
        }
        const n: i32 = this.doc.storeSpan(stream.source, firsts[at], counts[at], stop)
        if (n >= 0) {
          return n
        }
      }
    }
    return this.doc.storeText(stream.text(at))
  }

  /**
   * Stores number scalar `at` straight from its source when its text is
   * already the JSON spelling `yamlJsonNumber` would give it, and answers its
   * length; `-1`, with nothing stored, otherwise. That spelling is RFC 8259's
   * number grammar, less `-0`, which `yamlJsonNumber` writes as `0`.
   */
  private storeJsonNumber(at: i32): i32 {
    const stream: YamlStream = this.stream
    if (stream.style(at) !== YAML_PLAIN) {
      return -1
    }
    const source: string = stream.source
    const from: i32 = yamlJsonAt(stream.firsts, at)
    const to: i32 = yamlJsonAt(stream.counts, at)
    if (from < 0 || to <= from || to > toI32(source.length)) {
      return -1
    }
    let i: i32 = from
    if (toI32(source.charCodeAt(i)) === YAML_JSON_DASH) {
      i += 1
    }
    const lead: i32 = yamlJsonByte(source, i)
    if (lead === YAML_JSON_ZERO) {
      i += 1
      if (i === to && i - from === 2) {
        return -1
      }
    } else if (yamlJsonIsDigit(lead)) {
      i = yamlJsonDigits(source, i, to)
    } else {
      return -1
    }
    if (i < to && toI32(source.charCodeAt(i)) === YAML_JSON_DOT) {
      const fraction: i32 = yamlJsonDigits(source, i + 1, to)
      if (fraction === i + 1) {
        return -1
      }
      i = fraction
    }
    if (i < to && (toI32(source.charCodeAt(i)) | 32) === 101) {
      i += 1
      const sign: i32 = yamlJsonByte(source, i)
      if (i < to && (sign === YAML_JSON_PLUS || sign === YAML_JSON_DASH)) {
        i += 1
      }
      const exponent: i32 = yamlJsonDigits(source, i, to)
      if (exponent === i) {
        return -1
      }
      i = exponent
    }
    if (i !== to) {
      return -1
    }
    const noStop: i32 = -1
    return this.doc.storeSpan(source, from, to, noStop)
  }

  /** Stores key node `key`'s text, as `keyText` spells it, in the document and answers its length. */
  private storeKey(key: i32): i32 {
    const stream: YamlStream = this.stream
    if (stream.kind(key) === YAML_SCALAR) {
      const style: i32 = stream.style(key)
      if (yamlJsonAt(stream.props, key) < 0) {
        // Untagged, only a plain key that is empty or starts `~`, `n` or `N` can be a null.
        const start: i32 = stream.start(key)
        const c: i32 = yamlJsonByte(stream.source, start)
        if (
          style !== YAML_PLAIN ||
          (stream.end(key) > start &&
            c !== YAML_JSON_TILDE &&
            c !== YAML_JSON_LOWER_N &&
            c !== YAML_JSON_UPPER_N)
        ) {
          return this.storeScalar(key, style)
        }
      }
      return stream.type(key) === YAML_NULL ? 0 : this.storeScalar(key, style)
    }
    return this.doc.storeText(keyText(stream, key))
  }

  /** A sequence's array, each entry built in turn. */
  private buildSeq(at: i32, depth: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    const a: JsonValue = doc.newArray()
    if (a < 0) {
      return this.fail(a, stream.start(at), stream.end(at))
    }
    const ax: i32 = doc.index(a)
    const n: i32 = stream.count(at)
    doc.reserve(ax, n)
    // `at` is a seq, so its items are `kids[first, first + n)`, as `child` reads them.
    const kids: i32[] = stream.kids
    const first: i32 = yamlJsonAt(stream.firsts, at)
    for (let i: i32 = 0; i < n; i += 1) {
      const c: i32 = yamlJsonAt(kids, first + i)
      const v: JsonValue = c < 0 ? this.nullAt(stream.end(at)) : this.build(c, depth)
      if (v < 0) {
        return v
      }
      // `v` was just made, so it is in no container: what `push` would check.
      doc.append(ax, doc.index(v), YAML_JSON_NO_WORD, YAML_JSON_NO_WORD)
    }
    return a
  }

  /**
   * A map's object. A map with no merge key, in a stream whose parser
   * reported every repeated key, is its own pairs in order (`buildOwnMap`).
   * Otherwise its members are gathered first, own keys then merged ones, with
   * repeats settled; then each value is built and added.
   */
  private buildMap(at: i32, depth: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    const pairs: i32 = stream.count(at)
    let own: boolean = stream.uniqueKeys
    let merges: boolean = false
    const kids: i32[] = stream.kids
    const first: i32 = yamlJsonAt(stream.firsts, at)
    for (let i: i32 = 0; i < pairs; i += 1) {
      const key: i32 = stream.key(yamlJsonAt(kids, first + i))
      if (key < 0) {
        own = false
      } else if (this.mergeShaped(key)) {
        own = false
        merges = merges || stream.merge
      }
    }
    if (own) {
      return this.buildOwnMap(at, pairs, depth)
    }
    const base: i32 = this.entryTop
    // Clearing costs the table's capacity, which a large map leaves behind.
    if (this.seen.size > 0) {
      this.seen.clear()
    }
    for (let i: i32 = 0; i < stream.count(at); i += 1) {
      const pair: i32 = stream.child(at, i)
      if (!this.isMergeKey(stream.key(pair)) && this.addEntry(base, pair, true) < 0) {
        return this.failed
      }
    }
    if (merges) {
      const outer: i32 = 0
      this.newMergeStamp()
      this.markMerged(at)
      if (this.mergeInto(base, at, outer) < 0) {
        return this.failed
      }
    }
    const top: i32 = this.entryTop
    const o: JsonValue = doc.newObject()
    if (o < 0) {
      return this.fail(o, stream.start(at), stream.end(at))
    }
    const ox: i32 = doc.index(o)
    doc.reserve(ox, top - base)
    for (let e: i32 = base; e < top; e += 1) {
      const pair: i32 = this.entryPairs[e]
      const valueNode: i32 = this.entryValues[e]
      const v: JsonValue = valueNode < 0 ? this.nullAt(stream.end(pair)) : this.build(valueNode, depth)
      if (v < 0) {
        return v
      }
      const key: string = this.entryKeys[e]
      const keyAt: i32 = doc.byteTop
      const keyNode: i32 = stream.key(pair)
      // `key` is `keyText(keyNode)`, which `storeKey` spells from the node without the copy.
      const keyLength: i32 = keyNode < 0 ? doc.storeText(key) : this.storeKey(keyNode)
      const slot: i32 = doc.append(ox, doc.index(v), keyAt, keyLength)
      if (doc.byteTop > this.byteCap) {
        return this.tooMuchText(keyNode < 0 ? pair : keyNode)
      }
      const keyStart: i32 = keyNode < 0 ? stream.start(pair) : stream.start(keyNode)
      const keyEnd: i32 = keyNode < 0 ? keyStart : stream.end(keyNode)
      if (this.keyRange(slot, keyStart, keyEnd) < 0) {
        return this.failed
      }
    }
    this.entryTop = base
    return o
  }

  /**
   * Map `at`'s object when its `pairs` pairs are all its members: no
   * merge key, and no two keys alike, which the parser has reported under
   * `uniqueKeys` (a document with an error never loads). Each key is
   * stored from its node as `keyText` spells it, after its value is built.
   */
  private buildOwnMap(at: i32, pairs: i32, depth: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    const o: JsonValue = doc.newObject()
    if (o < 0) {
      return this.fail(o, stream.start(at), stream.end(at))
    }
    const ox: i32 = doc.index(o)
    doc.reserve(ox, pairs)
    // `buildMap` found every pair's key, so each child is a pair, whose key
    // and value are its `firsts` and `counts`, as `key` and `value` read them.
    const kids: i32[] = stream.kids
    const firsts: i32[] = stream.firsts
    const counts: i32[] = stream.counts
    const first: i32 = yamlJsonAt(firsts, at)
    for (let i: i32 = 0; i < pairs; i += 1) {
      const pair: i32 = yamlJsonAt(kids, first + i)
      const valueNode: i32 = yamlJsonAt(counts, pair)
      const v: JsonValue = valueNode < 0 ? this.nullAt(stream.end(pair)) : this.build(valueNode, depth)
      if (v < 0) {
        return v
      }
      const keyNode: i32 = yamlJsonAt(firsts, pair)
      const keyAt: i32 = doc.byteTop
      const slot: i32 = doc.append(ox, doc.index(v), keyAt, this.storeKey(keyNode))
      if (doc.byteTop > this.byteCap) {
        return this.tooMuchText(keyNode)
      }
      if (this.keyRange(slot, stream.start(keyNode), stream.end(keyNode)) < 0) {
        return this.failed
      }
    }
    return o
  }

  /** Gives member slot `slot` the key range `[start, end)`; a negative answer is the failure, recorded. */
  private keyRange(slot: i32, start: i32, end: i32): i32 {
    if (start < 0 || end < start) {
      return this.fail(JSON_VALUE_ERR_RANGE, start, end)
    }
    this.doc.keyRangeAt(slot, start, end)
    return 0
  }

  /**
   * Adds the merge keys' maps of map `at` to the entries from
   * `base`, each key only if it is not there yet: every map a merge key
   * names, in order, its own keys first and then its merge keys', `hops` deep.
   */
  private mergeInto(base: i32, at: i32, hops: i32): i32 {
    const stream: YamlStream = this.stream
    for (let i: i32 = 0; i < stream.count(at); i += 1) {
      const pair: i32 = stream.child(at, i)
      if (this.isMergeKey(stream.key(pair))) {
        if (hops >= YAML_JSON_MERGE_HOPS) {
          return this.fail(YAML_JSON_ERR_DEPTH, stream.start(pair), stream.end(pair))
        }
        const value: i32 = stream.value(pair)
        const source: i32 = stream.resolved(value)
        if (source >= 0 && stream.kind(source) === YAML_MAP) {
          if (this.mergeMap(base, pair, source, hops + 1) < 0) {
            return this.failed
          }
        } else if (source >= 0 && stream.kind(source) === YAML_SEQ) {
          // The walk itself is charged, since its items may all be merged already.
          this.mergeBudget -= stream.count(source)
          if (this.mergeBudget < 0) {
            return this.fail(YAML_JSON_ERR_EXPANSION, stream.start(pair), stream.end(pair))
          }
          for (let j: i32 = 0; j < stream.count(source); j += 1) {
            const item: i32 = stream.child(source, j)
            const m: i32 = stream.resolved(item)
            if (m < 0 || stream.kind(m) !== YAML_MAP) {
              const bad: i32 = item < 0 ? value : item
              return this.fail(YAML_JSON_ERR_MERGE, stream.start(bad), stream.end(bad))
            }
            if (this.mergeMap(base, pair, m, hops + 1) < 0) {
              return this.failed
            }
          }
        } else {
          const bad: i32 = value < 0 ? pair : value
          return this.fail(YAML_JSON_ERR_MERGE, stream.start(bad), stream.end(bad))
        }
      }
    }
    return 0
  }

  /**
   * Merges map `m`'s own keys, then its merge keys' maps, for the
   * merge key `pair`; nothing if `m` is merged into this map already, since
   * a second merge would find every key taken.
   */
  private mergeMap(base: i32, pair: i32, m: i32, hops: i32): i32 {
    const stream: YamlStream = this.stream
    if (!this.markMerged(m)) {
      return 0
    }
    this.mergeBudget -= stream.count(m) + 1
    if (this.mergeBudget < 0) {
      return this.fail(YAML_JSON_ERR_EXPANSION, stream.start(pair), stream.end(pair))
    }
    for (let i: i32 = 0; i < stream.count(m); i += 1) {
      const own: i32 = stream.child(m, i)
      if (!this.isMergeKey(stream.key(own)) && this.addEntry(base, own, false) < 0) {
        return this.failed
      }
    }
    return this.mergeInto(base, m, hops)
  }

  /** Starts a map's merges, so no node is marked as merged into it yet. */
  private newMergeStamp(): void {
    const nodes: i32 = toI32(this.stream.kinds.length)
    const marks: i32[] = this.mergeMarks
    while (toI32(marks.length) < nodes) {
      marks.push(0)
    }
    this.mergeStamp += 1
    if (this.mergeStamp >= JSON_VALUE_MAX_VALUES) {
      // Far past any one load: start the stamps over rather than let them wrap.
      for (let i: i32 = 0; i < toI32(marks.length); i += 1) {
        marks[i] = 0
      }
      this.mergeStamp = 1
    }
  }

  /** Marks node `n` as merged into the current map; `false` if it already was. */
  private markMerged(n: i32): boolean {
    const marks: i32[] = this.mergeMarks
    if (n < 0 || n >= toI32(marks.length) || marks[n] === this.mergeStamp) {
      return false
    }
    marks[n] = this.mergeStamp
    return true
  }

  /**
   * Adds pair `pair` to the entries of the map from `base`. A key
   * already there is skipped for a merged pair; for an own pair it follows
   * the document's `duplicates`, keeping the first key and its place.
   */
  private addEntry(base: i32, pair: i32, own: boolean): i32 {
    const stream: YamlStream = this.stream
    const keyNode: i32 = stream.key(pair)
    const key: string = keyNode < 0 ? "" : keyText(stream, keyNode)
    const found: i32 = this.findEntry(base, key)
    if (found >= 0) {
      if (!own) {
        return 0
      }
      if (this.doc.duplicates !== JSON_VALUE_DUPLICATE_LAST) {
        const start: i32 = keyNode < 0 ? stream.start(pair) : stream.start(keyNode)
        return this.fail(JSON_VALUE_ERR_DUPLICATE, start, keyNode < 0 ? start : stream.end(keyNode))
      }
      this.entryValues[found] = stream.value(pair)
      return 0
    }
    const e: i32 = this.entryTop
    if (e < toI32(this.entryPairs.length)) {
      this.entryKeys[e] = key
      this.entryPairs[e] = pair
      this.entryValues[e] = stream.value(pair)
    } else {
      this.entryKeys.push(key)
      this.entryPairs.push(pair)
      this.entryValues.push(stream.value(pair))
    }
    this.entryTop = e + 1
    if (e - base >= YAML_JSON_SCAN_KEYS) {
      this.seen.set(key, e)
    }
    return 0
  }

  /**
   * The entry from `base` whose key is `key`, or `-1`. The first
   * `YAML_JSON_SCAN_KEYS` are compared one by one; the rest are in `seen`.
   */
  private findEntry(base: i32, key: string): i32 {
    const top: i32 = this.entryTop
    const scanned: i32 = top - base < YAML_JSON_SCAN_KEYS ? top : base + YAML_JSON_SCAN_KEYS
    for (let e: i32 = base; e < scanned; e += 1) {
      if (this.entryKeys[e] === key) {
        return e
      }
    }
    if (top - base <= YAML_JSON_SCAN_KEYS) {
      return -1
    }
    const e: i32 | undefined = this.seen.get(key)
    return e ?? -1
  }

  /**
   * Whether `key` is a merge key, as the stream reads one: a plain
   * `<<`, untagged or `!!merge`, while the stream merges. Keep in step with
   * `yamlIsMergeKey` in `std/yaml.ts`, which is not exported.
   */
  private isMergeKey(key: i32): boolean {
    return this.stream.merge && this.mergeShaped(key)
  }

  /**
   * Whether `key` is shaped as a merge key, whatever `stream.merge` now
   * says: the parser checked repeats with the flag as it was then, so a map
   * holding one is not a map of unique keys.
   */
  private mergeShaped(key: i32): boolean {
    const stream: YamlStream = this.stream
    if (key < 0) {
      return false
    }
    // Almost every key is turned away by its length or its first byte; the
    // length is read first, so an empty key at the end of the text is not
    // read past.
    const start: i32 = stream.start(key)
    if (
      start < 0 ||
      stream.end(key) !== start + 2 ||
      start + 2 > toI32(stream.source.length) ||
      toI32(stream.source.charCodeAt(start)) !== YAML_JSON_LT ||
      toI32(stream.source.charCodeAt(start + 1)) !== YAML_JSON_LT ||
      stream.kind(key) !== YAML_SCALAR ||
      stream.style(key) !== YAML_PLAIN
    ) {
      return false
    }
    const tag: string = stream.tag(key)
    return tag === "" || tag === "merge"
  }
}

/** `a[i]`, or `-1` outside it, as `YamlStream`'s accessors read their arrays. */
const yamlJsonAt = (a: i32[], i: i32): i32 => (i >= 0 && i < toI32(a.length) ? a[i] : -1)

// ---- Numbers ---------------------------------------------------------------------

/**
 * The JSON spelling of a core-schema number's text: `""` for `.inf`, `-.inf`
 * and `.nan`, `"#"` for a `0x` or `0o` integer longer than
 * `YAML_JSON_MAX_RADIX_DIGITS` digits.
 */
const yamlJsonNumber = (text: string): string => {
  const n: i32 = toI32(text.length)
  let i: i32 = 0
  let sign: string = ""
  const first: i32 = yamlJsonByte(text, 0)
  if (first === YAML_JSON_PLUS || first === YAML_JSON_DASH) {
    sign = first === YAML_JSON_DASH ? "-" : ""
    i = 1
  }
  if (yamlJsonByte(text, i) === YAML_JSON_DOT && !yamlJsonIsDigit(yamlJsonByte(text, i + 1))) {
    return ""
  }
  const x: i32 = yamlJsonByte(text, i + 1)
  if (yamlJsonByte(text, i) === YAML_JSON_ZERO && (x === 120 || x === 111)) {
    if (n - i - 2 > YAML_JSON_MAX_RADIX_DIGITS) {
      return "#"
    }
    const digits: string = yamlJsonRadix(text, i + 2, x === 120 ? 16 : 8)
    return digits === "0" ? "0" : `${sign}${digits}`
  }
  // Decimal: the whole part without its leading zeros, then the rest as it is.
  let whole: i32 = i
  while (whole < n && yamlJsonIsDigit(yamlJsonByte(text, whole))) {
    whole += 1
  }
  let lead: i32 = i
  while (lead + 1 < whole && yamlJsonByte(text, lead) === YAML_JSON_ZERO) {
    lead += 1
  }
  const wholeDigits: string = whole === i ? "0" : text.substring(lead, whole)
  if (whole === n) {
    return wholeDigits === "0" ? "0" : `${sign}${wholeDigits}`
  }
  let rest: string = text.substring(whole, n)
  if (yamlJsonByte(text, whole) === YAML_JSON_DOT && !yamlJsonIsDigit(yamlJsonByte(text, whole + 1))) {
    // `1.` and `1.e5`: a fraction JSON needs at least one digit of.
    rest = `.0${text.substring(whole + 1, n)}`
  }
  return `${sign}${wholeDigits}${rest}`
}

/** `text[from, end)`, digits in `base` 16 or 8, written in decimal: four digits a limb, the lowest first. */
const yamlJsonRadix = (text: string, from: i32, base: i32): string => {
  const limbs: i32[] = [0]
  for (let i: i32 = from; i < toI32(text.length); i += 1) {
    let carry: i32 = yamlJsonHexValue(yamlJsonByte(text, i))
    for (let l: i32 = 0; l < toI32(limbs.length); l += 1) {
      const x: i32 = limbs[l] * base + carry
      limbs[l] = x % YAML_JSON_LIMB
      carry = x / YAML_JSON_LIMB
    }
    if (carry > 0) {
      limbs.push(carry)
    }
  }
  const top: i32 = toI32(limbs.length) - 1
  const parts: string[] = [`${limbs[top]}`]
  for (let l: i32 = top - 1; l >= 0 && l < toI32(limbs.length); l -= 1) {
    const limb: string = `${limbs[l]}`
    parts.push(`${"000".substring(0, 4 - toI32(limb.length))}${limb}`)
  }
  return parts.join("")
}

const yamlJsonByte = (text: string, i: i32): i32 =>
  i >= 0 && i < toI32(text.length) ? toI32(text.charCodeAt(i)) : -1

const yamlJsonIsDigit = (c: i32): boolean => c >= YAML_JSON_ZERO && c <= 57

/** The end of the run of decimal digits in `text[from, to)` that starts at `from`. */
const yamlJsonDigits = (text: string, from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i < to && yamlJsonIsDigit(yamlJsonByte(text, i))) {
    i += 1
  }
  return i
}

/** A hex digit's value; the text is the stream's, already checked to be digits of its base. */
const yamlJsonHexValue = (c: i32): i32 => {
  if (c >= YAML_JSON_ZERO && c <= 57) {
    return c - YAML_JSON_ZERO
  }
  return (c | 32) - 87
}
