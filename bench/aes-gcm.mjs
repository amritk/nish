#!/usr/bin/env node
// WP38 S5: AES-GCM and ChaCha20-Poly1305 on a TLS record and a QUIC packet, the
// baseline the AES kernel is judged by (docs/wp38-simd.md §7, S5). It builds
// bench/aes-gcm.ts, runs it in interleaved rounds, and prints each workload's
// throughput in MB/s and cycles per byte.
//
//   npm run build && node bench/aes-gcm.mjs [options] [--compiler <nish>]
//     --runs N            timed rounds after one warm-up (default 7, §7's minimum)
//     --self              a byte-identical copy of the baseline as a column: the noise band
//     --binary <path>     another build of bench/aes-gcm.ts as a column (repeatable)
//     --env NAME=VALUE    the baseline run with NAME=VALUE as a column (repeatable)
//     --ghz G             the clock cycles are counted at (default: the model name's)
//     --check             one short run, its checksum against the pinned one; exit 0 when equal
//
// The columns. The baseline is bench/aes-gcm.ts built by the compiler with
// `--profile speed`, into build/bench/aes-gcm/. `--binary` adds a build made
// elsewhere, such as the same program built from `main` in a worktree, and
// `--env` the baseline under an environment variable, such as `NISH_AES=soft`.
// Every column runs once per round, the order rotating so each goes first
// equally often, and the round count is rounded up to a multiple of the
// columns: a slow stretch of a shared machine falls on all of them. Every run
// of every column must print the same checksum, or the run stops: two builds
// whose answers differ are not timing the same work.
//
// What is timed is each workload's own loop, as bench/aes-gcm.ts's header
// says, not the process. MB/s is 10^6 bytes a second. Cycles per byte is the
// nanoseconds times the nominal clock over the bytes: a derived figure, not a
// counted one, and the line under the table names the clock it used.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "aes-gcm")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/aes-gcm.mjs: ${msg}`)
  process.exit(2)
}

/**
 * `--check`'s scale and the checksum bench/aes-gcm.ts prints at it. Every
 * build of the module, kernel or walker, must keep printing it: a change to
 * this number is a change to what the AEADs answer.
 */
const CHECK_SCALE = 64
const CHECK_SUM = "checksum 2203470130"
/** The workloads bench/aes-gcm.ts times; a run that reports fewer stopped short. */
const WORKLOADS = 9

let runs = 7
let self = false
let check = false
let ghz = null
const binaries = []
const envs = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--self") {
    self = true
  } else if (argv[i] === "--check") {
    check = true
  } else if (argv[i] === "--binary") {
    binaries.push(path.resolve(argv[++i] ?? ""))
  } else if (argv[i] === "--env") {
    const spec = argv[++i] ?? ""
    const eq = spec.indexOf("=")
    if (eq <= 0) {
      fail(`--env needs NAME=VALUE, not ${JSON.stringify(spec)}`)
    }
    envs.push({ name: spec.slice(0, eq), value: spec.slice(eq + 1) })
  } else if (argv[i] === "--ghz") {
    ghz = Number(argv[++i])
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(runs >= 1)) {
  fail("--runs needs a positive count")
}
if (ghz !== null && !(ghz > 0)) {
  fail("--ghz needs a positive clock")
}
for (const b of binaries) {
  if (!fs.existsSync(b)) {
    fail(`--binary ${b}: no such file`)
  }
}

const rel = (p) => path.relative(root, p)
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "aes-gcm")
const build = spawnSync(
  nishc.cmd,
  [...nishc.prefix, "bench/aes-gcm.ts", "-o", `${rel(outDir)}/`, "--link", rel(exe), "--profile", "speed"],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
)
if (build.status !== 0) {
  console.error(`building bench/aes-gcm.ts failed (exit ${build.status})\n${build.stdout}${build.stderr}`)
  process.exit(1)
}

