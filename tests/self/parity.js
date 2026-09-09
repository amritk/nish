/**
 * The WP19 G1 parity check: no flag and no answer is one compiler's alone.
 *
 *   node tests/self/parity.js              the difference table, empty or not
 *   node tests/self/parity.js --verbose    every row, not only the differing ones
 *
 * The oracles beside this one compare the two compilers over the *corpus* with
 * each program's own flags. This one compares them over the *flags*: it reads
 * both `--help` texts, diffs the two sets, and then runs a matrix of every
 * no-value flag and every value a valued flag takes across a handful of
 * programs, requiring the same exit code, the same IR and the same streams
 * from both sides. G1 wants an empty difference set printed as a table rather
 * than asserted silently, so the table is what this writes.
 *
 * The two halves catch different things and both were needed:
 *
 *   - the flag-set diff is what notices a flag that exists on one side only.
 *     `--no-warn-performance` was stage0's and `--out-dir` was stage1's, and
 *     neither showed up anywhere, because no test asks a compiler what flags
 *     it has;
 *   - the matrix is what notices a flag that both sides accept and only one
 *     side acts on. Nothing else here would: a flag the driver parses and
 *     drops leaves no trace in the IR the other oracles compare.
 *
 * A difference is only allowed when it is *named* below, with the reason, and
 * `--emit-ast` is the one that is (wp14-selfhost.md §7). An unnamed one fails
 * the run, which is the whole of G1: a gate nobody can fail is a wish.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "./ir_oracle.js";
import { extraArgs } from "./corpus.js";

const root = path.resolve(import.meta.dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");

/**
 * Differences that are decisions rather than work, each with the reason it is
 * one. Anything not in here is a failure.
 */
const ALLOWED = new Map([
  [
    "--emit-ast",
    "stage0's: its dump prints the `typescript` package's node names and line:column spans, and stage1's tree is the flattened one `self/nodes.ts` defines (wp14-selfhost.md §7)",
  ],
]);

/**
 * The programs the matrix runs. Small and few on purpose — this is a flag
 * matrix, and the corpus is `ir_oracle.js`'s job — but between them they reach
 * a string, a class, an array, a loop the performance class warns about, a
 * program whose modules arrive by `import`, and one that is refused, so a flag
 * that only shows up in one of those has somewhere to show up.
 *
 * Each is run with **its own flags** as the base, the ones the suite compiles
 * it with (`// smoke: args` or an `.args` sidecar), and the matrix flag on top.
 * Running a program in a mode it was not written for compares error recovery
 * rather than the flag, and the two compilers do diverge there — see the R1 row
 * for it in `docs/wp19-stage0-retirement.md` §2A, which is where that belongs.
 */
const PROGRAMS = [
  "examples/hello.ts",
  "examples/strings.ts",
  "examples/nbody.ts",
  "tests/cases/perf_str_concat_loop.ts",
  "tests/cases/reject_multi_error.ts",
  "examples/multi/main.ts",
];

/** Flags that stand alone. Every one of them is run against every program. */
const NO_VALUE = [
  "--plain",
  "--strict-exports",
  "--no-strict-exports",
  "--unchecked-indexing",
  "--nsw",
  "--wrapping",
  "--no-stack-alloc",
  "--runtime-decls",
  "--no-warn-performance",
  "--json",
  "-g",
];

/** Flags that take a value, and the values worth running. */
const VALUED = [
  ["--number-mode", "i32"],
  ["--number-mode", "f64"],
  ["--target", "host"],
  ["--target", "x86_64-unknown-linux-gnu"],
  ["--target", "aarch64-apple-darwin"],
  ["--target", "wasm32-wasi"],
];

/**
 * The flags a compiler says it has. stage0 prints one option per line, two
 * spaces then the flag, with continuations indented further; stage1 prints the
 * one-line usage with each flag in brackets. Reading both out of `--help` is
 * deliberate: a flag that is implemented and undocumented is a difference this
 * check is entitled to miss, because a user cannot find it either.
 */
function flagsOf(help) {
  const found = new Set();
  for (const line of help.split("\n")) {
    // stage0's option lines: exactly two spaces, then `-x` or `--xyz`,
    // optionally `-o, --output`. Continuations are indented much further and
    // cannot match.
    const option = /^ {2}(-[\w-]+)(?:, (--[\w-]+))?/.exec(line);
    if (option !== null) {
      found.add(option[1]);
      if (option[2] !== undefined) found.add(option[2]);
      continue;
    }
    // The usage lines, on both sides: `[--flag ...]`, and the alternatives
    // of `-v, --version | -h, --help`, which is why `,` and `|` separate too.
    for (const m of line.matchAll(/(?:^|[[\s|,])(--?[\w-]+)/g)) found.add(m[1]);
  }
  return found;
}

/** `wrote <path>` names a temporary directory that differs per side. */
function normalize(text) {
  return text
    .split("\n")
    .filter((line) => !line.startsWith("wrote "))
    // The driver's own prefix is the program's name, and the two programs are
    // named differently on purpose. The diagnostics themselves carry no prefix
    // and are compared whole.
    .map((line) => line.replace(/^(amritc|compile): /, ""))
    .join("\n")
    .trimEnd();
}

function llFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".ll")).sort();
}

