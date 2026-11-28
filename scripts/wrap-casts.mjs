#!/usr/bin/env node
// No wrap spelled as a cast: `toI32(toU32(a) + toU32(b))` and its `i64`
// form make signed arithmetic wrap without the compiler proving it fits, so a
// wrap stands in for a panic and nobody can tell it was meant. CLAUDE.md, "A
// wrap is spelled, never cast", has the rule: prove the sum, return a Result,
// or write `wrappingAdd`/`wrappingSub`/`wrappingMul` from `nish:unsafe`.
//
//   node scripts/wrap-casts.mjs            check the tree (npm run lint)
//   node scripts/wrap-casts.mjs --root D   check the copy at D, its files found by walking D
//                                          rather than git (tests/run.js plants a cast in
//                                          one and expects exit 1)
//
// A cast wrap is a `toI32(...)` call whose argument has a `toU32(...)` result
// as a direct operand of `+`, `-` or `*`, or the same with `toI64` and
// `toU64`, over any spacing and line breaks, with `//` and `/* */` comments
// blanked first. It finds that shape only: a `toU32` operand inside its own
// parentheses or under a `/`, and a u32 local summed first and cast later, are
// not found, so a pass is not a proof that a file wraps nowhere.
//
// Every cast wrap found fails, naming its file and line: WP91 took every
// scanned file to none, so none is allowed.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const usage = "the only flag is --root D"
const fail = (message) => {
  console.error(`wrap-casts: ${message}; ${usage}`)
  process.exit(2)
}
let rootArg
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === "--root") {
    const value = args[i + 1]
    if (value === undefined || value.startsWith("--")) {
      fail("--root needs a value")
    }
    rootArg = value
    i++
  } else {
    fail(`unknown argument ${a}`)
  }
}
const root = path.resolve(rootArg ?? path.join(import.meta.dirname, ".."))
if (!fs.existsSync(path.join(root, "std")) || !fs.statSync(path.join(root, "std")).isDirectory()) {
  fail(`${root} has no std/ directory`)
}
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

/** The `.ts` files under `dir` of `root`, as `/`-separated paths from `root`. */
const walk = (dir) => {
  const at = path.join(root, dir)
  if (!fs.existsSync(at)) {
    return []
  }
  return fs.readdirSync(at, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) {
      return walk(`${dir}/${e.name}`)
    }
    return e.name.endsWith(".ts") ? [`${dir}/${e.name}`] : []
  })
}
// The live tree lists what git tracks; a --root copy need not be a repository, so it is walked.
const files = (
  rootArg === undefined
    ? execFileSync("git", ["ls-files", "--", ...scanned.map((d) => `${d}/*.ts`)], {
        cwd: root,
        encoding: "utf8",
      }).split("\n")
    : scanned.flatMap(walk)
).filter((f) => f.endsWith(".ts"))
const found = new Map()
for (const f of files) {
  const sites = castWraps(fs.readFileSync(path.join(root, f), "utf8"))
  if (sites.length > 0) {
    found.set(f, sites)
  }
}
if (found.size > 0) {
  const sites = [...found].flatMap(([f, ss]) => ss.map((x) => `  ${f}:${x.line}: ${x.text}`))
  console.error(
    `wrap-casts: a cast wrap (CLAUDE.md, "A wrap is spelled, never cast"); prove the sum, return a Result, or call wrappingAdd/wrappingSub/wrappingMul from nish:unsafe:\n${sites.join("\n")}`
  )
  process.exit(1)
}
