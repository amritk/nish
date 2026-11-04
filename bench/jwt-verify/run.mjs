#!/usr/bin/env node
// An HS256 token's verification in nanoseconds a token, and the base64url
// decode inside it (bench/jwt-verify/main.ts says what each kernel times). It
// builds main.ts twice, for baseline x86-64 and for `--cpu x86-64-v3`, and
// times every case in interleaved rounds with a byte-identical copy of the
// baseline build as a column, whose distance from the build is the noise band.
//
//   npm run build && node bench/jwt-verify/run.mjs [options] [--compiler <nish>]
//     --validate         build, and check every column's one-iteration checksum
//                        against the case's pinned one; no timing
//     --rounds N         timed rounds a case runs at least (default 11); the
//                        median is reported
//     --only TEXT        only the cases whose label holds TEXT
//     --base REV         a column `base`: main.ts built by the same compiler
//                        against REV's standard library, from a worktree of REV
//                        under build/bench/jwt-verify/
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable)
//     --instructions     after the timing, each column's instructions a
//                        token under callgrind: (a 12,000-iteration run minus a
//                        2,000-iteration one) over 10,000
//
// The columns are `nish` (the baseline build), `nish-copy` (its bytes again),
// `v3` (the `--cpu x86-64-v3` build), then `base` and any `--binary`. A case
// that hashes adds `nish soft` and `v3 soft`: the same builds under
// `NISH_SHA256=soft`, the portable SHA-256 a CPU without SHA-NI runs. Each case
// calibrates one iteration count on `nish` so a run takes about 200 ms, and
// every column runs that count; each round runs every column once, in
// bench/json-compare/rounds.mjs's balanced order. Every column must print the
// case's `known` checksum for one iteration, pinned from main's build, and
// every timed run of every column the same checksum: two builds whose answers
// differ are not timing the same work.
//
// A column's ns/op is its `ns` line over the iterations; its change is its
// median against `nish`'s (against `nish soft`'s for `v3 soft`), + slower, and
// reads as a difference only outside the band.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "bench", "jwt-verify")
const nishc = compilerFrom(process.argv)

/**
 * What each case runs, as `main <kernel> <shape> <iterations>` takes it,
 * `known`, the checksum one iteration prints, and whether it hashes.
 */
