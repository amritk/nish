#!/usr/bin/env node
// Nish benchmark runner (WP9). Builds every benchmark in bench/ for
// Nish, C, Go and Rust, checks that all of them print the same checksum,
// times the binaries and writes docs/BENCHMARKS.md. See bench/README.md.
//
//   npm run build && node bench/run.mjs [options]
//     --runs N          timed runs per binary (default 5), after --warmup N (default 1)
//     --only a,b        benchmark names to include (default: all); `awfy` names
//                       the Are We Fast Yet ports in bench/awfy/, which run only
//                       when named (see bench/README.md)
//     --n name=value    override a benchmark's size (the `bench:n` line in its sources)
//     --validate        build and compare checksums only: no timing, no docs written
//     --no-rust         skip Rust even when rustc is installed
//     --no-go           skip Go even when the go tool is installed
//     --out <file>      where to write the report (default docs/BENCHMARKS.md)
//     --compiler <nish> the compiler under test (default build/nish; a
//                       native nish runs directly, a .js entry under node)
//     --instructions    count the instructions each of the 14 programs executes
//                       under valgrind's cachegrind, at the sizes in
//                       bench/instructions.json; nothing is timed. With --check,
//                       fail when one exceeds its baseline by more than the
//                       tolerance; with --update, rewrite the baseline (a PR that
//                       does must say why). --runs N repeats each run (default 1)
//
// The data-parallel kernels (bench/par_*.ts) are not twins: each is one Nish
// binary run twice, as the loop (`seq`) and as `parallelMapInto` (`par`), and
// the two runs must print the same checksum. They run with the rest, or when
// `--only` names one (`par` names all four), and are left out of
// --instructions: see bench/README.md.
//
// Every benchmark prints one checksum (one or more lines of numbers). Outputs
// are compared token by token; numeric tokens must agree to 1e-9 relative so
// that `%.17g`, Rust's `{}`, Go's `%v` and Nish's JavaScript-style
// formatting of the same double all count as equal. The Are We Fast Yet ports
// have no twins to compare with: each checks its own result, and the harness
// panics when one is wrong.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compilerFrom } from "./compiler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benchDir = path.join(root, "bench");
const outDir = path.join(root, "build", "bench");
const srcDir = path.join(outDir, "src");
const nishc = compilerFrom(process.argv);

// ---- Benchmarks -------------------------------------------------------------------

/**
 * `integer` marks the benchmarks whose hot loop is integer arithmetic, where
 * `--nsw` gets a column. `extraC` lists further C sources that print the same
 * checksum (the naive malloc/free string builder).
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
  { name: "strbuild", what: "string building, 131072 template pieces joined into 806 KB", integer: true, extraC: ["strbuild_naive"] },
  { name: "vec3", what: "Vec3 class with methods, 5e7 iterations (f64)", integer: false },
  { name: "result", what: "Result<number, number> returned and passed, 2e8 calls (WP17 packing)", integer: true },
];

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
];
const AWFY_ITERATIONS = 30;

/**
 * The wp29 P1 kernels in bench/par_*.ts: one binary each, timed as the loop
 * (`seq`) and as `parallelMapInto` (`par`) on every core the machine has.
 */
const PARALLEL = [
  { name: "par_compute", what: "64 square roots per element, 2^21 elements (f64)" },
  { name: "par_alloc", what: "a string formatted and summed per element, 2^22 elements; the body allocates (NL9012)" },
  { name: "par_nbody", what: "n-body partitioned: 1024 bodies, 16 steps, one map of 3n probes per step" },
  { name: "par_short", what: "an 8-element map called 2^20 times, each call fed by the last" },
];
const AWFY_KEPT = 20;

/** The compiler flags `bench/<name>.ts` is built with, from its `.args` sidecar. */
function sourceArgs(name) {
  const file = path.join(benchDir, `${name}.args`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean);
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
  out: path.join(root, "docs", "BENCHMARKS.md"),
};
const argv = nishc.rest;
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    const v = argv[++i];
    if (v === undefined) fail(`${a} needs a value`);
    return v;
  };
  if (a === "--runs") {
    opts.runs = Number(next());
    opts.runsGiven = true;
  }
  else if (a === "--warmup") opts.warmup = Number(next());
  else if (a === "--only") opts.only = new Set(next().split(",").filter(Boolean));
  else if (a === "--n") {
    for (const pair of next().split(",")) {
      const [name, value] = pair.split("=");
      if (!name || !/^\d+$/.test(value ?? "")) fail(`--n expects name=integer, got \`${pair}\``);
      opts.sizes.set(name, value);
    }
  } else if (a === "--validate") opts.validate = true;
  else if (a === "--instructions") opts.instructions = true;
  else if (a === "--check") opts.check = true;
  else if (a === "--update") opts.update = true;
  else if (a === "--no-rust") opts.rust = false;
  else if (a === "--no-go") opts.go = false;
  else if (a === "--out") opts.out = path.resolve(next());
  else if (a === "-h" || a === "--help") {
    // The banner is this file's leading comment block, minus the shebang: it
    // ends at the first line that is not a comment, so adding an option above
    // does not need a line count here changed to match.
    const banner = fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1);
    const end = banner.findIndex((l) => !l.startsWith("//"));
    console.log(banner.slice(0, end).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    process.exit(0);
  } else fail(`unknown option ${a}`);
}

