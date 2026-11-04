#!/usr/bin/env node
// The HTTP/1.1 request path in nanoseconds a case: request heads fed to one
// `Http1Connection` with no socket, answered through `respond`, and drained
// (bench/http1-request/main.ts says what each case holds). It builds main.ts,
// then times every case in bench/json-compare/rounds.mjs's interleaved rounds
// with a byte-identical copy as a column, whose distance from the build is the
// noise band.
//
//   npm run build && node bench/http1-request/run.mjs [options] [--compiler <nish>]
//     --validate         build, run every case once and check its pinned
//                        checksum, and stop: no timing
//     --instructions     count, instead of timing, the instructions one
//                        iteration and one request of every case executes in
//                        each build (the copies left out), under valgrind's
//                        cachegrind with --cache-sim=no: a run of 2N
//                        iterations less a run of N, over N, so start-up and
//                        calibration cancel. The figure the ranking rests on;
//                        the same with --cpu and --base as the timing
//     --rounds N         timed rounds a case runs at least (default 11); the
//                        median is reported with the min–max spread
//     --cpu <cpu>        x86-64, the baseline and the default, or x86-64-v3,
//                        the compiler's --cpu, for every build this script makes
//     --base <rev>       also build main.ts against std/ as <rev> has it, as
//                        the column `base` with its own copy `base-copy`: the
//                        before column of a change to std/net
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable)
//     --case <name>      time only this case (repeatable)
//
// The build is main.ts by the compiler with `--profile speed`, into
// build/bench/http1-request/<cpu>/. `--base` extracts std/, runtime/,
// scripts/ and bench/crypto/lib/ at <rev> with `git archive` into
// build/bench/http1-request/base-<rev>/ beside a copy of the compiler, and
// builds this checkout's main.ts there, so the two columns differ only in the
// library. Each case calibrates one iteration count on the build so a run
// takes about 200 ms, and every column runs that count.
//
// Before timing, every column runs each case once and must print the case's
// `known` checksum, pinned from one iteration of main.ts before any change to
// the codec: that, not the columns agreeing, is what says the requests were
// parsed and answered the same. Every timed run must then print the same
// checksum as the first, or the run stops.
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

/**
 * Each case as `main <case> <iterations>` takes it, the requests one
 * iteration holds, and the checksum one iteration prints.
 */
