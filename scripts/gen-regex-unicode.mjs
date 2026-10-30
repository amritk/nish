#!/usr/bin/env node
/**
 * Generate the Unicode tables of `std/regex.ts` and the oracle its tests read.
 *
 *   node scripts/gen-regex-unicode.mjs           rewrite the tables and the oracle
 *   node scripts/gen-regex-unicode.mjs --check   exit 1 if either differs by a byte, or if
 *                                                a table disagrees with this Node's RegExp
 *
 * The tables are the region of `std/regex.ts` between the
 * `gen-regex-unicode:begin` and `gen-regex-unicode:end` lines. They are read
 * from the Unicode Character Database files below, each pinned by its URL and
 * sha256 and cached under `build/ucd/`, at the Unicode version the ICU of the
 * Node that CI pins ships (`process.versions.unicode`), so that `--check` can
 * hold every table to that Node's `RegExp` with the `u` flag, code point by
 * code point. The region lives inside `regex.ts` rather than in a module of
 * its own because a file under `std/` is a public `nish/` module, listed as
 * one by the compiler and the release.
 *
 * **A range list** is a string of base-32 digits, each one byte `0` (48) to
 * `o` (111): a digit of 32 or more is a continuation carrying its low five
 * bits, most significant first, and one below 32 ends the number. A list is
 * its count of ranges, then per range the gap since the last one ended (the
 * first range's start; for later ones `lo - prevHi - 2`, since ranges never
 * touch) and its length less one. The lists are concatenated into
 * `REGEX_PROPERTY_DATA`, an identical list stored once.
 *
 * **The name index** `REGEX_PROPERTY_NAMES` is `|key=offset|…`, the key a
 * namespace letter and a name as ECMA-262 spells it, case and all: `g` a
 * General_Category value (alias or long name, groups such as `L` included),
 * `b` a binary property, `s` a Script value, whose entry is the Script list's
 * offset, a comma and the Script_Extensions list's. An offset starting `~`
 * names the complement of the list there.
 *
 * **The fold table** `REGEX_FOLD_DATA` is CaseFolding.txt's simple folding
 * (statuses C and S) as orbits, the sets of code points that fold to the same
 * one, kept to their members above ASCII: the ASCII letters fold by their own
 * table and nothing crosses into it, so ſ (U+017F) and the Kelvin sign
 * (U+212A) do not match `s` or `k`. An orbit left with fewer than two members
 * is dropped. It is, per member by code point, the gap since the last
 * member and the zigzag-coded step to the next member of its orbit, the last
 * member stepping back to the first; the step is doubled, plus one in an
 * orbit of two, whose walk then ends without reading the table again.
 * **The fold runs** `REGEX_FOLD_SPANS` are the same code points as maximal runs, at a fixed
 * width so `regexCompile` can binary-search them without reading the fold
 * table: a class with no folding code point, or none in its gaps, such as
 * `\S` under `i`, then never decodes it. **The fold index** `REGEX_FOLD_INDEX`
 * holds, per block of `FOLD_BLOCK` members, the first member and the offset
 * of its step, so `regexCompile` reads only the block a code point falls in
 * rather than decoding the table.
 *
 * **The oracle** `tests/link/std_regex_unicode/oracle.ts` is what this
 * Node's `RegExp` answers over the sample text the test builds: per property,
 * the runs `\p{…}+` finds, as a count and a digest of their byte offsets; per
 * folded code point, the same for the code point under `iu`.
 */
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "std", "regex.ts")
const oracleFile = path.join(root, "tests", "link", "std_regex_unicode", "oracle.ts")
const cacheDir = path.join(root, "build", "ucd")

