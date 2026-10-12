#!/usr/bin/env node
// Nish benchmark runner (WP9). Builds every benchmark in bench/ for
// Nish, C, Go and Rust, checks that all of them print the same checksum,
// times the binaries and writes docs/BENCHMARKS.md. See bench/README.md.
//
//   npm run build && node bench/run.mjs [options]
//     --runs N          timed runs per binary (default 5), after --warmup N (default 1)
//     --only a,b        benchmark names to include (default: all); `awfy` names
//                       the Are We Fast Yet ports in bench/awfy/, which run only
//                       when named, and `maps` the WP32 map programs (see
//                       bench/README.md)
//     --n name=value    override a benchmark's size (the `bench:n` line in its
//                       sources); `maps=<n>` sizes all the map programs at once
//     --validate        build and compare checksums only: no timing, no docs written
//     --no-rust         skip Rust even when rustc is installed
//     --no-go           skip Go even when the go tool is installed
//     --no-rayon        skip the Rayon twins of the data-parallel kernels
//                       even when cargo is installed and crates.io answers
//     --twin-runs N     how many times the twins' comparison is run whole
//                       (default 3), so its table can say how far apart runs fall
//     --out <file>      where to write the report (default docs/BENCHMARKS.md);
//                       a run of the data-parallel kernels alone (--only par)
//                       rewrites only their two tables and keeps the rest
//     --compiler <nish> the compiler under test (default build/nish; a
//                       native nish runs directly, a .js entry under node)
//     --instructions    count the instructions each of the 21 programs executes
//                       under valgrind's cachegrind, at the sizes in
//                       bench/instructions.json; nothing is timed. With --check,
//                       fail when one exceeds its baseline by more than the
//                       tolerance; with --update, rewrite the baseline (a PR that
//                       does must say why). --runs N repeats each run (default 1)
//
// The WP32 map programs are the four layout prototypes (bench/map_proto_*.ts)
// and the three measurements of the global `Map` (map-wordcount, map-presize,
// map-vs-stringmap), each beside a Node twin. Every checksum line is one of the
// ten bench/map-node.mjs prints from Node's `Map`, so every program runs a
// workload of docs/wp32-map.md §2 exactly; each workload is timed by the
// program itself. They run at 2^16 and 2^20 keys, in and out of the cache, and
// their tables, comparisons (a) to (d), go to docs/BENCHMARKS.md with the rest;
// `--only maps` prints them instead. `--n maps=<power of two>` picks one size.
// See bench/README.md.
//
// The data-parallel kernels (bench/par-*.ts) are one Nish binary each, run
// twice, as the loop (`seq`) and as the parallel form (`par`), and the two runs
// must print the same checksum. Four of them also have Rust twins
// (`std::thread::scope`, and Rayon through cargo) and Go twins (goroutines and
// a sync.WaitGroup), timed against the Nish `par` run in interleaved rounds,
// each beside a byte-identical copy of itself for the noise band; every twin
// must print Nish's checksum. They run with the rest, or when `--only` names
// one (`par` names all six), and are left out of --instructions: see
// bench/README.md.
//
// Every benchmark prints one checksum (one or more lines of numbers). Outputs
// are compared token by token; numeric tokens must agree to 1e-9 relative so
// that `%.17g`, Rust's `{}`, Go's `%v` and Nish's JavaScript-style
// formatting of the same double all count as equal. The Are We Fast Yet ports
// have no twins to compare with: each checks its own result, and the harness
// panics when one is wrong.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"
import { BAND_EDGE, cgroupCpus, judge, readAcross, spreadOf, times3 } from "./par-reading.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const benchDir = path.join(root, "bench")
const outDir = path.join(root, "build", "bench")
const srcDir = path.join(outDir, "src")
const nishc = compilerFrom(process.argv)

// ---- Benchmarks -------------------------------------------------------------------

/**
 * `integer` marks the benchmarks whose hot loop is integer arithmetic, where
 * `--wrapping` gets a column: what the overflow checks the default build keeps
 * cost. `extraC` lists further C sources that print the same checksum (the
 * naive malloc/free string builder).
 *
 * The compiler flags a benchmark needs are not listed here: they live in
 * `bench/<name>.args`, the sidecar `tests/cases` uses, so that the stage1
 * oracles compile the same source the same way (`tests/self/corpus.js`).
 */
const BENCHMARKS = [
  { name: "fib", what: "fib(40), recursive calls", integer: true },
  { name: "nbody", what: "n-body, 5 bodies, 2e7 steps (class + array, f64)", integer: false },
  { name: "spectral", what: "spectral norm, n = 3000 (number[] + f64)", integer: false },
  { name: "sieve", what: "sieve of Eratosthenes, n = 1e7, 20 passes (boolean[])", integer: true },
  {
    name: "strbuild",
    what: "string building, 131072 template pieces joined into 806 KB",
    integer: true,
    extraC: ["strbuild-naive"],
  },
  { name: "vec3", what: "Vec3 class with methods, 5e7 iterations (f64)", integer: false },
  {
    name: "result",
    what: "Result<number, number> returned and passed, 2e8 calls (WP17 packing)",
    integer: true,
  },
]

/**
 * The Are We Fast Yet ports in bench/awfy/, one harness binary for all seven,
 * at the inner iteration counts the AWFY suite runs them with. `--only awfy`
 * runs each for `AWFY_ITERATIONS` outer iterations and reports the median of
 * the last `AWFY_KEPT`; the ones before are the warm-up.
 */
const AWFY = [
  { name: "Permute", inner: 1000 },
  { name: "Queens", inner: 1000 },
  { name: "Towers", inner: 600 },
  { name: "List", inner: 1500 },
  { name: "Bounce", inner: 1500 },
  { name: "Mandelbrot", inner: 500 },
  { name: "Storage", inner: 1000 },
]
const AWFY_ITERATIONS = 30

/**
 * The wp29 kernels in bench/par-*.ts: one binary each, timed as the loop
 * (`seq`) and as `parallelMapInto` or a scope (`par`) on every core the
 * machine has. `twins` marks the ones ported to Rust and Go
 * (bench/par-<name>.rs, par-<name>-rayon.rs and par-<name>.go), which the
 * cross-language table times against the `par` run.
 */
const PARALLEL = [
  { name: "par-compute", what: "64 square roots per element, 2^21 elements (f64)", twins: true },
  {
    name: "par-alloc",
    what: "a string formatted and summed per element, 2^22 elements; the body allocates (NL9012)",
  },
  {
    name: "par-nbody",
    what: "n-body partitioned: 1024 bodies, 16 steps, one map of 3n probes per step",
    twins: true,
  },
  { name: "par-short", what: "an 8-element map called 2^20 times, each call fed by the last" },
  {
    name: "par-regions",
    what: "a 2^17-element map called 1,000 times, each call fed by the last: what a region costs",
    twins: true,
  },
  {
    name: "par-histogram",
    what: "4 tasks bin 50,000 values each into one `Mutex`, a lock per value, 16 rounds: a contended lock",
    twins: true,
  },
]
const AWFY_KEPT = 20

/**
 * The WP32 layout prototypes in bench/map_proto_*.ts, in the order of
 * docs/wp32-map.md §2, and the Node twin every one of them must agree with.
 */
const MAPS = [
  { name: "map-proto-ordered", label: "ordered" },
  { name: "map-proto-ordered-fp", label: "ordered+i64 fp" },
  { name: "map-proto-ordered-fp32", label: "ordered+u32 fp" },
  { name: "map-proto-unordered", label: "unordered" },
]
const MAPS_NODE = "map-node"

/**
 * The global `Map` measured in docs/wp32-map.md §10: comparisons (b), (c) and
 * (d). Each program runs the variants it names, one per process when timed
 * (`<name> time <variant>`), and prints what its twin prints; `map-node` is
 * the twin of `map-vs-stringmap` because they run the same ten workloads.
 */
const MAP_MEASURES = [
  { name: "map-wordcount", twin: "map-wordcount", variants: ["fused", "double"] },
  { name: "map-presize", twin: "map-presize", variants: ["grow", "reserve"] },
  { name: "map-vs-stringmap", twin: MAPS_NODE, variants: ["map", "stringmap"] },
]

/** The key counts the map tables are timed at: inside the last-level cache, and well outside it. */
const MAP_SIZES = ["65536", "1048576"]

/** The compiler flags `bench/<name>.ts` is built with, from its `.args` sidecar. */
const sourceArgs = (name) => {
  const file = path.join(benchDir, `${name}.args`)
  if (!fs.existsSync(file)) {
    return []
  }
  return fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean)
}

// ---- Options ------------------------------------------------------------------------

const opts = {
  runs: 5,
  runsGiven: false,
  warmup: 1,
  only: null,
  sizes: new Map(),
  validate: false,
  instructions: false,
  check: false,
  update: false,
  rust: true,
  go: true,
  rayon: true,
  twinRuns: 3,
  out: path.join(root, "docs", "BENCHMARKS.md"),
}
const fail = (msg) => {
  console.error(`bench/run.mjs: ${msg}`)
  process.exit(2)
}

