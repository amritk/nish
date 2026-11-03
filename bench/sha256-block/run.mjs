#!/usr/bin/env node
// SHA-256's block function in ns and TSC cycles a block: the Nish body
// (`NISH_SHA256=soft`), the SHA-NI kernel the compiler puts in front of it (the
// default), and OpenSSL's sha256_block_data_order under OPENSSL_ia32cap masks
// that pick its scalar, AVX2 and SHA-NI bodies; then HMAC-SHA256, HS256 and
// PBKDF2 under both NISH_SHA256 settings, which is the dispatch's timing proof.
// bench/sha256-block/main.ts and openssl.c say what each case times.
//
//   node bench/sha256-block/run.mjs [options] [--compiler <nish>]
//     --rounds N         timed rounds a case runs at least (default 11)
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable),
//                        run under NISH_SHA256=soft: the old Nish body, such
//                        as main.ts built from `main`'s std/ (README.md)
//
// It builds main.ts with `--profile speed` and openssl.c and tsc.c with
// `clang -O2` into build/bench/sha256-block/, copies the Nish build byte for
// byte as the noise band's column, and measures the TSC's rate with tsc.c.
// Each case calibrates one iteration count on its slowest Nish column so a run
// takes about 200 ms; every column runs that count, and each round runs every
// column once in bench/json-compare/rounds.mjs's balanced order. Before
// timing, every column runs each case once and must print its `known`
// checksum, and every timed run must print the same checksum again.
//
// A block case's per-block figure is a run's ns over iterations × blocks,
// blocks being size / 64 + 1 (the padding block of a whole-block message).
// TSC cycles are that over the TSC's rate: a fixed clock, not the core's own
// under turbo. Spread is (max - min) / median of the rounds.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "bench", "sha256-block")
const nishc = compilerFrom(process.argv)

/** OPENSSL_ia32cap masks (OpenSSL 3's `~` clears bits of the CPUID words). */
const MASK = {
  // Word 1 clears AVX (ECX 28) and SSSE3 (ECX 9); word 2 clears AVX2 (EBX 5),
  // BMI2 (EBX 8) and SHA (EBX 29): sha256_block_data_order's integer body.
  scalar: "~0x1000020000000000:~0x20000120",
  // Word 1 kept whole, word 2 loses only SHA: the AVX2 + BMI body.
  avx2: "~0x0:~0x20000000",
}

/**
 * Each case as `main <kernel> <size> <iterations>` takes it, `known` the
 * checksum of one iteration, `blocks` the compressions an iteration runs
 * (null: report ns an operation), and `openssl` whether openssl.c has it.
 */
const CASES = [
  { label: "block 16 KiB", kernel: "block", size: 16384, known: "34b8b4e9", blocks: 257, openssl: true },
  { label: "block 64 B", kernel: "block", size: 64, known: "3c7cc516", blocks: 2, openssl: true },
  { label: "hmac-sha256 64 B", kernel: "hmac", size: 64, known: "2c68bc93", blocks: null, openssl: true },
  { label: "hs256 sign+verify", kernel: "hs256", size: 0, known: "e1ecf09b", blocks: null, openssl: false },
  { label: "pbkdf2 1000", kernel: "pbkdf2", size: 1000, known: "8695dfb7", blocks: null, openssl: false },
]
/** The nanoseconds a calibrated run of the slowest Nish column aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/sha256-block/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--binary") {
    const spec = argv[++i] ?? ""
    const eq = spec.indexOf("=")
    const file = path.resolve(eq > 0 ? spec.slice(eq + 1) : spec)
    binaries.push({
      id: eq > 0 ? spec.slice(0, eq) : path.relative(root, file),
      bin: file,
      env: { NISH_SHA256: "soft" },
      nish: true,
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
const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    console.error(`${what} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "sha256-block")
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    "bench/sha256-block/main.ts",
    "-o",
    `${rel(outDir)}/`,
    "--link",
    rel(exe),
    "--profile",
    "speed",
  ],
  "building bench/sha256-block/main.ts"
)
// A copy rather than the same path twice, as bench/crypto/run.mjs makes one:
// each column is its own file, mapped on its own.
fs.copyFileSync(exe, `${exe}-copy`)
const ossl = path.join(outDir, "openssl")
run(
  "clang",
  ["-O2", "-I", "bench/crypto/lib", "bench/sha256-block/openssl.c", "-lcrypto", "-o", rel(ossl)],
  "building openssl.c"
)
const tsc = path.join(outDir, "tsc")
run("clang", ["-O2", "bench/sha256-block/tsc.c", "-o", rel(tsc)], "building tsc.c")
const tscHz = Number(/^tsc_hz (\d+)$/m.exec(run(tsc, [], "tsc"))?.[1])
if (!(tscHz > 0)) {
  fail("tsc printed no rate")
}

/**
 * The columns, each `{ id, bin, env, nish }`: the Nish body and its copy
 * first, then the SHA-NI default, the old builds, and OpenSSL's three bodies.
 */
