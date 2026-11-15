#!/usr/bin/env node
// Times `Result<Shape, string>` (union.ts) against the wrapper it replaces,
// `Result<ShapeWrapper, string>` (wrapper.ts): wall time, the bytes one success
// allocates, and the peak resident set.
//
//   npm run build && node bench/union-result/run.mjs [--rounds 11] [--record]
//
// Each round runs every variant once, in an order shuffled afresh for the
// round (a seeded shuffle, so a rerun repeats it), each in a fresh process
// under peak.c, which reports the child's ru_maxrss. A figure is the median
// over the rounds. The noise band is the median over the rounds of the gap
// between union and union2, a byte-identical copy of it timed in the same
// rounds: a difference inside it is no difference. Every variant must print
// the same accumulator, or the run fails. --record splices the table into
// docs/BENCHMARKS.md between its union-result markers.
//
// Linux only (wait4's ru_maxrss), run from the repository root.
import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const at = args.indexOf("--rounds")
const rounds = at >= 0 ? Number(args[at + 1]) : 11
const record = args.includes("--record")
const out = "build/union-result"
mkdirSync(out, { recursive: true })

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
  return s[s.length >> 1]
}
const field = (text, name) => {
  const m = text.match(new RegExp(`${name} (\\S+)`))
  if (m === null) {
    throw new Error(`no ${name} in: ${text}`)
  }
  return m[1]
}

const cc = process.env.CC ?? "clang"
execFileSync(cc, ["-O2", "bench/union-result/peak.c", "-o", `${out}/peak`])
for (const v of ["union", "wrapper"]) {
  execFileSync("build/nish", [`bench/union-result/${v}.ts`, "--link", `${out}/${v}`])
}
copyFileSync(`${out}/union`, `${out}/union2`)

const variants = ["union", "union2", "wrapper"]
const times = Object.fromEntries(variants.map((v) => [v, []]))
const peaks = Object.fromEntries(variants.map((v) => [v, []]))
const bytes = {}
const sums = new Set()
for (let r = 0; r < rounds; r++) {
  for (const v of shuffled(variants)) {
    const start = process.hrtime.bigint()
    const p = spawnSync(`${out}/peak`, [`${out}/${v}`], { encoding: "utf8" })
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    if (p.status !== 0) {
      throw new Error(`${v} exited ${p.status}: ${p.stderr}`)
    }
    times[v].push(ms)
    peaks[v].push(Number(field(p.stderr, "peak")))
    sums.add(field(p.stdout, "acc"))
    bytes[v] = Number(field(p.stdout, "bytes/success"))
  }
}
if (sums.size !== 1) {
  throw new Error("the variants disagree on the accumulator")
}

const band = median(times.union.map((t, r) => Math.abs(t - times.union2[r]) / t))
const peakBand = median(peaks.union.map((k, r) => Math.abs(k - peaks.union2[r]) / k))
const b = median(times.wrapper)
const lines = [
  "## A union as a `Result`'s success (WP58 S1)",
  "",
  "Not measured by `bench/run.mjs`, which carries this section over unchanged. " +
    "`bench/union-result/union.ts` returns `Result<Shape, string>`, where `Shape` is a " +
    "discriminated union; `wrapper.ts` is the same program written the way it had to be " +
    "before a union could be a type argument, `Result<ShapeWrapper, string>` with the union " +
    "in a class field. A success allocates the 24-byte result and the 8-byte variant; the " +
    "wrapper adds its own 8 bytes, so it allocates a quarter more and its resident set grows " +
    "with it. The union enters the result with a bitcast, so it costs nothing over the variant.",
  "",
  `4,000,000 calls of \`parse\`, ${rounds} interleaved rounds, medians; ` +
    "`node bench/union-result/run.mjs`.",
  "",
  "| variant | wall ms | vs wrapper | bytes per success | peak resident KiB |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...variants.map((v) => {
    const t = median(times[v])
    return `| ${v} | ${t.toFixed(1)} | ${(t / b).toFixed(2)}x | ${bytes[v]} | ${median(peaks[v])} |`
  }),
  "",
  `Noise band (union against its byte-identical copy union2): wall ${(band * 100).toFixed(1)}%, ` +
    `peak resident ${(peakBand * 100).toFixed(1)}%.`,
]
const table = lines.join("\n")
console.log(table)
if (record) {
  const path = "docs/BENCHMARKS.md"
  const doc = readFileSync(path, "utf8")
  const begin = "<!-- union-result:begin -->"
  const end = "<!-- union-result:end -->"
  const i = doc.indexOf(begin)
  const j = doc.indexOf(end)
  if (i < 0 || j < i) {
    throw new Error(`${path} has no ${begin} ... ${end} block`)
  }
  writeFileSync(path, `${doc.slice(0, i + begin.length)}\n${table}\n${doc.slice(j)}`)
}