const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  const a = argv[i]
  const next = () => {
    const v = argv[++i]
    if (v === undefined) {
      fail(`${a} needs a value`)
    }
    return v
  }
  if (a === "--runs") {
    opts.runs = Number(next())
    opts.runsGiven = true
  } else if (a === "--warmup") {
    opts.warmup = Number(next())
  } else if (a === "--only") {
    opts.only = new Set(next().split(",").filter(Boolean))
  } else if (a === "--n") {
    for (const pair of next().split(",")) {
      const [name, value] = pair.split("=")
      if (!name || !/^\d+$/.test(value ?? "")) {
        fail(`--n expects name=integer, got \`${pair}\``)
      }
      opts.sizes.set(name, value)
    }
  } else if (a === "--validate") {
    opts.validate = true
  } else if (a === "--instructions") {
    opts.instructions = true
  } else if (a === "--check") {
    opts.check = true
  } else if (a === "--update") {
    opts.update = true
  } else if (a === "--no-rust") {
    opts.rust = false
  } else if (a === "--no-go") {
    opts.go = false
  } else if (a === "--no-rayon") {
    opts.rayon = false
  } else if (a === "--twin-runs") {
    opts.twinRuns = Number(next())
    if (!Number.isInteger(opts.twinRuns) || opts.twinRuns < 1) {
      fail("--twin-runs expects a positive integer")
    }
  } else if (a === "--out") {
    opts.out = path.resolve(next())
  } else if (a === "-h" || a === "--help") {
    // The banner is this file's leading comment block, minus the shebang: it
    // ends at the first line that is not a comment, so adding an option above
    // does not need a line count here changed to match.
    const banner = fs
      .readFileSync(fileURLToPath(import.meta.url), "utf8")
      .split("\n")
      .slice(1)
    const end = banner.findIndex((l) => !l.startsWith("//"))
    console.log(
      banner
        .slice(0, end)
        .map((l) => l.replace(/^\/\/ ?/, ""))
        .join("\n")
    )
    process.exit(0)
  } else {
    fail(`unknown option ${a}`)
  }
}

if ((opts.check || opts.update) && !opts.instructions) {
  fail("--check and --update belong to --instructions")
}
if (opts.check && opts.update) {
  fail("--check and --update are exclusive: update the baseline or check it")
}
// Counting runs only the Nish builds, so the other languages are not looked up.
if (opts.instructions) {
  opts.rust = false
  opts.go = false
  opts.rayon = false
}

// ---- Toolchain ------------------------------------------------------------------------

const which = (tool, extraDirs = []) => {
  for (const dir of [...process.env.PATH.split(path.delimiter), ...extraDirs]) {
    const p = path.join(dir, tool)
    try {
      fs.accessSync(p, fs.constants.X_OK)
      return p
    } catch {
      // Not there, or not executable: try the next directory.
    }
  }
  return null
}

const version = (cmd, args = ["--version"]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" })
  return r.status === 0 ? r.stdout.split("\n")[0].trim() : `${cmd}: not found`
}

const CC = process.env.CC || which("clang") || fail("clang not found (set CC)")
const RUSTC = opts.rust
  ? process.env.RUSTC || which("rustc", [path.join(os.homedir(), ".cargo", "bin")])
  : null
const GO = opts.go
  ? process.env.GO || which("go", ["/usr/local/go/bin", path.join(os.homedir(), "go", "bin")])
  : null
// Rayon is a crate, so its twins are built by cargo, which fetches it from
// crates.io on the first run; `rustc` alone builds the `std::thread::scope` twins.
const CARGO =
  opts.rust && opts.rayon
    ? process.env.CARGO || which("cargo", [path.join(os.homedir(), ".cargo", "bin")])
    : null
// Peak RSS of a child comes from bench/rss.c (fork, exec, wait4): `/usr/bin/time`
// is not installed everywhere and an interpreter's fork would count its own pages.
const RSS_HELPER = (() => {
  const exe = path.join(outDir, "rss")
  fs.mkdirSync(outDir, { recursive: true })
  const r = spawnSync(CC, ["-O2", path.join(benchDir, "rss.c"), "-o", exe], { encoding: "utf8" })
  if (r.status !== 0) {
    console.error(`note: bench/rss.c did not build; the memory table is skipped\n${r.stderr}`)
  }
  return r.status === 0 ? exe : null
})()
if (!RUSTC && opts.rust) {
  console.error("note: rustc not found; Rust columns are skipped (set RUSTC=<path> or install rustup)")
}
if (!GO && opts.go) {
  console.error("note: the go tool was not found; Go columns are skipped (set GO=<path> or install Go)")
}

// ---- Build ----------------------------------------------------------------------------

const SPEED = ["-C", "opt-level=3", "-C", "panic=abort", "-C", "codegen-units=1", "-C", "strip=symbols"]

/**
 * Copy a source into `dir` (build/bench/src), rewriting the number on its
 * `bench:n` line when a size override is given.
 */
