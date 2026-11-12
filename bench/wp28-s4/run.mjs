// WP28 spike S4: whether a non-interfering `Promise.all` pays as a fork/join,
// the second payoff docs/wp28-compatibility-mode.md §6.4 claims for
// `--async-model threads`.
//
//   node bench/wp28-s4/run.mjs            # six task sizes, about three minutes
//   node bench/wp28-s4/run.mjs --quick    # three rounds
//   node bench/wp28-s4/run.mjs --rounds 21 --compiler build/nish
//
// Three programs over the one kernel of kernel.ts, the product of an array
// modulo a prime:
//
//   sequential  the two calls one after the other, what the pair costs today
//   fork-join   the two calls as two tasks on `using s = scope()`, the
//               lowering written by hand
//   reduce      one `parallelReduce` over both arrays, the data-parallel form
//
// Each is run at every task size with a byte-identical copy of the sequential
// binary beside it, in interleaved rounds whose order rotates. A ratio is a
// form's median over the sequential median, and the band is the gap between
// the sequential binary and its copy at that size. Every time is the whole
// process less the same binary's zero-call run at that size, taken in the same
// rounds, so start-up and the fill of the arrays are in no figure. Every run of
// one size must print the same checksum. The report is Markdown on stdout; README.md beside
// this file records one run of it and what it means.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { sideOf, times3 } from "../par-reading.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const sourceDir = path.join(root, "bench", "wp28-s4")
const outDir = path.join(root, "build", "bench", "wp28-s4")
const rel = (file) => path.relative(root, file)

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const nishc = compilerFrom(process.argv.slice(2))

const options = { quick: false, rounds: undefined }
for (let i = 0; i < nishc.rest.length; i++) {
  const arg = nishc.rest[i]
  if (arg === "--quick") {
    options.quick = true
  } else if (arg === "--rounds" && /^[1-9]\d*$/.test(nishc.rest[i + 1] ?? "")) {
    options.rounds = Number(nishc.rest[++i])
  } else {
    console.error("usage: node bench/wp28-s4/run.mjs [--quick] [--rounds <n>] [--compiler <nish>]")
    process.exit(2)
  }
}
const rounds = options.rounds ?? (options.quick ? 3 : 11)

/**
 * The task sizes: `n` elements per task, and how many pairs of tasks one run
 * makes, chosen so that the sequential run is a few hundred milliseconds. The
 * kernel is about
 * 4 ns an element on the machine README.md records, which makes 250, 25 000
 * and 2 500 000 elements the 1 µs, 100 µs and 10 ms tasks the spike asks
 * for; the three sizes between the first two are there to narrow the
 * break-even.
 */
const SIZES = [
  { n: 250, calls: 100000 },
  { n: 2500, calls: 10000 },
  { n: 5000, calls: 5000 },
  { n: 10000, calls: 4000 },
  { n: 25000, calls: 2000 },
  { n: 2500000, calls: 40 },
]

const BASELINE = "sequential"
const FORMS = [BASELINE, "fork-join", "reduce"]

// ---- Building and running -----------------------------------------------------------

/** Compile bench/wp28-s4/<name>.ts to an executable, keeping its IR beside it. */
const build = (name) => {
  const exe = path.join(outDir, name)
  const res = spawnSync(
    nishc.cmd,
    [
      ...nishc.prefix,
      rel(path.join(sourceDir, `${name}.ts`)),
      "-o",
      `${rel(outDir)}/ir-${name}/`,
      "--link",
      rel(exe),
      "--profile",
      "speed",
    ],
    { cwd: root, encoding: "utf8" }
  )
  if (res.status !== 0) {
    fail(`${name}: the build failed\n${res.stdout}${res.stderr}`)
  }
  return exe
}

