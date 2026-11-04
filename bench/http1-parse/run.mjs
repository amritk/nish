#!/usr/bin/env node
// The HTTP/1.1 request parser in nanoseconds a head: nish/net/http1-codec's
// `Http1Parser` against main's parser frozen beside it (old.ts) and a second
// frozen copy of the same code (old-copy.ts), whose distance from old is the
// noise band. bench/http1-parse/main.ts says what one iteration times.
//
//   npm run build && node bench/http1-parse/run.mjs [options] [--compiler <nish>]
//     --rounds N    timed rounds a head runs at least (default 21); the median
//                   is reported, with the min and max
//     --heads N     the fewest heads a run parses (default 100000)
//     --cpu LEVEL   pass `--cpu LEVEL` to the build (x86-64-v3 is AVX2)
//
// The build is main.ts with `--profile speed`, into build/bench/http1-parse/.
// Each head calibrates one iteration count on `new` so a run takes about
// 200 ms, and never fewer than --heads; every column runs that count, and
// each round runs every column once, in bench/json-compare/rounds.mjs's
// balanced order. Every column must print the head's `known` checksum for one
// iteration, and every timed run the same checksum as the others: three
// parsers that disagree are not timing the same work.
//
// freeze.mjs writes old.ts and old-copy.ts from a pinned commit; rerun it
// (`node bench/http1-parse/freeze.mjs`) only to move the baseline.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "bench", "http1-parse")
const nishc = compilerFrom(process.argv)

/** Each head as `main <parser> <head> <iterations>` takes it, and its checksum for one iteration. */
const HEADS = [
  { label: "loadgen GET", head: 0, known: "b29eddcc" },
  { label: "loadgen POST", head: 1, known: "a43fafe7" },
  { label: "browser GET", head: 2, known: "d66e7fa6" },
]
const COLUMNS = ["old", "old-copy", "new"]
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/http1-parse/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 21
let minHeads = 100000
let cpu = null
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--heads") {
    minHeads = Number(argv[++i])
  } else if (argv[i] === "--cpu") {
    cpu = argv[++i] ?? ""
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(Number.isInteger(rounds) && rounds >= 1)) {
  fail("--rounds needs a positive count")
}
if (!(Number.isInteger(minHeads) && minHeads >= 1)) {
  fail("--heads needs a positive count")
}

const rel = (p) => path.relative(root, p)
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, cpu === null ? "http1-parse" : `http1-parse-${cpu}`)
const build = spawnSync(
  nishc.cmd,
  [
    ...nishc.prefix,
    "bench/http1-parse/main.ts",
    "-o",
    `${rel(outDir)}/`,
    "--link",
    rel(exe),
    "--profile",
    "speed",
    ...(cpu === null ? [] : ["--cpu", cpu]),
  ],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
)
if (build.status !== 0) {
  console.error(
    `building bench/http1-parse/main.ts failed (exit ${build.status})\n${build.stdout}${build.stderr}`
  )
  process.exit(1)
}

const cpuModel = () => {
  try {
    const m = /^model name\s*:\s*(.+)$/m.exec(fs.readFileSync("/proc/cpuinfo", "utf8"))
    return m === null ? os.cpus()[0]?.model : m[1]
  } catch {
    return os.cpus()[0]?.model ?? "unknown"
  }
}
const cpuFlags = () => {
  try {
    const m = /^flags\s*:\s*(.+)$/m.exec(fs.readFileSync("/proc/cpuinfo", "utf8"))
    return new Set(m === null ? [] : m[1].split(/\s+/))
  } catch {
    return new Set()
  }
}
const flags = cpuFlags()
const has = ["sse2", "avx2", "bmi2", "avx512bw"].filter((f) => flags.has(f))
console.log(`cpu: ${cpuModel()} (${os.cpus().length} threads; ${has.join(", ") || "flags unknown"})`)
console.log(
  `simd path: ${cpu === null ? "baseline x86-64 (u8x16 on SSE2)" : `--cpu ${cpu} (u8x16 on ${cpu === "x86-64-v3" ? "AVX2's VEX SSE" : cpu})`}`
)

/** One run under bench/crypto/README.md's contract: `{ checksum, ns }`. */
const runOnce = (column, h, iterations) => {
  const r = spawnSync(exe, [column, String(h.head), String(iterations)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    fail(
      `${column} ${h.label} ${iterations}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`
    )
  }
  const bytes = /^bytes (\d+)$/m.exec(r.stderr ?? "")
  return { checksum: sum[1], ns: Number(ns[1]), bytes: bytes === null ? null : Number(bytes[1]) }
}

/** An iteration count that makes `new` take about TARGET_NS on `h`, and at least --heads. */
const calibrate = (h) => {
  let iterations = 1
  for (;;) {
    const r = runOnce("new", h, iterations)
    if (r.ns >= TARGET_NS / 10 || iterations >= 1 << 30) {
      return Math.max(minHeads, Math.round((iterations * TARGET_NS) / Math.max(r.ns, 1)))
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

const WIDTHS = [14, 10, 12, 18, 9, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")

const sizes = new Map()
for (const h of HEADS) {
  for (const col of COLUMNS) {
    const r = runOnce(col, h, 1)
    if (r.checksum !== h.known) {
      fail(`${col} ${h.label} printed checksum ${r.checksum} for one iteration, not the known ${h.known}`)
    }
    sizes.set(h.label, r.bytes)
  }
}

const n = roundsFor(COLUMNS.length, rounds)
console.log(line(["head", "parser", "median ns", "min–max ns", "ns/byte", "vs old"]))
for (const h of HEADS) {
  const iterations = calibrate(h)
  const times = new Map(COLUMNS.map((col) => [col, []]))
  let checksum = null
  for (let round = 0; round < n; round++) {
    for (const col of roundOrder(COLUMNS, round)) {
      const r = runOnce(col, h, iterations)
      if (checksum !== null && r.checksum !== checksum) {
        fail(`${col} ${h.label} printed checksum ${r.checksum}, not ${checksum}`)
      }
      checksum = r.checksum
      times.get(col).push(r.ns / iterations)
    }
  }
  const base = median(times.get("old"))
  const bytes = sizes.get(h.label)
  for (const col of COLUMNS) {
    const ts = times.get(col)
    const m = median(ts)
    console.log(
      line([
        h.label,
        col,
        m.toFixed(1),
        `${Math.min(...ts).toFixed(1)}–${Math.max(...ts).toFixed(1)}`,
        (m / bytes).toFixed(3),
        col === "old" ? "" : pct(base, m),
      ])
    )
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${bytes} bytes, ${iterations} heads a run, checksum ${checksum}; band ±${(
      Math.abs(median(times.get("old-copy")) / base - 1) * 100
    ).toFixed(1)}%`
  )
}
console.log(
  `\n${n} rounds of ${COLUMNS.length} parsers a head. ns is a run's nanoseconds over its heads; the band is` +
    " old-copy's median against old's, the same code, and a change inside it is noise."
)