const CASES = [
  { name: "browser", requests: 1, known: "a9dc71a8" },
  { name: "api", requests: 1, known: "6b37847a" },
  { name: "short", requests: 1, known: "f730d88a" },
  { name: "pipelined", requests: 2, known: "2569067a" },
  { name: "split", requests: 1, known: "f0a2967d" },
  { name: "json1k", requests: 1, known: "ce28ee06" },
  { name: "json4k", requests: 1, known: "4a907f5a" },
  { name: "json16k", requests: 1, known: "c873f212" },
  { name: "json40k", requests: 1, known: "e2585b39" },
]
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/http1-request/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
let validate = false
let instructions = false
let cpu = "x86-64"
let baseRev = null
const only = []
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  const a = argv[i]
  if (a === "--rounds") {
    rounds = Number(argv[++i])
  } else if (a === "--validate") {
    validate = true
  } else if (a === "--instructions") {
    instructions = true
  } else if (a === "--cpu") {
    cpu = argv[++i] ?? ""
  } else if (a === "--base") {
    baseRev = argv[++i] ?? ""
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
  const exe = path.join(dir, "h1")
  const rel = (p) => path.relative(cwd, p)
  run(
    cmd,
    [
      ...prefix,
      "bench/http1-request/main.ts",
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

const out = path.join(root, "build", "bench", "http1-request")
const exe = buildIn(nishc.cmd, nishc.prefix, root, path.join(out, cpu))
/** The columns, each `{ id, bin }`, the build first and its copy second. */
const columns = [
  { id: "nish", bin: exe },
  { id: "nish-copy", bin: `${exe}-copy` },
]

if (baseRev !== null) {
  const sha = run("git", ["rev-parse", "--verify", `${baseRev}^{commit}`], root).trim()
  const tree = path.join(out, `base-${sha.slice(0, 12)}`)
  if (!fs.existsSync(path.join(tree, "std"))) {
    fs.mkdirSync(tree, { recursive: true })
    const tar = spawnSync("git", ["archive", sha, "std", "runtime", "scripts", "bench/crypto/lib"], {
      cwd: root,
      maxBuffer: 1 << 30,
    })
    if (tar.status !== 0) {
      fail(`git archive ${sha}: ${tar.stderr}`)
    }
    const x = spawnSync("tar", ["-x", "-C", tree], { input: tar.stdout })
    if (x.status !== 0) {
      fail(`tar -x into ${tree}: ${x.stderr}`)
    }
  }
  // The compiler finds std/ beside the directory it runs from, so a native
  // compiler is copied into the tree; a Node entry point is run from it.
  let cmd = nishc.cmd
  const prefix = nishc.prefix
  if (prefix.length === 0) {
    fs.mkdirSync(path.join(tree, "build"), { recursive: true })
    cmd = path.join(tree, "build", "nish")
    fs.copyFileSync(nishc.cmd, cmd)
    fs.chmodSync(cmd, 0o755)
  } else {
    fail("--base needs a native compiler (build/nish), not a Node entry point")
  }
  fs.mkdirSync(path.join(tree, "bench", "http1-request"), { recursive: true })
  fs.copyFileSync(path.join(here, "main.ts"), path.join(tree, "bench", "http1-request", "main.ts"))
  const baseExe = buildIn(cmd, prefix, tree, path.join(tree, "build", "bench", cpu))
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
    `bench/http1-request: ${cases.length} cases, ${columns.length} columns, every checksum as pinned`
  )
  process.exit(0)
}

/**
 * glibc's choice of `memcpy` and `memset`, pinned to the SSE2 baseline as
 * bench/run.mjs pins it for its counts, so the count does not depend on the
 * host's AVX2 or ERMS.
 */
const PINNED_LIBC = [
  "glibc.cpu.hwcaps=-AVX_Fast_Unaligned_Load,-AVX2,-AVX512F,-AVX512VL,-ERMS,-FSRM,-SSSE3",
  "glibc.cpu.x86_non_temporal_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_movsb_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_stosb_threshold=0x0fffffffffffffff",
].join(":")

/** The iterations the shorter of an instruction count's two runs takes; the longer takes twice. */
const COUNT_ITERATIONS = 500

/** The instructions `main <case> <iterations>` executes under cachegrind, the whole process. */
const countRun = (column, c, iterations) => {
  const dir = path.dirname(column.bin)
  const file = path.join(dir, `${path.basename(column.bin)}-${c.name}-${iterations}.cachegrind`)
  const r = spawnSync(
    "valgrind",
    [
      "--tool=cachegrind",
      "--cache-sim=no",
      `--cachegrind-out-file=${file}`,
      `./${path.basename(column.bin)}`,
      c.name,
      String(iterations),
    ],
    { cwd: dir, env: { GLIBC_TUNABLES: PINNED_LIBC }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
  if (r.error !== undefined || r.status !== 0) {
    fail(`cachegrind ${column.id} ${c.name} ${iterations}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stderr}`)
  }
  const m = /^summary: (\d+)$/m.exec(fs.readFileSync(file, "utf8"))
  fs.rmSync(file)
  if (m === null) {
    fail(`cachegrind ${column.id} ${c.name}: no summary line`)
  }
  return Number(m[1])
}

if (instructions) {
  if (spawnSync("valgrind", ["--version"]).status !== 0) {
    fail("--instructions needs valgrind on PATH")
  }
  const counted = columns.filter((col) => !col.id.endsWith("-copy"))
  console.log(
    `instructions: cachegrind --cache-sim=no, built --cpu ${cpu}; one iteration is a run of ${2 * COUNT_ITERATIONS}` +
      ` iterations less a run of ${COUNT_ITERATIONS}, over ${COUNT_ITERATIONS}` +
      (baseRev !== null ? `; base: std/ at ${baseRev}` : "")
  )
  const W = [10, 10, 16, 14, 9]
  const row = (cells) => cells.map((x, i) => (i < 2 ? x.padEnd(W[i]) : x.padStart(W[i]))).join(" ")
  console.log(row(["case", "column", "an iteration", "a request", "vs nish"]))
  for (const c of cases) {
    let nish = 0
    for (const col of counted) {
      const per = (countRun(col, c, 2 * COUNT_ITERATIONS) - countRun(col, c, COUNT_ITERATIONS)) / COUNT_ITERATIONS
      if (col.id === "nish") {
        nish = per
      }
      const vs = col.id === "nish" ? "" : `${per >= nish ? "+" : ""}${((100 * (per - nish)) / nish).toFixed(1)}%`
      console.log(row([c.name, col.id, per.toFixed(0), (per / c.requests).toFixed(0), vs]))
    }
  }
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
if (baseRev !== null) {
  console.log(`base: std/ at ${baseRev}`)
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
      (baseRev !== null ? `, base ±${band("base-copy", "base")}%` : "")
  )
}
console.log(
  `\n${n} rounds of ${columns.length} columns a case. ns is one iteration of a case: a run's ns over its` +
    " iterations. The band is a copy's median against its build's, the same bytes; a change inside it is noise."
)