const prepare = (file, size, dir = srcDir) => {
  let text = fs.readFileSync(path.join(benchDir, file), "utf8")
  if (size !== undefined) {
    const lines = text.split("\n")
    const at = lines.findIndex((l) => l.includes("bench:n"))
    if (at < 0) {
      fail(`${file} has no \`bench:n\` line to override`)
    }
    lines[at] = lines[at].replace(/\b\d+\b/, size)
    text = lines.join("\n")
  }
  const dst = path.join(dir, file)
  fs.writeFileSync(dst, text)
  return dst
}

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    console.error(`${what}: ${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r
}

/**
 * Build every variant of one benchmark. A variant is { id, label, exe, cmd,
 * timed, integerOnly }: `timed` variants appear in the time table, the rest
 * (the size-profile binary) only in the size table.
 */
const build = (bench) => {
  const size = opts.sizes.get(bench.name)
  const ts = prepare(`${bench.name}.ts`, size)
  const c = prepare(`${bench.name}.c`, size)
  const rs = fs.existsSync(path.join(benchDir, `${bench.name}.rs`)) ? prepare(`${bench.name}.rs`, size) : null
  const go = fs.existsSync(path.join(benchDir, `${bench.name}.go`)) ? prepare(`${bench.name}.go`, size) : null
  const rel = (p) => path.relative(root, p)
  const variants = []
  const modeFlags = sourceArgs(bench.name)

  const nish = (id, label, extra, profile, timed) => {
    const exe = path.join(outDir, `${bench.name}-${id}`)
    const args = [rel(ts), ...modeFlags, ...extra, "--link", rel(exe), "--profile", profile]
    run(nishc.cmd, [...nishc.prefix, ...args], `${bench.name}/${id}`)
    variants.push({ id, label, exe, timed, cmd: `nish ${args.join(" ")}` })
  }
  nish("nish", "Nish", [], "speed", true)
  if (bench.integer) {
    nish("nish-wrapping", "Nish --wrapping", ["--wrapping"], "speed", true)
  }
  nish("nish-size", "Nish (size profile)", [], "size", false)

  const cc = (id, label, source) => {
    const exe = path.join(outDir, `${bench.name}-${id}`)
    const args = ["-O3", "-s", rel(source), "-lm", "-o", rel(exe)]
    run(CC, args, `${bench.name}/${id}`)
    variants.push({ id, label, exe, timed: true, cmd: `${path.basename(CC)} ${args.join(" ")}` })
  }
  cc("c", "C -O3", c)
  for (const extra of bench.extraC ?? []) {
    cc(
      `c-${extra.replace(`${bench.name}_`, "")}`,
      `C -O3 (${extra.replace(`${bench.name}_`, "")})`,
      prepare(`${extra}.c`, size)
    )
  }

  if (RUSTC && rs) {
    const rustc = (id, label, extra) => {
      const exe = path.join(outDir, `${bench.name}-${id}`)
      const args = [...SPEED, ...extra, rel(rs), "-o", rel(exe)]
      run(RUSTC, args, `${bench.name}/${id}`)
      variants.push({ id, label, exe, timed: true, cmd: `rustc ${args.join(" ")}` })
    }
    rustc("rust", "Rust -O3", [])
    rustc("rust-native", "Rust -O3 native", ["-C", "target-cpu=native"])
  }

  // `go build` is always -O-equivalent: the gc compiler has one optimisation
  // level. `-trimpath` keeps the binary independent of build/bench/src, and
  // `-ldflags=-s -w` strips it as every other column is stripped.
  if (GO && go) {
    const exe = path.join(outDir, `${bench.name}-go`)
    const args = ["build", "-trimpath", "-ldflags=-s -w", "-o", rel(exe), rel(go)]
    run(GO, args, `${bench.name}/go`)
    variants.push({ id: "go", label: "Go", exe, timed: true, cmd: `go ${args.join(" ")}` })
  }
  return variants
}

// ---- Run and compare ------------------------------------------------------------------

/** Run once; returns { ms, stdout }. Exit status other than 0 is a failure. */
const timeOnce = (exe, args = [], env = process.env) => {
  const t0 = process.hrtime.bigint()
  const r = spawnSync(exe, args, { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] })
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  if (r.status !== 0) {
    console.error(`${exe} exited with ${r.status}\n${r.stderr}`)
    process.exit(1)
  }
  return { ms, stdout: r.stdout }
}

/** Peak resident set in KB (see bench/rss.c), or null when the helper is unavailable. */
const peakRssKb = (exe, args = []) => {
  if (!RSS_HELPER) {
    return null
  }
  const r = spawnSync(RSS_HELPER, [exe, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  const m = r.stdout.trim()
  return r.status === 0 && /^\d+$/.test(m) ? Number(m) : null
}

/**
 * `exe args` run `--warmup` times and then `--runs` times (once under
 * `--validate`): { min, median } of the timed runs in ms, the peak RSS of one
 * more run (null under `--validate`), and the last run's stdout.
 */
const timeRuns = (exe, args = []) => {
  const times = []
  let stdout = ""
  const total = opts.validate ? 1 : opts.warmup + opts.runs
  for (let i = 0; i < total; i++) {
    const r = timeOnce(exe, args)
    stdout = r.stdout
    if (i >= opts.warmup || opts.validate) {
      times.push(r.ms)
    }
  }
  return {
    min: Math.min(...times),
    median: median(times),
    rss: opts.validate ? null : peakRssKb(exe, args),
    stdout,
  }
}

/** Token-wise comparison; numbers agree when within 1e-9 relative (or 1e-12 absolute). */
const sameOutput = (a, b) => {
  const ta = a.trim().split(/\s+/)
  const tb = b.trim().split(/\s+/)
  if (ta.length !== tb.length) {
    return false
  }
  return ta.every((x, i) => {
    const y = tb[i]
    const nx = Number(x)
    const ny = Number(y)
    if (Number.isFinite(nx) && Number.isFinite(ny) && x !== "" && y !== "") {
      return Math.abs(nx - ny) <= Math.max(1e-12, 1e-9 * Math.max(Math.abs(nx), Math.abs(ny)))
    }
    return x === y
  })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// ---- Instruction counts -------------------------------------------------------------------

/**
 * Build the AWFY harness into `dir` exactly as the timing mode does: checked,
 * `--profile speed` and nothing else. Answers the executable's path.
 */
const buildAwfy = (dir) => {
  const exe = path.join(dir, "awfy-harness")
  const args = [
    "bench/awfy/main.ts",
    "-o",
    `${path.relative(root, path.join(dir, "awfy"))}/`,
    "--link",
    path.relative(root, exe),
    "--profile",
    "speed",
  ]
  run(nishc.cmd, [...nishc.prefix, ...args], "awfy")
  return exe
}

const BASELINE_FILE = path.join(benchDir, "instructions.json")

/**
 * The one environment variable a counted run is given. glibc picks its
 * `memcpy` and `memset` by the CPU it finds and switches strategy at
 * thresholds taken from the cache sizes, and each choice executes a different
 * number of instructions for the same copy: left alone, strbuild counted 30%
 * fewer with ERMS switched off than with it on. These tunables take every host
 * to the SSE2 baseline routines with no `rep movsb`/`rep stosb` and no
 * non-temporal path, so a count measured on one x86-64 machine holds on
 * another. It changes which libc routine runs, never the program's own code.
 */
const PINNED_LIBC = [
  "glibc.cpu.hwcaps=-AVX_Fast_Unaligned_Load,-AVX2,-AVX512F,-AVX512VL,-ERMS,-FSRM,-SSSE3",
  "glibc.cpu.x86_non_temporal_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_movsb_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_stosb_threshold=0x0fffffffffffffff",
].join(":")

/**
 * The runtime's own choice, pinned the same way. runtime/runtime-simd.c picks a
 * scalar, a baseline vector or an AVX2 path on a kernel's first call, by the
 * CPU it finds, and each path runs a different number of instructions for the
 * same search. `base` is the SSE2 path every x86-64 machine has, as
 * `PINNED_LIBC` is glibc's, so the count does not depend on whether the host
 * has AVX2. A program that never calls a kernel never reads it.
 */
const PINNED_SIMD = "base"

/** How far `count` is from `base`, as a fraction of `base`: positive when it runs more. */
const change = (count, base) => (count - base) / base

/**
 * The instructions one run executes, counted by cachegrind over the whole
 * process: the dynamic loader and libc's start-up included, because nothing
 * separates them from the program's own code in a stripped `--profile speed`
 * binary on a host without libc's debug symbols. They are about 120 thousand
 * of a count in the hundreds of millions. What varies with the host is pinned
 * instead: the child's environment is `PINNED_LIBC`, `PINNED_SIMD` and nothing
 * else, and its argv[0] is relative (`./fib`, run from its own directory), so neither the
 * caller's variables nor the checkout's path reach the loader. bench/README.md
 * has the measurements that show what is left.
 */
const countInstructions = (valgrind, exe, args, name) => {
  const dir = path.dirname(exe)
  const out = path.join(dir, `${name}.cachegrind`)
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
      env: { GLIBC_TUNABLES: PINNED_LIBC, NISH_SIMD: PINNED_SIMD },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  if (r.status !== 0) {
    console.error(
      `${name}: cachegrind ${exe} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`
    )
    process.exit(1)
  }
  const m = fs.readFileSync(out, "utf8").match(/^summary: (\d+)$/m)
  if (!m) {
    fail(`${name}: no summary line in ${path.relative(root, out)}`)
  }
  return Number(m[1])
}

/**
 * `--instructions`: build the seven bench/ programs, the four map layout
 * prototypes, the three `Map` measurements and the seven AWFY ports at the
 * sizes bench/instructions.json names, count each run, and print the counts against the baseline. `--check` fails on any count above it by more than the
 * tolerance, and `--update` writes the counts back. Answers the exit status.
 */
const runInstructions = () => {
  const valgrind = which("valgrind")
  if (!valgrind) {
    fail("--instructions needs valgrind on PATH (Linux only; see bench/README.md)")
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  const host = `${process.platform}-${process.arch}`
  if ((opts.check || opts.update) && host !== baseline.platform) {
    fail(
      `the baseline is counted on ${baseline.platform}, so this ${host} host can neither check nor update it`
    )
  }
  const names = [
    ...BENCHMARKS.map((b) => b.name),
    ...MAPS.map((b) => b.name),
    ...MAP_MEASURES.map((b) => b.name),
    ...AWFY.map((b) => b.name),
  ]
  const listed = Object.keys(baseline.programs)
  if (listed.join(",") !== names.join(",")) {
    fail(`bench/instructions.json must list ${names.join(", ")} in that order; it lists ${listed.join(", ")}`)
  }
  // `awfy` and `maps` name their whole group, as they do outside --instructions.
  const wanted = (name, group) => !opts.only || opts.only.has(name) || (group !== "" && opts.only.has(group))
  for (const name of opts.only ?? []) {
    if (name !== "awfy" && name !== "maps" && !names.includes(name)) {
      fail(`unknown benchmark \`${name}\``)
    }
  }

  const dir = path.join(outDir, "instructions")
  const src = path.join(dir, "src")
  fs.mkdirSync(src, { recursive: true })
  const rel = (p) => path.relative(root, p)
  const jobs = [] // { name, size, exe, args }
  process.stderr.write("instructions: building")
  const programs = [
    ...BENCHMARKS.filter((x) => wanted(x.name, "")),
    ...[...MAPS, ...MAP_MEASURES].filter((x) => wanted(x.name, "maps")),
  ]
  for (const b of programs) {
    const n = baseline.programs[b.name].n
    const ts = prepare(`${b.name}.ts`, String(n), src)
    const exe = path.join(dir, b.name)
    run(
      nishc.cmd,
      [...nishc.prefix, rel(ts), ...sourceArgs(b.name), "--link", rel(exe), "--profile", "speed"],
      `${b.name}/instructions`
    )
    jobs.push({ name: b.name, size: `n=${n}`, exe, args: [] })
    process.stderr.write(".")
  }
  const awfy = AWFY.filter((b) => wanted(b.name, "awfy"))
  if (awfy.length > 0) {
    const exe = buildAwfy(dir)
    for (const b of awfy) {
      const inner = baseline.programs[b.name].inner
      jobs.push({ name: b.name, size: `inner=${inner}`, exe, args: [b.name, "1", String(inner)] })
    }
  }
  process.stderr.write(" ok; counting")

  const runs = opts.runsGiven ? opts.runs : 1
  const rows = []
  for (const job of jobs) {
    const counts = []
    for (let i = 0; i < runs; i++) {
      counts.push(countInstructions(valgrind, job.exe, job.args, job.name))
    }
    const count = median(counts)
    const base = baseline.programs[job.name].instructions
    const spread = Math.max(...counts) - Math.min(...counts)
    rows.push({ ...job, count, spread, base, change: change(count, base) })
    process.stderr.write(".")
  }
  process.stderr.write("\n")

  const tolerance = baseline.tolerance
  const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(3)}%`
  const num = (x) => x.toLocaleString("en-US")
  // An update reports what it moves; a check reports what it would fail.
  const [above, below, within] = opts.update ? ["raised", "lowered", "kept"] : ["REGRESSED", "below", "ok"]
  const status = (r) => {
    if (r.change > tolerance) {
      return above
    }
    return r.change < -tolerance ? below : within
  }
  // `npm test` only ever sees this check pass, so the failing side is proved
  // here on every run: a count twice the tolerance above a baseline has to
  // regress, one twice below has to be a gain, and the baseline itself has to
  // pass. An inverted comparison would otherwise stay green for ever.
  if (opts.check) {
    const base = 100_000_000
    const off = Math.ceil(base * tolerance * 2)
    const probes = [
      [base + off, above],
      [base - off, below],
      [base, within],
    ]
    for (const [count, want] of probes) {
      const got = status({ change: change(count, base) })
      if (got !== want) {
        fail(`--check's own comparison is broken: ${count} against ${base} reads ${got}, not ${want}`)
      }
    }
  }
  console.log(
    `instructions: ${version(valgrind)} cachegrind, whole process, --profile speed; tolerance ${pct(tolerance)}`
  )
  const width = Math.max(12, ...rows.map((r) => r.name.length + 2))
  console.log(
    `${"program".padEnd(width)}${"size".padEnd(12)}${"instructions".padStart(16)}${"baseline".padStart(16)}${"change".padStart(10)}${runs > 1 ? `${"spread".padStart(8)}` : ""}  status`
  )
  for (const r of rows) {
    const spread = runs > 1 ? String(r.spread).padStart(8) : ""
    console.log(
      `${r.name.padEnd(width)}${r.size.padEnd(12)}${num(r.count).padStart(16)}${num(r.base).padStart(16)}${pct(r.change).padStart(10)}${spread}  ${status(r)}`
    )
  }

  if (opts.update) {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
    const valgrindVersion = version(valgrind)
    // The file's `commit` and `valgrind` say where every count was measured, so
    // only an update of every program restamps them. An `--only` update stamps
    // the programs it counted instead, and a later full update clears those.
    const partial = rows.length < names.length
    for (const r of rows) {
      const p = baseline.programs[r.name]
      p.instructions = r.count
      if (partial) {
        p.commit = commit
        p.valgrind = valgrindVersion
      }
    }
    if (!partial) {
      baseline.valgrind = valgrindVersion
      baseline.commit = commit
      for (const p of Object.values(baseline.programs)) {
        delete p.commit
        delete p.valgrind
      }
    }
    // One program to a line, so a diff of the file reads as the table above.
    const { programs: baselinePrograms, ...header } = baseline
    const entry = (p) =>
      `{ ${Object.entries(p)
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join(", ")} }`
    const body = Object.entries(baselinePrograms).map(
      ([name, p]) => `    ${JSON.stringify(name)}: ${entry(p)}`
    )
    fs.writeFileSync(
      BASELINE_FILE,
      JSON.stringify(header, null, 2).replace(/\n}$/, `,\n  "programs": {\n${body.join(",\n")}\n  }\n}\n`)
    )
    console.log(
      `wrote ${rel(BASELINE_FILE)}: ${rows.length} count(s); say why in the pull request that carries it`
    )
    return 0
  }
  for (const r of rows.filter((x) => status(x) === below)) {
    console.log(
      `note: ${r.name} runs ${pct(r.change)} against its baseline; \`--instructions --update\` locks the gain in`
    )
  }
  const regressed = rows.filter((r) => status(r) === above)
  if (!opts.check) {
    return 0
  }
  if (regressed.length > 0) {
    console.log(
      `instructions: ${regressed.length} of ${rows.length} above ${rel(BASELINE_FILE)} by more than ${pct(tolerance)}: ${regressed.map((r) => r.name).join(", ")}`
    )
    return 1
  }
  console.log(`instructions: all ${rows.length} within ${pct(tolerance)} of ${rel(BASELINE_FILE)}`)
  return 0
}