if ((opts.check || opts.update) && !opts.instructions) fail("--check and --update belong to --instructions");
if (opts.check && opts.update) fail("--check and --update are exclusive: update the baseline or check it");
// Counting runs only the Nish builds, so the other languages are not looked up.
if (opts.instructions) {
  opts.rust = false;
  opts.go = false;
}

function fail(msg) {
  console.error(`bench/run.mjs: ${msg}`);
  process.exit(2);
}

// ---- Toolchain ------------------------------------------------------------------------

function which(tool, extraDirs = []) {
  for (const dir of [...process.env.PATH.split(path.delimiter), ...extraDirs]) {
    const p = path.join(dir, tool);
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {}
  }
  return null;
}

function version(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n")[0].trim() : `${cmd}: not found`;
}

const CC = process.env.CC || which("clang") || fail("clang not found (set CC)");
const RUSTC = opts.rust ? process.env.RUSTC || which("rustc", [path.join(os.homedir(), ".cargo", "bin")]) : null;
const GO = opts.go ? process.env.GO || which("go", ["/usr/local/go/bin", path.join(os.homedir(), "go", "bin")]) : null;
// Peak RSS of a child comes from bench/rss.c (fork, exec, wait4): `/usr/bin/time`
// is not installed everywhere and an interpreter's fork would count its own pages.
const RSS_HELPER = (() => {
  const exe = path.join(outDir, "rss");
  fs.mkdirSync(outDir, { recursive: true });
  const r = spawnSync(CC, ["-O2", path.join(benchDir, "rss.c"), "-o", exe], { encoding: "utf8" });
  if (r.status !== 0) console.error(`note: bench/rss.c did not build; the memory table is skipped\n${r.stderr}`);
  return r.status === 0 ? exe : null;
})();
if (!RUSTC && opts.rust) console.error("note: rustc not found; Rust columns are skipped (set RUSTC=<path> or install rustup)");
if (!GO && opts.go) console.error("note: the go tool was not found; Go columns are skipped (set GO=<path> or install Go)");

// ---- Build ----------------------------------------------------------------------------

const SPEED = ["-C", "opt-level=3", "-C", "panic=abort", "-C", "codegen-units=1", "-C", "strip=symbols"];

/**
 * Copy a source into `dir` (build/bench/src), rewriting the number on its
 * `bench:n` line when a size override is given.
 */
function prepare(file, size, dir = srcDir) {
  let text = fs.readFileSync(path.join(benchDir, file), "utf8");
  if (size !== undefined) {
    const lines = text.split("\n");
    const at = lines.findIndex((l) => l.includes("bench:n"));
    if (at < 0) fail(`${file} has no \`bench:n\` line to override`);
    lines[at] = lines[at].replace(/\b\d+\b/, size);
    text = lines.join("\n");
  }
  const dst = path.join(dir, file);
  fs.writeFileSync(dst, text);
  return dst;
}

function run(cmd, args, what) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    console.error(`${what}: ${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`);
    process.exit(1);
  }
  return r;
}

/**
 * Build every variant of one benchmark. A variant is { id, label, exe, cmd,
 * timed, integerOnly }: `timed` variants appear in the time table, the rest
 * (the size-profile binary) only in the size table.
 */
