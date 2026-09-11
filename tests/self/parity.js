/**
 * WP19 G1: parity between the two compilers, as one table.
 *
 *   node tests/self/parity.js                 the whole corpus, every variation
 *   node tests/self/parity.js --flags-only    the flag-set half alone (seconds)
 *   node tests/self/parity.js --only str_     just the programs whose path matches
 *   node tests/self/parity.js --verbose       list every run, not only the differences
 *   node tests/run.js --parity                the same thing, as the suite runs it
 *
 * **What this is, next to the other oracles.** `ir_oracle.js` compares the IR,
 * `checked_oracle.js` the checked dump, `interop_oracle.js` the sidecars and
 * `reject_oracle.js` the refusals — each over one surface, with the flags each
 * program already carries. This compares *everything the command line
 * produces* — exit status, stdout, stderr, and every file written — across the
 * flag variations the suite uses, which is the gate's actual question: is there
 * a program or a flag that is still stage0's?
 *
 * A difference is a failure unless it is **declared** below with a reason. The
 * mode is green when the undeclared set is empty; declared ones are counted
 * and named in the table, never hidden, for the reason a skip in the other
 * oracles is counted and named (`.claude/selfhost.md`).
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { linkPrograms, programs, root } from "./corpus.js";

const cli = path.join(root, "dist", "index.js");
const workRoot = path.join(root, "build", "test", "parity");

/**
 * The flag variations, applied on top of whatever flags a program already
 * carries. Every one of them is a flag the suite itself uses (the `.args`
 * sidecars of `tests/cases` and `tests/link`, and `tests/run.js`'s own runs);
 * nothing here is invented for the occasion.
 *
 * `family` is what the variation sets, so a program that already sets it in
 * its own `.args` is left alone rather than compiled with two spellings of one
 * flag. `stdoutOnly` marks the dumps, which write no IR.
 */
const VARIATIONS = [
  { name: "plain", args: [] },
  { name: "--plain", args: ["--plain"], family: "--plain" },
  { name: "-g", args: ["-g"], family: "-g" },
  { name: "--wrapping", args: ["--wrapping"], family: "--wrapping" },
  { name: "--unchecked-indexing", args: ["--unchecked-indexing"], family: "--unchecked-indexing" },
  { name: "--no-stack-alloc", args: ["--no-stack-alloc"], family: "--no-stack-alloc" },
  { name: "--no-strict-exports", args: ["--no-strict-exports"], family: "strict-exports" },
  { name: "--strict-exports", args: ["--strict-exports"], family: "strict-exports" },
  { name: "--runtime-decls", args: ["--runtime-decls"], family: "--runtime-decls" },
  { name: "--number-mode f64", args: ["--number-mode", "f64"], family: "--number-mode" },
  { name: "--target", args: ["--target", "x86_64-unknown-linux-gnu"], family: "--target" },
  { name: "--target host", args: ["--target", "host"], family: "--target" },
  { name: "--emit-checked", args: ["--emit-checked"], family: "dump", stdoutOnly: true },
  { name: "--emit-ast", args: ["--emit-ast"], family: "dump", stdoutOnly: true },
];

/**
 * Differences that are decided rather than broken. Each answers "why is this
 * not a parity bug?" in its own words, and each is counted in the table, so
 * the list can only grow by someone writing a sentence they are willing to
 * sign.
 *
 * A declaration is **narrow on purpose**: `normalize` rewrites away exactly
 * the part that is allowed to differ, and whatever still differs afterwards is
 * reported as undeclared. A declaration that returned a constant would swallow
 * the next real divergence on the same surface, which is the failure mode this
 * whole mode exists to prevent — the one exception is `whole`, for a surface
 * where every byte differs by design and there is nothing finer to say.
 */
