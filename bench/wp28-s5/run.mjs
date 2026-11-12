// WP28 spike S5: what `--number-mode f64` costs on the benchmark suite, the
// price docs/wp28-compatibility-mode.md §5.3 attaches to `--compat`.
//
//   node bench/wp28-s5/run.mjs            # every program, about 15 minutes
//   node bench/wp28-s5/run.mjs --quick    # three programs, three rounds
//   node bench/wp28-s5/run.mjs --rounds 9 --compiler build/nish
//
// Every program bench/run.mjs lists is built twice, as the suite builds it and
// with `--number-mode f64` added, and lands in one of three places:
//
//   refused  the f64 build does not compile, or its output differs: reported
//            by name with the diagnostics or the two outputs, never dropped
//   same IR  both builds emit byte-identical IR (the program already asks for
//            f64 in its `.args` sidecar), so its price is 1 by construction
//   timed    the two binaries and a byte-identical copy of each run in
//            interleaved rounds; the ratio is f64 over the default, and the
//            band is the larger gap between a binary and its own copy
//
// A timed program is also counted under cachegrind, at the size
// bench/instructions.json names when it has the program and at the source's
// own size otherwise. The report is Markdown on stdout; README.md beside this
// file records one run of it and what it means.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import vm from "node:vm"

import { compilerFrom } from "../compiler.mjs"
import { sideOf, times3 } from "../par-reading.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const benchDir = path.join(root, "bench")
const outDir = path.join(root, "build", "bench", "wp28-s5")
const rel = (file) => path.relative(root, file)

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const nishc = compilerFrom(process.argv.slice(2))

/** The three programs `--quick` runs: one of each outcome, the timed one the shortest that is not all start-up. */
const QUICK = ["fib", "nbody", "par-single"]

const options = { quick: false, rounds: undefined }
for (let i = 0; i < nishc.rest.length; i++) {
  const arg = nishc.rest[i]
  if (arg === "--quick") {
    options.quick = true
  } else if (arg === "--rounds" && /^[1-9]\d*$/.test(nishc.rest[i + 1] ?? "")) {
    options.rounds = Number(nishc.rest[++i])
  } else {
    console.error("usage: node bench/wp28-s5/run.mjs [--quick] [--rounds <n>] [--compiler <nish>]")
    process.exit(2)
  }
}
const rounds = options.rounds ?? (options.quick ? 3 : 7)

// ---- The suite ----------------------------------------------------------------------

/**
 * The declarations of bench/run.mjs this spike measures by, read out of its
 * source and evaluated. That file runs the whole benchmark when it is
 * imported and exports nothing, and a copy of its lists here would go stale
 * the day a program is added, so the text itself is the one source of truth:
 * a `const NAME = [` runs to the line that closes it, anything else is one
 * line. A name the file no longer declares stops the run.
 */
const suiteDeclarations = (names) => {
  const lines = fs.readFileSync(path.join(benchDir, "run.mjs"), "utf8").split("\n")
  const source = names.map((name) => {
    const from = lines.findIndex((l) => l.startsWith(`const ${name} = `))
    if (from < 0) {
      fail(`bench/run.mjs no longer declares \`${name}\`; bench/wp28-s5/run.mjs reads it from there`)
    }
    if (!lines[from].endsWith("[")) {
      return lines[from]
    }
    const to = lines.findIndex((l, at) => at > from && l.startsWith("]"))
    return lines.slice(from, to + 1).join("\n")
  })
  return vm.runInNewContext(`${source.join("\n")}\n;({ ${names.join(", ")} })`)
}

const suite = suiteDeclarations([
  "BENCHMARKS",
  "AWFY",
  "AWFY_ITERATIONS",
  "PARALLEL",
  "MAPS",
  "MAPS_NODE",
  "MAP_MEASURES",
  "PINNED_LIBC",
  "PINNED_SIMD",
  "FIXED_KEY",
])

const sized = JSON.parse(fs.readFileSync(path.join(benchDir, "instructions.json"), "utf8")).programs

