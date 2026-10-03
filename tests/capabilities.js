#!/usr/bin/env node
/**
 * The capability audit is total (WP35, docs/wp35-capabilities.md §2).
 *
 *   node tests/capabilities.js                 check the live sources
 *   node tests/capabilities.js --src <dir>     check a copy (the mutation checks in tests/run.js)
 *
 * Every builtin the checker accepts must have exactly one row in
 * `builtinCapability` (`src/capabilities.ts`), a capability or a deliberate
 * none, and every row must name a builtin the checker accepts. The compiler
 * enforces the first half itself, but only for a builtin some program calls:
 * the walk that meets an unlabelled one stops with exit 70. This check is what
 * fails a new builtin the day it is added, before anything calls it.
 *
 * It reads the sources rather than a compiler, as `scripts/gen-diagnostic-codes.mjs`
 * reads `src/codes.ts`, because the question is about the tables themselves:
 * which names the checker's own lists spell. The names come from
 *
 *   - `isBuiltinFunction` and `conversionTarget` (`src/builtins.ts`), the plain callees;
 *   - `SUPPORTED_BUILTINS`, the dotted callees the checker's refusal lists;
 *   - `checkNamespaceProperty`, the namespace properties (`Math.PI`, `process.argv`);
 *   - `isResultConstructor` (`src/result.ts`), `Ok` and `Err`;
 *   - `netSignature` and `isNetExport` (`src/nish-modules.ts`), every `nish:net` export;
 *   - `nishModuleExports`, every `nish:` export, by the builtin it renames.
 *
 * A shape this cannot read is a failure rather than an empty list, so a
 * refactor of one of those functions cannot quietly turn the check off.
 */
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const at = process.argv.indexOf("--src")
const srcDir = at >= 0 ? path.resolve(process.argv[at + 1]) : path.join(root, "src")

const problems = []
const read = (file) => fs.readFileSync(path.join(srcDir, file), "utf8")

/** The text of `const <name> = ...` up to the next top-level declaration. */
const declaration = (text, name, file) => {
  const start = text.indexOf(`const ${name} = `)
  if (start < 0) {
    problems.push(`${file}: no \`${name}\` to read`)
    return ""
  }
  const rest = text.slice(start + 1)
  const end = rest.search(/\n(?:export )?const /)
  return end < 0 ? rest : rest.slice(0, end)
}

/** Every `name === "x"` in a piece of source. */
const comparedNames = (text) => [...text.matchAll(/\bname === "([\w.]+)"/g)].map((m) => m[1])

const builtins = read("builtins.ts")
const modules = read("nish-modules.ts")
const results = read("result.ts")
const table = read("capabilities.ts")

// The plain callees: the conversions, then everything else `isBuiltinFunction` names.
const plain = [
  ...comparedNames(declaration(builtins, "conversionTarget", "builtins.ts")),
  ...comparedNames(declaration(builtins, "isBuiltinFunction", "builtins.ts")),
]
const netExports = [
  ...comparedNames(declaration(modules, "netSignature", "nish-modules.ts")),
  ...comparedNames(declaration(modules, "isNetExport", "nish-modules.ts")),
]
if (!declaration(builtins, "isBuiltinFunction", "builtins.ts").includes("isNetExport(name)")) {
  problems.push(
    "builtins.ts: `isBuiltinFunction` no longer admits `isNetExport(name)`; read its new shape here"
  )
}
const supported = /const SUPPORTED_BUILTINS: string =\s*((?:"[^"]*"\s*\+?\s*)+)/.exec(builtins)
// One string split over several literals, so the pieces are joined first.
const dotted =
  supported === null
    ? []
    : [...supported[1].matchAll(/"([^"]*)"/g)]
        .map((m) => m[1])
        .join("")
        .split(", ")
if (dotted.length === 0) {
  problems.push("builtins.ts: no `SUPPORTED_BUILTINS` list to read")
}
const properties = []
for (const line of declaration(builtins, "checkNamespaceProperty", "builtins.ts").split("\n")) {
  const ns = /namespace === "(\w+)" && \(?(.*)\)? \{$/.exec(line.trim())
  if (ns !== null) {
    for (const m of ns[2].matchAll(/member === "(\w+)"/g)) {
      properties.push(`${ns[1]}.${m[1]}`)
    }
  }
}
if (properties.length === 0) {
  problems.push("builtins.ts: no namespace property to read in `checkNamespaceProperty`")
}
const constructors = comparedNames(declaration(results, "isResultConstructor", "result.ts"))

const accepted = new Set([...plain, ...netExports, ...dotted, ...properties, ...constructors])

// Every `nish:` export renames a builtin: itself when it is a plain one, and
// the `process.` one of its name otherwise (`exit`, `argv`, ...).
const exportLists = [
  ...declaration(modules, "nishModuleExports", "nish-modules.ts").matchAll(/return "([^"]+)"/g),
]
if (exportLists.length === 0) {
  problems.push("nish-modules.ts: no export list to read in `nishModuleExports`")
}
for (const list of exportLists) {
  for (const name of list[1].split(", ")) {
    if (!accepted.has(name) && !accepted.has(`process.${name}`)) {
      problems.push(`nish-modules.ts: the export \`${name}\` renames no builtin this check knows`)
    }
  }
}

// The table: each row once, `isNetExport(name)` standing for every `nish:net` export.
const capability = declaration(table, "builtinCapability", "capabilities.ts")
const rows = comparedNames(capability)
const viaNet = capability.includes("isNetExport(name)")
const labelled = new Map()
for (const row of [...rows, ...(viaNet ? netExports : [])]) {
  labelled.set(row, (labelled.get(row) ?? 0) + 1)
}
for (const name of [...accepted].sort()) {
  const count = labelled.get(name) ?? 0
  if (count === 0) {
    problems.push(`capabilities.ts: the builtin \`${name}\` has no row in \`builtinCapability\``)
  } else if (count > 1) {
    problems.push(`capabilities.ts: the builtin \`${name}\` has ${count} rows in \`builtinCapability\``)
  }
}
for (const row of new Set(rows)) {
  if (!accepted.has(row)) {
    problems.push(`capabilities.ts: the row \`${row}\` names no builtin the checker accepts`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem)
  }
  console.error(`capabilities: ${problems.length} problem(s) in the audit of ${accepted.size} builtins`)
  process.exit(1)
}
console.log(`capabilities: all ${accepted.size} builtins carry exactly one label`)
