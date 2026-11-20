#!/usr/bin/env node
// WP68 S1: recounts the duplicated helpers docs/wp68-shared-libraries.md §3
// tabulates, so the survey can be rerun on any commit rather than trusted. For
// each cluster it greps std/ and src/ for a marker, walks up from each match to
// the top-level `const` that holds it, and prints that definition as
// `file:line name (n lines)`, then the cluster's site and line totals.
//
//   node bench/wp68-survey.mjs [cluster ...]
//
// A definition runs from its `const` line at column 0 to the first line that
// leaves every bracket closed (strings, comments and regular expressions
// skipped) and is followed by the end of the file, a blank line or a line at
// column 0; a match below that end is outside every `const`. A match counts its whole definition when the definition is
// short (SHORT) or the match is near its top (HEAD): the definition is then the
// copy. Otherwise the copy is written inline in a larger function, and it
// counts the unbroken lines around the match that the cluster's `run` pattern
// matches, once however many matches they hold. Markers find copies by shape,
// not by name, where a shape exists (`- 87` is the lower-case hex step); where
// none does, they match the names the copies carry. A copy a marker misses is
// not counted: the table is a lower bound.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** The clusters: a name, the marker a copy carries, and what the marker means. */
const CLUSTERS = [
  { name: "hex", marker: /[\w)] - 87\b/, what: "hex-digit decoders (the `- 87` lower-case step)" },
  { name: "digit", marker: /^(export )?const \w*[Ii]sDigit\w* = /, what: "ASCII digit predicates" },
  {
    name: "decimal",
    marker: /^(export )?const \w*(PutDecimal|DecimalDigits|DecimalLength|PutDigits\w*) = /,
    what: "decimal writers and their digit counters",
  },
  {
    name: "json-escape",
    marker:
      /^(export )?const (jsonShortEscape|jsonTokShortEscape|jsonQuote|addJsonQuoted|jsonWriterPutString|jsonWriterPutRuns|internalErrorFor) = /,
    what: "JSON string quoters and escape tables",
  },
  {
    name: "be-load",
    marker: /\(to[IU](32|64)\(\w+\[[^\]]*\]\) << (toU32\(|toI64\()?24\)?\)? \|/,
    run: /<< |^\s*\||\|\s*$/,
    what: "big-endian 32-bit loads (a byte shifted by 24 and OR'd)",
  },
  {
    name: "utf8",
    marker: /^(export )?const \w*[Uu]tf8\w* = /,
    what: "UTF-8 encoders, validators and widths",
  },
  { name: "fnv", marker: /\b16777619\b/, run: /\^|\*/, what: "FNV-1a hashes (the 32-bit prime)" },
  {
    name: "grow",
    marker: /^(export )?const \w+(Reserve|Grow|Grown) = /,
    what: "byte-buffer grow and reserve helpers",
  },
]

const DEF = /^(export )?const (\w+)/

/** Every `.ts` file under `dir`, sorted, relative to the repository root. */
const sources = (dir) => {
  const out = []
  const walk = (at) => {
    for (const entry of fs.readdirSync(path.join(root, at), { withFileTypes: true })) {
      const rel = path.join(at, entry.name)
      if (entry.isDirectory()) {
        walk(rel)
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        out.push(rel)
      }
    }
  }
  walk(dir)
  return out.sort()
}

/** A top-level declaration that is not a `const`: a walk up from inside one stops there. */
const OTHER = /^(export )?(class|interface|type|function|enum) /
/** A marker this many lines or fewer into a definition makes the definition the copy. */
const HEAD = 6
/** So does a definition this many lines long or shorter, wherever the marker is in it. */
const SHORT = 16

/**
 * The bracket depth after `line`, starting from `state.depth`, with strings,
 * template literals, comments and regular expression literals skipped; a
 * template literal or block comment left open carries into the next line
 * through `state`.
 */