const DECLARED = [
  {
    flag: "--emit-ast",
    surface: "stdout",
    whole: true,
    why: "each compiler dumps its own tree: stage0 the `typescript` package's node names and 1-based line:col spans, stage1 the flattened vocabulary of `self/nodes.ts` with byte offsets (wp19 §2A). A golden per compiler pins each; there is deliberately no oracle between them.",
  },
  {
    // No `flag`: this one is about the program, not about how it was compiled.
    surface: "stderr",
    matches: (want, got, run) => {
      const zero = firstDiagnostic(want);
      const one = firstDiagnostic(got);
      const syntax = (line) => line.includes(": syntax error: ");
      // stage1's parser refused the file and stage0's Phase 0 refused the same
      // file. Both said no, in different words, and stage1 has nothing further
      // to say because it never built a tree. Anything else — stage0 accepting
      // the program, a different file, stage1 refusing where stage0 does not —
      // falls through and reports.
      if (!syntax(one)) return false;
      // Under `--emit-ast` stage0 says nothing at all: the `typescript` parser
      // recovers from the syntax error and it prints the tree it got. There is
      // no stage0 diagnostic to compare against, and the reason is this one.
      if (zero === "") return run.flags.includes("--emit-ast");
      return (
        !syntax(zero) && diagnosticFile(one) !== "" && diagnosticFile(one) === diagnosticFile(zero)
      );
    },
    why: "the parser refuses before Phase 0 gets to name the rule. `.claude/selfhost.md` states the habit — lex and parse what is written, refuse in the phase that owns the rule — and stage1's grammar is Nish-0's, so syntax the language forbids stops at the parser with `expected `;`` where stage0 parses it with the `typescript` package and refuses it in Phase 0 by name. 43 cases of the corpus are this, and `reject_oracle.js` counts them apart for the same reason. What is *not* declared here is the outcome: the exit status, the stdout and every file written are still compared, and stage0 accepting a program stage1 refuses is a failure, not this.",
  },
  {
    surface: "exit",
    matches: (want, got, run) => {
      const syntax = firstDiagnostic(run.one.stderr).includes(": syntax error: ");
      // Only that direction: stage0 dumped a tree and exited 0, stage1 could
      // not read the file. stage1 exiting 0 where stage0 refuses is a failure.
      return syntax && want === "0" && got === "1";
    },
    why: "the same parser refusal as the stderr declaration above, on the surface a dump flag reaches: `--emit-ast` asks for the tree of a program stage1's grammar cannot read, so there is none to print and it exits 1, while stage0 parses it with the `typescript` package, which recovers from the syntax error, dumps a tree and exits 0. Declared only when stage1's own first diagnostic is that syntax error and only in that direction.",
  },
  {
    flag: "--emit-checked",
    surface: "stdout",
    normalize: (text) => text.replace(/^module .*?([^/\\]+\.ts)( \(entry\))?$/gm, "module $1$2"),
    why: "the `module <path>` header only. stage0 rewrites a file name to be cwd-relative (`displayName` in src/dump.ts) because the harness hands it absolute paths and a golden must not carry a checkout path; stage1 prints the path it was given, because it has no `cwd` to relativise against and adding a builtin to change one line of a debug dump is what §4 means by the runtime budget dying. Every other line of the dump is compared as it stands.",
  },
];

/**
 * The declaration covering a surface, or null. It is keyed on the flags the
 * run *effectively* carried, not on the variation's name: a program whose own
 * `.args` ask for a dump (`tests/cases/dump_ast.ts`) is dumping under every
 * variation, and keying on the name reported its difference as undeclared
 * eleven times over.
 *
 * `whole` declarations match outright; the rest have to *earn* it by
 * normalising the two texts into agreement, so a second, real difference on
 * the same surface still reports. A declaration with no `flag` applies to
 * every invocation, and one with a `matches` predicate is asked about the two
 * texts together — which is what a difference whose *shape* is the decided
 * part needs, rather than one whose bytes are.
 */
function declaredFor(flags, surface, want, got, run) {
  for (const d of DECLARED) {
    if (d.flag !== undefined && !flags.includes(d.flag)) continue;
    if (d.surface !== surface) continue;
    if (d.whole === true) return d;
    if (d.matches !== undefined && d.matches(want, got, run)) return d;
    if (d.normalize !== undefined && d.normalize(want) === d.normalize(got)) return d;
  }
  return null;
}

/** The first `error:` / `warning:` line of a report, or "". */
function firstDiagnostic(text) {
  return text.split("\n").find((line) => / (error|warning): /.test(line)) ?? "";
}

/** The file a diagnostic line names, or "" when it names none. */
function diagnosticFile(line) {
  const m = line.match(/^(.*?):\d+:\d+: /);
  return m === null ? "" : m[1];
}

