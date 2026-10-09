#!/usr/bin/env node
// WP38 S0: the baselines every later SIMD bar is a ratio against
// (docs/wp38-simd.md §2.3 and §7). Nothing here is built into the compiler; it
// only measures what the current one does.
//
//   npm run build && node bench/simd-s0.mjs [--runs N] [--only a,b] [--compiler <nish>]
//     --runs N    timed runs per row after one warm-up (default 7, the note's minimum)
//     --only a,b  rows to run: scan, nbody, vec3, spectral, bootstrap (default: all)
//
// What it times, and why each row is built the way it is:
//
//   scan       bench/scan.ts, natively and as freestanding wasm under Node. The
//              file is a library, so a driver is written beside a copy of it:
//              a 1 MiB document of balanced JSON objects is scanned SCAN_ROUNDS
//              times, one byte of it flipped between a digit and a comma before
//              each pass so no pass repeats the last, and every answer is folded
//              into the printed checksum. The wasm row drives the same rounds
//              through web/bytes-worker.mjs's `scanBatch`, so it also pays the
//              copy into linear memory that any host pays, and must print the
//              native row's checksum.
//   nbody, vec3, spectral
//              compiled once to a .ll with the flags in their .args sidecars,
//              then linked twice from that same .ll: `scripts/build.sh --profile
//              speed` as `nish --link` runs it (the baseline: no -march), and
//              again with clang given -march=x86-64-v3, module and runtime alike,
//              which is what an opt-in CPU level would do (§3.4). Only the link
//              differs, so the column is the target and nothing else. Both
//              binaries must print the same checksum.
//   bootstrap  `scripts/bootstrap.sh --verify`, seed to stage3, into a work
//              directory under build/bench so build/nish is left alone. This is
//              the self-compilation time S4 is judged by.
//
// Every row reports the minimum and the median of the timed runs in ms, as
// bench/run.mjs does: a native row is the wall time of the whole process, a wasm
// row the in-process time of its rounds.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { scanBatch } from "../web/bytes-worker.mjs"
import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const benchDir = path.join(root, "bench")
const outDir = path.join(root, "build", "bench", "simd-s0")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/simd-s0.mjs: ${msg}`)
  process.exit(2)
}

const ROWS = ["scan", "nbody", "vec3", "spectral", "bootstrap"]
let runs = 7
let only = new Set(ROWS)
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--only") {
    only = new Set((argv[++i] ?? "").split(",").filter(Boolean))
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(runs >= 1)) {
  fail("--runs needs a positive count")
}
for (const name of only) {
  if (!ROWS.includes(name)) {
    fail(`unknown row ${name} (rows: ${ROWS.join(", ")})`)
  }
}

/** The level the wider column is linked for: the one S2's flag would offer first. */
const MARCH = "x86-64-v3"

/** The rounds the scan driver runs over its document: about a second natively. */
const SCAN_ROUNDS = 1000
const SCAN_BYTES = 1 << 20

/**
 * One balanced object, repeated to fill the document. It has the bytes the
 * scanner branches on: quotes, an escaped quote, brackets, and commas and
 * colons both inside and outside strings. `FLIP` is the offset of the `1` the
 * rounds flip to a comma and back, outside any string, so the token count moves.
 */
const PIECE = '{"id":"a\\"b","n":[1,2,3],"s":"x,y:z","d":{"k":[true,null]}},'
const FLIP = PIECE.indexOf("[1") + 1

fs.mkdirSync(outDir, { recursive: true })
const rel = (p) => path.relative(root, p)

const run = (cmd, args, what, env = process.env) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    console.error(`${what}: ${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r
}