// ---- Main --------------------------------------------------------------------------------

if (opts.instructions) {
  process.exit(runInstructions())
}

fs.mkdirSync(srcDir, { recursive: true })
const selected = BENCHMARKS.filter((b) => !opts.only || opts.only.has(b.name))
const selectedParallel = PARALLEL.filter((b) => !opts.only || opts.only.has(b.name) || opts.only.has("par"))
const known = (name) =>
  name === "awfy" ||
  name === "par" ||
  name === "maps" ||
  BENCHMARKS.some((b) => b.name === name) ||
  PARALLEL.some((b) => b.name === name) ||
  MAPS.some((b) => b.name === name) ||
  MAP_MEASURES.some((b) => b.name === name)
if (opts.only) {
  for (const name of opts.only) {
    if (!known(name)) {
      fail(`unknown benchmark \`${name}\``)
    }
  }
}

/** Whether `--only` asks for a map program: `maps` names all seven, and no `--only` runs them with the rest. */
const mapWanted = (name) => !opts.only || opts.only.has("maps") || opts.only.has(name)
const mapsSelected = [...MAPS, ...MAP_MEASURES].some((b) => mapWanted(b.name))

/**
 * The AWFY ports: build the harness checked, the compiler's default, then run
 * each benchmark once with one inner iteration (`--validate`) or time it. A
 * wrong result is the port's own `verifyResult` failing, which panics, so a
 * nonzero exit is the whole check.
 */
const runAwfy = () => {
  process.stderr.write("awfy: building")
  const exe = buildAwfy(outDir)
  process.stderr.write(" ok; running\n")
  const rows = []
  for (const b of AWFY) {
    const [iterations, inner] = opts.validate ? [1, 1] : [AWFY_ITERATIONS, b.inner]
    const r = run(exe, [b.name, String(iterations), String(inner)], `awfy ${b.name}`)
    const times = [...r.stdout.matchAll(/^\S+: iterations=1 runtime: (\d+)us$/gm)].map(
      (m) => Number(m[1]) / 1000
    )
    if (times.length !== iterations) {
      fail(`awfy ${b.name}: ${times.length} of ${iterations} iterations timed\n${r.stdout}`)
    }
    if (opts.validate) {
      continue
    }
    const kept = times.slice(-AWFY_KEPT)
    rows.push({ ...b, median: median(kept), min: Math.min(...kept), max: Math.max(...kept) })
  }
  if (opts.validate) {
    console.log(`awfy: ${AWFY.length} benchmarks verified (${AWFY.map((b) => b.name).join(", ")})`)
    return
  }
  const ms = (x) => x.toFixed(1).padStart(10)
  console.log(
    `\nAre We Fast Yet: median, min and max of the last ${AWFY_KEPT} of ${AWFY_ITERATIONS} iterations (ms)`
  )
  console.log(
    `${"benchmark".padEnd(12)}${"inner".padStart(7)}${"median".padStart(10)}${"min".padStart(10)}${"max".padStart(10)}`
  )
  for (const r of rows) {
    console.log(`${r.name.padEnd(12)}${String(r.inner).padStart(7)}${ms(r.median)}${ms(r.min)}${ms(r.max)}`)
  }
}
if (opts.only?.has("awfy")) {
  runAwfy()
  if (selected.length === 0 && selectedParallel.length === 0 && !mapsSelected) {
    process.exit(0)
  }
}

/** A time in ms as the report prints it. */
const fmt = (ms) => {
  if (ms >= 100) {
    return ms.toFixed(0)
  }
  return ms >= 10 ? ms.toFixed(1) : ms.toFixed(2)
}

/**
 * The map programs at one size (`undefined` keeps each file's own): build each
 * native one with `--profile speed`, and require its checksum lines to be its
 * twin's, and every line to be one bench/map-node.mjs prints, so that each
 * workload is §2's. Unless `--validate`, time every column `--warmup` +
 * `--runs` times, the columns interleaved round by round so that a slow
 * stretch of a shared machine falls on all of them. A column is one process
 * per run: a prototype with `time`, a measurement with `time <variant>`, which
 * print `time <workload> <kind>[ <variant>] <ns>` to stderr per workload.
 * Answers the Markdown for comparisons (a) to (d), each cell `min / median`.
 */