const soft = { NISH_SHA256: "soft" }
const columns = [
  { id: "nish-soft", bin: exe, env: soft, nish: true },
  { id: "nish-soft-copy", bin: `${exe}-copy`, env: soft, nish: true },
  { id: "nish (sha-ni)", bin: exe, env: {}, nish: true },
  ...binaries,
  { id: "openssl scalar", bin: ossl, env: { OPENSSL_ia32cap: MASK.scalar }, nish: false },
  { id: "openssl avx2", bin: ossl, env: { OPENSSL_ia32cap: MASK.avx2 }, nish: false },
  { id: "openssl (sha-ni)", bin: ossl, env: {}, nish: false },
]

/** One run under bench/crypto/README.md's contract: `{ checksum, ns }`. */
const runOnce = (column, c, iterations) => {
  const env = { ...process.env, ...column.env }
  if (!("NISH_SHA256" in column.env)) {
    delete env.NISH_SHA256
  }
  if (!("OPENSSL_ia32cap" in column.env)) {
    delete env.OPENSSL_ia32cap
  }
  const r = spawnSync(column.bin, [c.kernel, String(c.size), String(iterations)], {
    encoding: "utf8",
    env,
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

/** An iteration count that makes the Nish body take about TARGET_NS on `c`. */
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

const cpu =
  /^model name\s*:\s*(.*)$/m.exec(fs.readFileSync("/proc/cpuinfo", "utf8"))?.[1] ?? os.cpus()[0]?.model
console.log(
  `CPU: ${cpu}; TSC ${(tscHz / 1e9).toFixed(3)} GHz; ${os.cpus().length} cores; ${run("openssl", ["version"], "openssl version").trim()}`
)

const WIDTHS = [18, 18, 10, 10, 8, 10, 10, 10]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "min ns", "median ns", "spread", "min cyc", "median cyc", "vs soft"]))

const columnsOf = (c) => columns.filter((col) => col.nish || c.openssl)
for (const c of CASES) {
  for (const col of columnsOf(c)) {
    const r = runOnce(col, c, 1)
    if (r.checksum !== c.known) {
      fail(`${col.id} ${c.label} printed checksum ${r.checksum} for one iteration, not the known ${c.known}`)
    }
  }
}

for (const c of CASES) {
  const cols = columnsOf(c)
  const n = roundsFor(cols.length, rounds)
  const iterations = calibrate(c)
  const per = iterations * (c.blocks ?? 1)
  const times = new Map(cols.map((col) => [col.id, []]))
  let checksum = null
  for (let round = 0; round < n; round++) {
    for (const col of roundOrder(cols, round)) {
      const r = runOnce(col, c, iterations)
      if (checksum !== null && r.checksum !== checksum) {
        fail(`${col.id} ${c.label} printed checksum ${r.checksum}, not ${checksum}`)
      }
      checksum = r.checksum
      times.get(col.id).push(r.ns / per)
    }
  }
  const base = median(times.get("nish-soft"))
  const cyc = (ns) => ((ns * tscHz) / 1e9).toFixed(0)
  for (const col of cols) {
    const ts = times.get(col.id)
    const m = median(ts)
    const lo = Math.min(...ts)
    const spread = `${((100 * (Math.max(...ts) - lo)) / m).toFixed(1)}%`
    console.log(
      line([
        c.label,
        col.id,
        lo.toFixed(1),
        m.toFixed(1),
        spread,
        cyc(lo),
        cyc(m),
        col.id === "nish-soft" ? "" : pct(base, m),
      ])
    )
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${c.blocks === null ? "ns an operation" : `ns a block (${c.blocks} a message)`}; ` +
      `${iterations} iterations a run, ${n} rounds; checksum ${checksum}; band ±${(
        Math.abs(median(times.get("nish-soft-copy")) / base - 1) * 100
      ).toFixed(1)}%`
  )
}
console.log(
  `\nspread is (max - min) / median over the rounds; the band is nish-soft-copy's median against nish-soft's,` +
    " the same bytes, and a difference inside it is noise. cyc are TSC cycles."
)
