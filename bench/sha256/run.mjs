#!/usr/bin/env node
// The portable SHA-256 path in nanoseconds an operation: `sha256` on 64 B,
// 1 KiB and 1 MiB, HMAC-SHA256 on 256 B, and an HS256 JWT signed and verified
// (bench/sha256/main.ts says what each times). It builds main.ts, then times
// every case in bench/crypto/run.mjs's interleaved rounds with a
// byte-identical copy as a column, whose distance from the build is the noise
// band. With `--c`, scalar.c, a scalar C SHA-256, is two more columns of the
// cases it has: `c-native`, for this CPU, and `c-x86-64`, for the baseline
// x86-64 a build without `--cpu` targets.
//
//   npm run build && node bench/sha256/run.mjs [options] [--compiler <nish>]
//     --rounds N         timed rounds a case runs at least (default 11); the
//                        median is reported
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable),
//                        headed `name` or the path, such as the same program
//                        built from `main`:
//
//       git worktree add ../base origin/main && cp -r bench/sha256 ../base/bench/
//       (cd ../base && npm ci && npm run build &&
//        build/nish bench/sha256/main.ts -o build/b/ --link build/b/sha256 --profile speed)
//       node bench/sha256/run.mjs --binary main=../base/build/b/sha256
//     --c                add the C twin's columns
//
// The columns inherit NISH_SHA256: on a CPU with SHA-NI or the Armv8 SHA-2
// instructions, run under NISH_SHA256=soft to time the Nish code rather than
// runtime/runtime-sha256.c, and so to compare it with the C twin. The twin is
// built by `$CC` (default clang) with `-O2 -mno-sha`, once with
// `-march=native`: that one
// has the host's scalar instructions, BMI2's `rorx` among them, and neither
// has its SHA extensions. The Nish build is baseline x86-64 like `c-x86-64`;
// pass a `--cpu x86-64-v3` build as `--binary` to set it beside `c-native`.
//
// The build is main.ts by the compiler with `--profile speed`, into
// build/bench/sha256/. Each case calibrates one iteration count on the build
// so a run takes about 200 ms, and every column runs that count; each round
// runs every column once, in bench/json-compare/rounds.mjs's balanced order.
// Before timing, every column runs each case once and must print the case's
// `known` checksum, pinned from one iteration of main's untuned build: that,
// not the columns agreeing, is what says the hashes are right. Every timed run
// of every column must then print the same checksum, or the run stops: two
// builds whose answers differ are not timing the same work.
//
// A column's ns/op is its `ns` line over the iterations, and ns/block that
// over the compressions one operation runs. Its change is its median against
// the build's, + slower, and reads as a difference only outside the band.
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

/** The 64-byte blocks SHA-256 compresses for an `n`-byte message: §5.1.1 pads it by 9 bytes at least. */
const blocksOf = (n) => Math.ceil((n + 9) / 64)

/**
 * What each case runs, as `main <kernel> <size> <iterations>` takes it,
 * `known`, the checksum one iteration prints, and `blocks`, the compressions
 * one operation runs (an HMAC's are its inner hash over the key block and the
 * message and its outer one over the key block and the inner digest).
 */