function build(bench) {
  const size = opts.sizes.get(bench.name);
  const ts = prepare(`${bench.name}.ts`, size);
  const c = prepare(`${bench.name}.c`, size);
  const rs = fs.existsSync(path.join(benchDir, `${bench.name}.rs`)) ? prepare(`${bench.name}.rs`, size) : null;
  const go = fs.existsSync(path.join(benchDir, `${bench.name}.go`)) ? prepare(`${bench.name}.go`, size) : null;
  const rel = (p) => path.relative(root, p);
  const variants = [];
  const modeFlags = sourceArgs(bench.name);

  const nish = (id, label, extra, profile, timed) => {
    const exe = path.join(outDir, `${bench.name}-${id}`);
    const args = [rel(ts), ...modeFlags, ...extra, "--link", rel(exe), "--profile", profile];
    run(nishc.cmd, [...nishc.prefix, ...args], `${bench.name}/${id}`);
    variants.push({ id, label, exe, timed, cmd: `nish ${args.join(" ")}` });
  };
  nish("nish", "Nish", [], "speed", true);
  if (bench.integer) nish("nish-nsw", "Nish --nsw", ["--nsw"], "speed", true);
  nish("nish-size", "Nish (size profile)", [], "size", false);

  const cc = (id, label, source) => {
    const exe = path.join(outDir, `${bench.name}-${id}`);
    const args = ["-O3", "-s", rel(source), "-lm", "-o", rel(exe)];
    run(CC, args, `${bench.name}/${id}`);
    variants.push({ id, label, exe, timed: true, cmd: `${path.basename(CC)} ${args.join(" ")}` });
  };
  cc("c", "C -O3", c);
  for (const extra of bench.extraC ?? []) cc(`c-${extra.replace(`${bench.name}_`, "")}`, `C -O3 (${extra.replace(`${bench.name}_`, "")})`, prepare(`${extra}.c`, size));

  if (RUSTC && rs) {
    const rustc = (id, label, extra) => {
      const exe = path.join(outDir, `${bench.name}-${id}`);
      const args = [...SPEED, ...extra, rel(rs), "-o", rel(exe)];
      run(RUSTC, args, `${bench.name}/${id}`);
      variants.push({ id, label, exe, timed: true, cmd: `rustc ${args.join(" ")}` });
    };
    rustc("rust", "Rust -O3", []);
    rustc("rust-native", "Rust -O3 native", ["-C", "target-cpu=native"]);
  }

  // `go build` is always -O-equivalent: the gc compiler has one optimisation
  // level. `-trimpath` keeps the binary independent of build/bench/src, and
  // `-ldflags=-s -w` strips it as every other column is stripped.
  if (GO && go) {
    const exe = path.join(outDir, `${bench.name}-go`);
    const args = ["build", "-trimpath", "-ldflags=-s -w", "-o", rel(exe), rel(go)];
    run(GO, args, `${bench.name}/go`);
    variants.push({ id: "go", label: "Go", exe, timed: true, cmd: `go ${args.join(" ")}` });
  }
  return variants;
}

// ---- Run and compare ------------------------------------------------------------------

/** Run once; returns { ms, stdout }. Exit status other than 0 is a failure. */
function timeOnce(exe, args = []) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(exe, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (r.status !== 0) {
    console.error(`${exe} exited with ${r.status}\n${r.stderr}`);
    process.exit(1);
  }
  return { ms, stdout: r.stdout };
}

/** Peak resident set in KB (see bench/rss.c), or null when the helper is unavailable. */
function peakRssKb(exe, args = []) {
  if (!RSS_HELPER) return null;
  const r = spawnSync(RSS_HELPER, [exe, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const m = r.stdout.trim();
  return r.status === 0 && /^\d+$/.test(m) ? Number(m) : null;
}

/**
 * `exe args` run `--warmup` times and then `--runs` times (once under
 * `--validate`): { min, median } of the timed runs in ms, the peak RSS of one
 * more run (null under `--validate`), and the last run's stdout.
 */
const timeRuns = (exe, args = []) => {
  const times = [];
  let stdout = "";
  const total = opts.validate ? 1 : opts.warmup + opts.runs;
  for (let i = 0; i < total; i++) {
    const r = timeOnce(exe, args);
    stdout = r.stdout;
    if (i >= opts.warmup || opts.validate) times.push(r.ms);
  }
  return {
    min: Math.min(...times),
    median: median(times),
    rss: opts.validate ? null : peakRssKb(exe, args),
    stdout,
  };
};

/** Token-wise comparison; numbers agree when within 1e-9 relative (or 1e-12 absolute). */
function sameOutput(a, b) {
  const ta = a.trim().split(/\s+/);
  const tb = b.trim().split(/\s+/);
  if (ta.length !== tb.length) return false;
  return ta.every((x, i) => {
    const y = tb[i];
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny) && x !== "" && y !== "") {
      return Math.abs(nx - ny) <= Math.max(1e-12, 1e-9 * Math.max(Math.abs(nx), Math.abs(ny)));
    }
    return x === y;
  });
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---- Instruction counts -------------------------------------------------------------------

/**
 * Build the AWFY harness into `dir` exactly as the timing mode does: checked,
 * `--profile speed` and nothing else. Answers the executable's path.
 */
const buildAwfy = (dir) => {
  const exe = path.join(dir, "awfy-harness");
  const args = [
    "bench/awfy/main.ts",
    "-o",
    `${path.relative(root, path.join(dir, "awfy"))}/`,
    "--link",
    path.relative(root, exe),
    "--profile",
    "speed",
  ];
  run(nishc.cmd, [...nishc.prefix, ...args], "awfy");
  return exe;
};

const BASELINE_FILE = path.join(benchDir, "instructions.json");

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
].join(":");

