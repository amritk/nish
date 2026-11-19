#!/usr/bin/env node
/**
 * The modules `nish c-import` writes for the headers in this directory,
 * checked in (WP66 S2).
 *
 *   node tests/c-import/goldens.js                   every header's module against its golden
 *   node tests/c-import/goldens.js --update          rewrite the goldens from the compiler's output
 *   node tests/c-import/goldens.js --nish <binary>   the compiler to ask (default build/nish-test)
 *
 * Each `<name>.h` is imported with `<name>.overrides.json` when there is one,
 * for `--target x86_64-unknown-linux-gnu` unless the header's name ends in
 * `-wasm32`, from this directory with relative paths, so the module's
 * `Regenerate:` line and every answer clang gives are the same on any host
 * clang runs on. The golden is `<name>.ts.expected`: the module is written
 * as `<name>.ts`, so its `Regenerate:` line reads as a user's would, then
 * moved aside, since a `.ts` file here would be a module no program imports.
 *
 * Prints one line per header, `ok <name>` or `FAIL <name>` with the first
 * differing line, and exits 1 when any fails (2 when clang is missing).
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

if (spawnSync("clang", ["--version"]).status !== 0) {
  console.log("skipped: c-import goldens: no clang")
  process.exit(2)
}

const headers = fs
  .readdirSync(here)
  .filter((f) => f.endsWith(".h"))
  .sort()
let failed = 0
for (const header of headers) {
  const name = header.slice(0, -2)
  const golden = `${name}.ts.expected`
  const written = path.join(here, `${name}.ts`)
  const target = name.endsWith("-wasm32") ? "wasm32-unknown-unknown" : "x86_64-unknown-linux-gnu"
  const args = ["c-import", header]
  if (fs.existsSync(path.join(here, `${name}.overrides.json`))) {
    args.push("--overrides", `${name}.overrides.json`)
  }
  args.push("--target", target, "-o", `${name}.ts`)
  const before = fs.existsSync(path.join(here, golden))
    ? fs.readFileSync(path.join(here, golden), "utf8")
    : null
  fs.rmSync(written, { force: true })
  const run = spawnSync(nish, args, { cwd: here, encoding: "utf8" })
  const after = fs.existsSync(written) ? fs.readFileSync(written, "utf8") : null
  fs.rmSync(written, { force: true })
  if (update && after !== null) {
    fs.writeFileSync(path.join(here, golden), after)
  }
  if (run.status !== 0 || after === null) {
    failed++
    console.log(`FAIL ${name}: exit ${run.status}\n${run.stderr}`)
  } else if (update || before === after) {
    console.log(`${update ? "wrote" : "ok"} ${name}`)
  } else {
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
}
process.exit(failed === 0 ? 0 : 1)