const CASES = [
  {
    label: "sha256 64 B",
    kernel: "sha256",
    size: 64,
    known: "af88af1d",
    blocks: blocksOf(64),
  },
  {
    label: "sha256 1 KiB",
    kernel: "sha256",
    size: 1024,
    known: "dcc0d434",
    blocks: blocksOf(1024),
  },
  {
    label: "sha256 1 MiB",
    kernel: "sha256",
    size: 1048576,
    known: "e71d7281",
    blocks: blocksOf(1048576),
  },
  {
    label: "hmac-sha256 256 B",
    kernel: "hmac-sha256",
    size: 256,
    known: "1434f311",
    blocks: blocksOf(64 + 256) + blocksOf(64 + 32),
  },
  {
    label: "hs256 sign+verify",
    kernel: "hs256",
    size: 0,
    known: "0737e026",
    blocks: null,
  },
]
/** The kernels scalar.c has. */
const C_KERNELS = new Set(["sha256", "hmac-sha256"])
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/sha256/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
let withC = false
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--c") {
    withC = true
  } else if (argv[i] === "--binary") {
    const spec = argv[++i] ?? ""
    const eq = spec.indexOf("=")
    const file = path.resolve(eq > 0 ? spec.slice(eq + 1) : spec)
    binaries.push({
      id: eq > 0 ? spec.slice(0, eq) : path.relative(root, file),
      bin: file,
    })
  } else {
    fail(`unknown option ${argv[i]}`)
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

/**
 * The columns, each `{ id, bin }` and, when it has only some kernels, their
 * set as `kernels`: the build first and its copy second.
 */
const columns = [{ id: "nish", bin: exe }, { id: "nish-copy", bin: `${exe}-copy` }, ...binaries]
const cc = process.env.CC ?? "clang"
for (const [id, flags] of withC
  ? [
      ["c-native", ["-march=native"]],
      ["c-x86-64", []],
    ]
  : []) {
  const twin = path.join(outDir, id)
  const r = spawnSync(
    cc,
    ["-O2", ...flags, "-mno-sha", "-I", "bench/crypto/lib", "bench/sha256/scalar.c", "-o", rel(twin)],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
  if (r.error !== undefined) {
    console.log(`note: no ${id} column: ${cc}: ${r.error.message}`)
  } else if (r.status !== 0) {
    console.error(`building bench/sha256/scalar.c as ${id} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  } else {
    columns.push({ id, bin: twin, kernels: C_KERNELS })
  }
}
/** The columns that run case `c`. */
const columnsOf = (c) => columns.filter((col) => col.kernels === undefined || col.kernels.has(c.kernel))

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

const WIDTHS = [18, 28, 12, 12, 9, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "min ns/op", "median ns/op", "ns/block", "vs nish"]))

for (const c of CASES) {
  for (const col of columnsOf(c)) {
    const r = runOnce(col, c, 1)
    if (r.checksum !== c.known) {
      fail(`${col.id} ${c.label} printed checksum ${r.checksum} for one iteration, not the known ${c.known}`)
    }
  }
}

let roundsRun = 0
for (const c of CASES) {
  const cols = columnsOf(c)
  const n = roundsFor(cols.length, rounds)
  roundsRun = Math.max(roundsRun, n)
  const iterations = calibrate(c)
  const times = new Map(cols.map((col) => [col.id, []]))
  let checksum = null
  for (let round = 0; round < n; round++) {
    for (const col of roundOrder(cols, round)) {
      const r = runOnce(col, c, iterations)
      if (checksum !== null && r.checksum !== checksum) {
        fail(`${col.id} ${c.label} printed checksum ${r.checksum}, not ${checksum}`)
      }
      checksum = r.checksum
      times.get(col.id).push(r.ns / iterations)
    }
  }
  const base = median(times.get("nish"))
  for (const col of cols) {
    const ts = times.get(col.id)
    const m = median(ts)
    console.log(
      line([
        c.label,
        col.id,
        Math.min(...ts).toFixed(1),
        m.toFixed(1),
        c.blocks === null ? "" : (m / c.blocks).toFixed(1),
        col.id === "nish" ? "" : pct(base, m),
      ])
    )
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${iterations} iterations a run, ${n} rounds, checksum ${checksum}; band ±${(
      Math.abs(median(times.get("nish-copy")) / base - 1) * 100
    ).toFixed(1)}%`
  )
}
console.log(
  `\nUp to ${roundsRun} rounds a case, each running every column the case has once. ns/op is a run's ns over` +
    ` its iterations, ns/block that over the case's compressions; the band is nish-copy's median against nish's,` +
    " the same bytes, and a change inside it is noise."
)