/** The compiler flags `bench/<name>.ts` is built with, from its `.args` sidecar, as bench/run.mjs reads them. */
const sourceArgs = (name) => {
  const file = path.join(benchDir, `${name}.args`)
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : []
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * `time()` once to warm up and then `runs` times: { min, median } in ms and the
 * last answer, which every run must repeat.
 */
const timeRuns = (what, time) => {
  const times = []
  let answer = null
  for (let i = 0; i <= runs; i++) {
    const r = time()
    if (answer !== null && r.answer !== answer) {
      fail(`${what}: run ${i} printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(answer)}`)
    }
    answer = r.answer
    if (i > 0) {
      times.push(r.ms)
    }
  }
  return { min: Math.min(...times), median: median(times), answer }
}

/** One process, timed from spawn to exit; its stdout is the answer. */
const timeProcess =
  (cmd, args, env = process.env) =>
  () => {
    const t0 = process.hrtime.bigint()
    const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] })
    const ms = Number(process.hrtime.bigint() - t0) / 1e6
    if (r.status !== 0) {
      fail(`${cmd} ${args.join(" ")} exited with ${r.status}\n${r.stdout}${r.stderr}`)
    }
    return { ms, answer: r.stdout.trim() }
  }

/**
 * A C compiler that is the baseline's with `-march=<MARCH>` in front, for
 * scripts/build.sh, which takes its compiler from `CC` and no extra flags.
 * Under `-flto` clang passes the CPU on to the link-time code generator, so the
 * module's functions get it as well as runtime.c's.
 */
const wideCC = (() => {
  const file = path.join(outDir, `cc-${MARCH}`)
  fs.writeFileSync(file, `#!/bin/sh\nexec ${process.env.CC || "clang"} -march=${MARCH} "$@"\n`, {
    mode: 0o755,
  })
  return file
})()

const results = []
const row = (name, column, r) => {
  results.push({ name, column, ...r })
  console.log(
    `${`${name} ${column}`.padEnd(28)} min ${r.min.toFixed(1).padStart(9)} ms  median ${r.median.toFixed(1).padStart(9)} ms`
  )
}

// ---- scan ----------------------------------------------------------------------------------

/** The driver: build the document, flip and scan it SCAN_ROUNDS times, print the folded answers. */
const scanDriver = () => {
  const piece = [...Buffer.from(PIECE)].join(", ")
  return `// Written by bench/simd-s0.mjs: the S0 driver around bench/scan.ts.
import { scanJson } from "./scan.ts"

export const main = (): i32 => {
  const PIECE: u8[] = [${piece}]
  const size: i32 = ${SCAN_BYTES}
  const pieces: i32 = size / PIECE.length
  const bytes: u8[] = []
  for (let i: i32 = 0; i < pieces * PIECE.length; i++) {
    bytes.push(PIECE[i % PIECE.length])
  }
  let checksum: i32 = 0
  for (let r: i32 = 0; r < ${SCAN_ROUNDS}; r++) {
    const at: i32 = (r % pieces) * PIECE.length + ${FLIP}
    bytes[at] = bytes[at] === toU8(44) ? toU8(49) : toU8(44)
    checksum = (checksum * 31 + scanJson(bytes) + r) % 1000003
  }
  console.log(checksum)
  return 0
}
`
}

/** The same rounds as the driver, on the wasm module through scanBatch. */
const scanWasmRounds = (exports) => {
  const piece = Buffer.from(PIECE)
  const pieces = Math.floor(SCAN_BYTES / piece.length)
  const bytes = new Uint8Array(pieces * piece.length)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = piece[i % piece.length]
  }
  let checksum = 0
  for (let r = 0; r < SCAN_ROUNDS; r++) {
    const at = (r % pieces) * piece.length + FLIP
    bytes[at] = bytes[at] === 44 ? 49 : 44
    checksum = (checksum * 31 + scanBatch(exports, [bytes])[0] + r) % 1000003
  }
  return String(checksum)
}

