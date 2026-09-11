#!/usr/bin/env node
// Nish benchmark runner (WP9). Builds every benchmark in bench/ for
// Nish, C, Go and Rust, checks that all of them print the same checksum,
// times the binaries and writes docs/BENCHMARKS.md. See bench/README.md.
//
//   npm run build && node bench/run.mjs [options]
//     --runs N          timed runs per binary (default 5), after --warmup N (default 1)
//     --only a,b        benchmark names to include (default: all)
//     --n name=value    override a benchmark's size (the `bench:n` line in its sources)
//     --validate        build and compare checksums only: no timing, no docs written
//     --no-rust         skip Rust even when rustc is installed
//     --no-go           skip Go even when the go tool is installed
//     --out <file>      where to write the report (default docs/BENCHMARKS.md)
//
// Every benchmark prints one checksum (one or more lines of numbers). Outputs
// are compared token by token; numeric tokens must agree to 1e-9 relative so
// that `%.17g`, Rust's `{}`, Go's `%v` and Nish's JavaScript-style
// formatting of the same double all count as equal.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benchDir = path.join(root, "bench");
const outDir = path.join(root, "build", "bench");
const srcDir = path.join(outDir, "src");
const cli = path.join(root, "dist", "index.js");

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

/** The compiler flags `bench/<name>.ts` is built with, from its `.args` sidecar. */
function sourceArgs(name) {
  const file = path.join(benchDir, `${name}.args`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean);
}

// ---- Options ------------------------------------------------------------------------

const opts = { runs: 5, warmup: 1, only: null, sizes: new Map(), validate: false, rust: true, go: true, out: path.join(root, "docs", "BENCHMARKS.md") };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  const next = () => {
    const v = process.argv[++i];
    if (v === undefined) fail(`${a} needs a value`);
    return v;
  };
  if (a === "--runs") opts.runs = Number(next());
  else if (a === "--warmup") opts.warmup = Number(next());
  else if (a === "--only") opts.only = new Set(next().split(",").filter(Boolean));
  else if (a === "--n") {
    for (const pair of next().split(",")) {
      const [name, value] = pair.split("=");
      if (!name || !/^\d+$/.test(value ?? "")) fail(`--n expects name=integer, got \`${pair}\``);
      opts.sizes.set(name, value);
    }
  } else if (a === "--validate") opts.validate = true;
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

if (!fs.existsSync(cli)) fail("dist/index.js is missing; run `npm run build` first");
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

/** Copy a source into build/bench/src, rewriting the number on its `bench:n` line when a size override is given. */
function prepare(file, size) {
  let text = fs.readFileSync(path.join(benchDir, file), "utf8");
  if (size !== undefined) {
    const lines = text.split("\n");
    const at = lines.findIndex((l) => l.includes("bench:n"));
    if (at < 0) fail(`${file} has no \`bench:n\` line to override`);
    lines[at] = lines[at].replace(/\b\d+\b/, size);
    text = lines.join("\n");
  }
  const dst = path.join(srcDir, file);
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
    run("node", [cli, ...args], `${bench.name}/${id}`);
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
function timeOnce(exe) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(exe, [], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (r.status !== 0) {
    console.error(`${exe} exited with ${r.status}\n${r.stderr}`);
    process.exit(1);
  }
  return { ms, stdout: r.stdout };
}

/** Peak resident set in KB (see bench/rss.c), or null when the helper is unavailable. */
function peakRssKb(exe) {
  if (!RSS_HELPER) return null;
  const r = spawnSync(RSS_HELPER, [exe], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const m = r.stdout.trim();
  return r.status === 0 && /^\d+$/.test(m) ? Number(m) : null;
}

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

// ---- Main --------------------------------------------------------------------------------

fs.mkdirSync(srcDir, { recursive: true });
const selected = BENCHMARKS.filter((b) => !opts.only || opts.only.has(b.name));
if (opts.only) for (const name of opts.only) if (!BENCHMARKS.some((b) => b.name === name)) fail(`unknown benchmark \`${name}\``);

const results = []; // { bench, variants: [{ ...variant, min, median, bytes, rss, stdout }], reference }
let mismatches = 0;
for (const bench of selected) {
  process.stderr.write(`${bench.name}: building`);
  const variants = build(bench);
  process.stderr.write(` ok; running`);
  const reference = timeOnce(variants.find((v) => v.id === "c").exe).stdout;
  for (const v of variants) {
    const times = [];
    let stdout = "";
    const total = opts.validate ? 1 : opts.warmup + opts.runs;
    for (let i = 0; i < total; i++) {
      const r = timeOnce(v.exe);
      stdout = r.stdout;
      if (i >= opts.warmup || opts.validate) times.push(r.ms);
    }
    const agrees = sameOutput(stdout, reference);
    if (!agrees) {
      mismatches++;
      console.error(`\nCHECKSUM MISMATCH ${bench.name}/${v.id}:\n--- C\n${reference}--- ${v.id}\n${stdout}`);
    }
    Object.assign(v, {
      min: Math.min(...times),
      median: median(times),
      bytes: fs.statSync(v.exe).size,
      rss: opts.validate ? null : peakRssKb(v.exe),
      stdout,
      agrees,
    });
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
lines.push(`| nish | ${version("node", [cli, "--version"])} (commit ${commit}) |`);
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

lines.push("## Checksums", "");
lines.push("Every binary of a benchmark printed the same output (numeric tokens compared to 1e-9 relative):", "");
for (const r of results) lines.push(`- **${r.bench.name}** (${r.bench.what}): \`${r.reference.trim().split("\n").join(" ")}\``);
lines.push("");

lines.push("## Commands", "");
lines.push("Sources are copied to `build/bench/src/` (with the size substituted when `--n` is given) and built from the repository root:", "");
for (const r of results) {
  lines.push(`### ${r.bench.name}`, "", "```");
  for (const v of r.variants) lines.push(v.cmd);
  lines.push("```", "");
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
console.log(`\nwrote ${path.relative(root, opts.out)}`);
if (mismatches) {
  console.error(`${mismatches} checksum mismatch(es); the table is not trustworthy`);
  process.exit(1);
}