/** The compiler flags `bench/<name>.ts` is built with, from the `.args` sidecar bench/run.mjs reads. */
const sourceArgs = (name) => {
  const file = path.join(benchDir, `${name}.args`)
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : []
}

/**
 * One row per program of the suite. `source` is what is compiled, and the
 * seven AWFY ports share one, so they share a build and a refusal. `runs` is
 * every argument list whose output the two modes must agree on, the first
 * being the one timed: a parallel kernel is timed as its loop (`seq`), where
 * the number mode is the only thing that differs, and checked as `par` too.
 * `counted` is how the cachegrind run differs when bench/instructions.json
 * has the program: a size to rewrite the `bench:n` line to, or the arguments
 * of an AWFY port.
 */
const programs = [
  ...suite.BENCHMARKS.map((b) => ({
    name: b.name,
    source: `${b.name}.ts`,
    flags: sourceArgs(b.name),
    runs: [[]],
    counted: sized[b.name] && { size: String(sized[b.name].n) },
  })),
  ...suite.AWFY.map((b) => ({
    name: b.name,
    source: "awfy/main.ts",
    flags: [],
    runs: [[b.name, String(suite.AWFY_ITERATIONS), String(b.inner)]],
    counted: sized[b.name] && { args: [b.name, "1", String(sized[b.name].inner)] },
  })),
  ...suite.PARALLEL.map((b) => ({
    name: b.name,
    source: `${b.name}.ts`,
    flags: sourceArgs(b.name),
    runs: [["seq"], ["par"]],
  })),
  ...[...suite.MAPS, ...suite.MAP_MEASURES].map((b) => ({
    name: b.name,
    source: `${b.name}.ts`,
    flags: sourceArgs(b.name),
    runs: [[]],
    counted: sized[b.name] && { size: String(sized[b.name].n) },
  })),
].filter((p) => !options.quick || QUICK.includes(p.name))

if (options.quick && programs.length !== QUICK.length) {
  fail(
    `--quick names ${QUICK.join(", ")}, and bench/run.mjs lists only ${programs.map((p) => p.name).join(", ")}`
  )
}

// ---- Building -------------------------------------------------------------------------

const F64 = ["--number-mode", "f64"]

/**
 * Compile `file` into `dir`: one `.ll` per module under `dir/ir/` and the
 * linked binary `dir/exe`. Answers the diagnostics, which are empty when the
 * build succeeded. A compiler that fails without naming an error is not a
 * refusal of the program, so it stops the run.
 */
const build = (file, flags, dir) => {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const exe = path.join(dir, "exe")
  const r = spawnSync(
    nishc.cmd,
    [
      ...nishc.prefix,
      rel(file),
      ...flags,
      "--json",
      "-o",
      `${rel(dir)}/ir/`,
      "--link",
      rel(exe),
      "--profile",
      "speed",
    ],
    { cwd: root, encoding: "utf8" }
  )
  const errors = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((d) => d.severity === "error")
  if (r.status !== 0 && errors.length === 0) {
    fail(
      `${rel(file)} ${flags.join(" ")}: the compiler exited with ${r.status} and no diagnostic\n${r.stderr}`
    )
  }
  return { exe, errors }
}

/** Whether the two directories hold the same files with the same bytes: `diff -r`'s exit status. */
const sameTree = (a, b) => {
  const r = spawnSync("diff", ["-r", a, b], { encoding: "utf8" })
  if (r.status > 1) {
    fail(`diff -r ${rel(a)} ${rel(b)} failed\n${r.stderr}`)
  }
  return { same: r.status === 0, changed: r.stdout.split("\n").filter((l) => /^[<>]/.test(l)).length }
}

/**
 * Both builds of every distinct source, keyed by source, under
 * build/bench/wp28-s5/<name>/<mode>/. The default build is the suite's own, so
 * its failure is a broken checkout and stops the run; the f64 build's failure
 * is a finding. A source whose sidecar already carries the flag is compiled
 * with it twice, which is how its IR comes out the same.
 */
