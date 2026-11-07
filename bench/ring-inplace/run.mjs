#!/usr/bin/env node
// Reproduces the ring-in-place figures in docs/wp47-shared-memory.md §7: JSON
// records of 1, 4 and 10 KB from a producer process, through a 16 MB
// `SpscRing`, to an `Http1Connection` answering keep-alive requests with
// them, to a reader draining the socket (`bench.ts`), copied (`tryPush`,
// `tryPop`, `write`) or in place (`reserve`, `commit`, `peek`, `sendBody`,
// `release`).
//
//   npm run build && node bench/ring-inplace/run.mjs [--quick] [--rounds 5] [--cpus 0,1,2]
//
// Each round runs every (size, mode) pair twice, in an order shuffled afresh
// for the round (a seeded shuffle, so a rerun repeats it). A figure is the
// median over the rounds of both runs, with the lowest and highest beside
// it. The noise band is how far the two runs of one mode in a round differ,
// the median over rounds and modes: a difference between the modes inside
// it is not one. The consumer runs under `taskset -c <first cpu>`, the
// producer and the reader on the second and third. `--quick` sends 3,000
// messages a run rather than 50,000 and finishes in seconds.
//
// Linux only (taskset), run from the repository root.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const quick = args.includes("--quick")
const rounds = Number(opt("--rounds", "5"))
const n = quick ? 3000 : 50000
const [consumerCpu, producerCpu, readerCpu] = opt("--cpus", "0,1,2").split(",")
const out = "build/ring-inplace"
mkdirSync(out, { recursive: true })

const run = (file, argv) => execFileSync(file, argv, { encoding: "utf8" })
run("build/nish", ["bench/ring-inplace/bench.ts", "--link", `${out}/bench`])

// mulberry32: a fixed seed, so a rerun shuffles in the same orders
let seed = 0x6e697368
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const shuffled = (xs) => {
  const s = [...xs]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
const median = (xs) => {
  const s = [...xs].sort((p, q) => p - q)
  return s.length % 2 === 1 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const field = (line, name) => {
  const m = line.match(new RegExp(`${name} (\\S+)`))
  if (m === null) {
    throw new Error(`no ${name} in: ${line}`)
  }
  return Number(m[1])
}

const sizes = [1024, 4096, 10240]
const modes = ["copy", "inplace"]
const pairs = sizes.flatMap((s) =>
  modes.flatMap((m) => [
    [s, m, 0],
    [s, m, 1],
  ])
)
const samples = new Map(pairs.map(([s, m, k]) => [`${s} ${m} ${k}`, []]))
for (let r = 0; r < rounds; r++) {
  for (const [s, m, k] of shuffled(pairs)) {
    const line = run("taskset", [
      "-c",
      consumerCpu,
      `${out}/bench`,
      m,
      String(s),
      String(n),
      producerCpu,
      readerCpu,
    ])
    if (field(line, "sent") !== field(line, "heard")) {
      throw new Error(`${m} ${s}: the reader did not hear what was sent: ${line}`)
    }
    samples.get(`${s} ${m} ${k}`).push(line)
  }
}

const both = (s, m) => [...samples.get(`${s} ${m} 0`), ...samples.get(`${s} ${m} 1`)]
const f = (x) => Math.round(x).toLocaleString("en-US")
const spread = (xs) => `${f(median(xs))} (${f(Math.min(...xs))} to ${f(Math.max(...xs))})`
/** How far the two runs of `m` at `s` differ in `name`, as a percentage of their mean, round by round. */
const gaps = (s, m, name) => {
  const a = samples.get(`${s} ${m} 0`).map((l) => field(l, name))
  const b = samples.get(`${s} ${m} 1`).map((l) => field(l, name))
  return a.map((x, k) => (200 * Math.abs(x - b[k])) / (x + b[k]))
}

console.log(
  `${rounds} rounds of ${n.toLocaleString("en-US")} messages, each mode run twice a round; consumer on cpu ${consumerCpu}, producer on ${producerCpu}, reader on ${readerCpu}\n`
)
console.log(
  "| record | mode | body (bytes) | consumer p50 (ns) | consumer p99 (ns) | pipeline (ns/msg) | bytes copied/msg | noise band p50 |"
)
console.log("| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
for (const s of sizes) {
  for (const m of modes) {
    const lines = both(s, m)
    const cols = [
      `${s / 1024} KB`,
      m === "copy" ? "copied" : "in place",
      f(median(lines.map((l) => field(l, "body_bytes")))),
      spread(lines.map((l) => field(l, "p50_ns"))),
      spread(lines.map((l) => field(l, "p99_ns"))),
      spread(lines.map((l) => field(l, "wall_ns"))),
      f(median(lines.map((l) => field(l, "copied")))),
      `±${median(gaps(s, m, "p50_ns")).toFixed(1)}%`,
    ]
    console.log(`| ${cols.join(" | ")} |`)
  }
}
console.log("\n| record | in place vs copied, consumer p50 | p99 | pipeline | noise band p50 |")
console.log("| ---: | ---: | ---: | ---: | ---: |")
const change = (s, name) => {
  const c = median(both(s, "copy").map((l) => field(l, name)))
  const p = median(both(s, "inplace").map((l) => field(l, name)))
  const d = (100 * (p - c)) / c
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`
}
for (const s of sizes) {
  const band = Math.max(median(gaps(s, "copy", "p50_ns")), median(gaps(s, "inplace", "p50_ns")))
  console.log(
    `| ${s / 1024} KB | ${change(s, "p50_ns")} | ${change(s, "p99_ns")} | ${change(s, "wall_ns")} | ±${band.toFixed(1)}% |`
  )
}
