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
 * A header may also have `<name>.refusals.json`: a list of
 * `{ "overrides": {...}, "message": "..." }`, each an override file the
 * import must refuse, exiting 1, writing nothing and printing the message.
 *
 * Prints one line per header, `ok <name>` or `FAIL <name>` with the first
 * differing line, and exits 1 when any fails (2 when clang is missing).
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
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

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "nish-c-import-refusals-"))
for (const header of headers) {
  const name = header.slice(0, -2)
  const listed = path.join(here, `${name}.refusals.json`)
  if (!fs.existsSync(listed)) {
    continue
  }
  const out = path.join(scratch, `${name}.ts`)
  const file = path.join(scratch, `${name}.overrides.json`)
  for (const [at, { overrides, message }] of JSON.parse(fs.readFileSync(listed, "utf8")).entries()) {
    fs.writeFileSync(file, JSON.stringify(overrides))
    fs.rmSync(out, { force: true })
    const target = name.endsWith("-wasm32") ? "wasm32-unknown-unknown" : "x86_64-unknown-linux-gnu"
    const run = spawnSync(nish, ["c-import", header, "--overrides", file, "--target", target, "-o", out], {
      cwd: here,
      encoding: "utf8",
    })
    if (run.status === 1 && run.stderr.includes(message) && !fs.existsSync(out)) {
      console.log(`ok ${name} refusal ${at + 1}`)
    } else {
      failed++
      console.log(
        `FAIL ${name} refusal ${at + 1}: exit ${run.status}\n  wanted: ${message}\n  stderr: ${run.stderr}`
      )
    }
  }
}
fs.rmSync(scratch, { recursive: true, force: true })
process.exit(failed === 0 ? 0 : 1)