const builds = new Map()
const buildBoth = (program, file = path.join(benchDir, program.source), into = "") => {
  const key = `${program.source}${into}`
  if (!builds.has(key)) {
    const dir = path.join(outDir, program.source.replace(/\.ts$/, "").replace("/", "-") + into)
    const base = build(file, program.flags, path.join(dir, "default"))
    if (base.errors.length > 0) {
      fail(`${program.source} does not compile as the suite builds it: ${base.errors[0].message}`)
    }
    const f64 = build(file, [...program.flags, ...F64], path.join(dir, "f64"))
    const ir =
      f64.errors.length === 0 ? sameTree(path.join(dir, "default", "ir"), path.join(dir, "f64", "ir")) : null
    builds.set(key, { dir, exes: [base.exe, f64.exe], errors: f64.errors, ir })
  }
  return builds.get(key)
}

/** A copy of the source with the number on its `bench:n` line rewritten, as bench/run.mjs's `prepare` does it. */
const resized = (program, size) => {
  const lines = fs.readFileSync(path.join(benchDir, program.source), "utf8").split("\n")
  const at = lines.findIndex((l) => l.includes("bench:n"))
  if (at < 0) {
    fail(`${program.source} has no \`bench:n\` line to set to ${size}`)
  }
  lines[at] = lines[at].replace(/\b\d+\b/, size)
  const file = path.join(outDir, "src", program.source)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, lines.join("\n"))
  return file
}

// ---- Running ----------------------------------------------------------------------------

const run = (exe, args) => {
  const t0 = process.hrtime.bigint()
  const r = spawnSync(exe, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 })
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  if (r.status !== 0) {
    fail(`${rel(exe)} ${args.join(" ")} exited with ${r.status ?? r.signal}\n${r.stderr}`)
  }
  return { ms, stdout: r.stdout }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Time the two binaries and a byte-identical copy of each, one warm-up and
 * then `rounds` rounds with the order rotated every round so that no binary
 * always runs first or always follows the same neighbour. The band is what
 * the machine does to a binary against itself in these very rounds, the
 * larger of the two gaps, and a ratio inside it is not a difference
 * (.claude/testing.md, "A `Measured:` trailer").
 */
const time = (exes, args) => {
  const ids = ["default", "f64", "default-copy", "f64-copy"]
  const files = [...exes, ...exes.map((exe) => `${exe}-copy`)]
  exes.forEach((exe, i) => {
    fs.copyFileSync(exe, files[i + 2])
  })
  const samples = ids.map(() => [])
  for (let round = -1; round < rounds; round++) {
    for (let k = 0; k < ids.length; k++) {
      const at = (k + Math.max(round, 0)) % ids.length
      const { ms } = run(files[at], args)
      if (round >= 0) {
        samples[at].push(ms)
      }
    }
  }
  const stat = (f) => {
    const [base, f64, baseCopy, f64Copy] = samples.map(f)
    const band = Math.max(Math.abs(base / baseCopy - 1), Math.abs(f64 / f64Copy - 1))
    return { base, f64, ratio: f64 / base, band, side: sideOf(f64 / base, band) }
  }
  return { median: stat(median), min: stat((xs) => Math.min(...xs)) }
}

const which = (tool) => {
  const r = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" })
  return r.status === 0 ? r.stdout.trim() : null
}
const valgrind = which("valgrind")

/**
 * Build bench/fixed-key.c beside `exe`, the preload that pins a `Map`'s hash
 * key, and count the instructions of one run the way
 * `node bench/run.mjs --instructions` does: whole process, the environment
 * nothing but the three pins read from that file, argv[0] relative.
 */
