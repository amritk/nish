// `std/regex`'s property escapes and case folding against Node's `RegExp` with
// the `u` and `iu` flags. `oracle.ts`, written by scripts/gen-regex-unicode.mjs,
// holds what Node answers over the sample text built here: per property, per
// class under `i` and per folded code point, the runs it matches as a count
// and a digest of their byte offsets. Each check lists the rows that differ.
import { Suite } from "../../../std/testing";
import { Regex, RegexMatch, regexCompile } from "../../../std/regex";
import { wrappingAdd, wrappingMul } from "nish:unsafe";
import { foldCharRows, foldClassRows, foldCodePoints, propertyRows, wordRows, wordText } from "./oracle";

/** `c` as UTF-8. */
const utf8 = (c: i32): string => {
  if (c < 128) {
    return String.fromCharCode(c)
  }
  if (c < 2048) {
    return `${String.fromCharCode(192 + (c >> 6))}${String.fromCharCode(128 + (c & 63))}`
  }
  const tail: string = `${String.fromCharCode(128 + ((c >> 6) & 63))}${String.fromCharCode(128 + (c & 63))}`
  if (c < 65536) {
    return `${String.fromCharCode(224 + (c >> 12))}${tail}`
  }
  return `${String.fromCharCode(240 + (c >> 18))}${String.fromCharCode(128 + ((c >> 12) & 63))}${tail}`
}

/**
 * The generator's sample text: every code point up to U+323AF and from
 * U+E0000 to U+E01EF, one in 251 of the rest and the plane edges in `edges`,
 * less the surrogates and the four ASCII letters whose folding crosses ASCII.
 */
const sample = (): string => {
  // `sample` in scripts/gen-regex-unicode.mjs builds the same text: change both.
  const edges: i32[] = [
    0x323b0, 0x3fffe, 0x3ffff, 0x40000, 0xdfffe, 0xdffff, 0xe01f0, 0xefffe, 0xeffff, 0xf0000, 0xffffd, 0xffffe,
    0xfffff, 0x100000, 0x10fffd, 0x10fffe, 0x10ffff,
  ]
  const parts: string[] = []
  let c: i32 = 0
  while (c <= 1114111) {
    const dense: boolean = c <= 205743 || (c >= 917504 && c <= 917999) || edges.indexOf(c) >= 0
    const skip: boolean = (c >= 55296 && c <= 57343) || c === 83 || c === 115 || c === 75 || c === 107
    if ((dense || c % 251 === 0) && !skip) {
      parts.push(utf8(c))
    }
    c += 1
  }
  return parts.join("")
}

/** The runs `pattern` matches in `text` under `flags`, as their number and digest, or the compile error. */
const runs = (pattern: string, flags: string, text: string): string => {
  const c = regexCompile(pattern, flags)
  if (c.isErr()) {
    return c.error
  }
  const re: Regex = c.value
  const m: RegexMatch = new RegexMatch()
  let count: i32 = 0
  let digest: i32 = 0
  let from: i32 = 0
  while (re.exec(text, from, m)) {
    count += 1
    digest = wrappingAdd(wrappingMul(digest, 31), m.start() * 7 + m.end())
    from = m.end()
  }
  return `${count} ${digest}`
}

/** The rows of `rows` whose runs, with `pattern` of their key under `flags` over `text`, differ from Node's. */
const differ = (rows: string[], pattern: (key: string) => string, flags: string, text: string): string[] => {
  const out: string[] = []
  for (const row of rows) {
    const key: string = row.slice(0, toI32(row.indexOf(" ")))
    const actual: string = `${key} ${runs(pattern(key), flags, text)}`
    if (actual !== row) {
      out.push(`${actual}, Node ${row}`)
    }
  }
  return out
}

export const main = (): i32 => {
  const t = new Suite("regex unicode")
  const none: string[] = []
  const text: string = sample()
  const props: string[] = propertyRows()
  t.eqLines(`${props.length} property escapes`, differ(props, (key: string): string => `\\p{${key}}+`, "", text), none)
  const classes: string[] = foldClassRows()
  t.eqLines(`${classes.length} classes under i`, differ(classes, (key: string): string => `${key}+`, "i", text), none)
  const folded: string[] = []
  for (const cp of foldCodePoints()) {
    folded.push(utf8(cp))
  }
  const chars: string[] = foldCharRows()
  const differs: string[] = differ(chars, (key: string): string => `${utf8(toI32(parseInt(key)))}+`, "i", folded.join(""))
  t.eqLines(`${chars.length} code points under i`, differs, none)
  const words: string[] = wordRows()
  t.eqLines(`${words.length} word patterns under i`, differ(words, (key: string): string => key, "i", wordText()), none)
  return t.done()
}