/**
 * The instructions one run executes, counted by cachegrind over the whole
 * process: the dynamic loader and libc's start-up included, because nothing
 * separates them from the program's own code in a stripped `--profile speed`
 * binary on a host without libc's debug symbols. They are about 120 thousand
 * of a count in the hundreds of millions. What varies with the host is pinned
 * instead: the child's environment is `PINNED_LIBC` and nothing else, and its
 * argv[0] is relative (`./fib`, run from its own directory), so neither the
 * caller's variables nor the checkout's path reach the loader. bench/README.md
 * has the measurements that show what is left.
 */
const countInstructions = (valgrind, exe, args, name) => {
  const dir = path.dirname(exe);
  const out = path.join(dir, `${name}.cachegrind`);
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
      env: { GLIBC_TUNABLES: PINNED_LIBC },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (r.status !== 0) {
    console.error(
      `${name}: cachegrind ${exe} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`
    );
    process.exit(1);
  }
  const m = fs.readFileSync(out, "utf8").match(/^summary: (\d+)$/m);
  if (!m) fail(`${name}: no summary line in ${path.relative(root, out)}`);
  return Number(m[1]);
};

/**
 * `--instructions`: build the seven bench/ programs and the seven AWFY ports at
 * the sizes bench/instructions.json names, count each run, and print the counts
 * against the baseline. `--check` fails on any count above it by more than the
 * tolerance, and `--update` writes the counts back. Answers the exit status.
 */
