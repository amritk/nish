#!/usr/bin/env node
// No new wrap spelled as a cast: `toI32(toU32(a) + toU32(b))` and its `i64`
// form make signed arithmetic wrap without the compiler proving it fits, so a
// wrap stands in for a panic and nobody can tell it was meant. CLAUDE.md, "A
// wrap is spelled, never cast", has the rule: prove the sum, return a Result,
// or write `wrappingAdd`/`wrappingSub`/`wrappingMul` from `nish:unsafe`.
//
//   node scripts/wrap-casts.mjs            check the tree (npm run lint)
//   node scripts/wrap-casts.mjs --update   lower scripts/wrap-casts.txt to the tree's counts;
//                                          refuses to raise one or add a file
//
// A cast wrap is a `toI32(...)` call whose argument has a `toU32(...)` result
// as a direct operand of `+`, `-` or `*`, or the same with `toI64` and
// `toU64`, over any spacing and line breaks, with `//` and `/* */` comments
// blanked first. It finds that shape only: a `toU32` operand inside its own
// parentheses or under a `/`, and a u32 local summed first and cast later, are
// not found, so a pass is not a proof that a file wraps nowhere.
//
// scripts/wrap-casts.txt holds the count per file of the casts that predate
// the rule, and the counts only fall. A file whose count rises, or that has
// one and is not listed, fails and names every cast in it; a count that falls
// fails until --update writes it back, so a removed cast cannot be traded for
// a new one.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const baselinePath = path.join(root, "scripts", "wrap-casts.txt")
const scanned = ["std", "src", "examples"]
const pairs = [
  { outer: "toI32", inner: "toU32" },
  { outer: "toI64", inner: "toU64" },
]

/** The index of the `)` that closes the `(` at `open` in `src`, or -1. */
const closingParen = (src, open) => {
  let depth = 0
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "(") {
      depth += 1
    } else if (src[i] === ")") {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

/** The offsets of each call of `name(` in `src` that is not the tail of a longer identifier. */
const callsOf = (src, name) => {
  const at = []
  for (let i = src.indexOf(`${name}(`); i >= 0; i = src.indexOf(`${name}(`, i + 1)) {
    if (!/[\w$.]/.test(src[i - 1] ?? "")) {
      at.push(i)
    }
  }
  return at
}

/** `source` with its comments replaced by spaces, line breaks kept, so offsets and line numbers hold. */
const blankComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (c) => " ".repeat(c.length))

/** The cast wraps in `source`: `{ line, text }`, `text` with its spacing removed. */
const castWraps = (source) => {
  const src = blankComments(source)
  const found = []
  for (const { outer, inner } of pairs) {
    for (const at of callsOf(src, outer)) {
      const end = closingParen(src, at + outer.length)
      if (end < 0) {
        continue
      }
      const arg = src.slice(at + outer.length + 1, end)
      // Each inner cast in the argument, nested ones within it included, becomes one placeholder.
      let flat = ""
      let from = 0
      for (const u of callsOf(arg, inner)) {
        if (u < from) {
          continue
        }
        const close = closingParen(arg, u + inner.length)
        flat += `${arg.slice(from, u)}\u0001`
        from = close < 0 ? arg.length : close + 1
      }
      flat += arg.slice(from)
      // biome-ignore lint/suspicious/noControlCharactersInRegex: \u0001 is the placeholder, chosen because no source text holds it
      if (/\u0001\s*[-+*]|[-+*]\s*\u0001/.test(flat)) {
        found.push({
          line: src.slice(0, at).split("\n").length,
          text: src.slice(at, end + 1).replace(/\s+/g, ""),
        })
      }
    }
  }
  return found.sort((a, b) => a.line - b.line)
}

