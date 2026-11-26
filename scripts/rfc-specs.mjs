#!/usr/bin/env node
// Every RFC a std/ module cites is covered by a vector spec of that module, or
// listed in scripts/rfc-unspecified.txt.
//
//   node scripts/rfc-specs.mjs                     check the tree (npm run lint, npm test's spec section)
//   node scripts/rfc-specs.mjs --update-baseline   drop the listed lines that are now covered or gone, and
//                                                  re-pin PRE_RULE_SHA256; refuses to add a line
//   node scripts/rfc-specs.mjs --grow-baseline     the same, adding lines: only for a change to the rule
//   node scripts/rfc-specs.mjs --root D [--pin H]  check the tree under D instead, with H in place of
//                                                  PRE_RULE_SHA256 (the tests' fixture trees; without
//                                                  --pin, no line may predate the rule)
//
// A citation is `RFC` or `RFCs` and a number, in either case and in any
// std/**/*.ts file, comments and identifiers included (`rfc822Name`,
// `rfc-editor.org/rfc/rfc9000`), and across a comment's line break (`RFC` at
// the end of one line, ` * 9000` or `// 9000` on the next). A list cites each
// number (`RFCs 8446 and 9001`, `RFCs 7230, 7231, and 7232`, `RFC 5208/5958`)
// and a range each number in it (`RFCs 7230-7235`, up to 64 of them; a wider
// one only its ends). The file is read as text, so a citation a parser would
// miss still counts, and a number after `and` that is not an RFC is read as
// one: list it as `cites:`.
//
// A contract `contracts/<n>.json` covers the pair (std/<module>.ts, RFC r) for
// its `target.module` `nish/<module>` and each `sources[].rfc` r, once its spec
// `specs/<n>.md` exists and its test `test/spec/<n>.ts` pins its SHA-256: the
// test is what vector emits from the contract, so a contract no test was
// emitted from covers nothing.
//
// The list has two kinds of line:
//
//   std/net/quic.ts RFC9000                       predates the rule
//   std/net/http.ts RFC8441 cites: out of scope   cited, not implemented, with the reason
//
// The lines from before the rule only shrink. PRE_RULE_SHA256 pins their set
// (preRuleDigest), so a line added, swapped or deleted by hand fails;
// --update-baseline is the one way to drop one, and it runs only on the pinned
// set, so what it keeps is a subset of what was pinned. A citation is an implementation unless a line lists it, so a new module
// that implements an RFC fails until its spec lands. A covered or no longer
// cited pair fails while it is still listed. CLAUDE.md, "Definition of done",
// has the rule; contracts/README.md has the spec-first walk.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/** How many lines of scripts/rfc-unspecified.txt predate the rule, and their preRuleDigest. */
const PRE_RULE_LINES = 231
const PRE_RULE_SHA256 = "857011476514ea5848dbdaabd7d39270685994e28fe3a970f04ead67682c4d76"

const usage = "the flags are --update-baseline, --grow-baseline, and --root D [--pin H]"
const fail = (message) => {
  console.error(`rfc-specs: ${message}; ${usage}`)
  process.exit(2)
}
let rootArg
let pinArg
let grow = false
let update = false
const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === "--root" || a === "--pin") {
    const value = args[i + 1]
    if (value === undefined || value.startsWith("--")) {
      fail(`${a} needs a value`)
    }
    if (a === "--root") {
      rootArg = value
    } else if (/^[0-9a-f]{64}$/.test(value)) {
      pinArg = value
    } else {
      fail(`--pin ${value} is not a SHA-256`)
    }
    i++
  } else if (a === "--update-baseline") {
    update = true
  } else if (a === "--grow-baseline") {
    update = true
    grow = true
  } else {
    fail(`unknown argument ${a}`)
  }
}
if (pinArg !== undefined && rootArg === undefined) {
  fail("--pin is for a --root tree; the live tree's is PRE_RULE_SHA256")
}
const root = path.resolve(rootArg ?? path.join(import.meta.dirname, ".."))
if (!fs.existsSync(path.join(root, "std")) || !fs.statSync(path.join(root, "std")).isDirectory()) {
  fail(`${root} has no std/ directory`)
}
/** The SHA-256 of a set of pairs: each `std/<file>.ts RFC<n>`, sorted, one per line. */
const preRuleDigest = (keys) =>
  crypto
    .createHash("sha256")
    .update(
      [...keys]
        .sort()
        .map((k) => `${k}\n`)
        .join("")
    )
    .digest("hex")
const live = rootArg === undefined
const pin = live ? PRE_RULE_SHA256 : (pinArg ?? preRuleDigest([]))
const pinName = live ? "PRE_RULE_SHA256 in scripts/rfc-specs.mjs" : "--pin"