const runInstructions = () => {
  const valgrind = which("valgrind");
  if (!valgrind) fail("--instructions needs valgrind on PATH (Linux only; see bench/README.md)");
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  const host = `${process.platform}-${process.arch}`;
  if ((opts.check || opts.update) && host !== baseline.platform) {
    fail(`the baseline is counted on ${baseline.platform}, so this ${host} host can neither check nor update it`);
  }
  const names = [...BENCHMARKS.map((b) => b.name), ...AWFY.map((b) => b.name)];
  const listed = Object.keys(baseline.programs);
  if (listed.join(",") !== names.join(",")) {
    fail(`bench/instructions.json must list ${names.join(", ")} in that order; it lists ${listed.join(", ")}`);
  }
  const wanted = (name, awfy) => !opts.only || opts.only.has(name) || (awfy && opts.only.has("awfy"));
  for (const name of opts.only ?? []) {
    if (name !== "awfy" && !names.includes(name)) fail(`unknown benchmark \`${name}\``);
  }

  const dir = path.join(outDir, "instructions");
  const src = path.join(dir, "src");
  fs.mkdirSync(src, { recursive: true });
  const rel = (p) => path.relative(root, p);
  const jobs = []; // { name, size, exe, args }
  process.stderr.write("instructions: building");
  for (const b of BENCHMARKS.filter((x) => wanted(x.name, false))) {
    const n = baseline.programs[b.name].n;
    const ts = prepare(`${b.name}.ts`, String(n), src);
    const exe = path.join(dir, b.name);
    run(
      nishc.cmd,
      [...nishc.prefix, rel(ts), ...sourceArgs(b.name), "--link", rel(exe), "--profile", "speed"],
      `${b.name}/instructions`
    );
    jobs.push({ name: b.name, size: `n=${n}`, exe, args: [] });
    process.stderr.write(".");
  }
  const awfy = AWFY.filter((b) => wanted(b.name, true));
  if (awfy.length > 0) {
    const exe = buildAwfy(dir);
    for (const b of awfy) {
      const inner = baseline.programs[b.name].inner;
      jobs.push({ name: b.name, size: `inner=${inner}`, exe, args: [b.name, "1", String(inner)] });
    }
  }
  process.stderr.write(" ok; counting");

  const runs = opts.runsGiven ? opts.runs : 1;
  const rows = [];
  for (const job of jobs) {
    const counts = [];
    for (let i = 0; i < runs; i++) counts.push(countInstructions(valgrind, job.exe, job.args, job.name));
    const count = median(counts);
    const base = baseline.programs[job.name].instructions;
    rows.push({
      ...job,
      count,
      spread: Math.max(...counts) - Math.min(...counts),
      base,
      change: (count - base) / base,
    });
    process.stderr.write(".");
  }
  process.stderr.write("\n");

  const tolerance = baseline.tolerance;
  const pct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(3)}%`;
  const num = (x) => x.toLocaleString("en-US");
  // An update reports what it moves; a check reports what it would fail.
  const [above, below, within] = opts.update ? ["raised", "lowered", "kept"] : ["REGRESSED", "below", "ok"];
  const status = (r) => (r.change > tolerance ? above : r.change < -tolerance ? below : within);
  console.log(
    `instructions: ${version(valgrind)} cachegrind, whole process, --profile speed; tolerance ${pct(tolerance)}`
  );
  console.log(
    `${"program".padEnd(12)}${"size".padEnd(12)}${"instructions".padStart(16)}${"baseline".padStart(16)}${"change".padStart(10)}${runs > 1 ? `${"spread".padStart(8)}` : ""}  status`
  );
  for (const r of rows) {
    const spread = runs > 1 ? String(r.spread).padStart(8) : "";
    console.log(
      `${r.name.padEnd(12)}${r.size.padEnd(12)}${num(r.count).padStart(16)}${num(r.base).padStart(16)}${pct(r.change).padStart(10)}${spread}  ${status(r)}`
    );
  }

  if (opts.update) {
    for (const r of rows) baseline.programs[r.name].instructions = r.count;
    baseline.valgrind = version(valgrind);
    baseline.commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    // One program to a line, so a diff of the file reads as the table above.
    const { programs, ...header } = baseline;
    const entry = (p) =>
      `{ ${Object.entries(p)
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
        .join(", ")} }`;
    const body = Object.entries(programs).map(([name, p]) => `    ${JSON.stringify(name)}: ${entry(p)}`);
    fs.writeFileSync(
      BASELINE_FILE,
      JSON.stringify(header, null, 2).replace(/\n}$/, `,\n  "programs": {\n${body.join(",\n")}\n  }\n}\n`)
    );
    console.log(
      `wrote ${rel(BASELINE_FILE)}: ${rows.length} count(s); say why in the pull request that carries it`
    );
    return 0;
  }
  for (const r of rows.filter((x) => status(x) === below)) {
    console.log(
      `note: ${r.name} runs ${pct(r.change)} against its baseline; \`--instructions --update\` locks the gain in`
    );
  }
  const regressed = rows.filter((r) => status(r) === above);
  if (!opts.check) return 0;
  if (regressed.length > 0) {
    console.log(
      `instructions: ${regressed.length} of ${rows.length} above ${rel(BASELINE_FILE)} by more than ${pct(tolerance)}: ${regressed.map((r) => r.name).join(", ")}`
    );
    return 1;
  }
  console.log(`instructions: all ${rows.length} within ${pct(tolerance)} of ${rel(BASELINE_FILE)}`);
  return 0;
};

// ---- Main --------------------------------------------------------------------------------

if (opts.instructions) process.exit(runInstructions());

fs.mkdirSync(srcDir, { recursive: true });
const selected = BENCHMARKS.filter((b) => !opts.only || opts.only.has(b.name));
const selectedParallel = PARALLEL.filter((b) => !opts.only || opts.only.has(b.name) || opts.only.has("par"));
const known = (name) => name === "awfy" || name === "par" || BENCHMARKS.some((b) => b.name === name) || PARALLEL.some((b) => b.name === name);
if (opts.only) for (const name of opts.only) if (!known(name)) fail(`unknown benchmark \`${name}\``);

/**
 * The AWFY ports: build the harness checked, the compiler's default, then run
 * each benchmark once with one inner iteration (`--validate`) or time it. A
 * wrong result is the port's own `verifyResult` failing, which panics, so a
 * nonzero exit is the whole check.
 */
