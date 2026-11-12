#!/usr/bin/env node
// Reproduces the figures in docs/wp46-long-running-memory.md: the baseline's
// arena and resident set over requests (`sessions.ts`), the same server on
// regions (`sessions-region.ts`, §7's stage 3) against it, and the options'
// prototypes (`options.c`, `rc-tax.c`), all timed in interleaved rounds.
//
//   npm run build && node bench/wp46-memory/run.mjs [--rounds 9]
//
// Each round runs every variant once, in an order shuffled afresh for the
// round (a seeded shuffle, so a rerun repeats it), each in a fresh process so
// its resident set is its own. A figure is the median
// over the rounds. The noise band is the median over the rounds of the gap
// between the baseline and a byte-identical copy of it (`a` and `a2`,
// `plain` and `plain2`), timed in the same rounds: a difference inside it is
// no difference. The memory columns are medians over the rounds too: the
// anonymous resident set and the address space at exit, the peak resident
// set, and the minor page faults. Every variant must print the same checksum, or the run fails.
//
// The two servers print a checkpoint line rather than a time, so their
// ns/request is the process's wall time over the requests, start-up included
// (a few milliseconds in a second), and their copy is `sessions` copied byte
// for byte to `sessions2`. Their memory is per checkpoint: the median over the
// rounds of the anonymous resident set, and of how far `Arena.mark()` has moved
// since the first checkpoint.
//
// Linux only (/proc), run from the repository root.
import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync } from "node:fs"

const args = process.argv.slice(2)
const at = args.indexOf("--rounds")
const rounds = at >= 0 ? Number(args[at + 1]) : 9
const out = "build/wp46"
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

const run = (file, argv) => execFileSync(file, argv, { encoding: "utf8" })
const cc = process.env.CC ?? "clang"
run(cc, ["-O2", "-c", "runtime/runtime.c", "-o", `${out}/runtime.o`])
run(cc, ["-O2", "bench/wp46-memory/options.c", `${out}/runtime.o`, "-o", `${out}/options`])
run(cc, ["-O2", "bench/wp46-memory/rc-tax.c", `${out}/runtime.o`, "-o", `${out}/rc-tax`])
run("build/nish", ["bench/wp46-memory/sessions.ts", "--link", `${out}/sessions`])
run("build/nish", ["bench/wp46-memory/sessions-region.ts", "--link", `${out}/sessions-region`])
copyFileSync(`${out}/sessions`, `${out}/sessions2`)

const median = (xs) => {
  const s = [...xs].sort((p, q) => p - q)
  return s[s.length >> 1]
}
const field = (line, name) => {
  const m = line.match(new RegExp(`${name} (\\S+)`))
  if (m === null) {
    throw new Error(`no ${name} in: ${line}`)
  }
  return m[1]
}

console.log(`## Baseline: ${out}/sessions 2000000 1000 250000\n`)
console.log(run(`${out}/sessions`, ["2000000", "1000", "250000"]))

const servers = (title, argv) => {
  const variants = ["sessions", "sessions2", "sessions-region"]
  const times = Object.fromEntries(variants.map((v) => [v, []]))
  const anons = Object.fromEntries(variants.map((v) => [v, []]))
  const moved = Object.fromEntries(variants.map((v) => [v, []]))
  const sums = new Set()
  let requests = []
  for (let r = 0; r < rounds; r++) {
    for (const v of shuffled(variants)) {
      const start = process.hrtime.bigint()
      const lines = run(`${out}/${v}`, argv).trim().split("\n")
      times[v].push(Number(process.hrtime.bigint() - start) / Number(argv[0]))
      sums.add(field(lines[lines.length - 1], "checksum"))
      const points = lines.slice(0, -1)
      requests = points.map((l) => field(l, "requests"))
      const first = Number(field(points[0], "mark"))
      anons[v].push(points.map((l) => Number(field(l, "anon"))))
      moved[v].push(points.map((l) => Number(field(l, "mark")) - first))
    }
  }
  if (sums.size !== 1) {
    throw new Error(`${title}: the servers disagree on the checksum`)
  }
  const band = median(times.sessions.map((t, r) => Math.abs(t - times.sessions2[r]) / t))
  const b = median(times.sessions)
  console.log(`## ${title}: ${out}/<server> ${argv.join(" ")}, ${rounds} rounds\n`)
  console.log("| server | ns/request (median) | vs sessions |")
  console.log("| --- | ---: | ---: |")
  for (const v of variants) {
    const t = median(times[v])
    console.log(`| ${v} | ${t.toFixed(0)} | ${(t / b).toFixed(2)}x |`)
  }
  console.log(`\nnoise band (sessions against sessions2): ${(band * 100).toFixed(1)}%\n`)
  const atPoint = (xs, k) => median(xs.map((row) => row[k]))
  console.log(
    "| requests | sessions anon | sessions mark moved | sessions-region anon | sessions-region mark moved |"
  )
  console.log("| ---: | ---: | ---: | ---: | ---: |")
  requests.forEach((n, k) => {
    const cells = ["sessions", "sessions-region"].map(
      (v) => `${atPoint(anons[v], k)} | ${atPoint(moved[v], k)}`
    )
    console.log(`| ${n} | ${cells.join(" | ")} |`)
  })
  console.log("")
}

