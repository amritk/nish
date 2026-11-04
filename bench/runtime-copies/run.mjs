#!/usr/bin/env node
// The copy and bounds-check shapes of bench/runtime-copies/main.ts in
// nanoseconds an iteration: the cases the stdlib benches spend their copies
// and checks on, each alone in a loop (README.md says where each was found).
// It builds main.ts, then times every case in bench/json-compare/rounds.mjs's
// interleaved rounds with a byte-identical copy as a column, whose distance
// from the build is the noise band.
//
//   npm run build && node bench/runtime-copies/run.mjs [options] [--compiler <nish>]
//     --validate         build, run every case once and check its pinned
//                        checksum, and stop: no timing
//     --rounds N         timed rounds a case runs at least (default 11); the
//                        median is reported with the min–max spread
//     --cpu <cpu>        x86-64, the baseline and the default, or x86-64-v3,
//                        the compiler's --cpu, for every build this script makes
//     --base-compiler <nish>
//                        also build main.ts with this compiler, as the column
//                        `base` with its own copy `base-copy`: the before
//                        column of a change to src/ or runtime/ (a compiler
//                        built before it, copied into build/ so it finds this
//                        checkout's std/ and runtime/)
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable)
//     --case <name>      time only this case (repeatable)
//
// The build is main.ts by the compiler with `--profile speed`, into
// build/bench/runtime-copies/<cpu>/. Each case calibrates one iteration count
// on the build so a run takes about 200 ms, and every column runs that count.
//
// Before timing, every column runs each case once and must print the case's
// `known` checksum, pinned from one iteration of main.ts: that, not the
// columns agreeing, is what says each build did the same work. Every timed
// run must then print the same checksum as the first, or the run stops.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const nishc = compilerFrom(process.argv)

/** Each case as `main <case> <iterations>` takes it, and the checksum one iteration prints. */
const CASES = [
  { name: "chars", known: "b6312942" },
  { name: "small-copies", known: "e161f085" },
  { name: "grow", known: "6e1e20ca" },
  { name: "checked", known: "2c54b9c5" },
  { name: "json-strings", known: "7fb1dc1f" },
]
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/runtime-copies/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
let validate = false
let cpu = "x86-64"
let baseCompiler = null
const only = []
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  const a = argv[i]
  if (a === "--rounds") {
    rounds = Number(argv[++i])
  } else if (a === "--validate") {
    validate = true
  } else if (a === "--cpu") {
    cpu = argv[++i] ?? ""
  } else if (a === "--base-compiler") {
    baseCompiler = path.resolve(argv[++i] ?? "")
  } else if (a === "--case") {
    only.push(argv[++i] ?? "")
  } else if (a === "--binary") {
    const spec = argv[++i] ?? ""
    const eq = spec.indexOf("=")
    const file = path.resolve(eq > 0 ? spec.slice(eq + 1) : spec)
    binaries.push({ id: eq > 0 ? spec.slice(0, eq) : path.relative(root, file), bin: file })
  } else {
    fail(`unknown option ${a}`)
  }
}
if (!(Number.isInteger(rounds) && rounds >= 1)) {
  fail("--rounds needs a positive count")
}
if (cpu !== "x86-64" && cpu !== "x86-64-v3") {
  fail(`--cpu takes x86-64 or x86-64-v3, got ${cpu}`)
}
for (const name of only) {
  if (!CASES.some((c) => c.name === name)) {
    fail(`--case ${name}: no such case (${CASES.map((c) => c.name).join(", ")})`)
  }
}
if (baseCompiler !== null && !fs.existsSync(baseCompiler)) {
  fail(`--base-compiler ${baseCompiler}: no such file`)
}
for (const b of binaries) {
  if (!fs.existsSync(b.bin)) {
    fail(`--binary ${b.bin}: no such file`)
  }
}
const cases = only.length === 0 ? CASES : CASES.filter((c) => only.includes(c.name))