const runAwfy = () => {
  process.stderr.write("awfy: building");
  const exe = buildAwfy(outDir);
  process.stderr.write(" ok; running\n");
  const rows = [];
  for (const b of AWFY) {
    const [iterations, inner] = opts.validate ? [1, 1] : [AWFY_ITERATIONS, b.inner];
    const r = run(exe, [b.name, String(iterations), String(inner)], `awfy ${b.name}`);
    const times = [...r.stdout.matchAll(/^\S+: iterations=1 runtime: (\d+)us$/gm)].map((m) => Number(m[1]) / 1000);
    if (times.length !== iterations) fail(`awfy ${b.name}: ${times.length} of ${iterations} iterations timed\n${r.stdout}`);
    if (opts.validate) continue;
    const kept = times.slice(-AWFY_KEPT);
    rows.push({ ...b, median: median(kept), min: Math.min(...kept), max: Math.max(...kept) });
  }
  if (opts.validate) {
    console.log(`awfy: ${AWFY.length} benchmarks verified (${AWFY.map((b) => b.name).join(", ")})`);
    return;
  }
  const ms = (x) => x.toFixed(1).padStart(10);
  console.log(`\nAre We Fast Yet: median, min and max of the last ${AWFY_KEPT} of ${AWFY_ITERATIONS} iterations (ms)`);
  console.log(`${"benchmark".padEnd(12)}${"inner".padStart(7)}${"median".padStart(10)}${"min".padStart(10)}${"max".padStart(10)}`);
  for (const r of rows) console.log(`${r.name.padEnd(12)}${String(r.inner).padStart(7)}${ms(r.median)}${ms(r.min)}${ms(r.max)}`);
};
if (opts.only?.has("awfy")) {
  runAwfy();
  if (selected.length === 0 && selectedParallel.length === 0) process.exit(0);
}

/**
 * The data-parallel kernels: build each once, run it as the loop and as the
 * map, and require the same checksum from both. The speedup is the loop's
 * minimum over the map's. Nothing is compared across languages, so the C
 * reference the table above uses has no part here.
 */
const runParallel = () => {
  const rows = [];
  let disagree = 0;
  for (const bench of selectedParallel) {
    process.stderr.write(`${bench.name}: building`);
    const ts = prepare(`${bench.name}.ts`, opts.sizes.get(bench.name));
    const exe = path.join(outDir, bench.name);
    const args = [path.relative(root, ts), "--link", path.relative(root, exe), "--profile", "speed"];
    run(nishc.cmd, [...nishc.prefix, ...args], bench.name);
    process.stderr.write(" ok; running");
    const modes = { seq: timeRuns(exe, ["seq"]), par: timeRuns(exe, ["par"]) };
    if (!sameOutput(modes.seq.stdout, modes.par.stdout)) {
      disagree++;
      console.error(`\nCHECKSUM MISMATCH ${bench.name}:\n--- seq\n${modes.seq.stdout}--- par\n${modes.par.stdout}`);
    }
    rows.push({ bench, cmd: `nish ${args.join(" ")}`, ...modes });
    process.stderr.write("\n");
  }
  if (disagree > 0) {
    console.error(`${disagree} data-parallel kernel(s) print different checksums as the loop and as the map`);
    process.exit(1);
  }
  return rows;
};
const parallelRows = runParallel();

const results = []; // { bench, variants: [{ ...variant, min, median, bytes, rss, stdout }], reference }
let mismatches = 0;
for (const bench of selected) {
  process.stderr.write(`${bench.name}: building`);
  const variants = build(bench);
  process.stderr.write(` ok; running`);
  const reference = timeOnce(variants.find((v) => v.id === "c").exe).stdout;
  for (const v of variants) {
    const timed = timeRuns(v.exe);
    const agrees = sameOutput(timed.stdout, reference);
    if (!agrees) {
      mismatches++;
      console.error(`\nCHECKSUM MISMATCH ${bench.name}/${v.id}:\n--- C\n${reference}--- ${v.id}\n${timed.stdout}`);
    }
    Object.assign(v, { ...timed, bytes: fs.statSync(v.exe).size, agrees });
    process.stderr.write(".");
  }
  results.push({ bench, variants, reference });
  process.stderr.write("\n");
}

if (opts.validate) {
  const n = results.reduce((s, r) => s + r.variants.length, 0);
  if (mismatches) {
    console.error(`${mismatches} of ${n} binaries disagree with the C checksum`);
    process.exit(1);
  }
  console.log(`checksums agree: ${n} binaries over ${results.length} benchmark(s)${RUSTC ? "" : " (Rust skipped)"}${GO ? "" : " (Go skipped)"}`);
  for (const r of results) console.log(`  ${r.bench.name}: ${r.reference.trim().split("\n").join(" ")}  [${r.variants.map((v) => v.id).join(", ")}]`);
  for (const r of parallelRows) console.log(`  ${r.bench.name}: ${r.seq.stdout.trim().split("\n").join(" ")}  [seq, par]`);
  process.exit(0);
}

// ---- Report ---------------------------------------------------------------------------------

const fmt = (ms) => (ms >= 100 ? ms.toFixed(0) : ms >= 10 ? ms.toFixed(1) : ms.toFixed(2));
const columns = [
  ["nish", "Nish"],
  ["nish-nsw", "Nish `--nsw`"],
  ["c", "C `-O3`"],
  ["c-naive", "C `-O3` naive"],
  ["go", "Go"],
  ["rust", "Rust `-O3`"],
  ["rust-native", "Rust native"],
].filter(([id]) => results.some((r) => r.variants.some((v) => v.id === id)));