const count = (exe, args) => {
  const dir = path.dirname(exe)
  const key = path.join(dir, suite.FIXED_KEY)
  const cc = spawnSync("clang", ["-O2", "-shared", "-fPIC", path.join(benchDir, "fixed-key.c"), "-o", key], {
    encoding: "utf8",
  })
  if (cc.status !== 0) {
    fail(`building ${rel(key)} failed\n${cc.stderr}`)
  }
  const out = path.join(dir, "cachegrind.out")
  const r = spawnSync(
    valgrind,
    [
      "--tool=cachegrind",
      "--cache-sim=no",
      `--cachegrind-out-file=${out}`,
      `./${path.basename(exe)}`,
      ...args,
    ],
    {
      cwd: dir,
      env: {
        GLIBC_TUNABLES: suite.PINNED_LIBC,
        NISH_SIMD: suite.PINNED_SIMD,
        LD_PRELOAD: `./${suite.FIXED_KEY}`,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1 << 28,
    }
  )
  const summary = r.status === 0 ? fs.readFileSync(out, "utf8").match(/^summary: (\d+)$/m) : null
  if (!summary) {
    fail(`cachegrind ${rel(exe)} ${args.join(" ")} failed (exit ${r.status})\n${r.stderr}`)
  }
  return Number(summary[1])
}

// ---- Measuring ----------------------------------------------------------------------------

/**
 * Where one program lands. A refusal carries the f64 build's diagnostics, an
 * output change carries both outputs of the first run that disagreed, and
 * only a program that builds both ways, differs in IR and prints the same
 * thing is timed and counted.
 */
const measure = (program) => {
  const built = buildBoth(program)
  if (built.errors.length > 0) {
    return { outcome: "refused", errors: built.errors }
  }
  if (built.ir.same) {
    return { outcome: "same-ir", dir: built.dir }
  }
  for (const args of program.runs) {
    const [base, f64] = built.exes.map((exe) => run(exe, args).stdout)
    if (base !== f64) {
      return { outcome: "output", args, base, f64 }
    }
  }
  const timing = time(built.exes, program.runs[0])
  let counts = null
  if (valgrind) {
    const { size, args = program.runs[0] } = program.counted ?? {}
    const exes = size === undefined ? built.exes : buildBoth(program, resized(program, size), "-sized").exes
    counts = exes.map((exe) => count(exe, args))
  }
  return {
    outcome: "timed",
    changed: built.ir.changed,
    timing,
    counts,
    atSuiteSize: program.counted !== undefined,
  }
}

// ---- Reporting ----------------------------------------------------------------------------

const ms = (n) => (n < 100 ? n.toFixed(1) : n.toFixed(0))
const percent = (n) => `${(n * 100).toFixed(1)}%`
const signed = (n) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`
const geomean = (xs) => Math.exp(xs.reduce((sum, x) => sum + Math.log(x), 0) / xs.length)
const READING = { within: "within the band", edge: "at the band's edge", slower: "slower", faster: "faster" }

/** The first line of an output that differs between the two, cut to a width a table can hold. */
const firstDifference = (a, b) => {
  const [x, y] = [a.split("\n"), b.split("\n")]
  const differs = x.findIndex((text, i) => text !== y[i])
  const at = differs < 0 ? x.length : differs
  const cut = (s) => {
    if (s === undefined) {
      return "(no such line)"
    }
    return s.length > 60 ? `${s.slice(0, 60)}…` : s
  }
  return `line ${at + 1}: \`${cut(x[at])}\` became \`${cut(y[at])}\``
}

const cpu = os.cpus()
const version = spawnSync(nishc.cmd, [...nishc.prefix, "--version"], { encoding: "utf8" }).stdout.trim()
const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim()

const results = programs.map((program) => {
  console.error(`${program.name}...`)
  return { ...program, ...measure(program) }
})

const timed = results.filter((r) => r.outcome === "timed")
const sameIr = results.filter((r) => r.outcome === "same-ir")
const refused = results.filter((r) => r.outcome === "refused")
const changed = results.filter((r) => r.outcome === "output")

const out = []
out.push(
  `${results.length} programs under \`--number-mode f64\` against the suite's own build: ` +
    `${timed.length} timed, ${sameIr.length} with the same IR, ${refused.length} refused, ` +
    `${changed.length} with a changed output.`,
  "",
  `Machine: ${cpu.length} x ${cpu[0]?.model ?? "unknown CPU"}, ${os.platform()}-${os.arch()}, ` +
    `${version} at ${head}, node ${process.version}. ${rounds} interleaved rounds after one warm-up.`,
  ""
)