if (only.has("scan")) {
  const dir = path.join(outDir, "scan")
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(path.join(benchDir, "scan.ts"), path.join(dir, "scan.ts"))
  fs.writeFileSync(path.join(dir, "main.ts"), scanDriver())
  const exe = path.join(dir, "scan-native")
  run(
    nishc.cmd,
    [...nishc.prefix, rel(path.join(dir, "main.ts")), "--link", rel(exe), "--profile", "speed"],
    "scan"
  )
  const native = timeRuns("scan native", timeProcess(exe, []))
  row("scan", "native", native)

  // Built the way bench/worker.mjs builds it: the library alone, freestanding.
  const ll = path.join(dir, "scan-wasm.ll")
  const wasm = path.join(dir, "scan.wasm")
  run(nishc.cmd, [...nishc.prefix, rel(path.join(dir, "scan.ts")), "-o", rel(ll)], "scan wasm")
  run(
    "bash",
    ["scripts/build.sh", rel(ll), "runtime/runtime-wasm.c", "-o", rel(wasm), "--profile", "wasm"],
    "scan wasm"
  )
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), {})
  const wasmTimes = timeRuns("scan wasm", () => {
    const t0 = performance.now()
    const answer = scanWasmRounds(instance.exports)
    return { ms: performance.now() - t0, answer }
  })
  if (wasmTimes.answer !== native.answer) {
    fail(`scan: wasm printed ${wasmTimes.answer}, native ${native.answer}`)
  }
  row("scan", "wasm (Node)", wasmTimes)
}

// ---- nbody, vec3, spectral -------------------------------------------------------------------

for (const name of ["nbody", "vec3", "spectral"].filter((n) => only.has(n))) {
  const ll = path.join(outDir, `${name}.ll`)
  run(nishc.cmd, [...nishc.prefix, `bench/${name}.ts`, ...sourceArgs(name), "-o", rel(ll)], name)
  const link = (exe, env) =>
    run(
      "bash",
      ["scripts/build.sh", rel(ll), "runtime/runtime.c", "-o", rel(exe), "--profile", "speed"],
      name,
      env
    )
  const base = path.join(outDir, `${name}-baseline`)
  const wide = path.join(outDir, `${name}-${MARCH}`)
  link(base, process.env)
  link(wide, { ...process.env, CC: wideCC })
  const b = timeRuns(`${name} baseline`, timeProcess(base, []))
  row(name, "baseline", b)
  const w = timeRuns(`${name} ${MARCH}`, timeProcess(wide, []))
  if (w.answer !== b.answer) {
    fail(
      `${name}: -march=${MARCH} printed ${JSON.stringify(w.answer)}, the baseline ${JSON.stringify(b.answer)}`
    )
  }
  row(name, MARCH, w)
}

// ---- bootstrap -------------------------------------------------------------------------------

if (only.has("bootstrap")) {
  const work = path.join(outDir, "selfhost")
  const exe = path.join(outDir, "nish-stage2")
  const verify = timeProcess("bash", [
    "scripts/bootstrap.sh",
    "--verify",
    "--quiet",
    "--work",
    rel(work),
    "-o",
    rel(exe),
  ])
  // Its output names the work directory and nothing that changes per run, so
  // the answer check is only that every run ended the same way.
  row(
    "bootstrap",
    "--verify",
    timeRuns("bootstrap --verify", () => ({ ...verify(), answer: "ok" }))
  )
}

// ---- Summary ---------------------------------------------------------------------------------

const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()
const cpu = (() => {
  const m = fs.readFileSync("/proc/cpuinfo", "utf8").match(/^model name\s*:\s*(.+)$/m)
  return m ? m[1].trim() : "unknown"
})()
console.log(`\n${runs} runs after one warm-up, at ${commit}, on ${cpu}`)
for (const name of ["nbody", "vec3", "spectral"]) {
  const b = results.find((r) => r.name === name && r.column === "baseline")
  const w = results.find((r) => r.name === name && r.column === MARCH)
  if (b && w) {
    const gain = (b.min - w.min) / b.min
    console.log(
      `${name}: -march=${MARCH} ${(100 * gain).toFixed(1)}% on the minimum (${b.min.toFixed(1)} -> ${w.min.toFixed(1)} ms)`
    )
  }
}
