#!/usr/bin/env node
// nish/net/postgres's DataRow decode and Bind encode paths in nanoseconds an
// operation, with no server (bench/pg-decode/main.ts says what each kernel
// times). It builds main.ts, then times every case in
// bench/json-compare/rounds.mjs's interleaved rounds with a byte-identical
// copy as a column, whose distance from the build is the noise band.
//
//   npm run build && node bench/pg-decode/run.mjs [options] [--compiler <nish>]
//     --validate         build, check every column's checksum on every case,
//                        and stop: no timing
//     --rounds N         timed rounds a case runs at least (default 11); the
//                        median is reported with the min-max spread
//     --cpu <level>      the `--cpu` every build is compiled for (x86-64, the
//                        compiler's default, or x86-64-v3)
//     --base <rev>       also build main.ts against std/ as it is at git
//                        <rev> (the same compiler, the library frozen) as the
//                        column `base`
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable)
//     --callgrind        instead of timing, count each column's instructions
//                        an operation under valgrind's callgrind: the count
//                        at 110 iterations less the count at 10, over 100,
//                        so the setup (startup, stream building) cancels
//     --case <label>     run only the cases whose label starts with <label>
//
// The build is main.ts by the compiler with `--profile speed`, into
// build/bench/pg-decode/. Each case calibrates one iteration count on the
// build so a run takes about 200 ms, and every column runs that count; each
// round runs every column once, in rounds.mjs's balanced order. Before
// timing, every column runs each case once and must print the case's `known`
// checksum, pinned from one iteration of main's build: that, not the columns
// agreeing, is what says the decoding is right. Every timed run of every
// column must then print the same checksum, or the run stops.
//
// `--base` copies the compiler into build/bench/pg-decode/base/build/nish and
// `git archive`s <rev>'s std/ beside it, with the checkout's scripts/ and
// runtime/ (the link step's): the compiler reads `nish/<module>` from the
// package it is run in, so the base build is started from there.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "bench", "pg-decode")
const nishc = compilerFrom(process.argv)

/**
 * What each case runs, as `main <kernel> <size> <iterations>` takes it;
 * `bytes`, the bytes it decodes (`rows`, `text`, `pool`: the answer to one
 * group) or encodes (`params`: the Bind, Execute and Sync), which the build's
 * `bytes` kernel must print; and `known`, the checksum one iteration prints.
 */