servers("Sessions server, 1,000 live", ["2000000", "1000", "250000"])
servers("Sessions server, 100,000 live", ["2000000", "100000", "250000"])

const interleave = (title, file, variants, argv, base, copy, unit) => {
  const times = Object.fromEntries(variants.map((v) => [v, []]))
  const kinds = ["anon", "size", "peak", "minflt"]
  const mems = Object.fromEntries(variants.map((v) => [v, Object.fromEntries(kinds.map((m) => [m, []]))]))
  const last = {}
  const sums = new Set()
  for (let r = 0; r < rounds; r++) {
    for (const v of shuffled(variants)) {
      const line = run(file, [v, ...argv])
      times[v].push(Number(field(line, unit)))
      sums.add(field(line, "checksum"))
      for (const m of kinds) {
        if (line.includes(` ${m} `)) {
          mems[v][m].push(Number(field(line, m)))
        }
      }
      last[v] = line
    }
  }
  if (sums.size !== 1) {
    throw new Error(`${title}: the variants disagree on the checksum`)
  }
  const band = median(times[base].map((t, r) => Math.abs(t - times[copy][r]) / t))
  console.log(`## ${title}: ${file} <variant> ${argv.join(" ")}, ${rounds} rounds\n`)
  console.log(
    `| variant | ${unit} (median) | vs ${base} | anon at exit | address space | peak resident | minor faults |`
  )
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
  const b = median(times[base])
  for (const v of variants) {
    const t = median(times[v])
    const [anon, size, peak, minflt] = kinds.map((m) =>
      mems[v][m].length > 0 ? String(median(mems[v][m])) : ""
    )
    console.log(
      `| ${v} | ${t.toFixed(2)} | ${(t / b).toFixed(2)}x | ${anon} | ${size} | ${peak} | ${minflt} |`
    )
  }
  if (last.s !== undefined) {
    console.log(`\ns: ${field(last.s, "flips")} flips, the longest ${field(last.s, "longest")} ns`)
  }
  console.log(`\nnoise band (${base} against ${copy}): ${(band * 100).toFixed(1)}%\n`)
}

const options = ["a", "a2", "r", "rs", "s", "c", "ca", "g"]
interleave("Churn, 1,000 live", `${out}/options`, options, ["2000000", "1000"], "a", "a2", "ns/request")
interleave("Churn, 100,000 live", `${out}/options`, options, ["2000000", "100000"], "a", "a2", "ns/request")
interleave(
  "Mostly hits, 1,000 live",
  `${out}/options`,
  options,
  ["4000000", "1000", "2"],
  "a",
  "a2",
  "ns/request"
)
const tax = ["plain", "plain2", "rc", "call", "atomic"]
interleave(
  "Counting tax, 1,024 objects",
  `${out}/rc-tax`,
  tax,
  ["1024", "100000000"],
  "plain",
  "plain2",
  "ns/step"
)
interleave(
  "Counting tax, 1,048,576 objects",
  `${out}/rc-tax`,
  tax,
  ["1048576", "20000000"],
  "plain",
  "plain2",
  "ns/step"
)