/**
 * The stage1 compiler this compares against: `build/self/compile`, linked from
 * `self/compile.ts` by stage0, which is what every other oracle builds too.
 * Reused when it is already there, so a run of the mode after `npm test` does
 * not pay for it twice. `NISH_PARITY_COMPILER` points at another one.
 */
async function build() {
  const out = path.join(root, "build", "self", "compile");
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await run("node", [cli, path.join(root, "self", "compile.ts"), "--link", out]);
  if (r.status !== 0) {
    process.stderr.write(`parity: could not build the stage1 compiler\n${r.stderr}\n`);
    return null;
  }
  return out;
}

/** Spawn, resolving with `{ status, stdout, stderr }` as strings. */
function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (status) => resolve({ status, stdout: out, stderr: err }));
    child.on("error", (e) => resolve({ status: null, stdout: out, stderr: String(e) }));
  });
}

function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Every file under `dir`, as `relative path -> bytes`, so a missing file is a difference too. */
function tree(dir) {
  const out = new Map();
  const walk = (at, prefix) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(at, entry.name);
      const rel = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else out.set(rel, fs.readFileSync(full, "utf8"));
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out;
}

/**
 * The path of the first byte at which two texts differ, as a line and its two
 * spellings — the shape `ir_oracle.js` reports, because it is what a reader
 * can act on without opening both files.
 */
function firstDifference(want, got) {
  const wantLines = want.split("\n");
  const gotLines = got.split("\n");
  for (let i = 0; i < Math.max(wantLines.length, gotLines.length); i++) {
    if (wantLines[i] !== gotLines[i]) {
      return `line ${i + 1}: stage1 \`${gotLines[i] ?? "<end>"}\`, stage0 \`${wantLines[i] ?? "<end>"}\``;
    }
  }
  return "the texts differ but no line does";
}