const mapsAtSize = (size) => {
  const rel = (p) => path.relative(root, p)
  const buildMapProgram = (name) => {
    process.stderr.write(`${name}: building`)
    const ts = prepare(`${name}.ts`, size)
    const exe = path.join(outDir, name)
    run(
      nishc.cmd,
      [...nishc.prefix, rel(ts), ...sourceArgs(name), "--link", rel(exe), "--profile", "speed"],
      name
    )
    process.stderr.write(" ok\n")
    return exe
  }
  const protos = MAPS.filter((b) => mapWanted(b.name)).map((b) => ({ ...b, exe: buildMapProgram(b.name) }))
  const measures = MAP_MEASURES.filter((b) => mapWanted(b.name)).map((b) => ({
    ...b,
    exe: buildMapProgram(b.name),
    twinFile: prepare(`${b.twin}.mjs`, size),
  }))
  const node = prepare(`${MAPS_NODE}.mjs`, size)
  const reference = run(process.execPath, [node], MAPS_NODE).stdout
  const knownLines = new Set(reference.trim().split("\n"))

  let disagree = 0
  const mismatch = (what, want, wantName, got) => {
    disagree++
    console.error(`CHECKSUM MISMATCH ${what}:\n--- ${wantName}\n${want}--- ${what}\n${got}`)
  }
  for (const p of protos) {
    const out = run(p.exe, [], p.name).stdout
    if (out !== reference) {
      mismatch(p.name, reference, MAPS_NODE, out)
    }
  }
  for (const m of measures) {
    const out = run(m.exe, [], m.name).stdout
    const twin = run(process.execPath, [m.twinFile], m.twin).stdout
    if (out !== twin) {
      mismatch(m.name, twin, `${m.twin}.mjs`, out)
    } else if (
      out === "" ||
      !out
        .trim()
        .split("\n")
        .every((l) => knownLines.has(l))
    ) {
      mismatch(m.name, reference, MAPS_NODE, out)
    }
  }
  if (disagree > 0) {
    console.error(`${disagree} map program(s) disagree with Node's Map`)
    process.exit(1)
  }
  const workloads = reference
    .trim()
    .split("\n")
    .map((l) => l.split(" ").slice(0, 2).join(" "))
  if (opts.validate) {
    console.log(
      `maps: ${protos.length} prototype(s) and ${measures.length} measurement(s) agree with Node's Map over ${workloads.length} workloads`
    )
    for (const line of reference.trim().split("\n")) {
      console.log(`  ${line}`)
    }
    return []
  }

  const columns = [
    ...protos.map((p) => ({ key: p.name, cmd: p.exe, args: ["time"] })),
    { key: MAPS_NODE, cmd: process.execPath, args: [node, "time"] },
  ]
  for (const m of measures) {
    for (const v of m.variants) {
      columns.push({ key: `${m.name}:${v}`, cmd: m.exe, args: ["time", v] })
      if (m.twin !== MAPS_NODE) {
        columns.push({ key: `${m.twin}.mjs:${v}`, cmd: process.execPath, args: [m.twinFile, "time", v] })
      }
    }
  }
  for (const c of columns) {
    c.samples = new Map()
  }
  process.stderr.write(`maps: timing ${columns.length} columns at n = ${size ?? "default"}`)
  for (let i = 0; i < opts.warmup + opts.runs; i++) {
    for (const c of columns) {
      const r = spawnSync(c.cmd, c.args, { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] })
      if (r.status !== 0) {
        fail(`${c.key} ${c.args.join(" ")} exited with ${r.status}\n${r.stderr}`)
      }
      if (i < opts.warmup) {
        continue
      }
      for (const [, workload, ns] of r.stderr.matchAll(/^time (\S+ \S+)(?: \S+)? (\d+)$/gm)) {
        if (!c.samples.has(workload)) {
          c.samples.set(workload, [])
        }
        c.samples.get(workload).push(Number(ns) / 1e6)
      }
    }
    process.stderr.write(".")
  }
  process.stderr.write("\n")
  const presize = measures.find((m) => m.name === "map-presize")
  const rss = new Map(presize ? presize.variants.map((v) => [v, peakRssKb(presize.exe, [v])]) : [])

  /** `{ min, median }` of column `key` on `workload`, or null when it did not run there. */
  const cell = (key, workload) => {
    const xs = columns.find((c) => c.key === key)?.samples.get(workload)
    return xs && xs.length > 0 ? { min: Math.min(...xs), median: median(xs) } : null
  }
  const noisy = new Set() // `column on workload`, once however many tables show the cell
  const lines = []
  const table = (title, rows, cols, ratioColumns) => {
    lines.push(`**${title}**`, "")
    lines.push(`| workload | ${[...cols.map(([, l]) => l), ...ratioColumns.map(([l]) => l)].join(" | ")} |`)
    lines.push(`| --- | ${[...cols, ...ratioColumns].map(() => "---:").join(" | ")} |`)
    for (const w of rows) {
      const cells = cols.map(([key]) => {
        const c = cell(key, w)
        if (c === null) {
          return ""
        }
        if (c.median > c.min * 1.05) {
          noisy.add(`${key} on ${w}`)
        }
        return `${fmt(c.min)} / ${fmt(c.median)}`
      })
      const quotients = ratioColumns.map(([, num, den]) => {
        const a = cell(num, w)
        const b = cell(den, w)
        return a && b ? `${(a.min / b.min).toFixed(2)}x` : ""
      })
      lines.push(`| ${w} | ${[...cells, ...quotients].join(" | ")} |`)
    }
    lines.push("")
  }
  const counts = workloads.filter((w) => w.startsWith("count "))
  const inserts = workloads.filter((w) => w.startsWith("insert "))
  lines.push(`### n = ${Number(size ?? 65536).toLocaleString("en-US")}`, "")
  table(
    "(a) the four layout prototypes",
    workloads,
    [...MAPS.map((b) => [b.name, b.label]), [MAPS_NODE, "Node `Map`"]],
    [
      ["u32 fp / unordered", "map-proto-ordered-fp32", "map-proto-unordered"],
      ["u32 fp / Node", "map-proto-ordered-fp32", MAPS_NODE],
    ]
  )
  table(
    "(b) word count: fused against double lookup",
    counts,
    [
      ["map-wordcount:fused", "`Map` fused"],
      ["map-wordcount:double", "`Map` double"],
      ["map-proto-unordered", "unordered"],
      ["map-wordcount.mjs:fused", "Node fused"],
      ["map-wordcount.mjs:double", "Node double"],
    ],
    [
      ["double / fused", "map-wordcount:double", "map-wordcount:fused"],
      ["fused / unordered", "map-wordcount:fused", "map-proto-unordered"],
      ["fused / Node fused", "map-wordcount:fused", "map-wordcount.mjs:fused"],
    ]
  )
  table(
    "(c) insert: presized with `reserve` against growing",
    inserts,
    [
      ["map-presize:grow", "`Map` growing"],
      ["map-presize:reserve", "`Map` `reserve`"],
      ["map-proto-unordered", "unordered"],
      ["map-presize.mjs:grow", "Node growing"],
      ["map-presize.mjs:reserve", "Node `reserve`"],
    ],
    [
      ["growing / reserve", "map-presize:grow", "map-presize:reserve"],
      ["reserve / unordered", "map-presize:reserve", "map-proto-unordered"],
      ["reserve / Node", "map-presize:reserve", "map-presize.mjs:grow"],
    ]
  )
  if (rss.size > 0) {
    const kb = (v) => (rss.get(v) != null ? `${rss.get(v).toLocaleString("en-US")} KB` : "not measured")
    lines.push(
      `Peak RSS of \`map-presize\` running one variant alone (whole process, both key sets included): growing ${kb("grow")}, \`reserve\` ${kb("reserve")}.`,
      ""
    )
  }
  table(
    "(d) the global `Map` against `StringMap`",
    workloads,
    [
      ["map-vs-stringmap:map", "`Map`"],
      ["map-vs-stringmap:stringmap", "`StringMap`"],
      ["map-proto-unordered", "unordered"],
      [MAPS_NODE, "Node `Map`"],
    ],
    [
      ["`Map` / `StringMap`", "map-vs-stringmap:map", "map-vs-stringmap:stringmap"],
      ["`Map` / unordered", "map-vs-stringmap:map", "map-proto-unordered"],
      ["`Map` / Node", "map-vs-stringmap:map", MAPS_NODE],
    ]
  )
  lines.push(
    noisy.size === 0
      ? "Every cell's median is within 5% of its minimum."
      : `Of ${columns.length} columns by their workloads, ${noisy.size} cell(s) have a median more than 5% above their minimum: ${[...noisy].join(", ")}.`,
    ""
  )
  return lines
}

/** The map programs at every size asked for: the tables' Markdown, or nothing under `--validate`. */
const runMaps = () => {
  const given = opts.sizes.get("maps")
  if (given !== undefined && (Number(given) < 16 || (Number(given) & (Number(given) - 1)) !== 0)) {
    fail(
      `--n maps=${given}: the map programs draw keys by masking, so the size is a power of two, 16 or more`
    )
  }
  let sizes = opts.validate ? [undefined] : MAP_SIZES
  if (given !== undefined) {
    sizes = [given]
  }
  const lines = sizes.flatMap(mapsAtSize)
  if (lines.length > 0) {
    console.log(`\n${lines.join("\n")}`)
  }
  return lines
}
const mapLines = mapsSelected ? runMaps() : []
if (opts.only && mapsSelected && selected.length === 0 && selectedParallel.length === 0) {
  process.exit(0)
}

/**
 * The data-parallel kernels: build each once, run it as the loop and as the
 * map, and require the same checksum from both. The speedup is the loop's
 * minimum over the map's. Nothing is compared across languages, so the C
 * reference the table above uses has no part here.
 */
const runParallel = () => {
  const rows = []
  let disagree = 0
  for (const bench of selectedParallel) {
    process.stderr.write(`${bench.name}: building`)
    const ts = prepare(`${bench.name}.ts`, opts.sizes.get(bench.name))
    const exe = path.join(outDir, bench.name)
    const args = [path.relative(root, ts), "--link", path.relative(root, exe), "--profile", "speed"]
    run(nishc.cmd, [...nishc.prefix, ...args], bench.name)
    process.stderr.write(" ok; running")
    const modes = { seq: timeRuns(exe, ["seq"]), par: timeRuns(exe, ["par"]) }
    if (!sameOutput(modes.seq.stdout, modes.par.stdout)) {
      disagree++
      console.error(
        `\nCHECKSUM MISMATCH ${bench.name}:\n--- seq\n${modes.seq.stdout}--- par\n${modes.par.stdout}`
      )
    }
    rows.push({ bench, exe, cmd: `nish ${args.join(" ")}`, ...modes })
    process.stderr.write("\n")
  }
  if (disagree > 0) {
    console.error(`${disagree} data-parallel kernel(s) print different checksums as the loop and as the map`)
    process.exit(1)
  }
  return rows
}
const parallelRows = runParallel()

// ---- Nish against Rust and Go on the data-parallel kernels ------------------------------

/**
 * The interleaved rounds the cross-language table times when `--runs` is not
 * given. Eleven is the floor docs/BENCHMARKS.md promises for it, so that the
 * median is the sixth run and not the average of two.
 */
const TWIN_ROUNDS = 11

/** The columns of the cross-language table, in order; a twin that did not build is left out. */
const TWIN_COLUMNS = [
  ["nish", "Nish"],
  ["rust", "Rust `thread::scope`"],
  ["rayon", "Rust Rayon"],
  ["go", "Go"],
]

/**
 * Build the Rayon twins as one cargo package in build/bench/rayon, with the
 * profile the rustc twins get on the command line. Answers { exes, version,
 * cmd }, or null after saying why, so that a machine with no cargo, or no way
 * to reach crates.io, still times the other columns.
 */
const buildRayon = (kernels) => {
  if (!CARGO) {
    if (opts.rust && opts.rayon) {
      console.error("note: cargo not found; the Rayon column is skipped (set CARGO=<path> or install rustup)")
    }
    return null
  }
  const dir = path.join(outDir, "rayon")
  fs.mkdirSync(path.join(dir, "src"), { recursive: true })
  const bins = kernels.map((k) => {
    prepare(`${k.name}-rayon.rs`, opts.sizes.get(k.name), path.join(dir, "src"))
    return `[[bin]]\nname = "${k.name}-rayon"\npath = "src/${k.name}-rayon.rs"\n`
  })
  const manifest = path.join(dir, "Cargo.toml")
  fs.writeFileSync(
    manifest,
    [
      '[package]\nname = "nish-par-rayon"\nversion = "0.0.0"\nedition = "2021"\npublish = false\n',
      // An empty workspace keeps cargo from looking above build/ for one.
      "[workspace]\n",
      // Pinned, so a rerun next year builds the Rayon the table was measured with.
      '[dependencies]\nrayon = "=1.12.0"\n',
      '[profile.release]\nopt-level = 3\npanic = "abort"\ncodegen-units = 1\nstrip = "symbols"\n',
      ...bins,
    ].join("\n")
  )
  const args = ["build", "--release", "--quiet", "--manifest-path", path.relative(root, manifest)]
  const r = spawnSync(CARGO, args, { cwd: root, encoding: "utf8" })
  if (r.status !== 0) {
    const why =
      r.stderr
        .trim()
        .split("\n")
        .find((l) => l.includes("error")) ?? `exit ${r.status}`
    console.error(`note: the Rayon twins did not build (${why}); the Rayon column is skipped`)
    return null
  }
  const lock = fs.readFileSync(path.join(dir, "Cargo.lock"), "utf8")
  const rayonVersion = lock.match(/name = "rayon"\nversion = "([^"]+)"/)?.[1] ?? "unknown"
  return {
    exes: new Map(kernels.map((k) => [k.name, path.join(dir, "target", "release", `${k.name}-rayon`)])),
    version: rayonVersion,
    cmd: `cargo ${args.join(" ")}`,
  }
}

/** `n` as a percentage with one decimal. */
const pct1 = (n) => `${(n * 100).toFixed(1)}%`