const UNICODE_VERSION = "16.0.0"
const UCD = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`
/** Each file the tables read, and its sha256. */
const FILES = {
  "CaseFolding.txt": "6f1f9c588eb4a5c718d9e8f93b782685e5c7fec872cf05e8e6878053599e09bb",
  "DerivedCoreProperties.txt": "39d35161f2954497f69e08bdb9e701493f476a3d30222de20028feda36c1dabd",
  "DerivedNormalizationProps.txt": "4d4c03892dea9146d674b686e495df2d55a28d071ac474041d73518f887abddc",
  "PropList.txt": "53d614508e2a0b2305a8aa21cd60d993de9326cdf65993660dfcce4503548583",
  "PropertyAliases.txt": "33a9f2266ad6b8e8de05c0ea3dfac411ac62cf8839ff1c94057471e4c5f6a2b3",
  "PropertyValueAliases.txt": "440fd3e5460b9bfe31da67b6f923992e1989d31fe2ed91e091c4b8f8e2620bf9",
  "ScriptExtensions.txt": "049117ce26b9769fe2749b06eef51a50a89faef4a97764dd2d81daa715980700",
  "Scripts.txt": "9e88f0a677df47311106340be8ede2ecdacd9c1c931831218d2be6d5508e0039",
  "emoji/emoji-data.txt": "f1365a5173eee18e1f98b240cdc492e84a25f1ce7e0c9d1094eb29c41a22696a",
  "extracted/DerivedBinaryProperties.txt": "1ed4d4791c0e34fcad4dfcb5dd4c4122e16428241b75452f05d780ffa661f89d",
  "extracted/DerivedGeneralCategory.txt": "7676ab755a41ef82108460238569e60ad65c191ddafe61b36c6765ec1353f293",
}

/** ECMA-262's table of binary Unicode properties, by long name; `Any`, `ASCII` and `Assigned` are its own. */
const BINARY = [
  "ASCII",
  "ASCII_Hex_Digit",
  "Alphabetic",
  "Any",
  "Assigned",
  "Bidi_Control",
  "Bidi_Mirrored",
  "Case_Ignorable",
  "Cased",
  "Changes_When_Casefolded",
  "Changes_When_Casemapped",
  "Changes_When_Lowercased",
  "Changes_When_NFKC_Casefolded",
  "Changes_When_Titlecased",
  "Changes_When_Uppercased",
  "Dash",
  "Default_Ignorable_Code_Point",
  "Deprecated",
  "Diacritic",
  "Emoji",
  "Emoji_Component",
  "Emoji_Modifier",
  "Emoji_Modifier_Base",
  "Emoji_Presentation",
  "Extended_Pictographic",
  "Extender",
  "Grapheme_Base",
  "Grapheme_Extend",
  "Hex_Digit",
  "IDS_Binary_Operator",
  "IDS_Trinary_Operator",
  "ID_Continue",
  "ID_Start",
  "Ideographic",
  "Join_Control",
  "Logical_Order_Exception",
  "Lowercase",
  "Math",
  "Noncharacter_Code_Point",
  "Pattern_Syntax",
  "Pattern_White_Space",
  "Quotation_Mark",
  "Radical",
  "Regional_Indicator",
  "Sentence_Terminal",
  "Soft_Dotted",
  "Terminal_Punctuation",
  "Unified_Ideograph",
  "Uppercase",
  "Variation_Selector",
  "White_Space",
  "XID_Continue",
  "XID_Start",
]

/** The General_Category groups, as the values they are the union of. */
const GROUPS = {
  C: ["Cc", "Cf", "Cn", "Co", "Cs"],
  L: ["Ll", "Lm", "Lo", "Lt", "Lu"],
  LC: ["Ll", "Lt", "Lu"],
  M: ["Mc", "Me", "Mn"],
  N: ["Nd", "Nl", "No"],
  P: ["Pc", "Pd", "Pe", "Pf", "Pi", "Po", "Ps"],
  S: ["Sc", "Sk", "Sm", "So"],
  Z: ["Zl", "Zp", "Zs"],
}

/** Script values ECMA-262 lists but no character has, which V8 refuses. */
const NO_SCRIPT = new Set(["Hrkt"])

const MAX_CP = 0x10ffff

// ---- The UCD files --------------------------------------------------------------

const readUcd = async (name) => {
  const file = path.join(cacheDir, UNICODE_VERSION, name)
  let bytes = fs.existsSync(file) ? fs.readFileSync(file) : null
  if (bytes === null) {
    const res = await fetch(`${UCD}/${name}`)
    if (!res.ok) {
      throw new Error(`gen-regex-unicode: ${UCD}/${name}: HTTP ${res.status}`)
    }
    bytes = Buffer.from(await res.arrayBuffer())
  }
  const sum = createHash("sha256").update(bytes).digest("hex")
  if (sum !== FILES[name]) {
    throw new Error(`gen-regex-unicode: ${name} has sha256 ${sum}, not the pinned ${FILES[name]}`)
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, bytes)
  return bytes.toString("utf8")
}

/** The data lines of a UCD file, split on `;` and trimmed, comments dropped. */
const records = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line !== "")
    .map((line) => line.split(";").map((f) => f.trim()))

/** `XXXX` or `XXXX..YYYY` as [lo, hi]. */
const span = (field) => {
  const [lo, hi] = field.split("..")
  return [Number.parseInt(lo, 16), Number.parseInt(hi ?? lo, 16)]
}

// ---- Sets of code points, as sorted, merged [lo, hi] lists ----------------------

const normalize = (ranges) => {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out = []
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1]
    if (last && lo <= last[1] + 1) {
      last[1] = Math.max(last[1], hi)
    } else {
      out.push([lo, hi])
    }
  }
  return out
}

const complement = (ranges) => {
  const out = []
  let from = 0
  for (const [lo, hi] of ranges) {
    if (lo > from) {
      out.push([from, lo - 1])
    }
    from = hi + 1
  }
  if (from <= MAX_CP) {
    out.push([from, MAX_CP])
  }
  return out
}

/** The ranges of every two-field record, grouped by the second field. */
const byValue = (text) => {
  const map = new Map()
  for (const f of records(text)) {
    if (f.length !== 2) {
      continue
    }
    if (!map.has(f[1])) {
      map.set(f[1], [])
    }
    map.get(f[1]).push(span(f[0]))
  }
  return map
}

// ---- The encoding ---------------------------------------------------------------

const DIGIT0 = 48
/** The members of `REGEX_FOLD_DATA` per entry of `REGEX_FOLD_INDEX`. */
const FOLD_BLOCK = 16

const varint = (v) => {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`gen-regex-unicode: cannot encode ${v}`)
  }
  const digits = [v & 31]
  let rest = v >>> 5
  while (rest > 0) {
    digits.unshift(32 + (rest & 31))
    rest >>>= 5
  }
  return String.fromCharCode(...digits.map((d) => DIGIT0 + d))
}

const encodeList = (ranges) => {
  let s = varint(ranges.length)
  let prev = -2
  ranges.forEach(([lo, hi], i) => {
    s += varint(i === 0 ? lo : lo - prev - 2) + varint(hi - lo)
    prev = hi
  })
  return s
}

const zigzag = (v) => (v >= 0 ? v * 2 : -v * 2 - 1)

/** A JavaScript string literal of `s`, which holds only bytes 48 to 111. */
const literal = (s) => `"${s.replaceAll("\\", "\\\\")}"`

// ---- Reading the database ------------------------------------------------------

const load = async () => {
  const text = {}
  for (const name of Object.keys(FILES)) {
    text[name] = await readUcd(name)
  }

  // Aliases: per property short name, its value aliases; and binary property aliases.
  const propAliases = new Map()
  for (const f of records(text["PropertyAliases.txt"])) {
    propAliases.set(f[1], f)
  }
  const valueAliases = new Map()
  for (const f of records(text["PropertyValueAliases.txt"])) {
    if (!valueAliases.has(f[0])) {
      valueAliases.set(f[0], [])
    }
    valueAliases.get(f[0]).push(f.slice(1))
  }

  const gc = byValue(text["extracted/DerivedGeneralCategory.txt"])
  const binarySources = [
    byValue(text["PropList.txt"]),
    byValue(text["DerivedCoreProperties.txt"]),
    byValue(text["emoji/emoji-data.txt"]),
    byValue(text["extracted/DerivedBinaryProperties.txt"]),
    byValue(text["DerivedNormalizationProps.txt"]),
  ]
  const binary = new Map()
  for (const name of BINARY) {
    let ranges = null
    if (name === "Any") {
      ranges = [[0, MAX_CP]]
    } else if (name === "ASCII") {
      ranges = [[0, 127]]
    } else if (name === "Assigned") {
      ranges = null
    } else {
      for (const src of binarySources) {
        if (src.has(name)) {
          ranges = normalize(src.get(name))
        }
      }
      if (ranges === null) {
        throw new Error(`gen-regex-unicode: no file lists ${name}`)
      }
    }
    binary.set(name, ranges)
  }

  // General_Category: each value, then the groups.
  const gcSets = new Map()
  for (const [value, ranges] of gc) {
    gcSets.set(value, normalize(ranges))
  }
  for (const [group, members] of Object.entries(GROUPS)) {
    gcSets.set(group, normalize(members.flatMap((m) => gcSets.get(m))))
  }

  // Script: listed values, then Unknown (Zzzz) as everything unlisted.
  const scriptLong = new Map()
  for (const v of valueAliases.get("sc")) {
    scriptLong.set(v[1], v[0])
  }
  const scRaw = byValue(text["Scripts.txt"])
  const sc = new Map()
  for (const [long, ranges] of scRaw) {
    sc.set(scriptLong.get(long), normalize(ranges))
  }
  sc.set("Zzzz", complement(normalize([...sc.values()].flat())))
  // Script_Extensions: a code point listed in ScriptExtensions.txt has those
  // scripts; any other has its Script.
  const scxOf = new Map()
  for (const f of records(text["ScriptExtensions.txt"])) {
    const [lo, hi] = span(f[0])
    for (let c = lo; c <= hi; c++) {
      scxOf.set(c, f[1].split(/\s+/))
    }
  }
  const scx = new Map()
  for (const [short, ranges] of sc) {
    const extra = []
    for (const [c, list] of scxOf) {
      if (list.includes(short)) {
        extra.push([c, c])
      }
    }
    const kept = []
    for (const [lo, hi] of ranges) {
      for (let c = lo; c <= hi; c++) {
        if (!scxOf.has(c)) {
          kept.push([c, c])
        }
      }
    }
    scx.set(short, normalize([...kept, ...extra]))
  }

  // Simple case folding, as orbits of code points above ASCII.
  const foldTo = new Map()
  for (const f of records(text["CaseFolding.txt"])) {
    if (f[1] === "C" || f[1] === "S") {
      foldTo.set(Number.parseInt(f[0], 16), Number.parseInt(f[2], 16))
    }
  }
  const orbitOf = new Map()
  for (const [c, t] of foldTo) {
    if (!orbitOf.has(t)) {
      orbitOf.set(t, new Set([t]))
    }
    orbitOf.get(t).add(c)
  }
  const orbits = []
  for (const set of orbitOf.values()) {
    const members = [...set].filter((c) => c >= 128).sort((a, b) => a - b)
    if (members.length >= 2) {
      orbits.push(members)
    }
  }

  return { propAliases, valueAliases, binary, gcSets, sc, scx, orbits }
}

// ---- The tables -----------------------------------------------------------------

/** Every name a `\p{…}` may use, as [key, set, how] where `how` is `g`, `b` or `s`. */
const names = (db) => {
  const out = []
  for (const v of db.valueAliases.get("gc")) {
    // [short, long, ...more]
    const set = db.gcSets.get(v[0])
    for (const alias of new Set(v)) {
      out.push({ key: `g${alias}`, gc: v[0], set })
    }
  }
  for (const name of BINARY) {
    const aliases = new Set([name])
    for (const f of db.propAliases.values()) {
      if (f[1] === name) {
        for (const a of f) {
          aliases.add(a)
        }
      }
    }
    for (const alias of aliases) {
      out.push({ key: `b${alias}`, binary: name })
    }
  }
  for (const v of db.valueAliases.get("sc")) {
    if (NO_SCRIPT.has(v[0])) {
      continue
    }
    for (const alias of new Set(v)) {
      out.push({ key: `s${alias}`, script: v[0] })
    }
  }
  return out
}

const tables = (db) => {
  let data = ""
  const at = new Map()
  const offset = (ranges) => {
    const enc = encodeList(ranges)
    if (!at.has(enc)) {
      at.set(enc, data.length)
      data += enc
    }
    return at.get(enc)
  }
  const cn = db.gcSets.get("Cn")
  let index = "|"
  for (const n of names(db)) {
    let value = ""
    if (n.gc !== undefined) {
      value = `${offset(n.set)}`
    } else if (n.binary !== undefined) {
      const set = db.binary.get(n.binary)
      value = set === null ? `~${offset(cn)}` : `${offset(set)}`
    } else {
      value = `${offset(db.sc.get(n.script))},${offset(db.scx.get(n.script))}`
    }
    index += `${n.key}=${value}|`
  }
  const members = db.orbits
    .flatMap((o) => o.map((c, i) => [c, o[(i + 1) % o.length], o.length === 2 ? 1 : 0]))
    .sort((a, b) => a[0] - b[0])
  let fold = ""
  let prev = 0
  // Per block of `FOLD_BLOCK` members, the first member and where its step starts.
  const blocks = []
  members.forEach(([c, to, pair], k) => {
    fold += varint(c - prev)
    if (k % FOLD_BLOCK === 0) {
      blocks.push([c, fold.length])
    }
    fold += varint(zigzag(to - c) * 2 + pair)
    prev = c
  })
  // The folding code points as maximal runs, each end four base-32 digits.
  const runs = []
  for (const [c] of members) {
    if (runs.length > 0 && runs[runs.length - 1][1] === c - 1) {
      runs[runs.length - 1][1] = c
    } else {
      runs.push([c, c])
    }
  }
  const fixed = (v) => {
    if (v >= 1 << 20) {
      throw new Error(`gen-regex-unicode: ${v} needs more than four digits`)
    }
    return String.fromCharCode(...[15, 10, 5, 0].map((b) => DIGIT0 + ((v >>> b) & 31)))
  }
  const spans = runs.map(([lo, hi]) => fixed(lo) + fixed(hi)).join("")
  const foldIndex = blocks.map(([first, stepAt]) => fixed(first) + fixed(stepAt)).join("")
  return { index, data, fold, spans, foldIndex }
}

// ---- The region ----------------------------------------------------------------

const BEGIN = "// gen-regex-unicode:begin"
const END = "// gen-regex-unicode:end"

const region = (t) =>
  [
    `${BEGIN} -- generated by scripts/gen-regex-unicode.mjs; edit that, not this.`,
    `/** \`\\p{…}\` names, \`|key=offset|\`; the key is \`g\`, \`b\` or \`s\` and the name (Unicode ${UNICODE_VERSION}). */`,
    "const REGEX_PROPERTY_NAMES: string =",
    `  ${literal(t.index)}`,
    "/** The range lists `REGEX_PROPERTY_NAMES` points into, in base-32 digits from `0`. */",
    "const REGEX_PROPERTY_DATA: string =",
    `  ${literal(t.data)}`,
    "/** Simple case folding above ASCII: per member of an orbit, its gap and the zigzag step to the next member, doubled, plus one in a pair. */",
    "const REGEX_FOLD_DATA: string =",
    `  ${literal(t.fold)}`,
    "/** The code points `REGEX_FOLD_DATA` folds, as runs: per run its first and last, four base-32 digits each. */",
    "const REGEX_FOLD_SPANS: string =",
    `  ${literal(t.spans)}`,
    `/** Per block of ${FOLD_BLOCK} members in \`REGEX_FOLD_DATA\`, the first and where its step starts, four base-32 digits each. */`,
    "const REGEX_FOLD_INDEX: string =",
    `  ${literal(t.foldIndex)}`,
    END,
  ].join("\n")

// ---- The oracle ----------------------------------------------------------------

/**
 * The sample text's code points, as the test builds them: every code point
 * up to U+323AF and from U+E0000 to U+E01EF, one in 251 of the rest and the
 * plane edges in `EDGES`, less the surrogates and the four ASCII letters
 * whose folding crosses ASCII (`s`, `S`, `k` and `K`), which would join ſ and
 * the Kelvin sign to their neighbours' runs.
 */
const SKIP = new Set([0x53, 0x73, 0x4b, 0x6b])
// The ends of the unassigned run after plane 3, of planes 4 to 13, of plane
// 14's tags and of the private-use planes 15 and 16, with their noncharacters.
const EDGES = new Set([
  0x323b0, 0x3fffe, 0x3ffff, 0x40000, 0xdfffe, 0xdffff, 0xe01f0, 0xefffe, 0xeffff, 0xf0000, 0xffffd, 0xffffe,
  0xfffff, 0x100000, 0x10fffd, 0x10fffe, 0x10ffff,
])
// `\w`, `\b` and `\B` under `i` around ſ and the Kelvin sign, which are word
// characters there, and a shorthand before a folded atom above ASCII.
const WORD_TEXT = "aſ ſa \u212a k\u212ab s_ſ é É aÉ ſ\u212a -ſ- x"
const WORD_PATTERNS = [
  "\\w+",
  "\\W+",
  "[\\w]+",
  "[^\\w]+",
  "\\b.",
  ".\\b",
  "\\B.",
  ".\\B",
  "\\b\\w+\\b",
  "\\wé",
  "\\Wé",
]
const sample = () => {
  const out = []
  for (let c = 0; c <= MAX_CP; c++) {
    const dense = c <= 0x323af || (c >= 0xe0000 && c <= 0xe01ef)
    if ((dense || c % 251 === 0 || EDGES.has(c)) && !(c >= 0xd800 && c <= 0xdfff) && !SKIP.has(c)) {
      out.push(c)
    }
  }
  return out
}

const utf8Width = (c) => {
  if (c < 0x80) {
    return 1
  }
  if (c < 0x800) {
    return 2
  }
  return c < 0x10000 ? 3 : 4
}

/** The runs of consecutive code points that `test` accepts: [count, digest]. */
const digestRuns = (cps, test) => {
  let count = 0
  let digest = 0
  let off = 0
  let start = -1
  const close = (end) => {
    count += 1
    digest = (Math.imul(digest, 31) + start * 7 + end) | 0
    start = -1
  }
  for (const c of cps) {
    if (test(c)) {
      if (start < 0) {
        start = off
      }
    } else if (start >= 0) {
      close(off)
    }
    off += utf8Width(c)
  }
  if (start >= 0) {
    close(off)
  }
  return [count, digest]
}

/** What Node's `RegExp` says of each name and fold, over the sample text. */
const oracle = (db, cps) => {
  const props = []
  for (const n of names(db)) {
    const ns = n.key[0]
    const name = n.key.slice(1)
    const sources = ns === "s" ? [`Script=${name}`, `scx=${name}`] : [name]
    for (const src of sources) {
      const re = new RegExp(`^\\p{${src}}$`, "u")
      const [count, digest] = digestRuns(cps, (c) => re.test(String.fromCodePoint(c)))
      props.push(`  "${src} ${count} ${digest}",`)
    }
  }
  // Under `i`, a sample of property and range classes, and each folded code point.
  const folds = []
  const iClasses = [
    "\\p{Lu}",
    "\\p{Ll}",
    "\\P{Ll}",
    "\\P{Lu}",
    "[^\\P{Ll}]",
    "[^\\P{Lu}]",
    "\\p{Script=Greek}",
    "[\\u{100}-\\u{17e}]",
    "[^\\p{Lt}]",
    "[\\u{80}-\\u{10ffff}]",
    "\\S",
    "\\w",
    "\\W",
    "[\\w]",
    "[\\W]",
    "\\D",
  ]
  for (const cls of iClasses) {
    const re = new RegExp(`^${cls}$`, "iu")
    // Nothing folds across ASCII but `\w` and `\W`, so ſ and the Kelvin sign
    // meet every other class as they are, as under `u` alone.
    const across = /\\[wW]/.test(cls) ? re : new RegExp(`^${cls}$`, "u")
    const test = (c) => (c === 0x17f || c === 0x212a ? across : re).test(String.fromCodePoint(c))
    const [count, digest] = digestRuns(cps, test)
    folds.push(`  "${cls.replaceAll("\\", "\\\\")} ${count} ${digest}",`)
  }
  const foldText = db.orbits.flat().sort((a, b) => a - b)
  const lits = []
  for (const c of foldText) {
    const re = new RegExp(`^\\u{${c.toString(16)}}$`, "iu")
    const [count, digest] = digestRuns(foldText, (d) => re.test(String.fromCodePoint(d)))
    lits.push(`  "${c} ${count} ${digest}",`)
  }
  // Patterns under `i` over `WORD_TEXT`: the runs `exec` finds one after another.
  const words = []
  for (const src of WORD_PATTERNS) {
    const re = new RegExp(src, "giu")
    let count = 0
    let digest = 0
    let m = re.exec(WORD_TEXT)
    while (m !== null) {
      const start = Buffer.byteLength(WORD_TEXT.slice(0, m.index))
      const end = start + Buffer.byteLength(m[0])
      count += 1
      digest = (Math.imul(digest, 31) + start * 7 + end) | 0
      m = re.exec(WORD_TEXT)
    }
    words.push(`  "${src.replaceAll("\\", "\\\\")} ${count} ${digest}",`)
  }
  return [
    "// Generated by scripts/gen-regex-unicode.mjs from this Node's RegExp; do not edit.",
    `// Unicode ${UNICODE_VERSION}. Each row is a name, pattern or code point, the number of runs it matches and their digest.`,
    "",
    "/** Per `\\p{…}` name: the runs `\\p{name}+` finds in the sample text, and their digest. */",
    "export const propertyRows = (): string[] => [",
    ...props,
    "]",
    "",
    "/** Per class under `i`: the same, over the sample text. */",
    "export const foldClassRows = (): string[] => [",
    ...folds,
    "]",
    "",
    "/** The text the word rows run over. */",
    `export const wordText = (): string => "${WORD_TEXT}"`,
    "",
    "/** Per pattern under `i`: the runs it finds in `wordText`, one after another. */",
    "export const wordRows = (): string[] => [",
    ...words,
    "]",
    "",
    "/** Every code point that folds to another above ASCII, in order. */",
    "export const foldCodePoints = (): i32[] => [",
    ...foldText.map((c) => `  ${c},`),
    "]",
    "",
    "/** Per folded code point: the same for the code point under `i`, over the text of `foldCodePoints`. */",
    "export const foldCharRows = (): string[] => [",
    ...lits,
    "]",
    "",
  ].join("\n")
}