const scan = (line, state) => {
  let i = 0
  let last = ""
  while (i < line.length) {
    const c = line[i]
    if (state.inBlock) {
      if (c === "*" && line[i + 1] === "/") {
        state.inBlock = false
        i += 2
      } else {
        i += 1
      }
      continue
    }
    if (state.inTemplate) {
      if (c === "\\") {
        i += 2
      } else {
        if (c === "`") {
          state.inTemplate = false
        }
        i += 1
      }
      continue
    }
    if (c === "/" && line[i + 1] === "/") {
      break
    }
    if (c === "/" && line[i + 1] === "*") {
      state.inBlock = true
      i += 2
      continue
    }
    if (c === '"' || c === "'") {
      i += 1
      while (i < line.length && line[i] !== c) {
        i += line[i] === "\\" ? 2 : 1
      }
      i += 1
      last = c
      continue
    }
    if (c === "`") {
      state.inTemplate = true
      i += 1
      continue
    }
    if (c === "/" && (last === "" || /[=(,:!&|?{};[+\-*%<>~^]/.test(last))) {
      // A regular expression literal: skip to its closing slash.
      i += 1
      let inClass = false
      while (i < line.length && (inClass || line[i] !== "/")) {
        if (line[i] === "\\") {
          i += 1
        } else if (line[i] === "[") {
          inClass = true
        } else if (line[i] === "]") {
          inClass = false
        }
        i += 1
      }
      i += 1
      last = "x"
      continue
    }
    if ("([{".includes(c)) {
      state.depth += 1
    } else if (")]}".includes(c)) {
      state.depth -= 1
    }
    if (!/\s/.test(c)) {
      last = c
    }
    i += 1
  }
}

/**
 * The `const` holding line `at` of `lines`: its first line, name and length,
 * or null outside one. The definition starts at the nearest `const` at column
 * 0 at or above `at`, and ends at the first line from there that leaves every
 * bracket closed and is followed by the end of the file, a blank line or a
 * line at column 0: continuation lines of a top-level definition are indented,
 * so a definition ended by `=>`, `=`, `[` or an operator runs on through its
 * indented lines and stops before the blank line or doc comment after it.
 */
const enclosing = (lines, at) => {
  let start = at
  while (start >= 0 && !DEF.test(lines[start])) {
    if (OTHER.test(lines[start])) {
      return null
    }
    start -= 1
  }
  if (start < 0) {
    return null
  }
  const name = DEF.exec(lines[start])[2]
  const state = { depth: 0, inBlock: false, inTemplate: false }
  let end = start
  for (; end < lines.length; end++) {
    scan(lines[end], state)
    const next = lines[end + 1]
    const open = state.depth > 0 || state.inBlock || state.inTemplate
    if (!open && (next === undefined || next.trim() === "" || !/^\s/.test(next))) {
      break
    }
  }
  if (at > end) {
    return null
  }
  return { line: start + 1, name, length: end - start + 1 }
}

/** The lines around `at` that `run` matches, unbroken: a copy written inline, as its first line and length. */
const inlineRun = (lines, at, run) => {
  if (run === undefined) {
    return { first: at, length: 1 }
  }
  let first = at
  while (first > 0 && run.test(lines[first - 1])) {
    first -= 1
  }
  let last = at
  while (last + 1 < lines.length && run.test(lines[last + 1])) {
    last += 1
  }
  return { first, length: last - first + 1 }
}

const wanted = process.argv.slice(2)
for (const name of wanted) {
  if (!CLUSTERS.some((c) => c.name === name)) {
    console.error(
      `bench/wp68-survey.mjs: no cluster ${name}; there are ${CLUSTERS.map((c) => c.name).join(", ")}`
    )
    process.exit(2)
  }
}
const files = [...sources("std"), ...sources("src")].map((file) => ({
  file,
  lines: fs.readFileSync(path.join(root, file), "utf8").split("\n"),
}))
const totals = []
for (const cluster of CLUSTERS.filter((c) => wanted.length === 0 || wanted.includes(c.name))) {
  console.log(`== ${cluster.name}: ${cluster.what}`)
  let sites = 0
  let lineCount = 0
  for (const { file, lines } of files) {
    const seen = new Set()
    for (let i = 0; i < lines.length; i++) {
      if (!cluster.marker.test(lines[i])) {
        continue
      }
      const found = enclosing(lines, i)
      const def = found !== null && (i + 1 - found.line <= HEAD || found.length <= SHORT) ? found : null
      const inline = def === null ? inlineRun(lines, i, cluster.run) : null
      const key = inline !== null ? `line ${inline.first}` : def.name
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      sites += 1
      const length = inline !== null ? inline.length : def.length
      lineCount += length
      const shown =
        inline !== null ? `${file}:${inline.first + 1} (inline)` : `${file}:${def.line} ${def.name}`
      console.log(`  ${shown} (${length} lines)`)
    }
  }
  console.log(`  ${sites} sites, ${lineCount} lines`)
  totals.push(`${cluster.name} ${sites}/${lineCount}`)
}
console.log(`sites/lines: ${totals.join(", ")}`)