const listRel = "scripts/rfc-unspecified.txt"
const header = `# RFCs a std/ module cites that no vector spec of that module covers.
#
# \`node scripts/rfc-specs.mjs\` (npm run lint) fails on a citation in std/ that no
# contract covers and no line lists, and on a line whose pair is now covered or
# no longer cited. A module that implements an RFC lands spec-first
# (contracts/README.md): its spec's contract covers the pair, and its line goes.
#
#   std/<file>.ts RFC<n>                    predates the rule. These only shrink:
#                                           PRE_RULE_SHA256 in scripts/rfc-specs.mjs
#                                           pins their set, so never add, swap or
#                                           delete one by hand; --update-baseline
#                                           drops stale ones and re-pins it
#   std/<file>.ts RFC<n> cites: <reason>    the file cites the RFC and does not
#                                           implement it; the reason says why
#
# --update-baseline rewrites this file: comments other than this header go.
`

/** Every std/**\/*.ts file, as repository paths, following symbolic links. */
const walk = (dir) => {
  const out = []
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const rel = `${dir}/${name}`
    if (fs.statSync(path.join(root, rel)).isDirectory()) {
      out.push(...walk(rel))
    } else if (name.endsWith(".ts")) {
      out.push(rel)
    }
  }
  return out
}

// What may stand between the words of a citation: space, and the `*` or `//`
// that starts a wrapped comment line.
const gap = String.raw`(?:\s|\*|//)*`
const rfcWord = String.raw`RFCs?(?:[\s-]|\*|//)*`
const separator = String.raw`${gap}(?:,|/|&|and|or|-|\u2013)${gap}(?:(?:and|or)${gap})?(?:${rfcWord})?`
const citation = new RegExp(String.raw`${rfcWord}(\d{1,5}(?:${separator}\d{1,5})*)(?!\d)`, "gi")
const rangeStep = new RegExp(String.raw`^${gap}[-\u2013]`)
/** The RFC numbers a matched citation names: each listed one, and each one a range spans. */
const citedNumbers = (body) => {
  const out = []
  const numbers = [...body.matchAll(/\d+/g)]
  for (const [i, m] of numbers.entries()) {
    const n = Number(m[0])
    const prev = numbers[i - 1]
    const between = prev === undefined ? "" : body.slice(prev.index + prev[0].length, m.index)
    const from = Number(prev?.[0])
    if (prev !== undefined && rangeStep.test(between) && n > from && n - from <= 64) {
      for (let r = from + 1; r < n; r++) {
        out.push(r)
      }
    }
    out.push(n)
  }
  return out
}
const pairKey = (file, rfc) => `${file} RFC${rfc}`

const cited = new Map()
for (const file of walk("std").sort()) {
  const text = fs.readFileSync(path.join(root, file), "utf8")
  for (const m of text.matchAll(citation)) {
    const line = text.slice(0, m.index).split("\n").length
    for (const n of citedNumbers(m[1])) {
      const key = pairKey(file, n)
      if (!cited.has(key)) {
        cited.set(key, line)
      }
    }
  }
}

const problems = []
const covered = new Set()
const contractsDir = path.join(root, "contracts")
const contracts = fs.existsSync(contractsDir)
  ? fs
      .readdirSync(contractsDir)
      .filter((n) => n.endsWith(".json"))
      .sort()
  : []
for (const name of contracts) {
  const rel = `contracts/${name}`
  const base = name.slice(0, -".json".length)
  const bytes = fs.readFileSync(path.join(contractsDir, name))
  let contract
  try {
    contract = JSON.parse(bytes.toString("utf8"))
  } catch (e) {
    problems.push(`${rel}: does not parse: ${e.message}`)
    continue
  }
  const mod = contract?.target?.module
  if (typeof mod !== "string" || !mod.startsWith("nish/")) {
    problems.push(`${rel}: target.module is ${JSON.stringify(mod)}, not a nish/ module`)
    continue
  }
  const sources = Array.isArray(contract.sources) ? contract.sources : []
  const bad = sources.filter((s) => s?.rfc !== undefined && !Number.isInteger(s.rfc))
  if (bad.length > 0) {
    problems.push(`${rel}: a sources[].rfc is not an RFC number: ${JSON.stringify(bad[0].rfc)}`)
    continue
  }
  if (!fs.existsSync(path.join(root, "specs", `${base}.md`))) {
    problems.push(`${rel}: has no spec specs/${base}.md, so it covers nothing`)
    continue
  }
  const testRel = `test/spec/${base}.ts`
  const want = crypto.createHash("sha256").update(bytes).digest("hex")
  const pins = fs.existsSync(path.join(root, testRel))
    ? fs
        .readFileSync(path.join(root, testRel), "utf8")
        .split("\n")
        .filter((l) => l.startsWith("// vector-contract-sha256:"))
        .map((l) => l.slice("// vector-contract-sha256:".length).trim())
    : []
  if (!(pins.length === 1 && pins[0] === want)) {
    problems.push(`${rel}: ${testRel} was not emitted from it as it is now, so it covers nothing`)
    continue
  }
  const file = `std/${mod.slice("nish/".length)}.ts`
  for (const source of sources) {
    if (source?.rfc !== undefined) {
      covered.add(pairKey(file, source.rfc))
    }
  }
}

