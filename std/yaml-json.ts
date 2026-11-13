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
 * `loadText(text, d, doc)` parses `text` and does the same with no second
 * walk of the node tree, about 7% fewer instructions when nothing else
 * needs the stream; its values, ranges and refusals are `load(parseYaml(text), d,
 * doc)`'s, and it falls back to `load` for any document it cannot build in
 * one sweep (a refusal, a merge it cannot copy, an alias to a later node).
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
  JSON_VALUE_ERR_VALUES,
  JSON_VALUE_MAX_VALUES,
  JsonDocument,
  JsonValue,
} from "nish/json-value"
import {
  YAML_ALIAS,
  YAML_BOOL,
  YAML_FLOAT,
  YAML_INT,
  YAML_MAP,
  YAML_NULL,
  YAML_PAIR,
  YAML_PLAIN,
  YAML_SCALAR,
  YAML_SEQ,
  YamlStream,
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

/** `loadText`'s marks on a node: not built, with all it holds; not built itself; a merge key's pair. */
const YAML_JSON_SKIP: i32 = 1
const YAML_JSON_SKIP_SELF: i32 = 2
const YAML_JSON_MERGE_PAIR: i32 = 4

/** The decimal limb `yamlJsonRadix` works in: four digits, so a limb times 16 plus a carry fits an `i32`. */
const YAML_JSON_LIMB: i32 = 10000

const YAML_JSON_PLUS: i32 = 43
const YAML_JSON_DASH: i32 = 45
const YAML_JSON_DOT: i32 = 46
const YAML_JSON_ZERO: i32 = 48
const YAML_JSON_LT: i32 = 60

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
  /** Each entry's key range, beside `entryKeys`, for `loadText`. */
  private entryStarts: i32[]
  private entryEnds: i32[]
  /**
   * `loadText`'s facts per node of the document, from its first node: what
   * `sweep` skips (`YAML_JSON_SKIP*`), and what the node expands to, as
   * `load` would build it: its value count, how many collections deep it
   * nests, the merged pairs it charges, how many merge keys deep it merges.
   */
  private flags: i32[]
  private totals: i32[]
  private heights: i32[]
  private charges: i32[]
  private chains: i32[]
  /** Per node, the value `sweep` built for it (`-1` for none). */
  private values: i32[]
  /** Per map node `sweep` built, where its keys start in `memberKeys`. */
  private memberBase: i32[]
  private memberKeys: string[]
  private memberTop: i32 = 0

  /** A loader that holds collections to `JSON_WRITER_MAX_DEPTH`, so whatever it loads can be written back out. */
  constructor() {
    this.maxDepth = JSON_WRITER_MAX_DEPTH
    this.stream = parseYaml("")
    this.doc = new JsonDocument(new JsonLimits())
    this.sizes = []
    this.counted = []
    this.pending = []
    this.entryKeys = []
    this.entryPairs = []
    this.entryValues = []
    this.seen = new Map<string, i32>()
    this.mergeMarks = []
    this.entryStarts = []
    this.entryEnds = []
    this.flags = []
    this.totals = []
    this.heights = []
    this.charges = []
    this.chains = []
    this.values = []
    this.memberBase = []
    this.memberKeys = []
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
    if (this.count(root, room) > room) {
      if (this.bigAlias >= 0) {
        return this.fail(YAML_JSON_ERR_EXPANSION, stream.start(this.bigAlias), stream.end(this.bigAlias))
      }
      return this.fail(JSON_VALUE_ERR_VALUES, stream.start(root), stream.end(root))
    }
    this.mergeBudget = room + toI32(stream.kinds.length)
    return this.build(root, origin)
  }

  /**
   * Parses `text` and loads its document `d` into `doc`: the same values,
   * ranges and refusals as `load(parseYaml(text), d, doc)`.
   *
   * @param text The YAML text, parsed with the default options.
   * @param d The document's 0-based index in the text.
   * @param doc Where the values go; cleared first, and cleared again when the load fails.
   * @returns The root value, or a negative code that is also in `failed`, with the range in
   *   `errorStart` and `errorEnd`.
   */
  loadText(text: string, d: i32, doc: JsonDocument): JsonValue {
    const stream: YamlStream = parseYaml(text)
    const v: JsonValue = this.sweep(stream, d, doc)
    if (v >= 0) {
      this.failed = 0
      this.errorStart = -1
      this.errorEnd = -1
      return v
    }
    return this.load(stream, d, doc)
  }

  // ---- The direct load -------------------------------------------------------------

  /**
   * Document `d` built in one pass over its nodes, children before the
   * collection that holds them, as the stream numbers them: each collection
   * is built once, an alias is a copy of what its anchor built, and a merged
   * member a copy of the member the merged map holds. `-1` when the load is
   * not one this pass is sure to build exactly as `load` would: any refusal,
   * and any document within reach of a limit, counted the way `load` counts
   * it or more. `loadText` then runs `load`, which answers the refusal.
   */
  private sweep(stream: YamlStream, d: i32, doc: JsonDocument): JsonValue {
    this.stream = stream
    this.doc = doc
    this.entryTop = 0
    this.memberTop = 0
    this.byteCap = doc.tok.maxTotalBytes
    doc.clear()
    if (d < 0 || d >= stream.documentCount()) {
      return -1
    }
    for (let i: i32 = 0; i < stream.diagnosticCount(); i += 1) {
      if (stream.diagnosticDocument(i) === d && !stream.diagnosticIsWarning(i)) {
        return -1
      }
    }
    const root: i32 = stream.documentRoot(d)
    if (root < 0) {
      return -1
    }
    let lo: i32 = 0
    for (let e: i32 = d - 1; e >= 0; e -= 1) {
      const r: i32 = stream.documentRoot(e)
      if (r >= 0) {
        lo = r + 1
        break
      }
    }
    const room: i32 = doc.maxValues < JSON_VALUE_MAX_VALUES ? doc.maxValues : JSON_VALUE_MAX_VALUES
    this.cap = room
    const budget: i32 = room + toI32(stream.kinds.length)
    if (lo > root || !this.markSkips(lo, root)) {
      return -1
    }
    for (let n: i32 = lo; n <= root; n += 1) {
      if (!this.sweepNode(n, budget)) {
        return -1
      }
    }
    const v: JsonValue = this.valueOf(root, 0)
    return doc.byteTop > this.byteCap ? -1 : v
  }

  /**
   * Readies the per-node arrays for nodes `lo` to `root` and marks what
   * `sweep` does not build: every key, with all it holds, since a key is its
   * text; and a merge key's sequence, whose maps are merged, not held. Visits
   * a collection before what it holds, which the stream numbers lower.
   * `false` when a node holds one numbered outside `[lo, itself)`.
   */
  private markSkips(lo: i32, root: i32): boolean {
    const stream: YamlStream = this.stream
    const nodes: i32 = toI32(stream.kinds.length)
    const flags: i32[] = this.flags
    while (toI32(flags.length) < nodes) {
      flags.push(0)
      this.totals.push(0)
      this.heights.push(0)
      this.charges.push(0)
      this.chains.push(0)
      this.values.push(-1)
      this.memberBase.push(0)
    }
    for (let n: i32 = lo; n <= root && n < nodes; n += 1) {
      flags[n] = 0
    }
    for (let n: i32 = root; n >= lo && n < nodes; n -= 1) {
      const kind: i32 = stream.kind(n)
      const skip: i32 = flags[n] & YAML_JSON_SKIP
      if (kind === YAML_MAP || kind === YAML_SEQ) {
        for (let i: i32 = 0; i < stream.count(n); i += 1) {
          const c: i32 = stream.child(n, i)
          if (c >= n || (c >= 0 && c < lo)) {
            return false
          }
          if (c >= 0) {
            flags[c] |= skip
          }
        }
      } else if (kind === YAML_PAIR) {
        const k: i32 = stream.key(n)
        const v: i32 = stream.value(n)
        if (k >= n || v >= n || (k >= 0 && k < lo) || (v >= 0 && v < lo)) {
          return false
        }
        if (k >= 0) {
          flags[k] |= YAML_JSON_SKIP
        }
        if (this.isMergeKey(k)) {
          flags[n] |= YAML_JSON_MERGE_PAIR
          if (v >= 0 && skip === 0 && stream.kind(v) === YAML_SEQ) {
            flags[v] |= YAML_JSON_SKIP_SELF
          }
        }
        if (v >= 0) {
          flags[v] |= skip
        }
      }
    }
    return true
  }

  /**
   * Node `n`'s counts, from those of the nodes it holds, and its value
   * when it is a collection `sweep` builds; `false` when one of the counts
   * reaches a limit, or the value cannot be built.
   */
  private sweepNode(n: i32, budget: i32): boolean {
    const stream: YamlStream = this.stream
    const kind: i32 = stream.kind(n)
    if (kind === YAML_SCALAR) {
      this.totals[n] = 1
      this.heights[n] = 0
      this.charges[n] = 0
      this.chains[n] = 0
      return true
    }
    if (kind === YAML_ALIAS) {
      const r: i32 = stream.resolved(n)
      if (r < 0 || r >= n || stream.kind(r) === YAML_ALIAS || stream.kind(r) === YAML_PAIR) {
        return false
      }
      this.totals[n] = this.totals[r]
      this.heights[n] = this.heights[r]
      this.charges[n] = this.charges[r]
      this.chains[n] = this.chains[r]
      return true
    }
    if (kind === YAML_SEQ) {
      let size: i32 = 1
      let height: i32 = 0
      let charge: i32 = 0
      for (let i: i32 = 0; i < stream.count(n); i += 1) {
        const c: i32 = stream.child(n, i)
        size += c < 0 ? 1 : this.totals[c]
        if (c >= 0) {
          height = height > this.heights[c] ? height : this.heights[c]
          charge += this.charges[c]
        }
        if (size > this.cap || charge > budget) {
          return false
        }
      }
      this.totals[n] = size
      this.heights[n] = height + 1
      this.charges[n] = charge
      this.chains[n] = 0
    } else if (kind === YAML_MAP) {
      if (!this.mapCounts(n, budget)) {
        return false
      }
    } else {
      return true
    }
    if (this.heights[n] > this.maxDepth) {
      return false
    }
    if ((this.flags[n] & (YAML_JSON_SKIP | YAML_JSON_SKIP_SELF)) !== 0) {
      return true
    }
    const v: JsonValue = kind === YAML_MAP ? this.sweepMap(n) : this.sweepSeq(n)
    this.values[n] = v
    return v >= 0 && this.doc.byteTop <= this.byteCap
  }

  /**
   * Map `n`'s counts. Its size is `sizeOf`'s; its height, charge and merge
   * chain are at least what `load` reaches building it, which may stop
   * short of them where an own key hides a merged one, or a map is merged
   * twice.
   */
  private mapCounts(n: i32, budget: i32): boolean {
    const stream: YamlStream = this.stream
    let size: i32 = 1
    let height: i32 = 0
    let charge: i32 = 0
    let chain: i32 = -1
    for (let i: i32 = 0; i < stream.count(n); i += 1) {
      const pair: i32 = stream.child(n, i)
      const value: i32 = stream.value(pair)
      const part: i32 = value < 0 ? 1 : this.totals[value]
      if ((this.flags[pair] & YAML_JSON_MERGE_PAIR) === 0) {
        size += part
        if (value >= 0) {
          height = height > this.heights[value] ? height : this.heights[value]
          charge += this.charges[value]
        }
      } else {
        const source: i32 = value < 0 ? -1 : stream.resolved(value)
        const sourceKind: i32 = stream.kind(source)
        if (sourceKind === YAML_MAP) {
          size += part - 1
          charge += this.mergeCharge(source)
          height = height > this.heights[source] - 1 ? height : this.heights[source] - 1
          chain = chain > this.chains[source] ? chain : this.chains[source]
        } else if (sourceKind === YAML_SEQ) {
          size += part - 1 - stream.count(source)
          charge += stream.count(source)
          for (let j: i32 = 0; j < stream.count(source); j += 1) {
            const m: i32 = stream.resolved(stream.child(source, j))
            if (stream.kind(m) !== YAML_MAP) {
              return false
            }
            charge += this.mergeCharge(m)
            height = height > this.heights[m] - 1 ? height : this.heights[m] - 1
            chain = chain > this.chains[m] ? chain : this.chains[m]
            if (charge > budget) {
              return false
            }
          }
        } else {
          return false
        }
      }
      if (size > this.cap || charge > budget) {
        return false
      }
    }
    this.totals[n] = size
    this.heights[n] = height + 1
    this.charges[n] = charge
    this.chains[n] = chain + 1
    return chain + 1 < YAML_JSON_MERGE_HOPS
  }

  /** What merging map `m` charges to `load`'s merge budget, at most. */
  private mergeCharge(m: i32): i32 {
    return this.stream.count(m) + 1 + this.charges[m]
  }

  /** Sequence `n`'s array, its entries built or copied. */
  private sweepSeq(n: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    const items: i32 = stream.count(n)
    const base: i32 = this.entryTop
    for (let i: i32 = 0; i < items; i += 1) {
      const v: JsonValue = this.valueOf(stream.child(n, i), stream.end(n))
      if (v < 0) {
        return -1
      }
      this.pushEntry(-1, "", v, 0, 0)
    }
    this.entryTop = base
    const a: JsonValue = doc.newArray()
    if (a < 0) {
      return -1
    }
    const ax: i32 = doc.index(a)
    doc.reserve(ax, items)
    for (let e: i32 = base; e < base + items; e += 1) {
      doc.append(ax, doc.index(this.entryValues[e]), 0, 0)
    }
    doc.placeRange(ax, stream.start(n), stream.end(n))
    return a
  }

  /**
   * Map `n`'s object: its own keys, in order, then each merged map's
   * members it does not have yet, copied, the first map listed winning. A
   * merged map's members are its own keys and then those it merged, so
   * taking them in that order is `mergeInto`'s walk, which skips a map
   * merged already: every key under that map is taken by then.
   */
  private sweepMap(n: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    const base: i32 = this.entryTop
    if (this.seen.size > 0) {
      this.seen.clear()
    }
    for (let i: i32 = 0; i < stream.count(n); i += 1) {
      const pair: i32 = stream.child(n, i)
      if ((this.flags[pair] & YAML_JSON_MERGE_PAIR) === 0) {
        const keyNode: i32 = stream.key(pair)
        const key: string = keyNode < 0 ? "" : stream.keyName(keyNode)
        if (this.findEntry(base, key) >= 0) {
          return -1
        }
        const v: JsonValue = this.valueOf(stream.value(pair), stream.end(pair))
        if (v < 0) {
          return -1
        }
        const keyStart: i32 = keyNode < 0 ? stream.start(pair) : stream.start(keyNode)
        this.pushEntry(base, key, v, keyStart, keyNode < 0 ? keyStart : stream.end(keyNode))
      }
    }
    for (let i: i32 = 0; i < stream.count(n); i += 1) {
      const pair: i32 = stream.child(n, i)
      if ((this.flags[pair] & YAML_JSON_MERGE_PAIR) !== 0) {
        const source: i32 = stream.resolved(stream.value(pair))
        if (stream.kind(source) === YAML_MAP) {
          if (!this.mergeMembers(base, source)) {
            return -1
          }
        } else {
          for (let j: i32 = 0; j < stream.count(source); j += 1) {
            if (!this.mergeMembers(base, stream.resolved(stream.child(source, j)))) {
              return -1
            }
          }
        }
      }
    }
    const top: i32 = this.entryTop
    this.entryTop = base
    const o: JsonValue = doc.newObject()
    if (o < 0) {
      return -1
    }
    const ox: i32 = doc.index(o)
    doc.reserve(ox, top - base)
    this.memberBase[n] = this.memberTop
    for (let e: i32 = base; e < top; e += 1) {
      const key: string = this.entryKeys[e]
      doc.append(ox, doc.index(this.entryValues[e]), doc.byteTop, doc.storeText(key))
      doc.placeKeyRange(doc.memberSlot(ox, e - base), this.entryStarts[e], this.entryEnds[e])
      if (this.memberTop < toI32(this.memberKeys.length)) {
        this.memberKeys[this.memberTop] = key
      } else {
        this.memberKeys.push(key)
      }
      this.memberTop += 1
    }
    doc.placeRange(ox, stream.start(n), stream.end(n))
    return o
  }

  /** Copies the members of map `m`'s object that the entries from `base` do not have. */
  private mergeMembers(base: i32, m: i32): boolean {
    const doc: JsonDocument = this.doc
    const o: JsonValue = this.values[m]
    if (o < 0) {
      return false
    }
    const keys: i32 = this.memberBase[m]
    for (let i: i32 = 0; i < doc.length(o); i += 1) {
      const key: string = this.memberKeys[keys + i]
      if (this.findEntry(base, key) < 0) {
        const v: JsonValue = doc.copyMember(o, i)
        if (v < 0) {
          return false
        }
        this.pushEntry(base, key, v, doc.keyStart(o, i), doc.keyEnd(o, i))
      }
    }
    return true
  }

  /**
   * Adds an entry: its key, the value made for it, and the key's range;
   * indexed in `seen` past the first `YAML_JSON_SCAN_KEYS` from `base`,
   * unless `base` is `-1`.
   */
  private pushEntry(base: i32, key: string, v: JsonValue, keyStart: i32, keyEnd: i32): void {
    const e: i32 = this.entryTop
    if (e < toI32(this.entryStarts.length)) {
      this.entryKeys[e] = key
      this.entryValues[e] = v
      this.entryStarts[e] = keyStart
      this.entryEnds[e] = keyEnd
    } else {
      while (toI32(this.entryKeys.length) < e) {
        this.entryKeys.push("")
        this.entryPairs.push(-1)
        this.entryValues.push(-1)
      }
      if (e < toI32(this.entryKeys.length)) {
        this.entryKeys[e] = key
        this.entryValues[e] = v
      } else {
        this.entryKeys.push(key)
        this.entryPairs.push(-1)
        this.entryValues.push(v)
      }
      this.entryStarts.push(keyStart)
      this.entryEnds.push(keyEnd)
    }
    this.entryTop = e + 1
    if (base >= 0 && e - base >= YAML_JSON_SCAN_KEYS) {
      this.seen.set(key, e)
    }
  }

  /**
   * The value of node `c` where it is held, a missing one being a null at
   * `at`: a scalar built, a collection's value, or an alias's copy with the
   * alias's range. `-1` when it cannot be made.
   */
  private valueOf(c: i32, at: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    if (c < 0) {
      const v: JsonValue = doc.newNull()
      if (v >= 0) {
        doc.placeRange(doc.index(v), at, at)
      }
      return v < 0 ? -1 : v
    }
    const r: i32 = stream.resolved(c)
    const kind: i32 = stream.kind(r)
    let v: JsonValue = -1
    if (kind === YAML_SCALAR) {
      v = this.buildScalar(r)
      if (v >= 0) {
        doc.placeRange(doc.index(v), stream.start(c), stream.end(c))
      }
    } else if (r === c) {
      return this.values[c]
    } else if (this.values[r] >= 0) {
      v = doc.copyValue(this.values[r], stream.start(c), stream.end(c))
    }
    return v < 0 || doc.byteTop > this.byteCap ? -1 : v
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
    const code: i32 = this.doc.setRange(v, start, end)
    return code < 0 ? this.fail(code, start, end) : v
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
    const at: i32 = stream.resolved(n)
    const kind: i32 = stream.kind(at)
    let v: JsonValue = 0
    const outer: boolean = this.copying < 0 && stream.kind(n) === YAML_ALIAS
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
    const type: i32 = stream.type(at)
    if (type === YAML_NULL) {
      return doc.newNull()
    }
    if (type === YAML_BOOL) {
      return doc.newBoolean(stream.boolValue(at))
    }
    if (type === YAML_INT || type === YAML_FLOAT) {
      const text: string = yamlJsonNumber(stream.text(at))
      if (text === "") {
        return this.fail(YAML_JSON_ERR_NOT_FINITE, stream.start(at), stream.end(at))
      }
      if (text === "#") {
        return this.fail(YAML_JSON_ERR_NUMBER, stream.start(at), stream.end(at))
      }
      return doc.newNumber(text)
    }
    return doc.newString(stream.text(at))
  }

  /** A sequence's array, each entry built in turn. */
  private buildSeq(at: i32, depth: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
    const a: JsonValue = doc.newArray()
    if (a < 0) {
      return this.fail(a, stream.start(at), stream.end(at))
    }
    for (let i: i32 = 0; i < stream.count(at); i += 1) {
      const c: i32 = stream.child(at, i)
      const v: JsonValue = c < 0 ? this.nullAt(stream.end(at)) : this.build(c, depth)
      if (v < 0) {
        return v
      }
      const code: i32 = doc.push(a, v)
      if (code < 0) {
        return this.fail(code, stream.start(at), stream.end(at))
      }
    }
    return a
  }

  /**
   * A map's object. Its members are gathered first, own keys then
   * merged ones, with repeats settled; then each value is built and added.
   */
  private buildMap(at: i32, depth: i32): JsonValue {
    const stream: YamlStream = this.stream
    const doc: JsonDocument = this.doc
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
    const outer: i32 = 0
    this.newMergeStamp()
    this.markMerged(at)
    if (this.mergeInto(base, at, outer) < 0) {
      return this.failed
    }
    const top: i32 = this.entryTop
    const o: JsonValue = doc.newObject()
    if (o < 0) {
      return this.fail(o, stream.start(at), stream.end(at))
    }
    const ox: i32 = doc.index(o)
    for (let e: i32 = base; e < top; e += 1) {
      const pair: i32 = this.entryPairs[e]
      const valueNode: i32 = this.entryValues[e]
      const v: JsonValue = valueNode < 0 ? this.nullAt(stream.end(pair)) : this.build(valueNode, depth)
      if (v < 0) {
        return v
      }
      const key: string = this.entryKeys[e]
      const keyAt: i32 = doc.byteTop
      doc.append(ox, doc.index(v), keyAt, doc.storeText(key))
      const keyNode: i32 = stream.key(pair)
      if (doc.byteTop > this.byteCap) {
        return this.tooMuchText(keyNode < 0 ? pair : keyNode)
      }
      const keyStart: i32 = keyNode < 0 ? stream.start(pair) : stream.start(keyNode)
      const keyEnd: i32 = keyNode < 0 ? keyStart : stream.end(keyNode)
      const code: i32 = doc.setKeyRange(o, e - base, keyStart, keyEnd)
      if (code < 0) {
        return this.fail(code, keyStart, keyEnd)
      }
    }
    this.entryTop = base
    return o
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
    const key: string = keyNode < 0 ? "" : stream.keyName(keyNode)
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
   * `<<`, untagged or `!!merge`. Keep in step with `yamlIsMergeKey` in
   * `std/yaml.ts`, which is not exported.
   */
  private isMergeKey(key: i32): boolean {
    const stream: YamlStream = this.stream
    if (!stream.merge || key < 0 || stream.kind(key) !== YAML_SCALAR || stream.style(key) !== YAML_PLAIN) {
      return false
    }
    const start: i32 = stream.start(key)
    if (
      stream.end(key) !== start + 2 ||
      toI32(stream.source.charCodeAt(start)) !== YAML_JSON_LT ||
      toI32(stream.source.charCodeAt(start + 1)) !== YAML_JSON_LT
    ) {
      return false
    }
    const tag: string = stream.tag(key)
    return tag === "" || tag === "merge"
  }
}

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

/** A hex digit's value; the text is the stream's, already checked to be digits of its base. */
const yamlJsonHexValue = (c: i32): i32 => {
  if (c >= YAML_JSON_ZERO && c <= 57) {
    return c - YAML_JSON_ZERO
  }
  return (c | 32) - 87
}
