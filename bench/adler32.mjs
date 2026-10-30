#!/usr/bin/env node
// WP38: a vectorised Adler-32 against the Nish `adler32Update` at 64 KiB and
// 1 MiB, and the verdict against the 20% bar (docs/wp38-simd.md §3.1). It
// builds bench/adler32.ts and bench/adler32/kernel.c, holds the kernel to the
// scalar reference, runs every column in interleaved rounds and prints each
// workload's time in ns/op and throughput in MB/s, then the gain per size.
//
//   npm run build && node bench/adler32.mjs [options] [--compiler <nish>]
//     --runs N    timed rounds after one warm-up (default 9), rounded up to a
//                 multiple of the column count so each column goes first equally often
//     --check     one short run per column, each checksum against the pinned one; exit 0 when equal
//
// The columns. `nish` is bench/adler32.ts built with `--profile speed`, the
// adler32Update that ships; `nish (copy)` is a byte-identical copy of it, the
// noise band; `kernel` is kernel.c's vector kernel (`ssse3` or `neon`, which
// it names); `scalar C` is kernel.c's scalar reference, for scale. kernel.c is
// built with `clang -O2` and no CPU flag: only the kernel carries a target
// attribute. Every run must print the same checksum, or the run stops.
//
// The gain at a size is the nish median over the kernel median, less one; the
// band is the larger of the copy's distance from nish at the minimum and at
// the median. A kernel passes when its gain is 20% or more and above the band
// at both sizes; the last line says whether it did. MB/s is 10^6 bytes a second.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "adler32")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/adler32.mjs: ${msg}`)
  process.exit(2)
}

/**
 * `--check`'s scale and the checksum every column prints at it: a change to
 * this number is a change to what Adler-32 answers.
 */
const CHECK_SCALE = 64
const CHECK_SUM = "checksum 1480580821"
/** The workloads each column times; a run that reports fewer stopped short. */
const WORKLOADS = 2
/** The gain a kernel must reach at every size to ship. */
const BAR = 0.2

let runs = 9
let check = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--check") {
    check = true
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(runs >= 1)) {
  fail("--runs needs a positive count")
}

const rel = (p) => path.relative(root, p)
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "adler32")
run(nishc.cmd, [
  ...nishc.prefix,
  "bench/adler32.ts",
  "-o",
  `${rel(outDir)}/`,
  "--link",
  rel(exe),
  "--profile",
  "speed",
])
const copy = path.join(outDir, "adler32-copy")
fs.copyFileSync(exe, copy)
const kernel = path.join(outDir, "kernel")
run(process.env.CC ?? "clang", [
  "-O2",
  "-Wall",
  "-Wextra",
  "-Werror",
  "bench/adler32/kernel.c",
  "-o",
  rel(kernel),
])

// The kernel is held to the scalar reference before anything is timed.
const verified = run(kernel, ["verify"]).trim()
console.log(verified)
const kernelPath = verified.match(/^adler32 (\S+):/)?.[1] ?? fail(`kernel verify printed ${verified}`)

/** The columns, each `{ label, bin, args }`, nish first and the kernel third. */
const columns = [
  { label: "nish", bin: exe, args: [] },
  { label: "nish (copy)", bin: copy, args: [] },
  { label: `kernel ${kernelPath}`, bin: kernel, args: ["time"] },
  { label: "scalar C", bin: kernel, args: ["scalar"] },
]

/** One run of a column at `scale`: `{ answer, times }`, times a Map from workload to `{ ns, bytes, ops }`. */
const runOnce = (c, scale) => {
  const r = spawnSync(c.bin, [...c.args, String(scale)], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.status !== 0) {
    fail(`${c.label} at scale ${scale} exited with ${r.status}\n${r.stdout}${r.stderr}`)
  }
  const times = new Map()
  for (const line of r.stderr.split("\n")) {
    const m = line.match(/^time (\S+) (\d+) (\d+) (\d+)$/)
    if (m !== null) {
      times.set(m[1], { ns: Number(m[2]), bytes: Number(m[3]), ops: Number(m[4]) })
    }
  }
  if (times.size !== WORKLOADS) {
    fail(`${c.label} at scale ${scale} timed ${times.size} workloads, not ${WORKLOADS}\n${r.stderr}`)
  }
  return { answer: r.stdout.trim(), times }
}