const CASES = [
  { label: "verify 148 B", kernel: "verify", shape: 0, known: "11532f9f", sha: true },
  { label: "verify 507 B", kernel: "verify", shape: 1, known: "75794536", sha: true },
  { label: "midstate 104 B", kernel: "midstate", shape: 0, known: "dc6bc4b9", sha: true },
  { label: "midstate 463 B", kernel: "midstate", shape: 1, known: "533aedea", sha: true },
  { label: "decode-server 148 B", kernel: "decode-server", shape: 0, known: "d8178c1f", sha: false },
  { label: "decode-std 148 B", kernel: "decode-std", shape: 0, known: "d8178c1f", sha: false },
  { label: "decode-old 148 B", kernel: "decode-old", shape: 0, known: "d8178c1f", sha: false },
  { label: "decode-server 507 B", kernel: "decode-server", shape: 1, known: "4b9b2110", sha: false },
  { label: "decode-std 507 B", kernel: "decode-std", shape: 1, known: "4b9b2110", sha: false },
  { label: "decode-old 507 B", kernel: "decode-old", shape: 1, known: "4b9b2110", sha: false },
]
/** The nanoseconds a calibrated run aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/jwt-verify/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 11
let validate = false
let only = ""
let baseRev = null
let instructions = false
const binaries = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--validate") {
    validate = true
  } else if (argv[i] === "--only") {
    only = argv[++i] ?? ""
  } else if (argv[i] === "--base") {
    baseRev = argv[++i] ?? ""
  } else if (argv[i] === "--instructions") {
    instructions = true
  } else if (argv[i] === "--binary") {
    const spec = argv[++i] ?? ""
    const eq = spec.indexOf("=")
    const file = path.resolve(eq > 0 ? spec.slice(eq + 1) : spec)
    binaries.push({ id: eq > 0 ? spec.slice(0, eq) : path.relative(root, file), bin: file, env: {} })
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(Number.isInteger(rounds) && rounds >= 1)) {
  fail("--rounds needs a positive count")
}
if (baseRev === "") {
  fail("--base needs a revision")
}
for (const b of binaries) {
  if (!fs.existsSync(b.bin)) {
    fail(`--binary ${b.bin}: no such file`)
  }
}

/** main.ts built from `dir` (a checkout) into `target`, with `extra` flags. */
const build = (cmd, prefix, dir, target, extra) => {
  const r = spawnSync(
    cmd,
    [
      ...prefix,
      "bench/jwt-verify/main.ts",
      "-o",
      `${path.relative(dir, target)}.d/`,
      "--link",
      path.relative(dir, target),
      "--profile",
      "speed",
      ...extra,
    ],
    { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
  if (r.status !== 0) {
    console.error(
      `building bench/jwt-verify/main.ts in ${dir} failed (exit ${r.status})\n${r.stdout}${r.stderr}`
    )
    process.exit(1)
  }
}

fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "jwt-verify")
const exeV3 = path.join(outDir, "jwt-verify-v3")
build(nishc.cmd, nishc.prefix, root, exe, [])
build(nishc.cmd, nishc.prefix, root, exeV3, ["--cpu", "x86-64-v3"])
// A copy rather than the same path twice, as bench/crypto/run.mjs makes one:
// each column is its own file, mapped on its own.
fs.copyFileSync(exe, `${exe}-copy`)

/**
 * The `base` column: a worktree of `rev` with this bench copied in and the
 * compiler's own binary beside it, so the compiler is this one and the
 * library it reads (the worktree's `std/`, found from where it sits) is rev's.
 */
const baseColumn = (rev) => {
  const sha = execFileSync("git", ["rev-parse", "--verify", `${rev}^{commit}`], {
    cwd: root,
    encoding: "utf8",
  }).trim()
  const tree = path.join(outDir, `base-${sha.slice(0, 12)}`)
  if (!fs.existsSync(tree)) {
    execFileSync("git", ["worktree", "add", "--detach", tree, sha], { cwd: root, stdio: "ignore" })
  }
  if (nishc.prefix.length > 0) {
    fail("--base needs a native compiler, which it copies beside the worktree's std/")
  }
  fs.mkdirSync(path.join(tree, "build"), { recursive: true })
  fs.copyFileSync(nishc.cmd, path.join(tree, "build", "nish"))
  fs.chmodSync(path.join(tree, "build", "nish"), 0o755)
  fs.cpSync(here, path.join(tree, "bench", "jwt-verify"), { recursive: true })
  fs.cpSync(path.join(root, "bench", "crypto", "lib"), path.join(tree, "bench", "crypto", "lib"), {
    recursive: true,
  })
  const bin = path.join(tree, "build", "bench", "jwt-verify")
  fs.mkdirSync(path.dirname(bin), { recursive: true })
  build(path.join(tree, "build", "nish"), [], tree, bin, [])
  return { id: "base", bin, env: {} }
}

const SOFT = { NISH_SHA256: "soft" }
/** The columns, each `{ id, bin, env, sha }`: `sha` columns join only the cases that hash. */
const columns = [
  { id: "nish", bin: exe, env: {} },
  { id: "nish-copy", bin: `${exe}-copy`, env: {} },
  { id: "v3", bin: exeV3, env: {} },
  ...(baseRev === null ? [] : [baseColumn(baseRev)]),
  ...binaries,
  { id: "nish soft", bin: exe, env: SOFT, sha: true },
  { id: "v3 soft", bin: exeV3, env: SOFT, sha: true },
]
const columnsOf = (c) => columns.filter((col) => col.sha !== true || c.sha)

const cpuInfo = () => {
  try {
    return fs.readFileSync("/proc/cpuinfo", "utf8")
  } catch {
    return ""
  }
}
const info = cpuInfo()
const model = /^model name\s*:\s*(.+)$/m.exec(info)?.[1] ?? os.cpus()[0]?.model ?? "unknown"
const flags = new Set((/^flags\s*:\s*(.+)$/m.exec(info)?.[1] ?? "").split(/\s+/))
const stamp = ["avx2", "bmi2", "sha_ni", "avx512f"]
  .map((f) => `${f} ${flags.has(f) ? "yes" : "no"}`)
  .join(", ")
console.log(`cpu: ${model} (${os.cpus().length} threads; ${stamp})`)

/** One run under bench/crypto/README.md's contract: `{ checksum, ns }`. */
const runOnce = (column, c, iterations) => {
  const r = spawnSync(column.bin, [c.kernel, String(c.shape), String(iterations)], {
    encoding: "utf8",
    env: { ...process.env, ...column.env },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    fail(
      `${column.id} ${c.kernel} ${c.shape} ${iterations}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`
    )
  }
  return { checksum: sum[1], ns: Number(ns[1]) }
}

const cases = CASES.filter((c) => c.label.includes(only))
for (const c of cases) {
  for (const col of columnsOf(c)) {
    const r = runOnce(col, c, 1)
    if (r.checksum !== c.known) {
      fail(`${col.id} ${c.label} printed checksum ${r.checksum} for one iteration, not the known ${c.known}`)
    }
  }
}
if (validate) {
  console.log(`${cases.length} cases, every column's one-iteration checksum the pinned one`)
  process.exit(0)
}

/** An iteration count that makes `nish` take about TARGET_NS on `c`. */
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

const WIDTHS = [20, 12, 12, 12, 9]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "min ns/op", "median ns/op", "vs nish"]))