if (timed.length > 0) {
  out.push(
    "### Timed",
    "",
    "Ratio is f64 over the default, on the median; the band is the larger gap between a binary and its byte-identical copy in the same rounds.",
    "",
    "| program | default (ms) | f64 (ms) | ratio | band | reading | ratio (min) | band (min) | instructions | IR lines changed |",
    "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |"
  )
  for (const r of timed) {
    const { median: m, min } = r.timing
    const counted = r.counts
      ? `${signed(r.counts[1] / r.counts[0] - 1)}${r.atSuiteSize ? "" : " †"}`
      : "not counted"
    out.push(
      `| ${r.name} | ${ms(m.base)} | ${ms(m.f64)} | ${times3(m.ratio)} | ±${percent(m.band)} | ${READING[m.side]} | ` +
        `${times3(min.ratio)} | ±${percent(min.band)} | ${counted} | ${r.changed} |`
    )
  }
  const outside = timed.filter((r) => r.timing.median.side === "slower" || r.timing.median.side === "faster")
  out.push(
    "",
    `Geometric mean of the ${timed.length} timed ratios: ${times3(geomean(timed.map((r) => r.timing.median.ratio)))} on the median, ` +
      `${times3(geomean(timed.map((r) => r.timing.min.ratio)))} on the minimum` +
      (sameIr.length > 0
        ? `; with the ${sameIr.length} same-IR programs at 1.000x, ` +
          `${times3(geomean([...timed.map((r) => r.timing.median.ratio), ...sameIr.map(() => 1)]))} on the median.`
        : "."),
    `Outside its band on the median: ${outside.length === 0 ? "none" : outside.map((r) => `${r.name} (${r.timing.median.side})`).join(", ")}.`
  )
  if (timed.some((r) => r.counts)) {
    out.push(
      "",
      "Instructions are f64 against the default under cachegrind, whole process, pinned as `node bench/run.mjs --instructions` pins them. " +
        "† marks a program bench/instructions.json does not have, counted at its source's own size."
    )
    for (const r of timed.filter((x) => x.counts)) {
      out.push(`- ${r.name}: ${r.counts[0]} default, ${r.counts[1]} f64`)
    }
  } else {
    out.push("", "Instructions were not counted: no `valgrind` on PATH.")
  }
  out.push("")
}

if (sameIr.length > 0) {
  out.push(
    "### Same IR",
    "",
    "The sidecar already builds these with `--number-mode f64`, so the flag changes nothing. Each command prints nothing:",
    "",
    "```"
  )
  for (const r of sameIr) {
    out.push(`diff -r ${rel(r.dir)}/default/ir ${rel(r.dir)}/f64/ir`)
  }
  out.push("```", "")
}

if (refused.length > 0) {
  out.push(
    "### Refused",
    "",
    "| program | source | errors | by code | first diagnostic |",
    "| --- | --- | ---: | --- | --- |"
  )
  for (const r of refused) {
    const codes = new Map()
    for (const e of r.errors) {
      codes.set(e.code, (codes.get(e.code) ?? 0) + 1)
    }
    const tally = [...codes].map(([code, n]) => `${code} x${n}`).join(", ")
    const first = r.errors[0]
    out.push(
      `| ${r.name} | bench/${r.source} | ${r.errors.length} | ${tally} | ${first.file}:${first.line}: ${first.message.replaceAll("|", "\\|")} |`
    )
  }
  out.push("")
}

if (changed.length > 0) {
  out.push("### Output changed", "", "| program | arguments | first difference |", "| --- | --- | --- |")
  for (const r of changed) {
    out.push(
      `| ${r.name} | ${r.args.join(" ") || "(none)"} | ${firstDifference(r.base, r.f64).replaceAll("|", "\\|")} |`
    )
  }
  out.push("")
}

console.log(out.join("\n"))