if (check) {
  let bad = false
  for (const c of columns) {
    const r = runOnce(c, CHECK_SCALE)
    const sizes = [...r.times].map(([name, t]) => `${name} ${(t.ns / t.ops).toFixed(0)} ns/op`).join(", ")
    console.log(`${c.label}: ${sizes}; ${r.answer}`)
    if (r.answer !== CHECK_SUM) {
      console.error(
        `bench/adler32.mjs: ${c.label} printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(CHECK_SUM)}`
      )
      bad = true
    }
  }
  process.exit(bad ? 1 : 0)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const n = columns.length
const rounds = Math.ceil(runs / n) * n
/** samples[k] maps a workload to its nanoseconds, one per timed round, for column k. */
const samples = columns.map(() => new Map())
const shape = new Map()
let answer = null
for (let i = 0; i <= rounds; i++) {
  for (let j = 0; j < n; j++) {
    const k = (i + 1 + j) % n
    const r = runOnce(columns[k], 1)
    if (answer !== null && r.answer !== answer) {
      fail(
        `${columns[k].label}, round ${i}, printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(answer)}`
      )
    }
    answer = r.answer
    if (i === 0) {
      continue
    }
    for (const [name, t] of r.times) {
      shape.set(name, t)
      const list = samples[k].get(name) ?? []
      list.push(t.ns)
      samples[k].set(name, list)
    }
  }
}

const cpuinfo = (() => {
  try {
    return fs.readFileSync("/proc/cpuinfo", "utf8")
  } catch {
    return null
  }
})()
const cpu = cpuinfo?.match(/^model name\s*:\s*(.+)$/m)?.[1].trim() ?? `${process.arch}, model unnamed`
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()

/** The table's widths: the first two columns are left-aligned, the rest right-aligned. */
const WIDTHS = [10, 13, 10, 10, 8, 8]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["workload", "column", "min ns/op", "median", "MB/s", "median"]))
const stats = columns.map(() => new Map())
for (const [name, { bytes, ops }] of shape) {
  for (let k = 0; k < n; k++) {
    const ts = samples[k].get(name)
    const s = { min: Math.min(...ts), median: median(ts) }
    stats[k].set(name, s)
    console.log(
      line([
        name,
        columns[k].label,
        (s.min / ops).toFixed(0),
        (s.median / ops).toFixed(0),
        ((bytes * 1e3) / s.min).toFixed(0),
        ((bytes * 1e3) / s.median).toFixed(0),
      ])
    )
  }
}
console.log(
  `\n${rounds} rounds of ${n} after one warm-up, at ${commit}, on ${cpu} (${process.arch}); ${answer}.` +
    " MB/s is 10^6 bytes a second, at the minimum and the median time."
)
const pct = (x) => `${(x * 100).toFixed(1)}%`
let passes = true
for (const name of shape.keys()) {
  const [nish, twin, vec] = [stats[0].get(name), stats[1].get(name), stats[2].get(name)]
  const band = Math.max(Math.abs(twin.min / nish.min - 1), Math.abs(twin.median / nish.median - 1))
  const gain = nish.median / vec.median - 1
  const ok = gain >= BAR && gain > band
  passes &&= ok
  console.log(
    `${name}: ${columns[2].label} gains ${pct(gain)} over nish (band ${pct(band)}): ${ok ? "passes" : "misses"} the ${pct(BAR)} bar`
  )
}
console.log(
  `verdict on ${process.arch}: the ${kernelPath} kernel ${passes ? "clears" : "misses"} the bar at every size`
)