for (const c of cases) {
  const cols = columnsOf(c)
  const n = roundsFor(cols.length, rounds)
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
    const against = col.id === "v3 soft" ? median(times.get("nish soft")) : base
    const vs = col.id === "nish" ? "" : `${pct(against, m)}${col.id === "v3 soft" ? "*" : ""}`
    console.log(line([c.label, col.id, Math.min(...ts).toFixed(1), m.toFixed(1), vs]))
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${n} rounds of ${iterations} iterations, checksum ${checksum}; band ±${(
      Math.abs(median(times.get("nish-copy")) / base - 1) * 100
    ).toFixed(1)}%`
  )
}
console.log(
  "\nns/op is a run's ns over its iterations; the band is nish-copy's median against nish's, the same" +
    " bytes, and a change inside it is noise. * is against nish soft."
)

if (instructions) {
  /** Instructions callgrind counts for one run of `c` at `iterations` under `col`. */
  const counted = (col, c, iterations) => {
    const tool = "valgrind"
    const out = path.join(outDir, "callgrind.out")
    const r = spawnSync(
      tool,
      [
        "--tool=callgrind",
        `--callgrind-out-file=${out}`,
        col.bin,
        c.kernel,
        String(c.shape),
        String(iterations),
      ],
      { encoding: "utf8", env: { ...process.env, ...col.env }, stdio: ["ignore", "pipe", "pipe"] }
    )
    const m = /Collected : (\d+)/.exec(r.stderr ?? "")
    if (r.status !== 0 || m === null) {
      fail(`callgrind ${col.id} ${c.label}: exit ${r.status}\n${r.stderr}`)
    }
    fs.rmSync(out, { force: true })
    return Number(m[1])
  }
  // The copy has the baseline's bytes, so it would count the same; every other column is counted.
  const counting = columns.filter((col) => col.id !== "nish-copy")
  console.log(`\n${"case".padEnd(WIDTHS[0])} instructions/op under callgrind`)
  for (const c of cases) {
    const cells = columnsOf(c)
      .filter((col) => counting.includes(col))
      .map((col) => `${col.id} ${((counted(col, c, 12000) - counted(col, c, 2000)) / 10000).toFixed(1)}`)
    console.log(`${c.label.padEnd(WIDTHS[0])} ${cells.join("  ")}`)
  }
}
