#!/usr/bin/env node
// WP38 S10: ChaCha20 on vectors against the Nish ChaCha20-Poly1305 at 64 B,
// 1 KiB, 16 KiB and 1 MiB, and the verdict against both routes' bars
// (docs/wp38-simd.md §3.1, §3.2). It builds bench/chacha20.ts with
// bench/chacha20/aead.ts and bench/chacha20/kernel.c, holds every C path to
// the scalar reference and RFC 8439's vector, runs every column in
// interleaved rounds and prints each workload's time in ns/op and throughput
// in MB/s, then the gain per size.
//
//   npm run build && node bench/chacha20.mjs [options] [--compiler <nish>]
//     --runs N    timed rounds after one warm-up (default 9), rounded up to a
//                 multiple of the column count so each column goes first equally often
//     --check     one short run per column, each checksum against the pinned one; exit 0 when equal
//
// The columns. `nish` is the std AEAD built with `--profile speed`, the code
// that ships; `nish (copy)` is a byte-identical copy of the binary, the noise
// band; `C scalar`, `C vec128`, `C avx2` and `C neon` run bench/chacha20/aead.ts,
// the std file with ChaCha20's keystream loop handed to kernel.c's path of
// that name for a buffer of four blocks or more. `vec128` is portable
// `vector_size(16)` C, four blocks at once; `avx2` is eight, behind kernel.c's
// own CPUID check; `neon` is four in NEON intrinsics, on aarch64. kernel.c is
// built with `-O2` and no CPU flag: only `avx2` carries a target attribute.
// Every run must print the same checksum, or the run stops.
//
// The gain at a size is the nish median over the path's median, less one;
// the band is the larger of the copy's distance from nish at the minimum and
// at the median. Two bars are judged. The runtime kernel's: the widest path
// the machine has gains 20% or more, above the band. nish:simd's: `vec128`,
// the portable 128-bit code nish:simd would lower to, runs 1.5x the nish
// median or better. MB/s is 10^6 bytes a second.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "chacha20")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/chacha20.mjs: ${msg}`)
  process.exit(2)
}

/**
 * `--check`'s scale and the checksum every column prints at it: a change to
 * this number is a change to what ChaCha20-Poly1305 answers.
 */
const CHECK_SCALE = 64
const CHECK_SUM = "checksum 1902755823"
/** The workloads each column times; a run that reports fewer stopped short. */
const WORKLOADS = 10
/** The runtime kernel's bar: the gain its widest path must reach at a size. */
const KERNEL_BAR = 0.2
/** nish:simd's bar: the speedup `vec128` must reach over the nish median. */
const SIMD_BAR = 1.5

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
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}
fs.mkdirSync(outDir, { recursive: true })

// The C paths are held to the scalar reference before anything is built on them.
const verifier = path.join(outDir, "verify")
const cc = process.env.CC ?? "clang"
const cflags = ["-O2", "-Wall", "-Wextra", "-Werror"]
run(cc, [...cflags, "-DCHACHA20_VERIFY", "bench/chacha20/kernel.c", "-o", rel(verifier)])
const verified = run(verifier, []).trim()
console.log(verified)
const paths =
  verified.match(/^chacha20 ([a-z0-9, ]+):/)?.[1].split(", ") ?? fail(`verify printed ${verified}`)

// bench/chacha20.ts imports both AEADs, so one binary runs every column.
run(nishc.cmd, [...nishc.prefix, "bench/chacha20.ts", "-o", `${rel(outDir)}/`, "--profile", "speed"])
const exe = path.join(outDir, "chacha20")
run("bash", [
  "scripts/build.sh",
  ...["chacha20.ll", "aead.ll", "chacha20poly1305.ll"].map((f) => rel(path.join(outDir, f))),
  "runtime/runtime.c",
  "bench/chacha20/kernel.c",
  "-o",
  rel(exe),
  "--profile",
  "speed",
])
const copy = path.join(outDir, "chacha20-copy")
fs.copyFileSync(exe, copy)

/** The columns, each `{ label, bin, args, env }`: nish first, its copy second, then a C path each. */
const columns = [
  { label: "nish", bin: exe, args: ["std"], env: {} },
  { label: "nish (copy)", bin: copy, args: ["std"], env: {} },
  ...paths.map((p) => ({
    label: `C ${p}`,
    path: p,
    bin: exe,
    args: ["kernel"],
    env: { BENCH_CHACHA20: p },
  })),
]
/** The widest path the machine has: the runtime kernel's candidate. */
const widest = ["avx2", "neon", "vec128"].find((p) => paths.includes(p))

/** One run of a column at `scale`: `{ answer, times }`, times a Map from workload to `{ ns, bytes, ops }`. */
const runOnce = (c, scale) => {
  const r = spawnSync(c.bin, [...c.args, String(scale)], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...c.env },
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.status !== 0) {
    fail(`${c.label} at scale ${scale} exited with ${r.status}\n${r.stdout}${r.stderr}`)
  }
  const times = new Map()
  for (const line of r.stderr.split("\n")) {
    const m = line.match(/^time (\S+) (\d+) (\d+) (\d+)$/)
    if (m !== null) {
      times.set(m[1], {
        ns: Number(m[2]),
        bytes: Number(m[3]),
        ops: Number(m[4]),
      })
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
    console.log(`${c.label}: ${r.times.size} workloads; ${r.answer}`)
    if (r.answer !== CHECK_SUM) {
      console.error(
        `bench/chacha20.mjs: ${c.label} printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(CHECK_SUM)}`
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
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
  } catch {
    return "unknown"
  }
})()

/** The table's widths: the first two columns are left-aligned, the rest right-aligned. */
const WIDTHS = [13, 12, 10, 10, 8, 8]
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
const at = (p) => columns.findIndex((c) => c.path === p)
const aead = [...shape.keys()].filter((name) => /^(seal|open)-/.test(name))
const kernelPasses = []
const simdPasses = []
for (const name of shape.keys()) {
  const [nish, twin] = [stats[0].get(name), stats[1].get(name)]
  const band = Math.max(Math.abs(twin.min / nish.min - 1), Math.abs(twin.median / nish.median - 1))
  const gains = columns
    .slice(2)
    .map((c, k) => `${c.path} ${pct(nish.median / stats[k + 2].get(name).median - 1)}`)
    .join(", ")
  const gain = nish.median / stats[at(widest)].get(name).median - 1
  const speedup = nish.median / stats[at("vec128")].get(name).median
  const ok = gain >= KERNEL_BAR && gain > band
  const simdOk = speedup >= SIMD_BAR
  if (aead.includes(name) && ok) {
    kernelPasses.push(name)
  }
  if (aead.includes(name) && simdOk) {
    simdPasses.push(name)
  }
  console.log(
    `${name}: ${gains} over nish (band ${pct(band)}); kernel ${ok ? "passes" : "misses"} ${pct(KERNEL_BAR)}, ` +
      `vec128 ${speedup.toFixed(2)}x ${simdOk ? "passes" : "misses"} ${SIMD_BAR}x`
  )
}
// Below four blocks the kernel is never called (chacha20/aead.ts's seam), so
// a 64-byte row reads the same Nish twice: it shows there is no loss there,
// not a gain. The verdict names the sizes each bar clears at.
const listed = (names) => (names.length === 0 ? "no AEAD size" : names.join(", "))
console.log(
  `verdict on ${process.arch}: the ${widest} kernel clears the ${pct(KERNEL_BAR)} bar at ${listed(kernelPasses)}; ` +
    `vec128 clears nish:simd's ${SIMD_BAR}x at ${listed(simdPasses)}`
)