/** Compare one program under one variation; returns the differences it found. */
async function compare(compiler, program, variation, index) {
  const own = program.args;
  if (variation.family !== undefined && own.includes(variation.family)) return [];
  if (variation.family === "strict-exports" && (own.includes("--strict-exports") || own.includes("--no-strict-exports"))) {
    return [];
  }
  if (variation.family === "--number-mode" && own.includes("--number-mode")) return [];

  const work = fresh(path.join(workRoot, String(index)));
  const zeroDir = fresh(path.join(work, "stage0"));
  const oneDir = fresh(path.join(work, "stage1"));
  const args = [...own, ...variation.args];
  const [zero, one] = await Promise.all([
    run("node", [cli, program.entry, "-o", `${zeroDir}${path.sep}`, ...args]),
    run(compiler, [program.entry, "-o", `${oneDir}${path.sep}`, ...args]),
  ]);

  const found = [];
  // The whole run is handed to a declaration as well as the two texts, because
  // a difference on one surface can be decided by what happened on another:
  // an exit status of 1 where stage0 has 0 is the parser's refusal when the
  // stderr *is* that refusal, and nothing else.
  const note = (surface, want, got, detail) => {
    const declared = declaredFor(args, surface, want, got, { zero, one, flags: args });
    found.push({ program: program.name, variation: variation.name, surface, detail, declared });
  };

  if (zero.status !== one.status) {
    note("exit", String(zero.status), String(one.status), `stage0 ${zero.status}, stage1 ${one.status}`);
  }
  if (zero.stdout !== one.stdout) note("stdout", zero.stdout, one.stdout, firstDifference(zero.stdout, one.stdout));
  // stderr is compared as the *set of messages*, not byte for byte: stage0
  // prints a source excerpt with a caret under the offending node and stage1
  // prints the same diagnostics without it, which `reject_oracle.js` owns and
  // `docs/wp14-selfhost.md` §7 records. The `error:` lines themselves must
  // match, and that is what this compares.
  const errors = (text) =>
    text
      .split("\n")
      .filter((l) => / (error|warning): /.test(l))
      .join("\n");
  if (errors(zero.stderr) !== errors(one.stderr)) {
    note("stderr", errors(zero.stderr), errors(one.stderr), firstDifference(errors(zero.stderr), errors(one.stderr)));
  }
  if (variation.stdoutOnly !== true) {
    const zeroTree = tree(zeroDir);
    const oneTree = tree(oneDir);
    const names = new Set([...zeroTree.keys(), ...oneTree.keys()]);
    for (const name of [...names].sort()) {
      const want = zeroTree.get(name);
      const got = oneTree.get(name);
      if (want === undefined) note("files", "", name, `stage1 wrote ${name}, stage0 did not`);
      else if (got === undefined) note("files", name, "", `stage0 wrote ${name}, stage1 did not`);
      else if (want !== got) note(name, want, got, firstDifference(want, got));
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
  return found;
}

/** Run `fn` over `items` with at most `n` in flight; results keep the input order. */
async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return results;
}

/**
 * The corpus as `{ name, entry, args }`: every positive program, every
 * `tests/link` program (including the ones that exist to be refused — a
 * refusal is a surface too, and both compilers must refuse alike), and the
 * `reject_*` cases, which are where the two have the most to disagree about.
 */
function corpus() {
  const out = [];
  for (const entry of programs()) {
    out.push({ name: path.relative(root, entry), entry, args: argsFor(entry) });
  }
  for (const program of linkPrograms()) {
    out.push({ name: `link/${program.name}`, entry: program.main, args: argsFor(program.main) });
  }
  const casesDir = path.join(root, "tests", "cases");
  for (const name of fs.readdirSync(casesDir).sort()) {
    if (!name.endsWith(".err")) continue;
    const entry = path.join(casesDir, `${name.slice(0, -4)}.ts`);
    if (fs.existsSync(entry)) out.push({ name: `cases/${name.slice(0, -4)}`, entry, args: argsFor(entry) });
  }
  return out;
}

function argsFor(entry) {
  const sidecar = entry.replace(/\.ts$/, ".args");
  if (fs.existsSync(sidecar)) return fs.readFileSync(sidecar, "utf8").trim().split(/\s+/).filter(Boolean);
  const dirArgs = path.join(path.dirname(entry), "args");
  if (path.basename(entry) === "main.ts" && fs.existsSync(dirArgs)) {
    return fs.readFileSync(dirArgs, "utf8").trim().split(/\s+/).filter(Boolean);
  }
  const marker = /^\/\/ smoke: args (.*)$/m.exec(fs.readFileSync(entry, "utf8"));
  return marker ? marker[1].trim().split(/\s+/).filter(Boolean) : [];
}

/**
 * Flags one compiler documents and the other does not.
 *
 * The corpus half below compiles *programs* with flags, which can only ever
 * exercise a flag someone thought to put in `VARIATIONS`. This asks the other
 * question — what flags does each compiler say it has? — and it is the half
 * that found the two differences no oracle and no variation could reach:
 * `--no-warn-performance` was stage0's and stage1 printed no performance
 * warnings at all, and `--out-dir` was stage1's alone. Both had been there for
 * as long as they had existed.
 *
 * The set comes from each compiler's own `--help`, which is deliberate: a flag
 * that is implemented and undocumented is a difference this is entitled to
 * miss, because a user cannot find it either.
 */
function flagsOf(help) {
  const found = new Set();
  for (const line of help.split("\n")) {
    // stage0's option lines: exactly two spaces, then `-x` or `--xyz`,
    // optionally `-o, --output`. Continuations are indented much further and
    // cannot match, so a flag named in a description is not counted.
    const option = /^ {2}(-[\w-]+)(?:, (--[\w-]+))?/.exec(line);
    if (option !== null) {
      found.add(option[1]);
      if (option[2] !== undefined) found.add(option[2]);
      continue;
    }
    // The usage lines on both sides: `[--flag ...]`, and the alternatives of
    // `-v, --version | -h, --help`, which is why `,` and `|` separate too.
    for (const m of line.matchAll(/(?:^|[[\s|,])(--?[\w-]+)/g)) found.add(m[1]);
  }
  return found;
}

/**
 * The flag-set difference, as rows shaped like the corpus half's so one table
 * prints both. A flag on one side only is undeclared unless `DECLARED` names
 * it, which is how `--emit-ast` — answered by both compilers now, about their
 * own trees — differs from a flag one of them simply does not have.
 */
function flagSetDifferences(help0, help1) {
  const flags0 = flagsOf(help0);
  const flags1 = flagsOf(help1);
  const out = [];
  for (const flag of [...new Set([...flags0, ...flags1])].sort()) {
    if (flags0.has(flag) === flags1.has(flag)) continue;
    const owner = flags0.has(flag) ? "stage0" : "stage1";
    const declared = DECLARED.find((d) => d.flag === flag && d.surface === "flag set") ?? null;
    out.push({
      program: "--help",
      variation: "flag set",
      surface: "flag set",
      declared,
      detail: `\`${flag}\` is ${owner}'s alone`,
    });
  }
  return out;
}

async function main(argv) {
  const verbose = argv.includes("--verbose");
  // The flag-set half needs two `--help` runs and no corpus, so it is seconds
  // where the whole mode is minutes. `tests/run.js` runs it on every `npm
  // test` for that reason; the corpus half stays the opt-in mode it was built
  // as.
  const flagsOnly = argv.includes("--flags-only");
  const onlyAt = argv.indexOf("--only");
  const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;
  const compiler = process.env.NISH_PARITY_COMPILER ?? (await build());
  if (compiler === null) return 1;
  fresh(workRoot);

  const runs = [];
  if (!flagsOnly) {
    for (const program of corpus()) {
      if (only !== null && !program.name.includes(only)) continue;
      for (const variation of VARIATIONS) runs.push({ program, variation });
    }
  }
  const t0 = Date.now();
  // A full run is minutes — `self/`'s modules are whole programs and every one
  // of them is compiled under every variation — so it says where it is. On
  // stderr, so that piping the table somewhere does not collect the progress
  // with it, and only when stderr is a terminal, so a CI log is not a
  // thousand lines of counter.
  const total = runs.length;
  let done = 0;
  const ticking = process.stderr.isTTY === true && !verbose;
  const results = await pool(runs, 8, async (run_, i) => {
    const found = await compare(compiler, run_.program, run_.variation, i);
    done++;
    if (ticking && done % 25 === 0) {
      process.stderr.write(`\rparity: ${done}/${total} runs`);
    }
    return found;
  });
  if (ticking) process.stderr.write(`\r${" ".repeat(30)}\r`);
  // The flag sets, compared once: it is a property of the two compilers rather
  // than of any program, so it does not belong in the per-run pool above.
  const help0 = await run("node", [cli, "--help"]);
  const help1 = await run(compiler, ["--help"]);
  if (help0.status !== 0 || help1.status !== 0) {
    process.stdout.write("parity: a compiler would not answer --help\n");
    return 1;
  }
  const differences = [...flagSetDifferences(help0.stdout, help1.stdout), ...results.flat()];
  const undeclared = differences.filter((d) => d.declared === null);
  const declared = differences.filter((d) => d.declared !== null);

  if (undeclared.length > 0 || verbose) {
    const rows = verbose ? differences : undeclared;
    process.stdout.write(`${"program".padEnd(44)} ${"variation".padEnd(20)} ${"surface".padEnd(12)} detail\n`);
    process.stdout.write(`${"-".repeat(110)}\n`);
    for (const d of rows) {
      process.stdout.write(
        `${d.program.padEnd(44)} ${d.variation.padEnd(20)} ${d.surface.padEnd(12)} ${d.declared ? "(declared) " : ""}${d.detail}\n`
      );
    }
  }
  if (declared.length > 0) {
    const byReason = new Map();
    for (const d of declared) byReason.set(d.declared, (byReason.get(d.declared) ?? 0) + 1);
    for (const [reason, count] of byReason) {
      const where = reason.flag ?? "any invocation";
      process.stdout.write(`declared: ${count} × ${where} ${reason.surface} — ${reason.why}\n`);
    }
  }
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  process.stdout.write(
    flagsOnly
      ? `parity: the flag sets each --help names (${seconds} s); ` +
        `${undeclared.length} undeclared difference(s), ${declared.length} declared\n`
      : `parity: ${runs.length} runs over ${new Set(runs.map((r) => r.program.name)).size} programs ` +
        `(${seconds} s); ${undeclared.length} undeclared difference(s), ${declared.length} declared\n`
  );
  return undeclared.length === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
