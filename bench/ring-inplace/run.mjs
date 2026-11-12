#!/usr/bin/env node
// Reproduces the ring-in-place figures in docs/wp47-shared-memory.md §7: JSON
// records of 1, 4 and 10 KB from a producer process, through an `SpscRing`
// (16 MB unless `--ring-bytes` says otherwise), to an `Http1Connection`
// answering keep-alive requests with them, to a reader draining the socket
// (`bench.ts`), copied (`tryPush`, `tryPop`, `write`), in place (`reserve`,
// `commit`, `peek`, `sendBody`, `release`), or in place on the consumer's
// side only (`tryPush`, then `peek`, `sendBody`, `release`).
//
//   npm run build && node bench/ring-inplace/run.mjs [--quick] [--rounds 5] [--cpus 0,1,2] [--ring-bytes 16777216]
//     [--modes copy,inplace,consumer] [--n 50000]
//
// Each round runs every (size, mode) pair twice, in an order shuffled afresh
// for the round (a seeded shuffle, so a rerun repeats it). A figure is the
// median over the rounds of both runs, with the lowest and highest beside
// it. A noise band, for p50, p99 and the pipeline each, is how far the two
// runs of one mode in a round differ, the median over rounds; a difference
// between the modes is set against the wider of the two modes' bands, and
// one inside it is not one. Every run must deliver what it sent, byte for
// byte (the reader's FNV-1a over the bodies equals the producer's), or the
// whole run fails. `--ring-bytes` is a power of two from 32,768 (which
// `reserve` needs for a 10 KB record) to 2^29: a shared region holds at most
// 2^30 bytes, headers included. The consumer runs under
// `taskset -c <first cpu>`, the producer and the reader on the second and
// third. `--quick` sends 3,000 messages a run rather than 50,000 and
// finishes in seconds; `--n` sends that many instead, and `--modes` runs only
// the modes it names. An unknown option, or one out of range, exits 2 before
// anything builds.
//
// The waiting column is the consumer's time a message before the ring held
// the record: time the producer set the pace, not the consumer. Set against
// the pipeline column, it says how much of each message that is.
//
// Linux only (taskset), run from the repository root.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"

const args = process.argv.slice(2)
/** The options that take a value, and the one that does not. */
const valued = ["--rounds", "--n", "--modes", "--cpus", "--ring-bytes"]
const flags = ["--quick"]
const opt = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
/** Prints why an option is refused and exits 2, before anything is built or run. */
const refuse = (why) => {
  console.error(`bench/ring-inplace: ${why}`)
  process.exit(2)
}
for (let k = 0; k < args.length; k++) {
  if (valued.includes(args[k])) {
    k++
  } else if (!flags.includes(args[k])) {
    refuse(`unknown option ${args[k]}; the options are ${[...flags, ...valued].join(", ")}`)
  }
}
/**
 * `text` as a whole number from 1 to 2^30, or refuses `name`: no sign,
 * fraction, exponent or leading zero, as `bench.ts`'s `wholeArg`.
 */
const whole = (name, text) => {
  if (text === undefined || !/^[1-9]\d{0,9}$/.test(text) || Number(text) > 2 ** 30) {
    refuse(`${name} wants a whole number from 1 to 1,073,741,824, not ${text}`)
  }
  return Number(text)
}
const quick = args.includes("--quick")
const rounds = whole("--rounds", opt("--rounds", "5"))
const n = whole("--n", opt("--n", quick ? "3000" : "50000"))
const known = ["copy", "inplace", "consumer"]
const modes = [...new Set((opt("--modes", known.join(",")) ?? "").split(","))]
for (const m of modes) {
  if (!known.includes(m)) {
    refuse(`unknown mode ${m === "" ? "(none)" : m} in --modes; the modes are ${known.join(", ")}`)
  }
}
const cpus = (opt("--cpus", "0,1,2") ?? "").split(",")
if (cpus.length !== 3 || cpus.some((c) => !/^\d+$/.test(c))) {
  refuse(`--cpus wants three cpu numbers, consumer,producer,reader, not ${cpus.join(",")}`)
}
const [consumerCpu, producerCpu, readerCpu] = cpus
const sizes = [1024, 4096, 10240]
const ringBytes = whole("--ring-bytes", opt("--ring-bytes", "16777216"))
// SpscRing's capacity is a power of two, and `reserve` lends at most half of
// it less 4, which the largest record must fit: 32,768 at the least.
let leastRing = 8
while (leastRing / 2 - 4 < Math.max(...sizes)) {
  leastRing *= 2
}
// A shared region holds at most 2^30 bytes, the ring's header included, so
// the largest ring is 2^29.
if (ringBytes < leastRing || ringBytes > 2 ** 29 || (ringBytes & (ringBytes - 1)) !== 0) {
  refuse(`--ring-bytes wants a power of two from ${leastRing} to 2^29, not ${opt("--ring-bytes")}`)
}
const out = "build/ring-inplace"
mkdirSync(out, { recursive: true })

// A run of 50,000 messages takes about a second; one that takes minutes has
// hung, and the bench's own deadlines are ten seconds a wait.
const run = (file, argv, timeout) => execFileSync(file, argv, { encoding: "utf8", timeout })
run("build/nish", ["bench/ring-inplace/bench.ts", "--link", `${out}/bench`], 600000)

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

