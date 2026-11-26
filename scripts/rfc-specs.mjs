#!/usr/bin/env node
// Every RFC a std/ module cites is covered by a vector spec of that module, or
// listed in scripts/rfc-unspecified.txt.
//
//   node scripts/rfc-specs.mjs                     check the tree (npm run lint, npm test's spec section)
//   node scripts/rfc-specs.mjs --update-baseline   drop the listed lines that are now covered or gone,
//                                                  refusing to add one
//   node scripts/rfc-specs.mjs --grow-baseline     the same, adding lines: only for a change to the rule
//   node scripts/rfc-specs.mjs --root D            check the tree under D instead
//
// A citation is `RFC` and a number, in any std/**/*.ts file, comments included:
// the file is read as text, so a citation a parser would miss still counts. A
// contract `contracts/<n>.json` covers the pair (std/<module>.ts, RFC n) for
// its `target.module` `nish/<module>` and each `sources[].rfc`; vector writes
// both fields when it extracts the contract from its spec, so they are what the
// spec profiles, not what anyone says it does.
//
// The list has two kinds of line:
//
//   std/net/quic.ts RFC9000                       predates the rule; the list of these only shrinks
//   std/net/http.ts RFC8441 cites: out of scope   cited, not implemented, with the reason
//
// A citation is an implementation unless a `cites:` line says otherwise, so a
// new module that implements an RFC fails until its spec lands. A covered or
// no longer cited pair fails while it is still listed, so the list cannot keep
// an exemption the tree no longer needs. CLAUDE.md, "Definition of done", has
// the rule; contracts/README.md has the spec-first walk.
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const at = args.indexOf("--root")
const root = at >= 0 ? path.resolve(args[at + 1]) : path.resolve(import.meta.dirname, "..")
const flags = args.filter((a, i) => a.startsWith("--") && a !== "--root" && args[i - 1] !== "--root")
const known = ["--update-baseline", "--grow-baseline"]
const unknown = flags.filter((f) => !known.includes(f))
if (unknown.length > 0) {
  console.error(
    `rfc-specs: unknown argument ${unknown.join(" ")}; the flags are --update-baseline, --grow-baseline and --root D`
  )
  process.exit(2)
}
const grow = flags.includes("--grow-baseline")
const update = grow || flags.includes("--update-baseline")

const listRel = "scripts/rfc-unspecified.txt"
const header = `# RFCs a std/ module cites that no vector spec of that module covers.
#
# \`node scripts/rfc-specs.mjs\` (npm run lint) fails on a citation in std/ that no
# contract covers and no line lists, and on a line whose pair is now covered or
# no longer cited. A module that implements an RFC lands spec-first
# (contracts/README.md): its spec's contract covers the pair, and its line goes.
#
#   std/<file>.ts RFC<n>                    predates the rule. These only shrink:
#                                           --update-baseline drops them and refuses
#                                           to add one; --grow-baseline adds them,
#                                           only for a change to the rule itself
#   std/<file>.ts RFC<n> cites: <reason>    the file cites the RFC and does not
#                                           implement it; the reason says why
`

/** Every std/**\/*.ts file, as repository paths. */
const walk = (dir) => {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) {
    return []
  }
  const out = []
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      out.push(...walk(rel))
    } else if (entry.name.endsWith(".ts")) {
      out.push(rel)
    }
  }
  return out
}

// `RFC 9000`, `RFC9000`, `RFC-9000`, `RFC 9000`. A lowercase `rfc822Name`
// is an X.509 field, not a citation.
const citation = /RFC[\s-]*(\d{3,5})\b/g
const pairKey = (file, rfc) => `${file} RFC${rfc}`

const cited = new Map()
for (const file of walk("std").sort()) {
  const text = fs.readFileSync(path.join(root, file), "utf8")
  for (const m of text.matchAll(citation)) {
    const key = pairKey(file, Number(m[1]))
    const line = text.slice(0, m.index).split("\n").length
    if (!cited.has(key)) {
      cited.set(key, line)
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
  let contract
  try {
    contract = JSON.parse(fs.readFileSync(path.join(contractsDir, name), "utf8"))
  } catch (e) {
    problems.push(`contracts/${name}: does not parse: ${e.message}`)
    continue
  }
  const mod = contract?.target?.module
  if (typeof mod !== "string" || !mod.startsWith("nish/")) {
    problems.push(`contracts/${name}: target.module is ${JSON.stringify(mod)}, not a nish/ module`)
    continue
  }
  const file = `std/${mod.slice("nish/".length)}.ts`
  for (const source of Array.isArray(contract.sources) ? contract.sources : []) {
    if (Number.isInteger(source?.rfc)) {
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
const linePattern = /^(std\/\S+\.ts) RFC(\d{3,5})(?: cites:(.*))?$/
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
const kept = [...baseline].filter((key) => cited.has(key) && !covered.has(key))
for (const key of [...baseline, ...cites.keys()]) {
  if (covered.has(key) && !update) {
    problems.push(`${key}: a contract covers it now; delete its line from ${listRel}`)
  } else if (!(cited.has(key) || update)) {
    problems.push(`${key}: no longer cited; delete its line from ${listRel}`)
  }
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
}

if (problems.length > 0) {
  for (const p of problems) {
    console.error(`rfc-specs: ${p}`)
  }
  process.exit(1)
}
const listed = update ? kept.length + (grow ? added.length : 0) : baseline.size
console.log(
  `rfc-specs: ${cited.size} RFC citations in std/, ${[...cited.keys()].filter((k) => covered.has(k)).length} covered by a spec, ${listed} listed from before the rule, ${cites.size} cited and not implemented`
)