const CASES = [
  { label: "rows 1 (214 B)", kernel: "rows", size: 1, bytes: 214, known: "920b9c5f" },
  { label: "rows 20 (2,892 B)", kernel: "rows", size: 20, bytes: 2892, known: "a4a8bc21" },
  { label: "rows 100 (14,019 B)", kernel: "rows", size: 100, bytes: 14019, known: "ee18fb6d" },
  { label: "text 1 (218 B)", kernel: "text", size: 1, bytes: 218, known: "7077c787" },
  { label: "text 20 (2,464 B)", kernel: "text", size: 20, bytes: 2464, known: "06e0cd59" },
  { label: "text 100 (12,153 B)", kernel: "text", size: 100, bytes: 12153, known: "cd4743fa" },
  { label: "pool 1 (214 B)", kernel: "pool", size: 1, bytes: 214, known: "920b9c5f" },
  { label: "pool 20 (2,892 B)", kernel: "pool", size: 20, bytes: 2892, known: "a4a8bc21" },
  { label: "pool 100 (14,019 B)", kernel: "pool", size: 100, bytes: 14019, known: "ee18fb6d" },
  { label: "params 1 (104 B)", kernel: "params", size: 1, bytes: 104, known: "8bc76938" },
  { label: "params 20 (1,051 B)", kernel: "params", size: 20, bytes: 1051, known: "ddbfedab" },
  { label: "params 100 (5,179 B)", kernel: "params", size: 100, bytes: 5179, known: "0c2ac44f" },
]
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/pg-decode/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
let validate = false
let callgrind = false
let cpu = null
let base = null
let only = null
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  const a = argv[i]
  if (a === "--rounds") {
    rounds = Number(argv[++i])
  } else if (a === "--validate") {
    validate = true
  } else if (a === "--callgrind") {
    callgrind = true
  } else if (a === "--cpu") {
    cpu = argv[++i] ?? fail("--cpu needs a level")
  } else if (a === "--base") {
    base = argv[++i] ?? fail("--base needs a revision")
  } else if (a === "--case") {
    only = argv[++i] ?? fail("--case needs a label")
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
for (const b of binaries) {
  if (!fs.existsSync(b.bin)) {
    fail(`--binary ${b.bin}: no such file`)
  }
}
const cases = CASES.filter((c) => only === null || c.label.startsWith(only))
if (cases.length === 0) {
  fail(`--case ${only}: no case's label starts with it`)
}

/** Builds main.ts with `cmd` (`prefix` first) from `cwd` into `dir`, linked as `bin`. */
const buildInto = (cmd, prefix, cwd, dir, bin) => {
  fs.mkdirSync(dir, { recursive: true })
  const r = spawnSync(
    cmd,
    [
      ...prefix,
      path.join(root, "bench", "pg-decode", "main.ts"),
      "-o",
      `${dir}/`,
      "--link",
      bin,
      "--profile",
      "speed",
      ...(cpu === null ? [] : ["--cpu", cpu]),
    ],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
  if (r.status !== 0) {
    console.error(
      `building bench/pg-decode/main.ts in ${cwd} failed (exit ${r.status})\n${r.stdout}${r.stderr}`
    )
    process.exit(1)
  }
}

const exe = path.join(outDir, "pg-decode")
buildInto(nishc.cmd, nishc.prefix, root, outDir, exe)
// A copy rather than the same path twice: each column is its own file,
// mapped on its own.
fs.copyFileSync(exe, `${exe}-copy`)

/** The columns, each `{ id, bin }`, the build first and its copy second. */
const columns = [
  { id: "nish", bin: exe },
  { id: "nish-copy", bin: `${exe}-copy` },
]

if (base !== null) {
  if (nishc.prefix.length > 0) {
    fail("--base needs a native compiler, which it copies beside the frozen std/")
  }
  const pkg = path.join(outDir, "base")
  fs.rmSync(pkg, { recursive: true, force: true })
  fs.mkdirSync(path.join(pkg, "build"), { recursive: true })
  fs.copyFileSync(nishc.cmd, path.join(pkg, "build", "nish"))
  fs.chmodSync(path.join(pkg, "build", "nish"), 0o755)
  fs.copyFileSync(path.join(root, "package.json"), path.join(pkg, "package.json"))
  // Only std/ is frozen: the link script and the C runtime are the checkout's,
  // so the base column differs from the build in the library alone.
  fs.cpSync(path.join(root, "scripts"), path.join(pkg, "scripts"), { recursive: true })
  fs.cpSync(path.join(root, "runtime"), path.join(pkg, "runtime"), { recursive: true })
  const tar = execFileSync("git", ["archive", "--format=tar", base, "std"], { cwd: root, maxBuffer: 1 << 28 })
  execFileSync("tar", ["-x", "-C", pkg], { input: tar })
  const baseExe = path.join(pkg, "pg-decode")
  buildInto(path.join(pkg, "build", "nish"), [], pkg, path.join(pkg, "out"), baseExe)
  columns.push({ id: "base", bin: baseExe })
}
columns.push(...binaries)

/** One run under bench/crypto/README.md's contract: `{ checksum, ns }`. */
const runOnce = (column, c, iterations) => {
  const r = spawnSync(column.bin, [c.kernel, String(c.size), String(iterations)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    fail(
      `${column.id} ${c.kernel} ${c.size} ${iterations}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`
    )
  }
  return { checksum: sum[1], ns: Number(ns[1]) }
}

/** The bytes the build's `bytes` kernel prints for `size`: what rows, text and params handle, in that order. */
const sizesOf = (size) => {
  const r = spawnSync(exe, ["bytes", String(size), "1"], { encoding: "utf8" })
  const m = /^bytes (\d+) (\d+) (\d+)\n$/.exec(r.stdout ?? "")
  if (r.status !== 0 || m === null) {
    fail(`${exe} bytes ${size}: exit ${r.status}\n${r.stdout}${r.stderr}`)
  }
  return { rows: Number(m[1]), pool: Number(m[1]), text: Number(m[2]), params: Number(m[3]) }
}

for (const c of cases) {
  const bytes = sizesOf(c.size)[c.kernel]
  if (bytes !== c.bytes) {
    fail(`${c.label}: the build handles ${bytes} bytes, not the ${c.bytes} its label says`)
  }
  for (const col of columns) {
    const r = runOnce(col, c, 1)
    if (r.checksum !== c.known) {
      fail(`${col.id} ${c.label} printed checksum ${r.checksum} for one iteration, not the known ${c.known}`)
    }
  }
}

/** The CPU the numbers are from: its model and the feature flags a build could use. */
const cpuStamp = () => {
  let info = ""
  try {
    info = fs.readFileSync("/proc/cpuinfo", "utf8")
  } catch {
    return `${process.arch}, no /proc/cpuinfo`
  }
  const model = info.match(/^model name\s*:\s*(.+)$/m)?.[1].trim() ?? `${process.arch}, model unnamed`
  const flags = new Set((info.match(/^flags\s*:\s*(.+)$/m)?.[1] ?? "").split(/\s+/))
  const has = ["avx2", "bmi2", "sha_ni", "avx512f"].map((f) => `${f} ${flags.has(f) ? "yes" : "no"}`)
  return `${model}; ${has.join(", ")}`
}
const header = `cpu: ${cpuStamp()}\nbuild: --profile speed --cpu ${cpu ?? "x86-64 (default)"}${
  base === null ? "" : `; base: std/ at ${base}`
}`

if (validate) {
  console.log(`${header}\nvalidate: ${cases.length} cases x ${columns.length} columns, every checksum known`)
  process.exit(0)
}

if (callgrind) {
  const SHORT = 10
  const LONG = 110
  const VALGRIND = "valgrind"
  /** Instructions callgrind counts for one run of `col` on `c`. */
  const instructions = (col, c, iterations) => {
    const out = path.join(outDir, `callgrind.${col.id}.out`)
    const r = spawnSync(
      VALGRIND,
      [
        "--tool=callgrind",
        `--callgrind-out-file=${out}`,
        col.bin,
        c.kernel,
        String(c.size),
        String(iterations),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    )
    const total = /Collected : (\d+)/.exec(r.stderr ?? "")
    if (r.error !== undefined || r.status !== 0 || total === null) {
      fail(`callgrind ${col.id} ${c.label}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stderr}`)
    }
    return Number(total[1])
  }
  console.log(`${header}\n`)
  console.log(
    `${"case".padEnd(22)} ${"column".padEnd(28)} ${"instr/op".padStart(10)} ${"vs nish".padStart(9)}`
  )
  for (const c of cases) {
    let first = null
    for (const col of columns) {
      const perOp = (instructions(col, c, LONG) - instructions(col, c, SHORT)) / (LONG - SHORT)
      first ??= perOp
      const vs =
        col === columns[0]
          ? ""
          : `${perOp >= first ? "+" : ""}${((100 * (perOp - first)) / first).toFixed(1)}%`
      console.log(
        `${c.label.padEnd(22)} ${col.id.padEnd(28)} ${perOp.toFixed(0).padStart(10)} ${vs.padStart(9)}`
      )
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

console.log(`${header}\n`)
const WIDTHS = [22, 28, 12, 20, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "median ns/op", "min-max ns/op", "vs nish"]))

const n = roundsFor(columns.length, rounds)
for (const c of cases) {
  const iterations = calibrate(c)
  const times = new Map(columns.map((col) => [col.id, []]))
  let checksum = null
  for (let round = 0; round < n; round++) {
    for (const col of roundOrder(columns, round)) {
      const r = runOnce(col, c, iterations)
      if (checksum !== null && r.checksum !== checksum) {
        fail(`${col.id} ${c.label} printed checksum ${r.checksum}, not ${checksum}`)
      }
      checksum = r.checksum
      times.get(col.id).push(r.ns / iterations)
    }
  }
  const med = median(times.get("nish"))
  for (const col of columns) {
    const ts = times.get(col.id)
    const m = median(ts)
    const spread = `${Math.min(...ts).toFixed(1)}-${Math.max(...ts).toFixed(1)}`
    console.log(line([c.label, col.id, m.toFixed(1), spread, col.id === "nish" ? "" : pct(med, m)]))
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${iterations} iterations a run, checksum ${checksum}; band ±${(
      Math.abs(median(times.get("nish-copy")) / med - 1) * 100
    ).toFixed(1)}%`
  )
}
console.log(
  `\n${n} rounds of ${columns.length} columns a case. ns/op is a run's ns over its iterations; the band is` +
    ` nish-copy's median against nish's, the same bytes, and a change inside it is noise.`
)