/** One `Nish / <language>` column per reference language that ran. */
const ratios = [
  ["go", "Nish / Go"],
  ["rust", "Nish / Rust"],
].filter(([id]) => results.some((r) => r.variants.some((v) => v.id === id)));

/** Nish's minimum over `id`'s, as `N.NNx`, or "" when either is missing. */
const ratio = (result, id) => {
  const nish = result.variants.find((v) => v.id === "nish");
  const other = result.variants.find((v) => v.id === id);
  return nish && other ? `${(nish.min / other.min).toFixed(2)}x` : "";
};

const lines = [];
const cpu = (() => {
  try {
    const m = fs.readFileSync("/proc/cpuinfo", "utf8").match(/^model name\s*:\s*(.+)$/m);
    return m ? m[1].trim() : os.cpus()[0]?.model ?? "unknown";
  } catch {
    return os.cpus()[0]?.model ?? "unknown";
  }
})();
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
})();

lines.push("# Benchmarks", "");
lines.push("Generated by `node bench/run.mjs`; do not edit by hand. The programs, the rules and the analysis of every gap are in [bench/README.md](../bench/README.md) and [docs/wp9-optimisation.md](wp9-optimisation.md).", "");
lines.push("| | |", "| --- | --- |");
lines.push(`| Date | ${new Date().toISOString().slice(0, 10)} |`);
lines.push(`| nish | ${version(nishc.cmd, [...nishc.prefix, "--version"])} (commit ${commit}) |`);
lines.push(`| CPU | ${cpu}, ${os.cpus().length} logical cores |`);
lines.push(`| OS | ${os.platform()} ${os.release()} (${os.arch()}) |`);
lines.push(`| C | ${version(CC)} |`);
lines.push(`| Rust | ${RUSTC ? version(RUSTC) : "not installed (columns skipped)"} |`);
lines.push(`| Go | ${GO ? version(GO, ["version"]) : "not installed (columns skipped)"} |`);
lines.push(`| Node | ${process.version} |`);
lines.push(`| Runs | ${opts.runs} timed after ${opts.warmup} warm-up, wall time via \`process.hrtime.bigint\` around \`spawnSync\`; min and median in ms |`);
lines.push("");

lines.push("## Wall time (ms, min / median)", "");
lines.push(`| Benchmark | ${columns.map(([, l]) => l).join(" | ")} | ${ratios.map(([, l]) => l).join(" | ")} |`);
lines.push(`| --- | ${columns.map(() => "---:").join(" | ")} | ${ratios.map(() => "---:").join(" | ")} |`);
for (const r of results) {
  const cell = (id) => {
    const v = r.variants.find((x) => x.id === id);
    return v ? `${fmt(v.min)} / ${fmt(v.median)}` : "";
  };
  lines.push(`| ${r.bench.name} | ${columns.map(([id]) => cell(id)).join(" | ")} | ${ratios.map(([id]) => ratio(r, id)).join(" | ")} |`);
}
lines.push("", "The ratio columns divide the Nish minimum by that language's minimum (Rust `-O3`, Go): 1.00x is parity, above 1.10x misses the WP9 target. Rust native is `-C target-cpu=native`; C is plain `-O3` without `-march`; Go has one optimisation level and always bounds-checks.", "");

lines.push("## Binary size (bytes, stripped)", "");
lines.push("| Benchmark | Nish speed | Nish size | C `-O3` | Go | Rust `-O3` |", "| --- | ---: | ---: | ---: | ---: | ---: |");
for (const r of results) {
  const b = (id) => r.variants.find((v) => v.id === id)?.bytes.toLocaleString("en-US") ?? "";
  lines.push(`| ${r.bench.name} | ${b("nish")} | ${b("nish-size")} | ${b("c")} | ${b("go")} | ${b("rust")} |`);
}
lines.push("", "Nish binaries link `runtime/runtime.c` statically and glibc dynamically; the Rust binaries carry `std` statically (`panic=abort`, `strip=symbols`) and the Go binaries their runtime, scheduler and garbage collector (`-ldflags=-s -w`).", "");