/**
 * One run of `bin` at `scale`: `{ answer, times }`, the checksum line and a
 * Map from workload to `{ ns, bytes }`.
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
    const m = line.match(/^time (\S+) (\d+) (\d+)$/)
    if (m !== null) {
      times.set(m[1], { ns: Number(m[2]), bytes: Number(m[3]) })
    }
  }
  if (times.size !== WORKLOADS) {
    fail(`${rel(bin)} ${scale} timed ${times.size} workloads, not ${WORKLOADS}\n${r.stderr}`)
  }
  return { answer: r.stdout.trim(), times }
}

if (check) {
  const r = runOnce(exe, CHECK_SCALE, process.env)
  console.log(r.answer)
  if (r.answer !== CHECK_SUM) {
    console.error(`bench/aes-gcm.mjs: printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(CHECK_SUM)}`)
    process.exit(1)
  }
  process.exit(0)
}

/** The columns, each `{ label, bin, env }`, the baseline first. */
const columns = [{ label: "baseline", bin: exe, env: process.env }]
if (self) {
  // A copy rather than the same path twice, as bench/simd-s0.mjs --self makes
  // one: each column is its own file, mapped on its own.
  const copy = path.join(outDir, "aes-gcm-copy")
  fs.copyFileSync(exe, copy)
  columns.push({ label: "baseline (copy)", bin: copy, env: process.env })
}
for (const b of binaries) {
  columns.push({ label: rel(b), bin: b, env: process.env })
}
for (const e of envs) {
  columns.push({ label: `${e.name}=${e.value}`, bin: exe, env: { ...process.env, [e.name]: e.value } })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// One warm-up round, then a multiple of the column count, counted from the
// first timed round so each column goes first equally often.
const n = columns.length
const rounds = Math.ceil(runs / n) * n
/** samples[k] maps a workload to its nanoseconds, one per timed round, for column k. */
const samples = columns.map(() => new Map())
const bytesOf = new Map()
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
      bytesOf.set(name, t.bytes)
      const list = samples[k].get(name) ?? []
      list.push(t.ns)
      samples[k].set(name, list)
    }
  }
}

const cpu = (() => {
  try {
    const m = fs.readFileSync("/proc/cpuinfo", "utf8").match(/^model name\s*:\s*(.+)$/m)
    return m ? m[1].trim() : "unknown"
  } catch {
    return "unknown"
  }
})()
const nominal = ghz ?? Number(cpu.match(/@\s*([\d.]+)\s*GHz/)?.[1] ?? Number.NaN)
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()

const mbps = (ns, bytes) => (bytes * 1e3) / ns
/** Cycles per byte, or "n/a" where the model name names no clock and `--ghz` was not given. */
const cpb = (ns, bytes) => (Number.isNaN(nominal) ? "n/a" : ((ns * nominal) / bytes).toFixed(1))
/** The table's widths: the first two columns are left-aligned, the rest right-aligned. */
const WIDTHS = [18, 22, 9, 10, 8, 8, 7, 7]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["workload", "column", "min ms", "median ms", "MB/s", "median", "c/B", "median"]))

const stats = columns.map(() => new Map())
for (const name of bytesOf.keys()) {
  const bytes = bytesOf.get(name)
  for (let k = 0; k < n; k++) {
    const ts = samples[k].get(name)
    const s = { min: Math.min(...ts), median: median(ts) }
    stats[k].set(name, s)
    console.log(
      line([
        name,
        columns[k].label,
        (s.min / 1e6).toFixed(2),
        (s.median / 1e6).toFixed(2),
        mbps(s.min, bytes).toFixed(1),
        mbps(s.median, bytes).toFixed(1),
        cpb(s.min, bytes),
        cpb(s.median, bytes),
      ])
    )
  }
}
console.log(
  `\n${rounds} rounds of ${n} after one warm-up, at ${commit}, on ${cpu}; ${answer}.` +
    ` MB/s is 10^6 bytes a second; c/B is ns x ${Number.isNaN(nominal) ? "the clock (pass --ghz)" : `${nominal} GHz`} (the nominal clock) over the bytes, not a counted cycle.`
)

/** Each column's time against the baseline's, as a percentage of the baseline's: + is slower. */
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`
for (let k = 1; k < n; k++) {
  const parts = []
  for (const name of bytesOf.keys()) {
    const b = stats[0].get(name)
    const c = stats[k].get(name)
    parts.push(`${name} ${pct(b.min, c.min)} / ${pct(b.median, c.median)}`)
  }
  console.log(`\n${columns[k].label} against the baseline, time at the minimum / median (+ is slower):`)
  console.log(`  ${parts.join("\n  ")}`)
}
