#!/usr/bin/env node
// Reproduces the figures in docs/wp46-long-running-memory.md: the baseline's
// arena and resident set over requests (`sessions.ts`), and the options'
// prototypes (`options.c`, `rc-tax.c`) timed in interleaved rounds.
//
//   npm run build && node bench/wp46-memory/run.mjs [--rounds 7]
//
// Each round runs every variant once, in an order rotated by the round, each
// in a fresh process so its resident set is its own. A figure is the median
// over the rounds. The noise band is the median over the rounds of the gap
// between the baseline and a byte-identical copy of it (`a` and `a2`,
// `plain` and `plain2`), timed in the same rounds: a difference inside it is
// no difference. The memory columns are medians over the rounds too: the
// anonymous resident set and the address space at exit, and the peak
// resident set. Every variant must print the same checksum, or the run fails.
//
// Linux only (/proc), run from the repository root.
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"

const args = process.argv.slice(2)
const at = args.indexOf("--rounds")
const rounds = at >= 0 ? Number(args[at + 1]) : 7
const out = "build/wp46"
mkdirSync(out, { recursive: true })

const run = (file, argv) => execFileSync(file, argv, { encoding: "utf8" })
const cc = process.env.CC ?? "clang"
run(cc, ["-O2", "-c", "runtime/runtime.c", "-o", `${out}/runtime.o`])
run(cc, ["-O2", "bench/wp46-memory/options.c", `${out}/runtime.o`, "-o", `${out}/options`])
run(cc, ["-O2", "bench/wp46-memory/rc-tax.c", `${out}/runtime.o`, "-o", `${out}/rc-tax`])
run("build/nish", ["bench/wp46-memory/sessions.ts", "--link", `${out}/sessions`])

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

const interleave = (title, file, variants, argv, base, copy, unit) => {
  const times = Object.fromEntries(variants.map((v) => [v, []]))
  const mems = Object.fromEntries(variants.map((v) => [v, { anon: [], size: [], peak: [] }]))
  const last = {}
  const sums = new Set()
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < variants.length; k++) {
      const v = variants[(k + r) % variants.length]
      const line = run(file, [v, ...argv])
      times[v].push(Number(field(line, unit)))
      sums.add(field(line, "checksum"))
      for (const m of ["anon", "size", "peak"]) {
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
  console.log(`| variant | ${unit} (median) | vs ${base} | anon at exit | address space | peak resident |`)
  console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
  const b = median(times[base])
  for (const v of variants) {
    const t = median(times[v])
    const [anon, size, peak] = ["anon", "size", "peak"].map((m) =>
      mems[v][m].length > 0 ? String(median(mems[v][m])) : ""
    )
    console.log(`| ${v} | ${t.toFixed(2)} | ${(t / b).toFixed(2)}x | ${anon} | ${size} | ${peak} |`)
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
