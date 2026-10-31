// What a round trip between two processes costs over loopback TCP, a Unix
// stream socketpair and a Unix seqpacket socketpair, at 64 B and 4 KB: wall
// time per round trip (median and 99th percentile) and the CPU each side spends
// on one (user + system), with the spread over rounds and the noise band this
// machine shows when the same transport runs twice.
//
//   npm run build && node bench/unix-ipc.mjs [--rounds N] [--cpus a,b|none] [--compiler <nish>]
//     --rounds N    timed rounds, rounded up to a multiple of 3 (default 12),
//                   after one uncounted warm-up round
//     --cpus a,b    pin the client to CPU a and the peer to CPU b with taskset
//                   (default 1,2 with three or more CPUs and taskset; else none)
//
// unix-ipc.ts is the program, client and peer in one; it is built once with
// `--link` (the speed profile). Each round runs every transport and size twice,
// as run a and run b, in an order that rotates by round, so over a multiple of
// 3 rounds each transport goes first equally often. A run is `WARM` untimed
// round trips, then `COUNT` timed ones; it prints its median and 99th
// percentile round trip and both sides' getrusage over the timed loop.
//
// The report is, for every transport and size, the median over all runs of
// each figure and its min-max and IQR. The noise band of a figure is
// |median(a) - median(b)| for the same transport, the largest over the three
// at that size: the difference between two runs of the very same thing. A
// transport differs from TCP in a figure only when the medians differ by more
// than the band and by more than both IQRs; anything else is noise, and
// printed as such.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(import.meta.dirname, "..")
const outDir = path.join(root, "build", "bench", "unix-ipc")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/unix-ipc.mjs: ${msg}`)
  process.exit(2)
}

const hasTaskset = spawnSync("taskset", ["-p", String(process.pid)]).status === 0
let rounds = 12
let cpus = hasTaskset && os.cpus().length >= 3 ? [1, 2] : null
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--cpus") {
    const v = argv[++i]
    cpus = v === "none" ? null : (v ?? "").split(",").map(Number)
    if (cpus !== null && (cpus.length !== 2 || !cpus.every((c) => Number.isInteger(c) && c >= 0))) {
      fail("--cpus takes two CPU numbers, a,b, or none")
    }
    if (cpus !== null && !hasTaskset) {
      fail("--cpus needs taskset")
    }
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(rounds >= 2)) {
  fail("--rounds needs at least 2")
}

const TRANSPORTS = ["tcp", "stream", "seqpacket"]
const SIZES = [64, 4096]
const WARM = 2000
// About a second a run on a 4-core cloud VM.
const COUNT = 20000

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 })
  if (r.status !== 0) {
    fail(`${what} failed (exit ${r.status})\n${r.stdout ?? ""}${r.stderr ?? ""}${r.error ?? ""}`)
  }
  return r.stdout
}

fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "unix-ipc")
fs.rmSync(exe, { force: true })
fs.rmSync(path.join(outDir, "unix-ipc.ir"), { recursive: true, force: true })
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(root, "bench", "unix-ipc.ts"),
    "-o",
    `${path.join(outDir, "unix-ipc.ir")}${path.sep}`,
    "--link",
    exe,
  ],
  "the Nish build"
)

const LINE =
  /^transport (\w+) size (\d+) count (\d+) ns (\d+) p50 (\d+) p99 (\d+) user (\d+) sys (\d+) peer_user (\d+) peer_sys (\d+)$/

/** One run: its round trip's median and p99, and each side's CPU per round trip, all in µs. */
const runOnce = (transport, size) => {
  const args = [transport, String(size), String(WARM), String(COUNT), cpus === null ? "-" : String(cpus[1])]
  const out =
    cpus === null
      ? run(exe, args, `unix-ipc ${transport} ${size}`)
      : run("taskset", ["-c", String(cpus[0]), exe, ...args], `unix-ipc ${transport} ${size}`)
  const m = LINE.exec(out.trim())
  if (m === null || m[1] !== transport || Number(m[2]) !== size || Number(m[3]) !== COUNT) {
    fail(`unix-ipc ${transport} ${size} printed ${JSON.stringify(out)}`)
  }
  return {
    p50: Number(m[5]) / 1000,
    p99: Number(m[6]) / 1000,
    client: (Number(m[7]) + Number(m[8])) / COUNT,
    peer: (Number(m[9]) + Number(m[10])) / COUNT,
  }
}

const FIGURES = [
  { key: "p50", what: "round trip median" },
  { key: "p99", what: "round trip p99" },
  { key: "client", what: "client cpu/trip" },
  { key: "peer", what: "peer cpu/trip" },
]

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const min = (xs) => Math.min(...xs)
const max = (xs) => Math.max(...xs)
/** The interquartile range, quartiles by linear interpolation. */
const iqr = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (q) => {
    const i = q * (s.length - 1)
    const lo = Math.floor(i)
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
  }
  return at(0.75) - at(0.25)
}

// runs[size][transport] = [[run a, ...], [run b, ...]]
const runs = SIZES.map(() => TRANSPORTS.map(() => [[], []]))
// Round 0 warms the binary, the page cache and the scheduler and is not counted.
const timed = Math.ceil(rounds / TRANSPORTS.length) * TRANSPORTS.length
for (let round = 0; round <= timed; round++) {
  for (let s = 0; s < SIZES.length; s++) {
    for (let ab = 0; ab < 2; ab++) {
      for (let j = 0; j < TRANSPORTS.length; j++) {
        const t = (j + round) % TRANSPORTS.length
        const r = runOnce(TRANSPORTS[t], SIZES[s])
        if (round > 0) {
          runs[s][t][(ab + round) % 2].push(r)
        }
      }
    }
  }
}

const us = (v) => `${v.toFixed(2)} µs`
const signed = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} µs`
const cpuModel = os.cpus()[0]?.model.trim() ?? "unknown CPU"
console.log(
  `unix-ipc: ${timed} rounds, each transport twice a round, ${COUNT} round trips a run after ${WARM};` +
    ` ${cpuModel}, ${os.cpus().length} CPUs, ${os.type()} ${os.release()};` +
    ` ${cpus === null ? "unpinned" : `client on CPU ${cpus[0]}, peer on CPU ${cpus[1]}`}`
)
for (let s = 0; s < SIZES.length; s++) {
  console.log(`${SIZES[s]} B:`)
  const all = (t, key) => [...runs[s][t][0], ...runs[s][t][1]].map((r) => r[key])
  const bands = {}
  for (const f of FIGURES) {
    bands[f.key] = max(
      TRANSPORTS.map((_, t) =>
        Math.abs(median(runs[s][t][0].map((r) => r[f.key])) - median(runs[s][t][1].map((r) => r[f.key])))
      )
    )
  }
  for (let t = 0; t < TRANSPORTS.length; t++) {
    console.log(
      `  ${TRANSPORTS[t].padEnd(10)}` +
        FIGURES.map((f) => {
          const x = all(t, f.key)
          return ` ${f.what} ${us(median(x))} (${min(x).toFixed(2)}-${max(x).toFixed(2)}, IQR ${iqr(x).toFixed(2)})`
        }).join(";")
    )
  }
  console.log(
    `  noise band (run a against run b):${FIGURES.map((f) => ` ${f.what} ${us(bands[f.key])}`).join(";")}`
  )
  for (let t = 1; t < TRANSPORTS.length; t++) {
    console.log(
      `  ${TRANSPORTS[t]} - tcp:` +
        FIGURES.map((f) => {
          const x = all(t, f.key)
          const y = all(0, f.key)
          const diff = median(x) - median(y)
          const seen = Math.abs(diff) > bands[f.key] && Math.abs(diff) > iqr(x) && Math.abs(diff) > iqr(y)
          return ` ${f.what} ${signed(diff)} (${((diff / median(y)) * 100).toFixed(1)}%, ${seen ? "outside the noise" : "inside the noise"})`
        }).join(";")
    )
  }
}