// The list: a missing file is an empty list, so a tree with no exemptions
// needs none.
const listFull = path.join(root, listRel)
const listText = fs.existsSync(listFull) ? fs.readFileSync(listFull, "utf8") : ""
const baseline = new Set()
const cites = new Map()
const linePattern = /^(std\/\S+\.ts) RFC(\d{1,5})(?: cites:(.*))?$/
for (const [i, raw] of listText.split("\n").entries()) {
  const line = raw.trimEnd()
  if (line === "" || line.startsWith("#")) {
    continue
  }
  const m = linePattern.exec(line)
  if (!m) {
    problems.push(
      `${listRel}:${i + 1}: not \`std/<file>.ts RFC<n>\` or \`std/<file>.ts RFC<n> cites: <reason>\`: ${line}`
    )
    continue
  }
  const key = pairKey(m[1], Number(m[2]))
  if (baseline.has(key) || cites.has(key)) {
    problems.push(`${listRel}:${i + 1}: ${key} is listed twice`)
  } else if (m[3] === undefined) {
    baseline.add(key)
  } else if (m[3].trim() === "") {
    problems.push(`${listRel}:${i + 1}: ${key}: a \`cites:\` line gives its reason`)
  } else {
    cites.set(key, m[3].trim())
  }
}

const added = []
for (const [key, line] of cited) {
  if (covered.has(key) || baseline.has(key) || cites.has(key)) {
    continue
  }
  added.push(key)
  if (!grow) {
    const [file, rfc] = key.split(" ")
    problems.push(
      `${file}:${line}: cites ${rfc}, which no vector spec of this module covers: land the module spec-first (contracts/README.md), or list \`${key} cites: <reason>\` in ${listRel} if it does not implement it`
    )
  }
}
for (const key of [...baseline, ...cites.keys()]) {
  if (update) {
    continue
  }
  if (covered.has(key)) {
    problems.push(`${key}: a contract covers it now; delete its line from ${listRel}`)
  } else if (!cited.has(key)) {
    problems.push(`${key}: no longer cited; delete its line from ${listRel}`)
  }
}
const kept = [...baseline].filter((key) => cited.has(key) && !covered.has(key))
const preRule = update ? [...kept, ...(grow ? added : [])] : [...baseline]
if (preRuleDigest(baseline) !== pin) {
  problems.push(
    update
      ? `${listRel}'s ${baseline.size} lines from before the rule are not the set ${pinName} pins: restore them (git checkout ${listRel}) and run --update-baseline again; it is the only way a line goes`
      : `${listRel}'s ${baseline.size} lines from before the rule are not the set ${pinName} pins: a line is never added, swapped or deleted by hand. A module that implements an RFC lands spec-first (contracts/README.md); a stale line goes with \`node scripts/rfc-specs.mjs --update-baseline\``
  )
}
if (update && problems.length === 0) {
  const cite = [...cites].filter(([key]) => cited.has(key) && !covered.has(key))
  const lines = [...kept, ...(grow ? added : [])].sort().map((key) => `${key}\n`)
  const citeLines = cite.sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, why]) => `${key} cites: ${why}\n`)
  fs.mkdirSync(path.dirname(listFull), { recursive: true })
  fs.writeFileSync(
    listFull,
    `${header}\n${lines.join("")}${citeLines.length > 0 ? `\n${citeLines.join("")}` : ""}`
  )
  for (const key of grow ? added : []) {
    console.log(`rfc-specs: grows ${listRel}: ${key}`)
  }
  const digest = preRuleDigest(preRule)
  if (digest !== pin) {
    if (live) {
      const self = import.meta.filename
      const source = fs
        .readFileSync(self, "utf8")
        .replace(/^const PRE_RULE_LINES = \d+$/m, `const PRE_RULE_LINES = ${preRule.length}`)
        .replace(/^const PRE_RULE_SHA256 = "[0-9a-f]+"$/m, `const PRE_RULE_SHA256 = "${digest}"`)
      fs.writeFileSync(self, source)
    }
    console.log(`rfc-specs: ${pinName} moves to ${digest} (${preRule.length} lines)`)
  }
}

if (problems.length > 0) {
  for (const p of problems) {
    console.error(`rfc-specs: ${p}`)
  }
  process.exit(1)
}
console.log(
  `rfc-specs: ${cited.size} RFC citations in std/, ${[...cited.keys()].filter((k) => covered.has(k)).length} covered by a spec, ${preRule.length} listed from before the rule, ${update ? [...cites.keys()].filter((k) => cited.has(k) && !covered.has(k)).length : cites.size} cited and not implemented`
)
