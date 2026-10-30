#!/usr/bin/env node
// The portable SHA-256 path in nanoseconds an operation: `sha256` on 64 B,
// 1 KiB and 1 MiB, and an HS256 JWT signed and verified (bench/sha256/main.ts
// says what each times). It builds main.ts, then times every case in
// bench/crypto/run.mjs's interleaved rounds with a byte-identical copy as a
// column, whose distance from the build is the noise band.
//
//   npm run build && node bench/sha256/run.mjs [options] [--compiler <nish>]
//     --rounds N         timed rounds a case runs at least (default 11); the
//                        median is reported
//     --binary <path>    another build of main.ts as a column (repeatable),
//                        such as the same program built from `main`:
//
//       git worktree add ../base origin/main && cp -r bench/sha256 ../base/bench/
//       (cd ../base && npm ci && npm run build &&
//        build/nish bench/sha256/main.ts -o build/b/ --link build/b/sha256 --profile speed)
//       node bench/sha256/run.mjs --binary ../base/build/b/sha256
//
// The build is main.ts by the compiler with `--profile speed`, into
// build/bench/sha256/. Each case calibrates one iteration count on the build
// so a run takes about 200 ms, and every column runs that count; each round
// runs every column once, in bench/json-compare/rounds.mjs's balanced order.
// Every run of every column must print the same checksum, or the run stops:
// two builds whose answers differ are not timing the same work.
//
// A column's ns/op is its `ns` line over the iterations. Its change is its
// median against the build's, + slower, and reads as a difference only
// outside the band.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "bench", "sha256")
const nishc = compilerFrom(process.argv)

/** What each case runs, as `main <kernel> <size> <iterations>` takes it. */
const CASES = [
  { label: "sha256 64 B", kernel: "sha256", size: 64 },
  { label: "sha256 1 KiB", kernel: "sha256", size: 1024 },
  { label: "sha256 1 MiB", kernel: "sha256", size: 1048576 },
  { label: "hs256 sign+verify", kernel: "hs256", size: 0 },
]
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/sha256/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--binary") {
    binaries.push(path.resolve(argv[++i] ?? ""))
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(Number.isInteger(rounds) && rounds >= 1)) {
  fail("--rounds needs a positive count")
}
for (const b of binaries) {
  if (!fs.existsSync(b)) {
    fail(`--binary ${b}: no such file`)
  }
}

const rel = (p) => path.relative(root, p)
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "sha256")
const build = spawnSync(
  nishc.cmd,
  [
    ...nishc.prefix,
    "bench/sha256/main.ts",
    "-o",
    `${rel(outDir)}/`,
    "--link",
    rel(exe),
    "--profile",
    "speed",
  ],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
)
if (build.status !== 0) {
  console.error(`building bench/sha256/main.ts failed (exit ${build.status})\n${build.stdout}${build.stderr}`)
  process.exit(1)
}
// A copy rather than the same path twice, as bench/crypto/run.mjs makes one:
// each column is its own file, mapped on its own.
fs.copyFileSync(exe, `${exe}-copy`)

/** The columns, each `{ id, bin }`, the build first and its copy second. */
const columns = [
  { id: "nish", bin: exe },
  { id: "nish-copy", bin: `${exe}-copy` },
  ...binaries.map((b) => ({ id: rel(b), bin: b })),
]

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

const WIDTHS = [18, 28, 12, 12, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "min ns/op", "median ns/op", "vs nish"]))

const n = roundsFor(columns.length, rounds)
for (const c of CASES) {
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
  const base = median(times.get("nish"))
  for (const col of columns) {
    const ts = times.get(col.id)
    const m = median(ts)
    console.log(
      line([c.label, col.id, Math.min(...ts).toFixed(1), m.toFixed(1), col.id === "nish" ? "" : pct(base, m)])
    )
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${iterations} iterations a run, checksum ${checksum}; band ±${(
      Math.abs(median(times.get("nish-copy")) / base - 1) * 100
    ).toFixed(1)}%`
  )
}
console.log(
  `\n${n} rounds of ${columns.length} columns a case. ns/op is a run's ns over its iterations; the band is` +
    ` nish-copy's median against nish's, the same bytes, and a change inside it is noise.`
)
