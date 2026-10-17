#!/usr/bin/env node
// WP41: the bar of docs/wp41-mul-wide.md §2. It builds bench/mul-wide.ts
// natively and bench/mul-wide-kernels.ts as freestanding wasm, runs each in
// interleaved rounds, and prints each column's min and median against the
// radix-2^26 kernel `main` shipped.
//
//   npm run build && node bench/mul-wide.mjs [options] [--compiler <nish>]
//     --runs N    timed rounds after one warm-up (default 15, the bar's minimum)
//     --no-wasm   the native table alone
//     --check     one short native run of each kernel, its checksum against the pinned one
//
// The columns, natively: `base`, the frozen radix-2^26 kernel; `std`, the
// kernel std/crypto holds; and `base (copy)`, a byte-identical copy of the
// binary run as `base`, whose distance from `base` is the noise band. Under
// wasm the same three, as macRun(0), macRun(1) and macRun(0) on a second
// instance of a copy of the module. Every column runs once per round, the
// order rotating so each goes first equally often, and the round count is
// rounded up to a multiple of three. Every run of every column must give the
// same checksum, or the run stops: two kernels that answer differently are not
// timing the same work. What is timed is macRun alone, not the process.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "mul-wide")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/mul-wide.mjs: ${msg}`)
  process.exit(2)
}

/**
 * `--check`'s scale and the checksum bench/mul-wide.ts prints at it, for both
 * kernels: a change to this number is a change to what Poly1305 answers.
 */
const CHECK_SCALE = 64
const CHECK_SUM = "checksum 3090113157"
/** bench/mul-wide-kernels.ts's MACS and MESSAGE_BYTES, for the wasm calls. */
const MACS = 4096
const MESSAGE_BYTES = 65536

let runs = 15
let wasm = true
let check = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--no-wasm") {
    wasm = false
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
const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    console.error(`${what} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
}
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "mul-wide")
run(
  nishc.cmd,
  [...nishc.prefix, "bench/mul-wide.ts", "-o", `${rel(outDir)}/`, "--link", rel(exe), "--profile", "speed"],
  "building bench/mul-wide.ts"
)

/** One run of `bin kernel scale`: `{ answer, ns }`. */
const runOnce = (bin, kernel, scale) => {
  const r = spawnSync(bin, [kernel, String(scale)], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.status !== 0) {
    fail(`${rel(bin)} ${kernel} ${scale} exited with ${r.status}\n${r.stdout}${r.stderr}`)
  }
  const m = r.stderr.match(/^time poly1305 (\d+) \d+$/m)
  if (m === null) {
    fail(`${rel(bin)} ${kernel} ${scale} printed no time\n${r.stderr}`)
  }
  return { answer: r.stdout.trim(), ns: Number(m[1]) }
}

if (check) {
  for (const kernel of ["base", "std"]) {
    const r = runOnce(exe, kernel, CHECK_SCALE)
    console.log(`${kernel} ${r.answer}`)
    if (r.answer !== CHECK_SUM) {
      console.error(
        `bench/mul-wide.mjs: ${kernel} printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(CHECK_SUM)}`
      )
      process.exit(1)
    }
  }
  process.exit(0)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * The rounds over `columns`, each `{ label, time }` where `time()` answers
 * `{ answer, ns }`: one warm-up, then `runs` rounded up to a multiple of the
 * columns, the first column rotating. Each column's `{ min, median }` in ns.
 */
const measure = (columns) => {
  const n = columns.length
  const rounds = Math.ceil(runs / n) * n
  const samples = columns.map(() => [])
  let answer = null
  for (let i = 0; i <= rounds; i++) {
    for (let j = 0; j < n; j++) {
      const k = (i + j) % n
      const r = columns[k].time()
      if (answer !== null && r.answer !== answer) {
        fail(`${columns[k].label}, round ${i}, answered ${r.answer}, not ${answer}`)
      }
      answer = r.answer
      if (i > 0) {
        samples[k].push(r.ns)
      }
    }
  }
  return { rounds, answer, stats: samples.map((ts) => ({ min: Math.min(...ts), median: median(ts) })) }
}

/** `to` against `from` as a percentage of `from`: + is slower. */
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`

const report = (title, columns, m) => {
  console.log(`\n${title}: ${m.rounds} rounds of ${columns.length} after one warm-up; ${m.answer}`)
  console.log(`${"column".padEnd(14)} ${"min ms".padStart(9)} ${"median ms".padStart(10)}   against base`)
  const base = m.stats[0]
  columns.forEach((c, k) => {
    const s = m.stats[k]
    const against = k === 0 ? "" : `${pct(base.min, s.min)} / ${pct(base.median, s.median)}`
    console.log(
      `${c.label.padEnd(14)} ${(s.min / 1e6).toFixed(1).padStart(9)} ${(s.median / 1e6).toFixed(1).padStart(10)}   ${against}`
    )
  })
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
console.log(`bench/mul-wide.mjs at ${commit}, on ${cpu}, ${process.arch}; base (copy) is the noise band`)

// A copy rather than the same path twice, as bench/aes-gcm.mjs --self makes
// one: each column is its own file, mapped on its own.
const copy = path.join(outDir, "mul-wide-copy")
fs.copyFileSync(exe, copy)
const native = [
  { label: "base", time: () => runOnce(exe, "base", 1) },
  { label: "std", time: () => runOnce(exe, "std", 1) },
  { label: "base (copy)", time: () => runOnce(copy, "base", 1) },
]
report("native", native, measure(native))

if (wasm) {
  // The kernels alone, linked as scripts/build.sh --profile wasm links host IR:
  // the route that must carry mulHigh without a __multi3.
  const wasmDir = path.join(outDir, "wasm")
  fs.mkdirSync(wasmDir, { recursive: true })
  run(
    nishc.cmd,
    [...nishc.prefix, "bench/mul-wide-kernels.ts", "-o", `${rel(wasmDir)}/`],
    "building the wasm kernels"
  )
  const module = path.join(wasmDir, "mul-wide.wasm")
  run(
    "bash",
    [
      "scripts/build.sh",
      rel(path.join(wasmDir, "mul-wide-kernels.ll")),
      rel(path.join(wasmDir, "chacha20poly1305.ll")),
      "runtime/runtime-wasm.c",
      "-o",
      rel(module),
      "--profile",
      "wasm",
    ],
    "linking the wasm kernels"
  )
  const moduleCopy = path.join(wasmDir, "mul-wide-copy.wasm")
  fs.copyFileSync(module, moduleCopy)
  const first = (await WebAssembly.instantiate(fs.readFileSync(module), {})).instance.exports
  const second = (await WebAssembly.instantiate(fs.readFileSync(moduleCopy), {})).instance.exports
  const call = (exports, kernel) => () => {
    const t0 = process.hrtime.bigint()
    const sum = exports.macRun(kernel, MACS, MESSAGE_BYTES) >>> 0
    return { answer: `checksum ${sum}`, ns: Number(process.hrtime.bigint() - t0) }
  }
  const columns = [
    { label: "base", time: call(first, 0) },
    { label: "std", time: call(first, 1) },
    { label: "base (copy)", time: call(second, 0) },
  ]
  report(`wasm32 (Node ${process.version})`, columns, measure(columns))
}
