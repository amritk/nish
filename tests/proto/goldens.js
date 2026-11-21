#!/usr/bin/env node
/**
 * What `nish proto` answers for the `.proto` files in this directory,
 * checked in (WP72 S5, docs/wp72-proto-classes.md).
 *
 *   node tests/proto/goldens.js                   every file against its golden
 *   node tests/proto/goldens.js --update          rewrite the goldens from the compiler's output
 *   node tests/proto/goldens.js --nish <binary>   the compiler to ask (default build/nish-test)
 *
 * Each `<name>.proto` here is written, from this directory with relative
 * paths, as `<name>.ts`, which is then moved aside: the golden is
 * `<name>.ts.expected`, since a `.ts` file here would be a module no program
 * imports. Each `refused/<name>.proto` must exit 1, write nothing and print
 * exactly `refused/<name>.err` on stderr: the construct and its line.
 *
 * Prints one line per file, `ok <name>` or `FAIL <name>` with the first
 * differing line, and exits 1 when any fails.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const here = path.dirname(new URL(import.meta.url).pathname)
const root = path.resolve(here, "..", "..")
const argv = process.argv.slice(2)
const update = argv.includes("--update")
const nishAt = argv.indexOf("--nish")
const nish = nishAt >= 0 ? path.resolve(argv[nishAt + 1]) : path.join(root, "build", "nish-test")

let failed = 0

/** `ok`, or `FAIL` with the first line where `before` and `after` differ. */
const compare = (name, before, after) => {
  if (update || before === after) {
    console.log(`${update ? "wrote" : "ok"} ${name}`)
    return
  }
  failed++
  const was = (before ?? "").split("\n")
  const now = after.split("\n")
  let line = 0
  while (line < was.length && was[line] === now[line]) {
    line++
  }
  console.log(
    `FAIL ${name}: line ${line + 1}\n  golden: ${was[line] ?? "(end)"}\n  now:    ${now[line] ?? "(end)"}`
  )
}

/** The file's text, or null when it is not there. */
const readOrNull = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null)

const sources = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".proto"))
    .sort()

for (const source of sources(here)) {
  const name = source.slice(0, -".proto".length)
  const golden = path.join(here, `${name}.ts.expected`)
  const written = path.join(here, `${name}.ts`)
  fs.rmSync(written, { force: true })
  const run = spawnSync(nish, ["proto", source, "-o", `${name}.ts`], { cwd: here, encoding: "utf8" })
  const after = readOrNull(written)
  fs.rmSync(written, { force: true })
  if (run.status !== 0 || after === null) {
    failed++
    console.log(`FAIL ${name}: exit ${run.status}\n${run.stderr}`)
    continue
  }
  const before = readOrNull(golden)
  if (update) {
    fs.writeFileSync(golden, after)
  }
  compare(name, before, after)
}

const refusedDir = path.join(here, "refused")
for (const source of sources(refusedDir)) {
  const name = `refused/${source.slice(0, -".proto".length)}`
  const golden = path.join(here, `${name}.err`)
  const written = path.join(here, `${name}.ts`)
  fs.rmSync(written, { force: true })
  const run = spawnSync(nish, ["proto", `${name}.proto`, "-o", `${name}.ts`], { cwd: here, encoding: "utf8" })
  const wrote = fs.existsSync(written)
  fs.rmSync(written, { force: true })
  if (run.status !== 1 || wrote) {
    failed++
    console.log(`FAIL ${name}: exit ${run.status}, ${wrote ? "wrote a" : "no"} module\n${run.stderr}`)
    continue
  }
  const before = readOrNull(golden)
  if (update) {
    fs.writeFileSync(golden, run.stderr)
  }
  compare(name, before, run.stderr)
}
process.exit(failed === 0 ? 0 : 1)