/**
 * The threads Nish's runtime divides over on this machine: the CPUs this
 * process may run on, lowered by the cgroup v2 quota of its cgroup or any
 * above it (`nish_cpu_count` in runtime/runtime-parallel.c), and at most 64,
 * its 63 workers and the caller. Every twin is handed the same count, so no
 * column wins by using more threads than Nish does.
 */
const THREADS = cgroupCpus(Math.min(os.availableParallelism(), 64))

/**
 * Time every kernel with twins against its Rust and Go ports, `--twin-runs`
 * times over. Each binary is copied byte for byte, and in each round every
 * binary and every copy runs once, in an order rotated by one per round, so
 * that a slow stretch of the machine lands on all of them alike. A run times
 * every kernel before the next run starts, so the runs are minutes apart and
 * their spread is the machine's run-to-run variation. Every binary is handed
 * THREADS, and every twin must print the checksum the Nish `par` run prints.
 * Answers null when there is nothing to compare with.
 */
const runParallelTwins = () => {
  const kernels = parallelRows.filter((r) => r.bench.twins)
  if (kernels.length === 0) {
    return null
  }
  if (!RUSTC && !GO) {
    console.error(
      "note: no rustc and no go (looked on PATH, in ~/.cargo/bin and in /usr/local/go/bin, unless --no-rust and --no-go were given); the table of Nish against Rust and Go is not measured, and a report that has one keeps it"
    )
    return null
  }
  const rayon = RUSTC ? buildRayon(kernels.map((r) => r.bench)) : null
  const rounds = opts.runsGiven ? opts.runs : TWIN_ROUNDS
  const passes = opts.validate ? 1 : opts.twinRuns
  const count = String(THREADS)
  const env = {
    ...process.env,
    NISH_NUM_THREADS: count,
    RAYON_NUM_THREADS: count,
    GOMAXPROCS: count,
    PAR_THREADS: count,
  }
  const rel = (p) => path.relative(root, p)
  const built = kernels.map((kernel) => {
    const name = kernel.bench.name
    const size = opts.sizes.get(name)
    process.stderr.write(`${name}: building the Rust and Go twins`)
    const variants = [{ id: "nish", exe: kernel.exe, args: ["par"], cmd: kernel.cmd }]
    if (RUSTC) {
      const exe = path.join(outDir, `${name}-rust`)
      const args = [...SPEED, "--edition", "2021", rel(prepare(`${name}.rs`, size)), "-o", rel(exe)]
      run(RUSTC, args, `${name}/rust`)
      variants.push({ id: "rust", exe, args: [], cmd: `rustc ${args.join(" ")}` })
    }
    if (rayon) {
      variants.push({ id: "rayon", exe: rayon.exes.get(name), args: [], cmd: rayon.cmd })
    }
    if (GO) {
      const exe = path.join(outDir, `${name}-go`)
      const args = ["build", "-trimpath", "-ldflags=-s -w", "-o", rel(exe), rel(prepare(`${name}.go`, size))]
      run(GO, args, `${name}/go`)
      variants.push({ id: "go", exe, args: [], cmd: `go ${args.join(" ")}` })
    }
    const binaries = variants.flatMap((v) => {
      const copy = `${v.exe}-copy`
      fs.copyFileSync(v.exe, copy)
      return [
        { key: v.id, exe: v.exe, args: v.args },
        { key: `${v.id}-copy`, exe: copy, args: v.args },
      ]
    })
    process.stderr.write(" ok\n")
    return {
      bench: kernel.bench,
      ids: variants.map((v) => v.id),
      cmds: variants.map((v) => v.cmd),
      checksum: "",
      binaries,
      all: new Map(binaries.map((b) => [b.key, []])),
      passes: [],
    }
  })
  let disagree = 0
  for (let pass = 0; pass < passes; pass++) {
    for (const k of built) {
      process.stderr.write(`${k.bench.name}: run ${pass + 1} of ${passes}`)
      const times = new Map(k.binaries.map((b) => [b.key, []]))
      const outputs = new Map()
      const warmup = opts.validate ? 0 : opts.warmup
      const total = opts.validate ? 1 : warmup + rounds
      for (let round = 0; round < total; round++) {
        for (let i = 0; i < k.binaries.length; i++) {
          const b = k.binaries[(i + round) % k.binaries.length]
          const t = timeOnce(b.exe, b.args, env)
          outputs.set(b.key, t.stdout)
          if (round >= warmup) {
            times.get(b.key).push(t.ms)
            k.all.get(b.key).push(t.ms)
          }
        }
        process.stderr.write(".")
      }
      process.stderr.write("\n")
      const want = outputs.get("nish")
      k.checksum = want
      for (const [key, got] of outputs) {
        if (!sameOutput(got, want)) {
          disagree++
          console.error(`CHECKSUM MISMATCH ${k.bench.name}/${key}:\n--- Nish\n${want}--- ${key}\n${got}`)
        }
      }
      const stats = new Map(
        [...times].map(([key, ms]) => [key, { min: Math.min(...ms), median: median(ms) }])
      )
      k.passes.push({ min: judge(stats, k.ids, "min"), median: judge(stats, k.ids, "median") })
    }
  }
  if (disagree > 0) {
    console.error(`${disagree} twin binaries print a different checksum from the Nish kernel they port`)
    process.exit(1)
  }
  const rows = built.map((k) => ({
    bench: k.bench,
    ids: k.ids,
    cmds: k.cmds,
    checksum: k.checksum,
    pooled: new Map(
      k.ids.map((id) => [id, { min: Math.min(...k.all.get(id)), median: median(k.all.get(id)) }])
    ),
    passes: k.passes,
  }))
  return { rows, rounds, passes, rayon }
}
const twins = runParallelTwins()

const results = [] // { bench, variants: [{ ...variant, min, median, bytes, rss, stdout }], reference }
let mismatches = 0
for (const bench of selected) {
  process.stderr.write(`${bench.name}: building`)
  const variants = build(bench)
  process.stderr.write(" ok; running")
  const reference = timeOnce(variants.find((v) => v.id === "c").exe).stdout
  for (const v of variants) {
    const timed = timeRuns(v.exe)
    const agrees = sameOutput(timed.stdout, reference)
    if (!agrees) {
      mismatches++
      console.error(
        `\nCHECKSUM MISMATCH ${bench.name}/${v.id}:\n--- C\n${reference}--- ${v.id}\n${timed.stdout}`
      )
    }
    Object.assign(v, { ...timed, bytes: fs.statSync(v.exe).size, agrees })
    process.stderr.write(".")
  }
  results.push({ bench, variants, reference })
  process.stderr.write("\n")
}

if (opts.validate) {
  const n = results.reduce((s, r) => s + r.variants.length, 0)
  if (mismatches) {
    console.error(`${mismatches} of ${n} binaries disagree with the C checksum`)
    process.exit(1)
  }
  console.log(
    `checksums agree: ${n} binaries over ${results.length} benchmark(s)${RUSTC ? "" : " (Rust skipped)"}${GO ? "" : " (Go skipped)"}`
  )
  for (const r of results) {
    console.log(
      `  ${r.bench.name}: ${r.reference.trim().split("\n").join(" ")}  [${r.variants.map((v) => v.id).join(", ")}]`
    )
  }
  for (const r of parallelRows) {
    console.log(`  ${r.bench.name}: ${r.seq.stdout.trim().split("\n").join(" ")}  [seq, par]`)
  }
  if (twins !== null) {
    const binaries = twins.rows.reduce((sum, r) => sum + r.ids.length, 0)
    console.log(`twins: ${binaries} binaries over ${twins.rows.length} kernel(s) print the Nish checksum`)
    for (const r of twins.rows) {
      console.log(`  ${r.bench.name}: [${r.ids.join(", ")}]`)
    }
  }
  process.exit(0)
}

// ---- Report ---------------------------------------------------------------------------------

const columns = [
  ["nish", "Nish"],
  ["nish-wrapping", "Nish `--wrapping`"],
  ["c", "C `-O3`"],
  ["c-naive", "C `-O3` naive"],
  ["go", "Go"],
  ["rust", "Rust `-O3`"],
  ["rust-native", "Rust native"],
].filter(([id]) => results.some((r) => r.variants.some((v) => v.id === id)))

/** One `Nish / <language>` column per reference language that ran. */
const ratios = [
  ["go", "Nish / Go"],
  ["rust", "Nish / Rust"],
].filter(([id]) => results.some((r) => r.variants.some((v) => v.id === id)))

/** Nish's minimum over `id`'s, as `N.NNx`, or "" when either is missing. */
const ratio = (result, id) => {
  const nish = result.variants.find((v) => v.id === "nish")
  const other = result.variants.find((v) => v.id === id)
  return nish && other ? `${(nish.min / other.min).toFixed(2)}x` : ""
}

const lines = []
const cpu = (() => {
  try {
    const m = fs.readFileSync("/proc/cpuinfo", "utf8").match(/^model name\s*:\s*(.+)$/m)
    return m ? m[1].trim() : (os.cpus()[0]?.model ?? "unknown")
  } catch {
    return os.cpus()[0]?.model ?? "unknown"
  }
})()
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()

/**
 * Where on `main` a measurement was taken. A commit on a branch is orphaned
 * when the branch is squash-merged, so a run off `main` names the `main`
 * commit its branch grew from, and the branch commit beside it.
 */
const mainStamp = (() => {
  const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" })
  if (git("merge-base", "--is-ancestor", "HEAD", "origin/main").status === 0) {
    return `commit ${commit} on \`main\``
  }
  const base = git("merge-base", "HEAD", "origin/main")
  if (base.status !== 0) {
    return `commit ${commit}`
  }
  const short = git("rev-parse", "--short", base.stdout.trim()).stdout.trim()
  return `\`main\` at ${short}, the base of the branch it was measured on (branch commit ${commit}, which a squash merge does not keep)`
})()

