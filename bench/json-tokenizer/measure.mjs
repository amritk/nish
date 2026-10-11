#!/usr/bin/env node
// Times bench/json-tokenizer/main.ts against a byte-identical copy of its own
// binary, in interleaved rounds, so the noise band is measured on the same
// machine at the same time as the figure it bounds (CLAUDE.md, `Measured:`).
// Each round runs both binaries once, in alternating order; each run prints its
// checksum, which must agree, and its ns per body.
//
//   node bench/json-tokenizer/measure.mjs [--rounds 15] [--bodies 200000] [--compiler build/nish]
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..", "..")
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : fallback
}
const rounds = Number(flag("--rounds", "15"))
const bodies = flag("--bodies", "200000")
const compiler = path.resolve(root, flag("--compiler", "build/nish"))

const outDir = path.join(root, "build", "bench-json-tokenizer")
fs.rmSync(outDir, { recursive: true, force: true })
const app = path.join(outDir, "app")
const copy = path.join(outDir, "app-copy")
execFileSync(compiler, ["bench/json-tokenizer/main.ts", "-o", `${outDir}/`, "--link", app], {
  cwd: root,
  stdio: ["ignore", "ignore", "inherit"],
})
fs.copyFileSync(app, copy)
fs.chmodSync(copy, 0o755)

const runOnce = (exe) => {
  const [checksum, timing] = execFileSync(exe, [bodies], { encoding: "utf8" }).trim().split("\n")
  return { checksum, ns: Number.parseFloat(timing) }
}
const times = { app: [], copy: [] }
const checksums = new Set()
for (let r = 0; r < rounds; r++) {
  const order = r % 2 === 0 ? ["app", "copy"] : ["copy", "app"]
  for (const which of order) {
    const run = runOnce(which === "app" ? app : copy)
    checksums.add(run.checksum)
    times[which].push(run.ns)
  }
}
if (checksums.size !== 1) {
  process.stderr.write(`checksums disagree: ${[...checksums].join(", ")}\n`)
  process.exitCode = 1
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const min = (xs) => Math.min(...xs)
const pct = (a, b) => `${((Math.abs(a - b) / b) * 100).toFixed(1)}%`
const line = (name, xs) =>
  `${name.padEnd(5)} min ${min(xs).toFixed(0)} ns/body, median ${median(xs).toFixed(0)} ns/body`
process.stdout.write(
  `${rounds} interleaved rounds of ${bodies} bodies, checksum ${[...checksums].join(", ")}\n` +
    `${line("app", times.app)}\n${line("copy", times.copy)}\n` +
    `noise band (app against its byte-identical copy): min ${pct(min(times.app), min(times.copy))}, median ${pct(median(times.app), median(times.copy))}\n`
)
