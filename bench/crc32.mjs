#!/usr/bin/env node
// WP38: CRC-32 on 64 B to 1 MiB and the gzip round trip around it, on the path
// this machine picks and on the tables (docs/wp38-simd.md §3.1). It builds
// bench/crc32.ts, runs it in interleaved rounds, and prints each workload's
// throughput in MB/s and its time in ns/op, naming the path each column ran.
//
//   npm run build && node bench/crc32.mjs [options] [--compiler <nish>]
//     --runs N    timed rounds after one warm-up (default 7), rounded up to a
//                 multiple of the column count so each column goes first equally often
//     --self      a byte-identical copy of the default column: the noise band
//     --check     one short run on each path, each checksum against the pinned one; exit 0 when equal
//
// The columns. `default` is bench/crc32.ts built with `--profile speed`, into
// build/bench/crc32/, with `NISH_CRC32` unset, so it runs the kernel where the
// CPU has one; `soft` is the same binary under `NISH_CRC32=soft`, the Nish
// tables. Every column runs once per round, the order rotating so each goes
// first equally often, and every run must print the same checksum, or the run
// stops: the paths answer the same or they are not timing the same work.
//
// The path a column ran is inferred, not asked: the program cannot say which
// kernel the runtime picked, so the path is read from the CPU flags in
// /proc/cpuinfo, the bits runtime/runtime-checksum.c tests: pclmul (x86-64
// PCLMULQDQ and SSE4.1), crc32 (AArch64 with the CRC32 instructions), or
// tables. That file is Linux only; elsewhere the default column says
// `unknown`. What is timed is each workload's own loop, not the process. MB/s
// is 10^6 bytes a second.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "crc32")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/crc32.mjs: ${msg}`)
  process.exit(2)
}

/**
 * `--check`'s scale and the checksum bench/crc32.ts prints at it, on every
 * path: a change to this number is a change to what CRC-32 or gzip answers.
 */
const CHECK_SCALE = 64
const CHECK_SUM = "checksum 3114044553"
/** The workloads bench/crc32.ts times; a run that reports fewer stopped short. */
const WORKLOADS = 6

let runs = 7
let self = false
let check = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--self") {
    self = true
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
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "crc32")
const build = spawnSync(
  nishc.cmd,
  [...nishc.prefix, "bench/crc32.ts", "-o", `${rel(outDir)}/`, "--link", rel(exe), "--profile", "speed"],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
)
if (build.status !== 0) {
  console.error(`building bench/crc32.ts failed (exit ${build.status})\n${build.stdout}${build.stderr}`)
  process.exit(1)
}

const cpuinfo = (() => {
  try {
    return fs.readFileSync("/proc/cpuinfo", "utf8")
  } catch {
    return null
  }
})()
const flags = new Set((cpuinfo?.match(/^(?:flags|Features)\s*:\s*(.+)$/m)?.[1] ?? "").split(/\s+/))
/**
 * The kernel runtime/runtime-checksum.c picks on this machine, or `tables`,
 * inferred from /proc/cpuinfo; `unknown` where there is none.
 */
const machinePath = (() => {
  if (cpuinfo === null) {
    return "unknown"
  }
  if (process.arch === "x64" && flags.has("pclmulqdq") && flags.has("sse4_1")) {
    return "pclmul"
  }
  if (process.arch === "arm64" && flags.has("crc32")) {
    return "crc32"
  }
  return "tables"
})()

/** The columns, each `{ label, bin, env, path }`, the default first. */
const unset = { ...process.env }
delete unset.NISH_CRC32
const columns = [{ label: "default", bin: exe, env: unset, path: machinePath }]
if (self) {
  const copy = path.join(outDir, "crc32-copy")
  fs.copyFileSync(exe, copy)
  columns.push({ label: "default (copy)", bin: copy, env: unset, path: machinePath })
}
columns.push({ label: "soft", bin: exe, env: { ...unset, NISH_CRC32: "soft" }, path: "tables" })

/**
 * One run of `bin` at `scale`: `{ answer, times }`, the checksum line and a
 * Map from workload to `{ ns, bytes, ops }`.
 */
const runOnce = (bin, scale, env) => {
  const r = spawnSync(bin, [String(scale)], {
    cwd: root,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.status !== 0) {
    fail(`${rel(bin)} ${scale} exited with ${r.status}\n${r.stdout}${r.stderr}`)
  }
  const times = new Map()
  for (const line of r.stderr.split("\n")) {
    const m = line.match(/^time (\S+) (\d+) (\d+) (\d+)$/)
    if (m !== null) {
      times.set(m[1], { ns: Number(m[2]), bytes: Number(m[3]), ops: Number(m[4]) })
    }
  }
  if (times.size !== WORKLOADS) {
    fail(`${rel(bin)} ${scale} timed ${times.size} workloads, not ${WORKLOADS}\n${r.stderr}`)
  }
  return { answer: r.stdout.trim(), times }
}

if (check) {
  let bad = false
  for (const c of columns) {
    const r = runOnce(c.bin, CHECK_SCALE, c.env)
    console.log(`${c.label} (${c.path}): ${r.answer}`)
    if (r.answer !== CHECK_SUM) {
      console.error(
        `bench/crc32.mjs: ${c.label} printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(CHECK_SUM)}`
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
    const r = runOnce(columns[k].bin, 1, columns[k].env)
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

const cpu = cpuinfo?.match(/^model name\s*:\s*(.+)$/m)?.[1].trim() ?? `${process.arch}, model unnamed`
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()

/** The table's widths: the first three columns are left-aligned, the rest right-aligned. */
const WIDTHS = [19, 15, 7, 11, 11, 9, 9]
const line = (cells) => cells.map((c, i) => (i < 3 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["workload", "column", "path", "min ns/op", "median", "MB/s", "median"]))
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
        columns[k].path,
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
const soft = stats[n - 1]
const speedups = [...shape.keys()].map(
  (name) => `${name} ${(soft.get(name).median / stats[0].get(name).median).toFixed(2)}x`
)
console.log(
  `default (${machinePath}, from /proc/cpuinfo) against soft, median time over median time: ${speedups.join(", ")}`
)
