#!/usr/bin/env node
// Reproduces the figures in docs/wp47-shared-memory.md: 16-byte messages
// between two processes on two cores, through `nish/sync/ring` (`ring.ts`)
// and through an AF_UNIX socketpair (`socketpair.c`, `clang -O2`).
//
//   npm run build && node bench/ring-latency/run.mjs [--rounds 5] [--cpus 0,1]
//
// Each round runs every (transport, mode) pair once, in an order shuffled
// afresh for the round (a seeded shuffle, so a rerun repeats it); a figure is
// the median over the rounds and the spread beside it is the lowest and
// highest. The parent runs under `taskset -c <first cpu>` and the child is
// pinned to the second. Then, when strace is installed, one more run of
// `stream` and `idle` under `strace -f -c` counts the system calls a message
// costs: the ring's futex calls and the socket's reads and writes. In `idle`
// the ring bench sleeps on a futex of its own once a message (the socket
// bench uses nanosleep), so those n calls are taken off the ring's count.
//
// Linux only (taskset, futex), run from the repository root.
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync } from "node:fs"

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const rounds = Number(opt("--rounds", "5"))
const [parentCpu, childCpu] = opt("--cpus", "0,1").split(",")
const out = "build/ring-latency"
mkdirSync(out, { recursive: true })

const run = (file, argv) => execFileSync(file, argv, { encoding: "utf8" })
run("build/nish", ["bench/ring-latency/ring.ts", "--link", `${out}/ring`])
run(process.env.CC ?? "clang", ["-O2", "bench/ring-latency/socketpair.c", "-o", `${out}/socketpair`])

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
const median = (xs) => [...xs].sort((p, q) => p - q)[xs.length >> 1]
const field = (line, name) => {
  const m = line.match(new RegExp(`${name} (\\S+)`))
  if (m === null) {
    throw new Error(`no ${name} in: ${line}`)
  }
  return Number(m[1])
}

const sizes = { pingpong: 200000, stream: 5000000, idle: 500 }
const transports = ["ring", "socketpair"]
const pairs = transports.flatMap((t) => Object.keys(sizes).map((m) => [t, m]))
const samples = new Map(pairs.map(([t, m]) => [`${t} ${m}`, []]))
for (let r = 0; r < rounds; r++) {
  for (const [t, m] of shuffled(pairs)) {
    const line = run("taskset", ["-c", parentCpu, `${out}/${t}`, m, String(sizes[m]), childCpu])
    if (m !== "pingpong" && field(line, "got") !== sizes[m]) {
      throw new Error(`${t} ${m} lost messages: ${line}`)
    }
    samples.get(`${t} ${m}`).push(line)
  }
}

const spread = (xs, digits) => {
  const f = (x) => x.toLocaleString("en-US", { maximumFractionDigits: digits })
  return `${f(median(xs))} (${f(Math.min(...xs))} to ${f(Math.max(...xs))})`
}
console.log(`${rounds} rounds, parent on cpu ${parentCpu}, child on cpu ${childCpu}\n`)
console.log("| transport | round trip p50 (ns) | p99 (ns) | mean (ns) | stream (msgs/s) | idle (msgs/s) |")
console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
for (const t of transports) {
  const pp = samples.get(`${t} pingpong`)
  const cols = [
    spread(
      pp.map((l) => field(l, "p50_ns")),
      0
    ),
    spread(
      pp.map((l) => field(l, "p99_ns")),
      0
    ),
    spread(
      pp.map((l) => field(l, "mean_ns")),
      0
    ),
    spread(
      samples.get(`${t} stream`).map((l) => field(l, "msgs_per_s")),
      0
    ),
    spread(
      samples.get(`${t} idle`).map((l) => field(l, "msgs_per_s")),
      0
    ),
  ]
  console.log(`| ${t} | ${cols.join(" | ")} |`)
}

if (spawnSync("strace", ["-V"]).status !== 0) {
  console.log("\nstrace is not installed: no system-call counts")
  process.exit(0)
}
const traced = { stream: 1000000, idle: 500 }
const counts = (t, m) => {
  const file = `${out}/strace-${t}-${m}.txt`
  const trace = "futex,read,write,nanosleep,clock_nanosleep"
  run("strace", [
    "-f",
    "-c",
    "-e",
    `trace=${trace}`,
    "-o",
    file,
    "taskset",
    "-c",
    parentCpu,
    `${out}/${t}`,
    m,
    String(traced[m]),
    childCpu,
  ])
  const calls = {}
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const cells = line.trim().split(/\s+/)
    const name = cells[cells.length - 1]
    if (cells.length >= 5 && /^\d+$/.test(cells[3]) && name !== "total") {
      calls[name] = Number(cells[3])
    }
  }
  return calls
}
console.log("\n| transport | mode | messages | calls on the message path | per message |")
console.log("| --- | --- | ---: | ---: | ---: |")
for (const t of transports) {
  for (const m of Object.keys(traced)) {
    const c = counts(t, m)
    const n = traced[m]
    const path = t === "ring" ? (c.futex ?? 0) - (m === "idle" ? n : 0) : (c.read ?? 0) + (c.write ?? 0)
    const what = t === "ring" ? "futex" : "read + write"
    console.log(
      `| ${t} | ${m} | ${n.toLocaleString("en-US")} | ${path.toLocaleString("en-US")} ${what} | ${(path / n).toFixed(4)} |`
    )
  }
}