/** Runs `cmd` to completion and stops the script if it fails. */
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.error !== undefined || r.status !== 0) {
    fail(`${cmd} ${args.join(" ")}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

/** Builds main.ts with `cmd prefix` in `cwd` into `dir` and answers the executable. */
const buildIn = (cmd, prefix, cwd, dir) => {
  fs.mkdirSync(dir, { recursive: true })
  const exe = path.join(dir, "copies")
  const rel = (p) => path.relative(cwd, p)
  run(
    cmd,
    [
      ...prefix,
      "bench/runtime-copies/main.ts",
      "-o",
      `${rel(dir)}/`,
      "--link",
      rel(exe),
      "--profile",
      "speed",
      ...(cpu === "x86-64" ? [] : ["--cpu", cpu]),
    ],
    cwd
  )
  // A copy rather than the same path twice, as bench/crypto/run.mjs makes one:
  // each column is its own file, mapped on its own.
  fs.copyFileSync(exe, `${exe}-copy`)
  return exe
}

const out = path.join(root, "build", "bench", "runtime-copies")
const exe = buildIn(nishc.cmd, nishc.prefix, root, path.join(out, cpu))
/** The columns, each `{ id, bin }`, the build first and its copy second. */
const columns = [
  { id: "nish", bin: exe },
  { id: "nish-copy", bin: `${exe}-copy` },
]

if (baseCompiler !== null) {
  const baseExe = buildIn(baseCompiler, [], root, path.join(out, `${cpu}-base`))
  columns.push({ id: "base", bin: baseExe }, { id: "base-copy", bin: `${baseExe}-copy` })
}
columns.push(...binaries)

/** One run under bench/crypto/README.md's contract: `{ checksum, ns }`. */
const runOnce = (column, c, iterations) => {
  const r = spawnSync(column.bin, [c.name, String(iterations)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    fail(
      `${column.id} ${c.name} ${iterations}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`
    )
  }
  return { checksum: sum[1], ns: Number(ns[1]) }
}

for (const c of cases) {
  for (const col of columns) {
    const r = runOnce(col, c, 1)
    if (r.checksum !== c.known) {
      fail(`${col.id} ${c.name} printed checksum ${r.checksum} for one iteration, not the known ${c.known}`)
    }
  }
}
if (validate) {
  console.log(
    `bench/runtime-copies: ${cases.length} cases, ${columns.length} columns, every checksum as pinned`
  )
  process.exit(0)
}

/** An iteration count that makes the build take about TARGET_NS on `c`. */
const calibrate = (c) => {
  let iterations = 1
  for (;;) {
    const r = runOnce(columns[0], c, iterations)
    if (r.ns >= TARGET_NS / 10 || iterations >= 1 << 30) {
      return Math.max(1, Math.round((iterations * TARGET_NS) / Math.max(r.ns, 1)))
    }
    iterations *= Math.min(100, Math.max(2, Math.ceil(TARGET_NS / 10 / Math.max(r.ns, 1))))
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** `to` against `from` as a percentage of `from`: + is slower. */
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`

const info = fs.existsSync("/proc/cpuinfo") ? fs.readFileSync("/proc/cpuinfo", "utf8") : ""
const model = /^model name\s*:\s*(.*)$/m.exec(info)?.[1] ?? os.cpus()[0]?.model ?? "unknown"
const flags = new Set((/^flags\s*:\s*(.*)$/m.exec(info)?.[1] ?? "").split(" "))
const stamp = ["avx2", "bmi2", "sha_ni", "avx512f"].map((f) => `${f} ${flags.has(f) ? "yes" : "no"}`)
console.log(`CPU: ${model}, ${os.cpus().length} cores; ${stamp.join(", ")}; built --cpu ${cpu}`)
if (baseCompiler !== null) {
  console.log(`base: built by ${path.relative(root, baseCompiler)}`)
}

const WIDTHS = [10, 12, 22, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "median (min–max) ns", "vs nish"]))

const n = roundsFor(columns.length, rounds)
for (const c of cases) {
  const iterations = calibrate(c)
  const times = new Map(columns.map((col) => [col.id, []]))
  let checksum = null
  for (let round = 0; round < n; round++) {
    for (const col of roundOrder(columns, round)) {
      const r = runOnce(col, c, iterations)
      if (checksum !== null && r.checksum !== checksum) {
        fail(`${col.id} ${c.name} printed checksum ${r.checksum}, not ${checksum}`)
      }
      checksum = r.checksum
      times.get(col.id).push(r.ns / iterations)
    }
  }
  const nish = median(times.get("nish"))
  for (const col of columns) {
    const ts = times.get(col.id)
    const m = median(ts)
    const cell = `${m.toFixed(1)} (${Math.min(...ts).toFixed(1)}–${Math.max(...ts).toFixed(1)})`
    console.log(line([c.name, col.id, cell, col.id === "nish" ? "" : pct(nish, m)]))
  }
  const band = (id, of) => (Math.abs(median(times.get(id)) / median(times.get(of)) - 1) * 100).toFixed(1)
  console.log(
    `${"".padEnd(WIDTHS[0])} ${iterations} iterations a run, checksum ${checksum}; band ±${band("nish-copy", "nish")}%` +
      (baseCompiler !== null ? `, base ±${band("base-copy", "base")}%` : "")
  )
}
console.log(
  `\n${n} rounds of ${columns.length} columns a case. ns is one iteration of a case: a run's ns over its` +
    " iterations. The band is a copy's median against its build's, the same bytes; a change inside it is noise."
)