/** One timed run of `calls` calls: wall-clock milliseconds and the checksum it printed. */
const run = (exe, n, calls) => {
  const start = process.hrtime.bigint()
  const res = spawnSync(exe, [String(n), String(calls)], { encoding: "utf8" })
  const wall = Number(process.hrtime.bigint() - start) / 1e6
  if (res.status !== 0) {
    fail(`${rel(exe)} ${n} ${calls}: exit ${res.status}\n${res.stderr}`)
  }
  return { wall, checksum: res.stdout.trim() }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Every binary of `exes` at one size, in `rounds` interleaved rounds after one warm-up
 * round, the order rotated each round so that no binary always runs first.
 * Each binary is run twice a round, with the size's calls and with none: the
 * second is its start-up and the fill of its arrays, the fixed cost. Answers
 * each binary's median fixed cost and its median wall time less that, and
 * stops the run if two runs of the size print different checksums.
 */
const time = (exes, size) => {
  const samples = new Map(exes.map((b) => [b.id, { wall: [], fixed: [] }]))
  let checksum
  for (let round = -1; round < rounds; round++) {
    for (let k = 0; k < exes.length; k++) {
      const b = exes[(k + Math.max(round, 0)) % exes.length]
      const got = run(b.exe, size.n, size.calls)
      const fixed = run(b.exe, size.n, 0).wall
      checksum ??= got.checksum
      if (got.checksum !== checksum) {
        fail(`n=${size.n}: ${b.id} printed ${got.checksum}, and an earlier run printed ${checksum}`)
      }
      if (round >= 0) {
        samples.get(b.id).wall.push(got.wall)
        samples.get(b.id).fixed.push(fixed)
      }
    }
  }
  const fixed = new Map([...samples].map(([id, xs]) => [id, median(xs.fixed)]))
  const medians = new Map([...samples].map(([id, xs]) => [id, median(xs.wall) - fixed.get(id)]))
  return { checksum, medians, fixed }
}

fs.mkdirSync(outDir, { recursive: true })
const binaries = FORMS.map((id) => {
  console.error(`building ${id}...`)
  return { id, exe: build(id) }
})
const copy = path.join(outDir, `${BASELINE}-copy`)
fs.copyFileSync(path.join(outDir, BASELINE), copy)
fs.chmodSync(copy, 0o755)
binaries.push({ id: `${BASELINE}-copy`, exe: copy })

const rows = SIZES.map((size) => {
  console.error(`n=${size.n}, ${size.calls} calls...`)
  const { checksum, medians, fixed } = time(binaries, size)
  const base = medians.get(BASELINE)
  const band = Math.abs(medians.get(`${BASELINE}-copy`) / base - 1)
  const form = (id) => {
    const ratio = medians.get(id) / base
    return { perCall: (medians.get(id) * 1000) / size.calls, ratio, side: sideOf(ratio, band) }
  }
  return {
    size,
    checksum,
    band,
    // Milliseconds of start-up and fill the sequential times leave out.
    fixed: fixed.get(BASELINE),
    // Microseconds for one task, run alone: half a sequential pair.
    task: (base * 1000) / size.calls / 2,
    sequential: form(BASELINE),
    forkJoin: form("fork-join"),
    reduce: form("reduce"),
  }
})

// ---- Reporting ----------------------------------------------------------------------

/** Three significant figures of a value under 1000. */
const micros = (n) => n.toFixed(Math.max(0, 2 - Math.floor(Math.log10(Math.max(n, 1)))))
const duration = (us) => (us < 1000 ? `${micros(us)} µs` : `${micros(us / 1000)} ms`)
const percent = (n) => `${(n * 100).toFixed(1)}%`
const READING = { within: "within the band", edge: "at the band's edge", slower: "slower", faster: "faster" }

/**
 * Where the fork/join stops losing: the last size at which it is slower than
 * the sequential pair outside the band, the first at which it is faster
 * outside it, and between two adjacent sizes on either side of 1.000x the
 * task time at which the ratio crosses 1, interpolated in the logarithm of
 * both. A run in which the ratio never crosses has no break-even to report.
 */
const breakEven = () => {
  const lastSlower = rows.findLast((r) => r.forkJoin.side === "slower")
  const firstFaster = rows.find((r) => r.forkJoin.side === "faster")
  const at = rows.findIndex((r, i) => i > 0 && rows[i - 1].forkJoin.ratio > 1 && r.forkJoin.ratio <= 1)
  if (at < 0 || !lastSlower || !firstFaster) {
    return "No break-even in this run: the fork/join is not slower outside the band at one size and faster outside it at a larger one."
  }
  const [lo, hi] = [rows[at - 1], rows[at]]
  const t = Math.log(lo.forkJoin.ratio) / (Math.log(lo.forkJoin.ratio) - Math.log(hi.forkJoin.ratio))
  const crossing = Math.exp(Math.log(lo.task) + t * (Math.log(hi.task) - Math.log(lo.task)))
  return (
    `Break-even: the fork/join is last slower outside the band at a ${duration(lastSlower.task)} task ` +
    `(${times3(lastSlower.forkJoin.ratio)}) and first faster outside it at ${duration(firstFaster.task)} ` +
    `(${times3(firstFaster.forkJoin.ratio)}); interpolated between the sizes either side of 1.000x, ` +
    `the ratio crosses 1 at a task of about ${duration(crossing)}.`
  )
}

const cpu = os.cpus()
const version = spawnSync(nishc.cmd, [...nishc.prefix, "--version"], { encoding: "utf8" }).stdout.trim()
const head =
  spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout?.trim() ||
  "an unknown commit"

/** The CPUs the container's cgroup allows, where it sets a quota under the logical count. */
const quota = () => {
  try {
    const [max, period] = fs.readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim().split(" ")
    return max === "max" ? "" : `, cgroup quota ${(Number(max) / Number(period)).toFixed(1)} CPUs`
  } catch {
    return ""
  }
}

const formCells = (f) => `${duration(f.perCall)} | ${times3(f.ratio)} | ${READING[f.side]}`
const out = [
  "Two calls of one pure kernel, sequential, as a fork/join on `scope()`, and as one `parallelReduce`.",
  "",
  `Machine: ${cpu.length} logical CPUs, ${cpu[0]?.model ?? "unknown CPU"}${quota()}, ${os.platform()}-${os.arch()}, ` +
    `${version} at ${head}, node ${process.version}. ${rounds} interleaved rounds after one warm-up.`,
  "",
  "One task is half a sequential call. A time is the median wall time of the whole process less the median of the same " +
    "binary's zero-call run in the same rounds, its start-up and the fill of its arrays. A ratio is a form's time over " +
    "the sequential time; the band is the gap between the sequential binary and a byte-identical copy of it in the same rounds.",
  "",
  "| elements per task | one task | calls | sequential, per call | fork/join, per call | ratio | reading | reduce, per call | ratio | reading | band | start-up and fill | checksum |",
  "| ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |",
  ...rows.map(
    (r) =>
      `| ${r.size.n} | ${duration(r.task)} | ${r.size.calls} | ${duration(r.sequential.perCall)} | ` +
      `${formCells(r.forkJoin)} | ${formCells(r.reduce)} | ±${percent(r.band)} | ${duration(r.fixed * 1000)} | ${r.checksum} |`
  ),
  "",
  breakEven(),
  "",
  "What one fork/join costs over the work it shares out, its call less half a sequential call: " +
    `${rows.map((r) => `${duration(r.forkJoin.perCall - r.sequential.perCall / 2)} at ${r.size.n}`).join(", ")}.`,
  "",
  `The IR of the fork/join site is \`@pair\` in ${rel(outDir)}/ir-fork-join/fork-join.ll.`,
]

console.log(out.join("\n"))