if (results.some((r) => r.variants.some((v) => v.rss !== null))) {
  lines.push("## Peak resident memory (KB)", "");
  lines.push(`| Benchmark | ${columns.map(([, l]) => l).join(" | ")} |`);
  lines.push(`| --- | ${columns.map(() => "---:").join(" | ")} |`);
  for (const r of results) {
    const cell = (id) => {
      const v = r.variants.find((x) => x.id === id);
      return v?.rss != null ? v.rss.toLocaleString("en-US") : "";
    };
    lines.push(`| ${r.bench.name} | ${columns.map(([id]) => cell(id)).join(" | ")} |`);
  }
  lines.push("", "Peak RSS of one run (`ru_maxrss` from `wait4`, see `bench/rss.c`). String building holds every intermediate string until exit: each `join` returns its result, so it escapes and the automatic arena scopes (WP6) cannot reclaim it; per-call-site reclamation of a returned temporary is the open item in `docs/wp9-optimisation.md`.", "");
}

if (parallelRows.length > 0) {
  lines.push("## Data parallelism (ms, min / median)", "");
  lines.push(
    `Each kernel is one Nish binary, run as the loop a program writes without \`nish/threads\` (\`seq\`) and as \`parallelMapInto\` (\`par\`) on all ${os.cpus().length} logical cores; the speedup is the loop's minimum over the map's. Both runs print the same checksum. The kernels are in \`bench/par_*.ts\`, and wp29 §8a reads the numbers.`,
    ""
  );
  lines.push("| Kernel | What | Loop | `parallelMapInto` | Speedup | Peak RSS loop / map (KB) |", "| --- | --- | ---: | ---: | ---: | ---: |");
  for (const r of parallelRows) {
    const rss = r.seq.rss !== null && r.par.rss !== null ? `${r.seq.rss.toLocaleString("en-US")} / ${r.par.rss.toLocaleString("en-US")}` : "";
    lines.push(
      `| ${r.bench.name} | ${r.bench.what} | ${fmt(r.seq.min)} / ${fmt(r.seq.median)} | ${fmt(r.par.min)} / ${fmt(r.par.median)} | ${(r.seq.min / r.par.min).toFixed(2)}x | ${rss} |`
    );
  }
  lines.push("");
}

lines.push("## Checksums", "");
lines.push("Every binary of a benchmark printed the same output (numeric tokens compared to 1e-9 relative):", "");
for (const r of results) lines.push(`- **${r.bench.name}** (${r.bench.what}): \`${r.reference.trim().split("\n").join(" ")}\``);
for (const r of parallelRows) lines.push(`- **${r.bench.name}** (loop and map): \`${r.seq.stdout.trim().split("\n").join(" ")}\``);
lines.push("");

lines.push("## Commands", "");
lines.push("Sources are copied to `build/bench/src/` (with the size substituted when `--n` is given) and built from the repository root:", "");
for (const r of results) {
  lines.push(`### ${r.bench.name}`, "", "```");
  for (const v of r.variants) lines.push(v.cmd);
  lines.push("```", "");
}
for (const r of parallelRows) {
  lines.push(`### ${r.bench.name}`, "", "```", r.cmd, "```", "");
}
lines.push("Rust flags: `-C opt-level=3 -C panic=abort -C codegen-units=1 -C strip=symbols`, plus `-C target-cpu=native` for the native column. Go has no optimisation level to choose: `-trimpath` and `-ldflags=-s -w` only strip the binary. `nish --link` runs `scripts/build.sh --profile speed` (`clang -O3 -flto` with section GC and stripping; see the README) over the module and `runtime/runtime.c`.", "");

fs.mkdirSync(path.dirname(opts.out), { recursive: true });
fs.writeFileSync(opts.out, lines.join("\n"));

// Console summary.
console.log(`\n${"benchmark".padEnd(10)} ${columns.map(([, l]) => l.replace(/`/g, "").padStart(18)).join("")}${ratios.map(([, l]) => l.replace("Nish", "nish").padStart(20)).join("")}`);
for (const r of results) {
  const cell = (id) => {
    const v = r.variants.find((x) => x.id === id);
    return (v ? `${fmt(v.min)}/${fmt(v.median)}` : "-").padStart(18);
  };
  console.log(`${r.bench.name.padEnd(10)} ${columns.map(([id]) => cell(id)).join("")}${ratios.map(([id]) => (ratio(r, id) || "-").padStart(20)).join("")}`);
}
for (const r of parallelRows) {
  console.log(`${r.bench.name.padEnd(12)} loop ${fmt(r.seq.min)}/${fmt(r.seq.median)}  map ${fmt(r.par.min)}/${fmt(r.par.median)}  ${(r.seq.min / r.par.min).toFixed(2)}x`);
}
console.log(`\nwrote ${path.relative(root, opts.out)}`);
if (mismatches) {
  console.error(`${mismatches} checksum mismatch(es); the table is not trustworthy`);
  process.exit(1);
}
