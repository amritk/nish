// `nish/regex` over a 64 KB corpus of mixed ASCII and non-ASCII lines:
// English, Greek, French, German and CJK words, numbers and addresses. Each
// case compiles one pattern once, then counts its matches (or, for `exec`,
// walks them and reads every group) over one of eight copies of the corpus
// that differ in their first line, a different copy every iteration, so no
// iteration can be computed once. Every count and group length is folded into
// the printed checksum.
//
//   build/nish bench/regex/main.ts -o build/bench-regex/ --link build/bench-regex/app
//   build/bench-regex/app <case> [iterations]   prints the checksum, then ns per pass
//
// The cases without the Unicode features are `literal`, `class`, `alternation`,
// `group`, `anchored`, `icase-ascii` and `exec`; those with them are
// `property`, `script` and `icase-unicode`. bench/regex/measure.mjs times them
// against a byte-identical copy of the binary for the noise band, and against
// another compiler's build with `--before`.
import { Regex, RegexMatch, regexCompile } from "nish/regex"

/** The words the corpus is built from. */
const words = (): string[] => [
  "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "needle", "Hello", "World",
  "σοφία", "Ἀθῆναι", "λόγος", "ΑΛΦΑ", "école", "ÉCOLE", "café", "Straße", "STRASSE", "Ärger",
  "日本語", "東京", "数据", "über", "naïve", "1234", "56", "2026", "ada@example.com", "bob@site.org",
]

/** One line of `n` words, picked by an LCG from `seed`, and the seed after it. */
const line = (vocabulary: string[], seed: i32, n: i32, out: string[]): i32 => {
  let s: i32 = seed
  let k: i32 = 0
  while (k < n) {
    s = (s * 1103 + 12345) & 1048575
    out.push(vocabulary[s % toI32(vocabulary.length)])
    out.push(k + 1 === n ? "\n" : " ")
    k += 1
  }
  return s
}

/** The eight copies of the corpus: `copy` ASCII letters, then the same 64 KB of lines. */
const corpora = (): string[] => {
  const vocabulary: string[] = words()
  const body: string[] = []
  let seed: i32 = 7
  let size: i32 = 0
  while (size < 65536) {
    const parts: string[] = []
    seed = line(vocabulary, seed, 8 + (seed & 7), parts)
    const text: string = parts.join("")
    body.push(text)
    size += toI32(text.length)
  }
  const rest: string = body.join("")
  const out: string[] = []
  let copy: i32 = 0
  while (copy < 8) {
    out.push(`${"abcdefgh".slice(0, copy)}\n${rest}`)
    copy += 1
  }
  return out
}

/** The pattern and flags of `name`, as `pattern flags`, or "" for no such case. */
const benchCase = (name: string): string => {
  if (name === "literal") { return "needle" }
  if (name === "class") { return "[0-9]+" }
  if (name === "alternation") { return "fox|dog|needle|World" }
  if (name === "group") { return "(?:[a-z]+ ){2}[a-z]+" }
  if (name === "anchored") { return "^[A-Z][a-z]+" }
  if (name === "icase-ascii") { return "hello world|quick" }
  if (name === "exec") { return "(\\w+)@(\\w+)\\.(com|org)" }
  if (name === "property") { return "\\p{L}+" }
  if (name === "script") { return "\\p{Script=Greek}+" }
  if (name === "icase-unicode") { return "σοφία|école|straße|über" }
  return ""
}

const benchFlags = (name: string): string => {
  if (name === "anchored") { return "m" }
  if (name === "icase-ascii" || name === "icase-unicode") { return "i" }
  return ""
}

/** The matches of `re` in `text` and the lengths of their groups, folded. */
const execAll = (re: Regex, text: string, m: RegexMatch): i32 => {
  let sum: i32 = 0
  let from: i32 = 0
  while (re.exec(text, from, m)) {
    sum = (sum * 31 + m.end() - m.start() + toI32(m.group(1).length) + toI32(m.group(3).length)) & 1048575
    from = m.end()
  }
  return sum
}

export const main = (): number => {
  const name: string = process.argv.length > 1 ? process.argv[1] : ""
  const iterations: i32 = process.argv.length > 2 ? toI32(parseInt(process.argv[2])) : 200
  const pattern: string = benchCase(name)
  if (pattern === "") {
    console.error(`bench/regex: no case ${name}`)
    return 2
  }
  const compiled = regexCompile(pattern, benchFlags(name))
  if (compiled.isErr()) {
    console.error(compiled.error)
    return 1
  }
  const re: Regex = compiled.value
  const m: RegexMatch = new RegexMatch()
  const texts: string[] = corpora()
  let checksum: i32 = 0
  const started: i64 = monotonicNanos()
  let r: i32 = 0
  while (r < iterations) {
    const slot: i32 = r % 8
    const text: string = texts[slot]
    const got: i32 = name === "exec" ? execAll(re, text, m) : re.count(text)
    checksum = (checksum * 31 + got) & 1048575
    r += 1
  }
  const elapsed: i64 = monotonicNanos() - started
  console.log(`${checksum}`)
  console.log(`${toF64(elapsed) / toF64(iterations)} ns/pass`)
  return 0
}