// ---- Checking against Node -----------------------------------------------------

const checkNode = (db) => {
  if (process.versions.unicode !== UNICODE_VERSION.replace(/\.0$/, "")) {
    throw new Error(
      `gen-regex-unicode: this Node has Unicode ${process.versions.unicode}, not ${UNICODE_VERSION}`
    )
  }
  const bad = []
  const compare = (src, ranges, negate) => {
    let re = null
    try {
      re = new RegExp(`^\\p{${src}}$`, "u")
    } catch {
      bad.push(`\\p{${src}}: Node refuses it`)
      return
    }
    let i = 0
    for (let c = 0; c <= MAX_CP; c++) {
      while (i < ranges.length && ranges[i][1] < c) {
        i++
      }
      const ours = (i < ranges.length && ranges[i][0] <= c) !== negate
      if (ours !== re.test(String.fromCodePoint(c))) {
        bad.push(`\\p{${src}} at U+${c.toString(16)}`)
        return
      }
    }
  }
  for (const n of names(db)) {
    const name = n.key.slice(1)
    if (n.gc !== undefined) {
      compare(name, n.set, false)
    } else if (n.binary !== undefined) {
      const set = db.binary.get(n.binary)
      compare(name, set ?? db.gcSets.get("Cn"), set === null)
    } else {
      compare(`Script=${name}`, db.sc.get(n.script), false)
      compare(`scx=${name}`, db.scx.get(n.script), false)
    }
  }
  // A General_Category or Script alias is ours exactly when Node accepts it.
  for (const [prop, ns] of [
    ["gc", "g"],
    ["sc", "s"],
  ]) {
    const ours = new Set(
      names(db)
        .filter((n) => n.key[0] === ns)
        .map((n) => n.key.slice(1))
    )
    for (const alias of db.valueAliases.get(prop).flat()) {
      let accepted = true
      try {
        new RegExp(`\\p{${prop === "gc" ? alias : `Script=${alias}`}}`, "u")
      } catch {
        accepted = false
      }
      if (accepted !== ours.has(alias)) {
        bad.push(`${prop}=${alias}: Node ${accepted ? "accepts" : "refuses"} it and the tables do not`)
      }
    }
  }
  // Folding: every orbit member matches exactly its orbit's members above ASCII under `iu`.
  for (const o of db.orbits) {
    for (const c of o) {
      const re = new RegExp(`^\\u{${c.toString(16)}}$`, "iu")
      for (const d of o) {
        if (!re.test(String.fromCodePoint(d))) {
          bad.push(`U+${c.toString(16)} does not fold to U+${d.toString(16)}`)
        }
      }
    }
  }
  const folded = new Set(db.orbits.flat())
  for (let c = 128; c <= MAX_CP; c++) {
    if (folded.has(c) || c === 0x17f || c === 0x212a || (c >= 0xd800 && c <= 0xdfff)) {
      continue
    }
    const s = String.fromCodePoint(c)
    if (s.toLowerCase() !== s && new RegExp(`^\\u{${c.toString(16)}}$`, "iu").test(s.toLowerCase())) {
      bad.push(`U+${c.toString(16)} folds in Node but has no orbit`)
    }
  }
  return bad
}