lines.push("# Benchmarks", "")
lines.push(
  "Generated by `node bench/run.mjs`, except the JSON section at the end, which `node bench/json-compare/run.mjs --record` writes; do not edit by hand. The programs, the rules and the analysis of every gap are in [bench/README.md](../bench/README.md) and [docs/wp9-optimisation.md](wp9-optimisation.md).",
  ""
)
lines.push("| | |", "| --- | --- |")
lines.push(`| Date | ${new Date().toISOString().slice(0, 10)} |`)
lines.push(`| nish | ${version(nishc.cmd, [...nishc.prefix, "--version"])} (commit ${commit}) |`)
lines.push(`| CPU | ${cpu}, ${os.cpus().length} logical cores |`)
lines.push(`| OS | ${os.platform()} ${os.release()} (${os.arch()}) |`)
lines.push(`| C | ${version(CC)} |`)
lines.push(`| Rust | ${RUSTC ? version(RUSTC) : "not installed (columns skipped)"} |`)
lines.push(`| Go | ${GO ? version(GO, ["version"]) : "not installed (columns skipped)"} |`)
lines.push(`| Node | ${process.version} |`)
lines.push(
  `| Runs | ${opts.runs} timed after ${opts.warmup} warm-up, wall time via \`process.hrtime.bigint\` around \`spawnSync\`; min and median in ms |`
)
lines.push("")

lines.push("## Wall time (ms, min / median)", "")
lines.push(
  `| Benchmark | ${columns.map(([, l]) => l).join(" | ")} | ${ratios.map(([, l]) => l).join(" | ")} |`
)
lines.push(`| --- | ${columns.map(() => "---:").join(" | ")} | ${ratios.map(() => "---:").join(" | ")} |`)
for (const r of results) {
  const cell = (id) => {
    const v = r.variants.find((x) => x.id === id)
    return v ? `${fmt(v.min)} / ${fmt(v.median)}` : ""
  }
  lines.push(
    `| ${r.bench.name} | ${columns.map(([id]) => cell(id)).join(" | ")} | ${ratios.map(([id]) => ratio(r, id)).join(" | ")} |`
  )
}
lines.push(
  "",
  "The ratio columns divide the Nish minimum by that language's minimum (Rust `-O3`, Go): 1.00x is parity, above 1.10x misses the WP9 target. Rust native is `-C target-cpu=native`; C is plain `-O3` without `-march`; Go has one optimisation level and always bounds-checks.",
  ""
)

lines.push("## Binary size (bytes, stripped)", "")
lines.push(
  "| Benchmark | Nish speed | Nish size | C `-O3` | Go | Rust `-O3` |",
  "| --- | ---: | ---: | ---: | ---: | ---: |"
)
for (const r of results) {
  const b = (id) => r.variants.find((v) => v.id === id)?.bytes.toLocaleString("en-US") ?? ""
  lines.push(`| ${r.bench.name} | ${b("nish")} | ${b("nish-size")} | ${b("c")} | ${b("go")} | ${b("rust")} |`)
}
lines.push(
  "",
  "Nish binaries link `runtime/runtime.c` statically and glibc dynamically; the Rust binaries carry `std` statically (`panic=abort`, `strip=symbols`) and the Go binaries their runtime, scheduler and garbage collector (`-ldflags=-s -w`).",
  ""
)

if (results.some((r) => r.variants.some((v) => v.rss !== null))) {
  lines.push("## Peak resident memory (KB)", "")
  lines.push(`| Benchmark | ${columns.map(([, l]) => l).join(" | ")} |`)
  lines.push(`| --- | ${columns.map(() => "---:").join(" | ")} |`)
  for (const r of results) {
    const cell = (id) => {
      const v = r.variants.find((x) => x.id === id)
      return v?.rss != null ? v.rss.toLocaleString("en-US") : ""
    }
    lines.push(`| ${r.bench.name} | ${columns.map(([id]) => cell(id)).join(" | ")} |`)
  }
  lines.push(
    "",
    "Peak RSS of one run (`ru_maxrss` from `wait4`, see `bench/rss.c`). String building used to hold every intermediate string until exit, because each `join` returns its result and the automatic arena scopes (WP6) cannot reclaim an escaping value; the call-site reclaim in `docs/wp9-optimisation.md` now frees a returned string's intermediates at the call.",
    ""
  )
}

// A run of the data-parallel kernels alone rewrites only their table, so the
// table says where it was measured; every other section keeps the machine and
// the commit in the header (`spliceSections`).
const partialNote =
  opts.only && results.length === 0
    ? ` This table alone was measured on ${new Date().toISOString().slice(0, 10)}, on ${cpu}, at ${mainStamp}, by \`node bench/run.mjs --only par\`; the rest of the file was measured on the machine in the header.`
    : ""
if (parallelRows.length > 0) {
  lines.push("## Data parallelism (ms, min / median)", "")
  lines.push(
    `Each kernel is one Nish binary, run as the loop a program writes without \`nish/threads\` (\`seq\`) and as \`parallelMapInto\` (\`par\`) on all ${os.cpus().length} logical cores, par-histogram as a scope of four tasks sharing a \`Mutex\`; the speedup is the loop's minimum over the map's. Both runs print the same checksum. The kernels are in \`bench/par-*.ts\`, and wp29 §8a reads the numbers. par-regions is what one divided region costs, and [wp20 §8e](wp20-threads.md#8e-what-a-region-costs-and-why-it-is-not-a-goroutine) has it before and after the worker pool.${partialNote}`,
    ""
  )
  lines.push(
    "| Kernel | What | Loop | `parallelMapInto` | Speedup | Peak RSS loop / map (KB) |",
    "| --- | --- | ---: | ---: | ---: | ---: |"
  )
  for (const r of parallelRows) {
    const rss =
      r.seq.rss !== null && r.par.rss !== null
        ? `${r.seq.rss.toLocaleString("en-US")} / ${r.par.rss.toLocaleString("en-US")}`
        : ""
    lines.push(
      `| ${r.bench.name} | ${r.bench.what} | ${fmt(r.seq.min)} / ${fmt(r.seq.median)} | ${fmt(r.par.min)} / ${fmt(r.par.median)} | ${(r.seq.min / r.par.min).toFixed(2)}x | ${rss} |`
    )
  }
  lines.push("")
}

/** A column's label in the twins' tables. */
const twinLabel = (id) => TWIN_COLUMNS.find(([c]) => c === id)[1]

const TWINS_HEADING = "## Data parallelism against Rust and Go (ms, min / median)"
if (twins !== null) {
  const present = TWIN_COLUMNS.filter(([id]) => twins.rows.some((r) => r.ids.includes(id)))
  const tool = (cmd, args) => (cmd ? version(cmd, args) : "not installed (column skipped)")
  const rayonNote = twins.rayon
    ? `Rayon ${twins.rayon.version}, built by cargo with the same profile`
    : "Rayon not built (no cargo, or crates.io out of reach: column skipped)"
  const n = twins.passes
  lines.push(TWINS_HEADING, "")
  lines.push(
    `Four of the kernels above, each ported to Rust and to Go with the same work, the same sizes and the same checksum: every binary below printed the Nish \`par\` run's output (numeric tokens to 1e-9 relative; the n-body energies agree to the last bit). The Rust twins run on \`std::thread::scope\` (\`bench/par-<kernel>.rs\`) and on Rayon's pool (\`bench/par-<kernel>-rayon.rs\`), the Go twins on goroutines and a \`sync.WaitGroup\` (\`bench/par-<kernel>.go\`). The map kernels cut the array into one contiguous chunk per thread, the first on the calling thread, which is how Nish's partitioner divides them at these sizes; Rayon splits adaptively. par-histogram takes the lock once per value in every language, Nish's \`Mutex\`, Rust's \`std::sync::Mutex\` and Go's \`sync.Mutex\`, since Nish has no atomic counter to compare with.`,
    "",
    `**The same work, not the same checks or the same build.** Nish builds with its default checks: every integer operation that can overflow and every index it cannot prove in range is checked (\`nish_panic_overflow\` and \`nish_panic_index\` are reached from par-histogram's \`binStream\`, for one). The Rust twins build as \`--release\` does, with bounds checks and without overflow checks; Go checks bounds and not overflow. And Nish's \`--profile speed\` links with LTO, where neither Rust build does, which gives Nish a small edge. In par-nbody each Nish probe reaches the bodies through class references, where the twins index a contiguous array of structs, which slightly favours Rust and Go.`,
    "",
    `**How it is timed.** Every binary divides over ${THREADS} threads, the count Nish's runtime chooses on this machine: \`NISH_NUM_THREADS\`, \`RAYON_NUM_THREADS\`, \`GOMAXPROCS\` and \`PAR_THREADS\` (read by the scope twins) are all set to it. The comparison is run ${n} time(s), minutes apart, each run ${twins.rounds} interleaved rounds after ${opts.warmup} warm-up: in each round every binary and a byte-identical copy of it run once, in an order rotated by one per round. The times below are process wall time, min / median in ms over every round of every run. In each run, and separately for the minimum and the median, Nish is divided by the fastest other column on that statistic, and the band is the larger of the gaps between Nish and its copy and between that column and its copy. A ratio reads as faster or slower only outside the band, and within ${(BAND_EDGE * 100).toFixed(1)}% of its edge as at the edge. The reading takes every run together: runs that fall on both sides of the band make no claim. The Nish column is the \`par\` run of the table above, timed again here beside seven other binaries rather than in that table's alternation with its loop, so the two tables' Nish figures differ by about as much as this machine moves between runs: compare within a table, not across.`,
    "",
    `Measured on ${new Date().toISOString().slice(0, 10)}, on ${cpu}, ${os.cpus().length} logical cores, ${THREADS} threads, ${os.platform()} ${os.release()}, by \`node bench/run.mjs --only par\` at ${mainStamp}. ${version(nishc.cmd, [...nishc.prefix, "--version"])}; ${tool(RUSTC)}; ${rayonNote}; ${tool(GO, ["version"])}.`,
    ""
  )
  lines.push(
    `| Kernel | ${present.map(([, l]) => l).join(" | ")} | Nish / fastest, min, over ${n} run(s) | Nish / fastest, median | Reading, min | Reading, median |`,
    `| --- | ${present.map(() => "---:").join(" | ")} | ---: | ---: | --- | --- |`
  )
  for (const r of twins.rows) {
    const cell = (id) => {
      const v = r.pooled.get(id)
      return v ? `${fmt(v.min)} / ${fmt(v.median)}` : ""
    }
    const onMin = r.passes.map((p) => p.min)
    const onMedian = r.passes.map((p) => p.median)
    lines.push(
      `| ${r.bench.name} | ${present.map(([id]) => cell(id)).join(" | ")} | ${spreadOf(onMin)} | ${spreadOf(onMedian)} | ${readAcross(onMin)} | ${readAcross(onMedian)} |`
    )
  }
  lines.push(
    "",
    "Each run on its own: the fastest other column on each statistic, Nish over it, and that row's band.",
    "",
    "| Kernel | Run | Fastest, min | Nish / it | Band | Fastest, median | Nish / it | Band |",
    "| --- | ---: | --- | ---: | ---: | --- | ---: | ---: |"
  )
  for (const r of twins.rows) {
    r.passes.forEach((p, i) => {
      lines.push(
        `| ${r.bench.name} | ${i + 1} | ${twinLabel(p.min.fastest)} | ${times3(p.min.ratio)} | ${pct1(p.min.band)} | ${twinLabel(p.median.fastest)} | ${times3(p.median.ratio)} | ${pct1(p.median.band)} |`
      )
    })
  }
  lines.push(
    "",
    `Rust flags: \`${SPEED.join(" ")} --edition 2021\`, without \`target-cpu=native\` or LTO; Nish's \`--profile speed\` has no \`-march\` either. Go: \`go build -trimpath -ldflags=-s -w\`. bench/README.md says what each kernel measures and, where Nish loses, what has been measured of why.`,
    "",
    "The Checksums and Commands sections below are written by a full run, which `--only par` leaves as they were, so a kernel added since the last full run is missing there. Every binary of this table printed its kernel's checksum, and was built so:",
    ""
  )
  for (const r of twins.rows) {
    lines.push(`- **${r.bench.name}**: \`${r.checksum.trim().split("\n").join(" ")}\``, "", "  ```")
    for (const cmd of r.cmds) {
      lines.push(`  ${cmd}`)
    }
    lines.push("  ```", "")
  }
}