function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * One cell of the matrix: both compilers, the same program, the same flags,
 * the same output directory spelling. Answers null when they agree, and the
 * first thing that differed when they do not.
 */
function runBoth(binary, work, program, flags) {
  const dir0 = fresh(path.join(work, "stage0"));
  const dir1 = fresh(path.join(work, "stage1"));
  const opts = { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  const a = spawnSync("node", [cli, program, "-o", `${dir0}/`, ...flags], opts);
  const b = spawnSync(binary, [program, "-o", `${dir1}/`, ...flags], opts);

  if (a.status !== b.status) return `exit ${a.status} vs ${b.status}`;
  if (normalize(a.stdout) !== normalize(b.stdout)) {
    return `stdout:\n  stage0: ${normalize(a.stdout).split("\n")[0]}\n  stage1: ${normalize(b.stdout).split("\n")[0]}`;
  }
  if (normalize(a.stderr) !== normalize(b.stderr)) {
    return `stderr:\n  stage0: ${normalize(a.stderr).split("\n")[0]}\n  stage1: ${normalize(b.stderr).split("\n")[0]}`;
  }
  const names0 = llFiles(dir0);
  const names1 = llFiles(dir1);
  if (names0.join(",") !== names1.join(",")) {
    return `modules [${names0.join(" ")}] vs [${names1.join(" ")}]`;
  }
  for (const name of names0) {
    const ir0 = fs.readFileSync(path.join(dir0, name), "utf8");
    const ir1 = fs.readFileSync(path.join(dir1, name), "utf8");
    if (ir0 !== ir1) {
      const at = ir0.split("\n").findIndex((line, i) => line !== ir1.split("\n")[i]);
      return `${name} differs at line ${at + 1}`;
    }
  }
  return null;
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const binary = build();
  if (binary === null) return 1;

  const help0 = spawnSync("node", [cli, "--help"], { cwd: root, encoding: "utf8" });
  const help1 = spawnSync(binary, ["--help"], { cwd: root, encoding: "utf8" });
  if (help0.status !== 0 || help1.status !== 0) {
    process.stderr.write("parity: a compiler would not answer --help\n");
    return 1;
  }
  const flags0 = flagsOf(help0.stdout);
  const flags1 = flagsOf(help1.stdout);

  const differences = [];
  const rows = [];
  for (const flag of [...new Set([...flags0, ...flags1])].sort()) {
    const both = flags0.has(flag) && flags1.has(flag);
    const owner = flags0.has(flag) ? "stage0" : "stage1";
    if (both) {
      rows.push([flag, "both", ""]);
      continue;
    }
    const reason = ALLOWED.get(flag);
    rows.push([flag, `${owner} only`, reason ?? "UNNAMED"]);
    if (reason === undefined) differences.push(`${flag}: ${owner} only, with no reason given`);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "amrit-parity-"));
  let cells = 0;
  const combinations = [...NO_VALUE.map((f) => [f]), ...VALUED];
  for (const program of PROGRAMS) {
    for (const flags of combinations) {
      // A flag one side documents and the other does not is already a
      // difference above; running it would report the same thing twice, in a
      // worse shape. A flag *neither* documents still runs: `--nsw` and
      // `--strict-exports` are accepted by both and listed by neither, since
      // they now spell out what the compiler does anyway, and they are exactly
      // the kind of flag that stops being wired up without anyone noticing.
      if (flags.some((f) => f.startsWith("-") && flags0.has(f) !== flags1.has(f))) continue;
      // The program's own flags first, and the matrix flag on top -- unless
      // the two name the same thing, in which case the cell would be asking
      // what `--number-mode i32 --number-mode f64` means rather than what the
      // flag does.
      const own = extraArgs(path.join(root, program));
      if (flags.some((f) => own.includes(f))) continue;
      const all = [...own, ...flags];
      cells++;
      const why = runBoth(binary, work, program, all);
      if (why !== null) differences.push(`${program} ${all.join(" ")}: ${why}`);
      if (verbose) process.stdout.write(`  ${why === null ? "same" : "DIFF"} ${program} ${all.join(" ")}\n`);
    }
  }
  fs.rmSync(work, { recursive: true, force: true });

  if (verbose || differences.length > 0) {
    const width = Math.max(...rows.map(([flag]) => flag.length));
    for (const [flag, where, note] of rows) {
      if (!verbose && where === "both") continue;
      process.stdout.write(`  ${flag.padEnd(width)}  ${where}${note ? `  ${note}` : ""}\n`);
    }
    for (const d of differences) process.stdout.write(`  DIFFERENCE ${d}\n`);
  }

  const named = rows.filter(([, where, note]) => where !== "both" && note !== "UNNAMED").length;
  process.stdout.write(
    `${flags0.size} stage0 flags, ${flags1.size} stage1 flags, ` +
      `${cells} flag/program pairs agree, ${differences.length} differences` +
      `${named > 0 ? `, ${named} named exception${named === 1 ? "" : "s"}` : ""}\n`
  );
  return differences.length === 0 ? 0 : 1;
}

process.exit(main(process.argv.slice(2)));