const label = { copy: "copied", inplace: "in place", consumer: "consumer" }
const pairs = sizes.flatMap((s) =>
  modes.flatMap((m) => [
    [s, m, 0],
    [s, m, 1],
  ])
)
const samples = new Map(pairs.map(([s, m, k]) => [`${s} ${m} ${k}`, []]))
for (let r = 0; r < rounds; r++) {
  for (const [s, m, k] of shuffled(pairs)) {
    const line = run(
      "taskset",
      ["-c", consumerCpu, `${out}/bench`, m, String(s), String(n), producerCpu, readerCpu, String(ringBytes)],
      180000
    )
    if (field(line, "sent") !== field(line, "heard")) {
      throw new Error(`${m} ${s}: the reader did not hear what was sent: ${line}`)
    }
    if (field(line, "made_sum") !== field(line, "read_sum")) {
      throw new Error(`${m} ${s}: the bodies the reader parsed are not the records rendered: ${line}`)
    }
    samples.get(`${s} ${m} ${k}`).push(line)
  }
}

const both = (s, m) => [...samples.get(`${s} ${m} 0`), ...samples.get(`${s} ${m} 1`)]
const f = (x) => Math.round(x).toLocaleString("en-US")
const f2 = (x) =>
  x.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const spread = (xs) => `${f(median(xs))} (${f(Math.min(...xs))} to ${f(Math.max(...xs))})`
/** How far the two runs of `m` at `s` differ in `name`, as a percentage of their mean, round by round. */
const gaps = (s, m, name) => {
  const a = samples.get(`${s} ${m} 0`).map((l) => field(l, name))
  const b = samples.get(`${s} ${m} 1`).map((l) => field(l, name))
  return a.map((x, k) => (200 * Math.abs(x - b[k])) / (x + b[k]))
}

console.log(
  `${rounds} rounds of ${n.toLocaleString("en-US")} messages, each mode run twice a round, through a ring of ${ringBytes.toLocaleString("en-US")} bytes; consumer on cpu ${consumerCpu}, producer on ${producerCpu}, reader on ${readerCpu}\n`
)
const band = (s, m, name) => median(gaps(s, m, name))
const pct = (x) => `±${x.toFixed(1)}%`
console.log(
  "| record | mode | body (bytes) | consumer p50 (ns) | consumer p99 (ns) | pipeline (ns/msg) | consumer waiting for a record (ns/msg) | bytes copied/msg | messages with a tail | wrapped records popped | noise band p50 / p99 / pipeline |"
)
console.log("| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
for (const s of sizes) {
  for (const m of modes) {
    const lines = both(s, m)
    const tails = lines.map((l) => field(l, "tails"))
    const copied = lines.map((l) => field(l, "copied"))
    const cols = [
      `${s / 1024} KB`,
      label[m],
      f2(median(lines.map((l) => field(l, "body_bytes")))),
      spread(lines.map((l) => field(l, "p50_ns"))),
      spread(lines.map((l) => field(l, "p99_ns"))),
      spread(lines.map((l) => field(l, "wall_ns"))),
      spread(lines.map((l) => field(l, "waited_ns"))),
      f2(median(copied) / n),
      m === "copy"
        ? "—"
        : `${f(median(tails))} of ${f(n)} (at most ${f(Math.max(...tails))}, ${f(Math.max(...lines.map((l) => field(l, "tail_bytes"))))} bytes)`,
      m === "copy" ? "—" : f(median(lines.map((l) => field(l, "wrapped")))),
      ["p50_ns", "p99_ns", "wall_ns"].map((name) => pct(band(s, m, name))).join(" / "),
    ]
    console.log(`| ${cols.join(" | ")} |`)
  }
}
console.log(
  "\n| record | comparison | consumer p50 | consumer p99 | pipeline |\n| ---: | --- | ---: | ---: | ---: |"
)
/** The change in `name` from mode `from` to mode `to` at `s`, against the wider of the two modes' bands. */
const change = (s, from, to, name) => {
  const c = median(both(s, from).map((l) => field(l, name)))
  const p = median(both(s, to).map((l) => field(l, name)))
  const d = (100 * (p - c)) / c
  const b = Math.max(band(s, from, name), band(s, to, name))
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}% (band ${pct(b)}, ${Math.abs(d) > b ? "outside" : "inside"})`
}
const comparisons = [
  ["copy", "inplace"],
  ["copy", "consumer"],
  ["inplace", "consumer"],
].filter(([from, to]) => modes.includes(from) && modes.includes(to))
for (const s of sizes) {
  for (const [from, to] of comparisons) {
    const cols = ["p50_ns", "p99_ns", "wall_ns"].map((name) => change(s, from, to, name))
    console.log(`| ${s / 1024} KB | ${label[to]} vs ${label[from]} | ${cols.join(" | ")} |`)
  }
}
// A stall is a message whose response head waited for the last message's
// tail to drain, inside the timed window; print the most any run had.
const stalls = sizes.flatMap((s) =>
  modes.map((m) => `${s / 1024} KB ${label[m]} ${f(Math.max(...both(s, m).map((l) => field(l, "stalls"))))}`)
)
console.log(`\nrespond stalls, the most in any run: ${stalls.join(", ")}`)
