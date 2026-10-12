#!/usr/bin/env node
// Times the typed decode of tests/link/std_json_typed (`--bench`, the workload
// #593 measured: `{"message":"Hello, World! NNNNNN"}` decoded into one reused
// object, its digits the iteration's) against a byte-identical copy of its own
// binary, in interleaved rounds, so the noise band is measured on the same
// machine at the same time as the figure it bounds (CLAUDE.md, `Measured:`).
// With `--before <nish>`, the program is built a second time by that compiler,
// whose own `std/` it links, and timed in the same rounds: the change between
// the two compilers' `nish/json-typed`, read against the band.
//
//   node bench/json-typed/measure.mjs [--rounds 9] [--decodes 2000000] [--compiler build/nish] [--before <nish>]
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const program = "tests/link/std_json_typed/main.ts"
const take = (argv, name) => {
  const at = argv.indexOf(name)
  if (at < 0 || at + 1 >= argv.length) {
    return { value: null, rest: argv }
  }
  return { value: argv[at + 1], rest: [...argv.slice(0, at), ...argv.slice(at + 2)] }
}
const before = take(process.argv.slice(2), "--before")
const after = compilerFrom(before.rest)
const rounds = Number(take(after.rest, "--rounds").value ?? "9")
const decodes = take(after.rest, "--decodes").value ?? "2000000"

const outDir = path.join(root, "build", "bench-json-typed")
fs.rmSync(outDir, { recursive: true, force: true })
const build = (cmd, prefix, name) => {
  const dir = path.join(outDir, name)
  const app = path.join(dir, "app")
  execFileSync(cmd, [...prefix, program, "-o", `${dir}/`, "--link", app], {
    cwd: root,
    stdio: ["ignore", "ignore", "pipe"],
  })
  return app
}
const apps = { app: build(after.cmd, after.prefix, "app") }
apps.copy = path.join(outDir, "app", "app-copy")
fs.copyFileSync(apps.app, apps.copy)
fs.chmodSync(apps.copy, 0o755)
if (before.value !== null) {
  const base = compilerFrom(["--compiler", before.value])
  apps.before = build(base.cmd, base.prefix, "before")
}
const names = Object.keys(apps)

const runOnce = (exe) => {
  const out = execFileSync(exe, ["--bench", decodes], { encoding: "utf8" }).trim()
  const match = /^checksum (-?\d+) ns\/op ([0-9.]+)$/.exec(out)
  if (match === null) {
    throw new Error(`${exe}: unexpected output ${out}`)
  }
  return { checksum: match[1], ns: Number.parseFloat(match[2]) }
}
const times = Object.fromEntries(names.map((n) => [n, []]))
const checksums = new Set()
for (let r = 0; r < rounds; r++) {
  // Each round starts one later in the list, so no binary is always first.
  for (let k = 0; k < names.length; k++) {
    const name = names[(r + k) % names.length]
    const run = runOnce(apps[name])
    checksums.add(run.checksum)
    times[name].push(run.ns)
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
const line = (name) =>
  `${name.padEnd(6)} min ${min(times[name]).toFixed(1)} ns/decode, median ${median(times[name]).toFixed(1)} ns/decode`
let report =
  `${rounds} interleaved rounds of ${decodes} decodes, checksum ${[...checksums].join(", ")}\n` +
  `${names.map(line).join("\n")}\n` +
  `noise band (app against its byte-identical copy): min ${pct(min(times.app), min(times.copy))}, median ${pct(median(times.app), median(times.copy))}\n`
if (before.value !== null) {
  const speed = (f) => (f(times.before) / f(times.app)).toFixed(2)
  report += `before / app: ${speed(min)}x (min), ${speed(median)}x (median)\n`
}
process.stdout.write(report)
