#!/usr/bin/env node
// WP34 K5: ECDSA over P-256, the baseline a fixed-base table is judged by
// (docs/wp34-hosting-cs.md, "K5: P-256, the baseline"). It builds
// bench/p256.ts, runs it in interleaved rounds, and prints each workload's
// time a call and calls a second.
//
//   npm run build && node bench/p256.mjs [options] [--compiler <nish>]
//     --runs N            timed rounds after one warm-up (default 7)
//     --self              a byte-identical copy of the baseline as a column: the noise band
//     --binary <path>     another build of bench/p256.ts as a column (repeatable)
//     --check             one short run, its checksum against the pinned one; exit 0 when equal
//
// The columns. The baseline is bench/p256.ts built by the compiler with
// `--profile speed`, into build/bench/p256/. `--binary` adds a build made
// elsewhere, such as the same program built from `main` in a worktree. Every
// column runs once per round, the order rotating so each goes first equally
// often, and the round count is rounded up to a multiple of the columns: a
// slow stretch of a shared machine falls on all of them.
//
// Each workload runs in a process of its own (`p256 1 <workload>`), so one
// workload's heap is not the next one's: signing allocates as it goes
// (std/crypto/p256.ts, "Signing over caller-owned scratch"). Every run of a
// workload, in every column, must print the same checksum, or the run stops:
// two builds whose answers differ are not timing the same work. What is timed
// is the workload's own loop, as bench/p256.ts's header says, not the process.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "p256")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/p256.mjs: ${msg}`)
  process.exit(2)
}

/**
 * `--check`'s scale and the checksum bench/p256.ts prints at it, all three
 * workloads in one process. Every build of the module, table or window, must
 * keep printing it: a change to this number is a change to what P-256 answers.
 */
const CHECK_SCALE = 16
const CHECK_SUM = "checksum 2023672166"
/** The workloads bench/p256.ts times, each given its own process. */
const WORKLOADS = ["public-key", "sign", "verify"]

let runs = 7
let self = false
let check = false
const binaries = []
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
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(runs >= 1)) {
  fail("--runs needs a positive count")
}
for (const b of binaries) {
  if (!fs.existsSync(b)) {
    fail(`--binary ${b}: no such file`)
  }
}

const rel = (p) => path.relative(root, p)
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "p256")
const build = spawnSync(
  nishc.cmd,
  [...nishc.prefix, "bench/p256.ts", "-o", `${rel(outDir)}/`, "--link", rel(exe), "--profile", "speed"],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
)
if (build.status !== 0) {
  console.error(`building bench/p256.ts failed (exit ${build.status})\n${build.stdout}${build.stderr}`)
  process.exit(1)
}

/**
 * One run of `bin`: `{ answer, times }`, the checksum line and a Map from
 * workload to `{ ns, calls }`. `args` is `[scale]` or `[scale, workload]`, and
 * `want` names the workloads the run must time.
 */
const runOnce = (bin, args, want) => {
  const r = spawnSync(bin, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    fail(`${rel(bin)} ${args.join(" ")} exited with ${r.status}\n${r.stdout}${r.stderr}`)
  }
  const times = new Map()
  for (const line of r.stderr.split("\n")) {
    const m = line.match(/^time (\S+) (\d+) (\d+)$/)
    if (m !== null) {
      times.set(m[1], { ns: Number(m[2]), calls: Number(m[3]) })
    }
  }
  if (times.size !== want.length || !want.every((name) => times.has(name))) {
    fail(
      `${rel(bin)} ${args.join(" ")} timed ${[...times.keys()].join(", ")}, not ${want.join(", ")}\n${r.stderr}`
    )
  }
  return { answer: r.stdout.trim(), times }
}

if (check) {
  const r = runOnce(exe, [String(CHECK_SCALE)], WORKLOADS)
  console.log(r.answer)
  if (r.answer !== CHECK_SUM) {
    console.error(`bench/p256.mjs: printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(CHECK_SUM)}`)
    process.exit(1)
  }
  process.exit(0)
}

/** The columns, each `{ label, bin }`, the baseline first. */
const columns = [{ label: "baseline", bin: exe }]
if (self) {
  // A copy rather than the same path twice, as bench/aes-gcm.mjs --self makes
  // one: each column is its own file, mapped on its own.
  const copy = path.join(outDir, "p256-copy")
  fs.copyFileSync(exe, copy)
  columns.push({ label: "baseline (copy)", bin: copy })
}
for (const b of binaries) {
  columns.push({ label: rel(b), bin: b })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// One warm-up round, then a multiple of the column count, counted from the
// first timed round so each column goes first equally often. Within a round
// every column runs each workload before the next workload starts.
const n = columns.length
const rounds = Math.ceil(runs / n) * n
/** samples[k] maps a workload to its nanoseconds a call, one per timed round, for column k. */
const samples = columns.map(() => new Map())
/** The checksum each workload printed first, which every later run of it must repeat. */
const answers = new Map()
for (let i = 0; i <= rounds; i++) {
  for (const name of WORKLOADS) {
    for (let j = 0; j < n; j++) {
      const k = (i + 1 + j) % n
      const r = runOnce(columns[k].bin, ["1", name], [name])
      if (!answers.has(name)) {
        answers.set(name, r.answer)
      }
      if (r.answer !== answers.get(name)) {
        fail(
          `${columns[k].label}, ${name}, round ${i}, printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(answers.get(name))}`
        )
      }
      if (i === 0) {
        continue
      }
      const t = r.times.get(name)
      const list = samples[k].get(name) ?? []
      list.push(t.ns / t.calls)
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
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()

/** The table's widths: the first two columns are left-aligned, the rest right-aligned. */
const WIDTHS = [11, 22, 9, 10, 9, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["workload", "column", "min us", "median us", "calls/s", "median"]))

const stats = columns.map(() => new Map())
for (const name of WORKLOADS) {
  for (let k = 0; k < n; k++) {
    const ts = samples[k].get(name)
    const s = { min: Math.min(...ts), median: median(ts) }
    stats[k].set(name, s)
    console.log(
      line([
        name,
        columns[k].label,
        (s.min / 1e3).toFixed(1),
        (s.median / 1e3).toFixed(1),
        (1e9 / s.min).toFixed(0),
        (1e9 / s.median).toFixed(0),
      ])
    )
  }
}
const sums = WORKLOADS.map((name) => `${name} ${answers.get(name)}`).join(", ")
console.log(`\n${rounds} rounds of ${n} after one warm-up, at ${commit}, on ${cpu}; ${sums}.`)

/** Each column's time against the baseline's, as a percentage of the baseline's: + is slower. */
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`
for (let k = 1; k < n; k++) {
  const parts = []
  for (const name of WORKLOADS) {
    const b = stats[0].get(name)
    const c = stats[k].get(name)
    parts.push(`${name} ${pct(b.min, c.min)} / ${pct(b.median, c.median)}`)
  }
  console.log(`\n${columns[k].label} against the baseline, time at the minimum / median (+ is slower):`)
  console.log(`  ${parts.join("\n  ")}`)
}