// ---- Main -----------------------------------------------------------------------

const ucd = await load()
const built = tables(ucd)
const source = fs.readFileSync(target, "utf8")
const begin = source.indexOf(BEGIN)
const regionEnd = source.indexOf(END)
if (begin < 0 || regionEnd < begin) {
  throw new Error(`gen-regex-unicode: no ${BEGIN} … ${END} region in std/regex.ts`)
}
const next = source.slice(0, begin) + region(built) + source.slice(regionEnd + END.length)
const nextOracle = oracle(ucd, sample())

if (process.argv.includes("--check")) {
  const bad = checkNode(ucd)
  if (next !== source) {
    bad.push("std/regex.ts: the tables differ from the generator's; run node scripts/gen-regex-unicode.mjs")
  }
  if (!fs.existsSync(oracleFile) || fs.readFileSync(oracleFile, "utf8") !== nextOracle) {
    bad.push(`${path.relative(root, oracleFile)} differs from the generator's`)
  }
  for (const line of bad) {
    console.error(`gen-regex-unicode: ${line}`)
  }
  if (bad.length > 0) {
    process.exit(1)
  }
  console.log(
    `gen-regex-unicode: the tables match Unicode ${UNICODE_VERSION} and this Node's RegExp (${built.index.length + built.data.length + built.fold.length + built.spans.length} bytes)`
  )
} else {
  fs.writeFileSync(target, next)
  fs.mkdirSync(path.dirname(oracleFile), { recursive: true })
  fs.writeFileSync(oracleFile, nextOracle)
  console.log(
    `gen-regex-unicode: names ${built.index.length} bytes, ranges ${built.data.length}, folds ${built.fold.length}, fold runs ${built.spans.length}; wrote std/regex.ts and ${path.relative(root, oracleFile)}`
  )
}