if (mapLines.length > 0) {
  lines.push("## Map and Set (WP32)", "")
  lines.push(
    `Each workload is timed by the program around the workload alone, not as process wall time, and every column is its own process, the columns taking turns round by round: ${opts.runs} timed runs after ${opts.warmup} warm-up, min / median in ms. The workloads are [docs/wp32-map.md](wp32-map.md) §2's, over the same keys, and every program prints checksum lines \`bench/map-node.mjs\` prints from Node's \`Map\`. \`unordered\` is the S1 prototype with keys and values in the buckets, the layout the language does not ship; the ratios divide minimums. The programs are built with \`nish bench/<name>.ts --link <exe> --profile speed\`, and bench/README.md describes them; §10 of the note reads the numbers.`,
    ""
  )
  lines.push(...mapLines)
}

lines.push("## Checksums", "")
lines.push(
  "Every binary of a benchmark printed the same output (numeric tokens compared to 1e-9 relative):",
  ""
)
for (const r of results) {
  lines.push(`- **${r.bench.name}** (${r.bench.what}): \`${r.reference.trim().split("\n").join(" ")}\``)
}
for (const r of parallelRows) {
  lines.push(`- **${r.bench.name}** (loop and map): \`${r.seq.stdout.trim().split("\n").join(" ")}\``)
}
lines.push("")

lines.push("## Commands", "")
lines.push(
  "Sources are copied to `build/bench/src/` (with the size substituted when `--n` is given) and built from the repository root:",
  ""
)
for (const r of results) {
  lines.push(`### ${r.bench.name}`, "", "```")
  for (const v of r.variants) {
    lines.push(v.cmd)
  }
  lines.push("```", "")
}
for (const r of parallelRows) {
  lines.push(`### ${r.bench.name}`, "", "```", r.cmd, "```", "")
}
lines.push(
  "Rust flags: `-C opt-level=3 -C panic=abort -C codegen-units=1 -C strip=symbols`, plus `-C target-cpu=native` for the native column. Go has no optimisation level to choose: `-trimpath` and `-ldflags=-s -w` only strip the binary. `nish --link` runs `scripts/build.sh --profile speed` (`clang -O3 -flto` with section GC and stripping; see the README) over the module and `runtime/runtime.c`.",
  ""
)

// A section another script writes, between `<!-- name:begin -->` and
// `<!-- name:end -->` (bench/json-compare/run.mjs --record's), is carried over
// from the file this one replaces, so that rewriting the rest does not drop it.
const kept = fs.existsSync(opts.out)
  ? [...fs.readFileSync(opts.out, "utf8").matchAll(/<!-- ([a-z-]+):begin -->[\s\S]*?<!-- \1:end -->/g)].map(
      (m) => m[0]
    )
  : []
for (const section of kept) {
  lines.push(section, "")
}

/**
 * The `## ` sections of a report, in order, each as the heading line and the
 * lines up to the next heading; the lines before the first heading are keyed "".
 */
const sectionsOf = (text) => {
  const sections = []
  for (const line of text.split("\n")) {
    if (line.startsWith("## ") || sections.length === 0) {
      sections.push({ heading: line.startsWith("## ") ? line : "", lines: [] })
    }
    sections[sections.length - 1].lines.push(line)
  }
  return sections
}

/**
 * A run of the data-parallel kernels alone (`--only par`) writes their table
 * into the existing report and leaves every other section as it was, byte for
 * byte, because a table measured on another day, or another machine, is not
 * this run's to replace. A subset of the kernels, or a report with no such
 * table, writes nothing. Any run that measured the benchmark tables rewrites
 * the report whole, carrying the marked sections over (`kept`, above).
 */
const spliceSections = (oldText, newText, headings) => {
  const fresh = new Map(sectionsOf(newText).map((s) => [s.heading, s.lines]))
  const old = sectionsOf(oldText)
  const had = new Set(old.map((s) => s.heading))
  return old
    .flatMap((s) => {
      const own = headings.includes(s.heading) && fresh.has(s.heading) ? fresh.get(s.heading) : s.lines
      // A heading the report does not have yet goes in after the one listed
      // before it, so the first `--only par` run that measures the twins puts
      // their table under the data-parallel one.
      const added = headings
        .filter((h, i) => i > 0 && headings[i - 1] === s.heading && !had.has(h) && fresh.has(h))
        .flatMap((h) => fresh.get(h))
      return [...own, ...added]
    })
    .join("\n")
}

fs.mkdirSync(path.dirname(opts.out), { recursive: true })
const PARALLEL_HEADING = "## Data parallelism (ms, min / median)"
// Whether the report on disk was rewritten, for the summary's last line: a
// partial run that measured no whole table leaves it as it was.
let wrote = true
if (opts.only && results.length === 0) {
  const old = fs.existsSync(opts.out) ? fs.readFileSync(opts.out, "utf8") : ""
  wrote =
    parallelRows.length === PARALLEL.length &&
    sectionsOf(old).some((section) => section.heading === PARALLEL_HEADING)
  if (wrote) {
    // The twins' table is replaced only when this run measured it, so a
    // machine without rustc or go keeps the one the report has.
    const headings = twins !== null ? [PARALLEL_HEADING, TWINS_HEADING] : [PARALLEL_HEADING]
    fs.writeFileSync(opts.out, spliceSections(old, lines.join("\n"), headings))
  }
} else {
  fs.writeFileSync(opts.out, lines.join("\n"))
}

// Console summary.
console.log(
  `\n${"benchmark".padEnd(10)} ${columns.map(([, l]) => l.replace(/`/g, "").padStart(18)).join("")}${ratios.map(([, l]) => l.replace("Nish", "nish").padStart(20)).join("")}`
)
for (const r of results) {
  const cell = (id) => {
    const v = r.variants.find((x) => x.id === id)
    return (v ? `${fmt(v.min)}/${fmt(v.median)}` : "-").padStart(18)
  }
  console.log(
    `${r.bench.name.padEnd(10)} ${columns.map(([id]) => cell(id)).join("")}${ratios.map(([id]) => (ratio(r, id) || "-").padStart(20)).join("")}`
  )
}
for (const r of parallelRows) {
  console.log(
    `${r.bench.name.padEnd(14)} loop ${fmt(r.seq.min)}/${fmt(r.seq.median)}  map ${fmt(r.par.min)}/${fmt(r.par.median)}  ${(r.seq.min / r.par.min).toFixed(2)}x`
  )
}
for (const r of twins?.rows ?? []) {
  const onMin = r.passes.map((p) => p.min)
  const onMedian = r.passes.map((p) => p.median)
  console.log(
    `${r.bench.name.padEnd(14)} min ${spreadOf(onMin)}: ${readAcross(onMin).replace(/\*/g, "")}; median ${spreadOf(onMedian)}: ${readAcross(onMedian).replace(/\*/g, "")}`
  )
}
console.log(
  wrote
    ? `\nwrote ${path.relative(root, opts.out)}`
    : `\nleft ${path.relative(root, opts.out)} unchanged: only a run of every data-parallel kernel alone rewrites its table, into a report that has one`
)
if (mismatches) {
  console.error(`${mismatches} checksum mismatch(es); the table is not trustworthy`)
  process.exit(1)
}
