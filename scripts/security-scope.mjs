#!/usr/bin/env node
// Every file of the attacker-facing surface is named in a security record's
// scope, or listed in the index's "Not yet audited" table with a reason.
//
//   node scripts/security-scope.mjs            check the tree (CI + npm test)
//   node scripts/security-scope.mjs --root D   check the tree under D instead
//
// The surface is `std/net/**/*.ts`, `std/crypto/*.ts` and `runtime/*.c`. A file
// is in scope when its repository path, or a glob that matches it, is
// backticked in the first cell of a row of a record's `## Scope` table, or in
// the Scope column of `docs/security/README.md`'s Areas table. A row of the
// "Not yet audited" table is refused when its file is covered or gone, so the
// list only shrinks. The rule it checks is CLAUDE.md's: new attacker-facing
// code ships with its record.
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const at = args.indexOf("--root")
const root = at >= 0 ? path.resolve(args[at + 1]) : path.resolve(import.meta.dirname, "..")
const securityDir = path.join(root, "docs", "security")

const walk = (dir, keep) => {
  if (!fs.existsSync(path.join(root, dir))) {
    return []
  }
  const out = []
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      out.push(...walk(rel, keep))
    } else if (keep(entry.name)) {
      out.push(rel)
    }
  }
  return out
}

const surface = [
  ...walk("std/net", (n) => n.endsWith(".ts")),
  ...fs
    .readdirSync(path.join(root, "std", "crypto"))
    .filter((n) => n.endsWith(".ts"))
    .map((n) => `std/crypto/${n}`),
  ...fs
    .readdirSync(path.join(root, "runtime"))
    .filter((n) => n.endsWith(".c"))
    .map((n) => `runtime/${n}`),
].sort()

const ticked = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim())
const cells = (line) => line.split("|").slice(1, -1)

// A glob here is a path with `*` in its last part, nothing more.
const matches = (pattern, file) => {
  if (!pattern.includes("*")) {
    return pattern === file
  }
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`)
  return re.test(file)
}

const patterns = new Set()
const index = fs.readFileSync(path.join(securityDir, "README.md"), "utf8").split("\n")
for (const name of fs.readdirSync(securityDir)) {
  if (!name.endsWith(".md") || name === "README.md") {
    continue
  }
  const lines = fs.readFileSync(path.join(securityDir, name), "utf8").split("\n")
  let inScope = false
  for (const line of lines) {
    if (line.startsWith("## ")) {
      inScope = line.trim() === "## Scope"
    } else if (inScope && line.startsWith("|")) {
      for (const t of ticked(cells(line)[0] ?? "")) {
        patterns.add(t)
      }
    }
  }
}

// The Areas table: its Scope column is the third. The "Not yet audited" table:
// file, then reason.
const pending = new Map()
let table = ""
for (const line of index) {
  if (line.startsWith("## ")) {
    table = line.slice(3).trim()
  }
  if (
    !line.startsWith("|") ||
    line.startsWith("| ---") ||
    line.startsWith("| Area") ||
    line.startsWith("| File")
  ) {
    continue
  }
  const row = cells(line)
  if (table === "Areas") {
    for (const t of ticked(row[2] ?? "")) {
      patterns.add(t)
    }
  }
  if (table === "Not yet audited") {
    const [file] = ticked(row[0] ?? "")
    if (file) {
      pending.set(file, (row[1] ?? "").trim())
    }
  }
}

const problems = []
const covered = (file) => [...patterns].some((p) => matches(p, file))
for (const file of surface) {
  if (covered(file)) {
    if (pending.has(file)) {
      problems.push(`${file}: in a record's scope, so its "Not yet audited" row goes`)
    }
  } else if (!pending.has(file)) {
    problems.push(`${file}: in no record's scope; it ships with its docs/security/ record (CLAUDE.md)`)
  }
}
for (const [file, reason] of pending) {
  if (!surface.includes(file)) {
    problems.push(`${file}: listed under "Not yet audited" but not on the surface`)
  } else if (reason === "") {
    problems.push(`${file}: its "Not yet audited" row gives no reason`)
  }
}

if (problems.length > 0) {
  for (const p of problems) {
    console.error(`security-scope: ${p}`)
  }
  process.exit(1)
}
console.log(
  `security-scope: ${surface.length} files, ${surface.length - pending.size} in a record, ${pending.size} not yet audited`
)