// The scan itself, on every run: a cast split over lines with odd spacing is
// found in both widths, a nested one is one site, and neither a commented-out
// cast, a `wrappingAdd`, nor a cast with no arithmetic is found.
const planted = [
  "const a = toI32(",
  "  toU32(x)",
  "    +   toU32(y))",
  "const b = toI64(toU64(p) * toU64(toU64(q)))",
  "// const c = toI32(toU32(x) + toU32(y))",
  "/* toI32(toU32(x) - 1) */",
  "const d = wrappingAdd(x, y)",
  "const e = toI32(toU32(x))",
  "const f = toI32(1 - toU32(x))",
].join("\n")
const plantedFound = castWraps(planted).map((s) => `${s.line} ${s.text}`)
const plantedWant = ["1 toI32(toU32(x)+toU32(y))", "4 toI64(toU64(p)*toU64(toU64(q)))", "9 toI32(1-toU32(x))"]
if (plantedFound.join("\n") !== plantedWant.join("\n")) {
  console.error(
    `wrap-casts: the scan's self-test found\n${plantedFound.join("\n")}\nnot\n${plantedWant.join("\n")}`
  )
  process.exit(1)
}

/** The baseline's counts by file. Lines are `<count> <path>`; `#` starts a comment line. */
const readBaseline = () => {
  const counts = new Map()
  for (const raw of fs.readFileSync(baselinePath, "utf8").split("\n")) {
    const line = raw.trim()
    if (line === "" || line.startsWith("#")) {
      continue
    }
    const m = /^(\d+) (\S+)$/.exec(line)
    if (m === null) {
      console.error(`wrap-casts: scripts/wrap-casts.txt: not \`<count> <path>\`: ${line}`)
      process.exit(2)
    }
    counts.set(m[2], Number(m[1]))
  }
  return counts
}

const header = [
  "# The cast wraps (`toI32(toU32(a) + toU32(b))`, and toI64/toU64) that predate",
  '# CLAUDE.md\'s "A wrap is spelled, never cast", per file. Counts only fall:',
  "# lower them with `node scripts/wrap-casts.mjs --update`, never by hand.",
]

const files = execFileSync("git", ["ls-files", "--", ...scanned.map((d) => `${d}/*.ts`)], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f.endsWith(".ts"))
const found = new Map()
for (const f of files) {
  const sites = castWraps(fs.readFileSync(path.join(root, f), "utf8"))
  if (sites.length > 0) {
    found.set(f, sites)
  }
}
const baseline = readBaseline()
const rises = []
const falls = []
for (const [f, sites] of found) {
  const allowed = baseline.get(f) ?? 0
  if (sites.length > allowed) {
    rises.push(
      `${f}: ${sites.length} cast wraps, ${allowed} allowed; prove the sum, return a Result, or call wrappingAdd/wrappingSub/wrappingMul from nish:unsafe:\n${sites.map((s) => `  ${f}:${s.line}: ${s.text}`).join("\n")}`
    )
  }
}
for (const [f, allowed] of baseline) {
  const n = found.get(f)?.length ?? 0
  if (n < allowed) {
    falls.push(`${f}: ${n} cast wraps, scripts/wrap-casts.txt says ${allowed}`)
  }
}
if (rises.length > 0) {
  console.error(
    `wrap-casts: a cast wrap was added (CLAUDE.md, "A wrap is spelled, never cast")\n${rises.join("\n")}`
  )
  process.exit(1)
}
if (process.argv.includes("--update")) {
  const lines = [...found].sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, sites]) => `${sites.length} ${f}`)
  fs.writeFileSync(baselinePath, `${[...header, ...lines].join("\n")}\n`)
  const total = [...found.values()].reduce((n, s) => n + s.length, 0)
  console.log(`wrap-casts: wrote ${found.size} files, ${total} cast wraps`)
} else if (falls.length > 0) {
  console.error(
    `wrap-casts: a count fell; lower it with \`node scripts/wrap-casts.mjs --update\`\n${falls.join("\n")}`
  )
  process.exit(1)
}
