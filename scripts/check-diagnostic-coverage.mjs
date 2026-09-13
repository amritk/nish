#!/usr/bin/env node
/**
 * Which diagnostic wordings are pinned by a case that outlives stage0.
 *
 *   node scripts/check-diagnostic-coverage.mjs           report, and fail on a regression
 *   node scripts/check-diagnostic-coverage.mjs --list    name every uncovered code
 *   node scripts/check-diagnostic-coverage.mjs --update  rewrite the backlog file
 *   node scripts/check-diagnostic-coverage.mjs --jobs 4  how many compilers at once
 *
 * **What this measures and why it is a gate.** WP19 §2B, "The wording gap":
 * every diagnostic the compiler can print is presently proved by *comparison* —
 * stage0 and stage1 saying the same words about the same program — and after
 * R6 there is no second implementation to compare with. What survives is the
 * `reject_*` cases and the `tests/link/` negatives, whose expected fragments
 * are checked in, and they do not reach every rule. A wording nothing reaches
 * is a wording anyone can change to anything, in either compiler, without a
 * test noticing.
 *
 * So: compile every negative case, read the `code` of every diagnostic it
 * prints, and hold the set against the registry. `tests/self/wording_backlog.txt`
 * lists the codes that are still unreached; a code that leaves the backlog
 * cannot come back to it without this failing, and a *new* code that arrives
 * without a case fails immediately. That is the ratchet: the gap is allowed to
 * shrink and never to grow.
 *
 * **Why a script rather than a block in `npm test`.** It compiles the whole
 * negative corpus a second time, which is a minute of a three-minute suite for
 * an answer that only changes when a diagnostic does. `ci.yml` runs it as its
 * own step, beside the registry staleness check it is the twin of: that one
 * says every diagnostic has a code, this one says every code has a case.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { registry } from "./gen-diagnostic-codes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "dist", "index.js");
const CASES = path.join(root, "tests", "cases");
const LINK = path.join(root, "tests", "link");
const BACKLOG = path.join(root, "tests", "self", "wording_backlog.txt");

/**
 * The rules whose words a case could reach: the generator's own registry, less
 * the **retired** entries. A retired fragment is one no message in the source
 * contains any more; `scripts/gen-diagnostic-codes.mjs` keeps its line so its
 * number is never handed to a different rule, and says so — "a retired
 * fragment matches nothing, so carrying it costs a string". Counting those as
 * uncovered would measure history rather than coverage, which is why this
 * imports the generator instead of parsing what it wrote: the generated files
 * carry the fragment and the code, and only the generator knows which of them
 * are still live.
 */
function liveRules() {
  const byCode = new Map();
  let retired = 0;
  let shadowed = 0;
  for (const entry of registry()) {
    if (entry.retired === true) {
      retired++;
      continue;
    }
    // Shadowed: every message this rule's fragment occurs in also contains an
    // earlier-sorted fragment, so `codeFor` answers with the other rule and no
    // program can make the compiler print this code. Asking for a case would
    // be asking for one nobody can write; the generator computes it, this only
    // counts it.
    if (entry.shadowed === true) {
      shadowed++;
      continue;
    }
    if (!byCode.has(entry.code)) byCode.set(entry.code, entry.fragment);
  }
  return { byCode, retired, shadowed };
}

/**
 * The command lines that make the **driver** talk, and the rule each one has
 * to print the words of.
 *
 * A usage error and the internal-error report are the two diagnostics that
 * never carry a `code`: a usage error is stderr and exit 2 (`AGENTS.md`), and
 * the crash report is prose around the one `NL0003` object. Their wordings are
 * in the registry all the same, because the generator reads them out of
 * `src/index.ts` like any other message — so measuring coverage by codes alone
 * would leave six rules looking unreachable when what is unreachable is the
 * *code*, not the words.
 *
 * Naming the code rather than the sentence is deliberate: the script looks the
 * fragment up in the registry and asserts the output contains it, so the
 * assertion is "this command prints the words of NL3008" and there is no
 * second copy of the wording here to drift from the first.
 */
const DRIVER_CASES = [
  { name: "unknown option", argv: ["examples/hello.ts", "--bogus"], codes: ["NL3008"] },
  {
    name: "unsupported target",
    argv: ["examples/hello.ts", "--target", "mips-unknown-elf", "-o", "/dev/null"],
    codes: ["NL3001"],
  },
  {
    name: "internal compiler error",
    argv: ["examples/hello.ts", "-o", "/dev/null"],
    env: { NISH_SIMULATE_ICE: "1" },
    codes: ["NL3003", "NL3005", "NL3002", "NL3007"],
  },
];

/**
 * The programs that *compile* and warn, and the rule each warning is.
 *
 * A WP15 §8 performance warning goes to stderr on a successful compile, so no
 * `reject_*` case can reach one: a case with a `.err` must fail. What pins
 * these wordings is the WP15 block of `tests/run.js`, which compiles the same
 * programs and matches the same sentences; this table is how the *registry*
 * learns they are pinned, and it fails if a warning stops being printed.
 */
const WARNING_CASES = [
  { name: "perf_str_concat_loop", codes: ["NL9002"] },
  { name: "perf_alloc_loop", codes: ["NL9001"] },
  { name: "perf_arena_drop", codes: ["NL9003"] },
  { name: "perf_overflow", codes: ["NL9004", "NL9005"] },
  { name: "perf_overflow_const", codes: ["NL9006"] },
];

/** Every negative case: the `reject_*` goldens and the `tests/link/` programs with an `expected.err`. */
function negatives() {
  const out = [];
  for (const name of fs.readdirSync(CASES).sort()) {
    if (!name.startsWith("reject_") || !name.endsWith(".ts")) continue;
    const file = path.join(CASES, name);
    if (!fs.existsSync(file.replace(/\.ts$/, ".err"))) continue;
    out.push({ name: path.basename(name, ".ts"), file, args: argsFor(file) });
  }
  for (const dir of fs.existsSync(LINK) ? fs.readdirSync(LINK).sort() : []) {
    const program = path.join(LINK, dir);
    if (!fs.existsSync(path.join(program, "expected.err"))) continue;
    const main = path.join(program, "main.ts");
    if (!fs.existsSync(main)) continue;
    const argsFile = path.join(program, "args");
    out.push({
      name: `link/${dir}`,
      file: main,
      args: fs.existsSync(argsFile) ? split(fs.readFileSync(argsFile, "utf8")) : [],
    });
  }
  return out;
}

function argsFor(file) {
  const sidecar = file.replace(/\.ts$/, ".args");
  return fs.existsSync(sidecar) ? split(fs.readFileSync(sidecar, "utf8")) : [];
}

const split = (text) => text.trim().split(/\s+/).filter(Boolean);

/**
 * The codes one program's compile prints. `--json` is what makes this a
 * measurement rather than a guess: the code is the compiler's own answer, not
 * this script matching wordings a second time and getting a different result
 * from `codeFor`.
 */
function codesOf(entry) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, path.relative(root, entry.file), "--json", ...entry.args], {
      cwd: root,
    });
    let text = "";
    child.stdout.on("data", (chunk) => (text += chunk));
    child.stderr.on("data", (chunk) => (text += chunk));
    child.on("close", () => {
      const found = new Set();
      for (const match of text.matchAll(/"code"\s*:\s*"(NL\d+)"/g)) found.add(match[1]);
      resolve(found);
    });
  });
}

/**
 * Run the driver cases and answer the codes whose words came out, naming any
 * that did not. A missing wording is a failure of this table rather than of
 * the compiler: the command still printed something, and what it printed is no
 * longer the rule this says it is.
 */
function driverCodes(byCode) {
  const covered = new Set();
  const wrong = [];
  const runs = [
    ...DRIVER_CASES,
    ...WARNING_CASES.map((entry) => ({
      name: entry.name,
      argv: [path.join("tests", "cases", `${entry.name}.ts`), "-o", "/dev/null"],
      codes: entry.codes,
    })),
  ];
  for (const entry of runs) {
    const r = spawnSync(process.execPath, [cli, ...entry.argv], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...(entry.env ?? {}) },
    });
    const text = `${r.stdout}${r.stderr}`;
    for (const code of entry.codes) {
      const fragment = byCode.get(code);
      if (fragment === undefined) continue; // retired or shadowed: not this table's business
      if (text.includes(fragment)) covered.add(code);
      else wrong.push(`${entry.name}: ${code}'s words are not in what it printed (${JSON.stringify(fragment)})`);
    }
  }
  return { covered, wrong };
}

/** `--jobs N`, defaulting to the cores this machine says it has, capped where the pool caps. */
function jobsFrom(argv) {
  const at = argv.indexOf("--jobs");
  if (at >= 0) return Math.max(1, Number(argv[at + 1]) || 1);
  return Math.min(8, Math.max(1, (fs.existsSync("/proc/cpuinfo") ? 8 : 4)));
}

async function pool(items, width, work) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await work(items[i]);
  });
  await Promise.all(workers);
  return results;
}

/** The backlog file: one code per line, `#` comments and blanks ignored. */
function backlog() {
  if (!fs.existsSync(BACKLOG)) return new Set();
  return new Set(
    fs
      .readFileSync(BACKLOG, "utf8")
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter((line) => line.length > 0)
  );
}

function writeBacklog(missing, byCode) {
  const header = `# The diagnostic wordings that no surviving case exercises (WP19 G2.4).
#
# Every code here is a message the compiler can print and nothing checks the
# words of. Today they are proved by stage0 and stage1 agreeing; after R6 that
# comparison is gone and they would be proved by nothing, so this file is a
# work list rather than a list of exemptions.
#
# GENERATED by scripts/check-diagnostic-coverage.mjs --update. The check is a
# ratchet: a code that leaves this file may not come back, and a code that is
# not here and not covered fails the run. Write a \`reject_*\` case, run the
# script with --update, and the line disappears.
#
# ${missing.length} live codes, measured against tests/cases/reject_* and
# tests/link/. Retired fragments are not here and never will be: they match no
# message, so no case can reach them.
`;
  const lines = missing.map((code) => `${code}  # ${byCode.get(code) ?? ""}`.trimEnd());
  fs.writeFileSync(BACKLOG, `${header}\n${lines.join("\n")}\n`);
}

async function main(argv) {
  if (!fs.existsSync(cli)) {
    process.stderr.write("no dist/: run `npm run build` first\n");
    return 2;
  }
  const { byCode, retired, shadowed } = liveRules();
  const cases = negatives();
  const jobs = jobsFrom(argv);
  const t0 = Date.now();
  const found = await pool(cases, jobs, codesOf);
  const covered = new Set();
  for (const set of found) for (const code of set) covered.add(code);
  const driver = driverCodes(byCode);
  for (const code of driver.covered) covered.add(code);

  const all = [...byCode.keys()].sort();
  const missing = all.filter((code) => !covered.has(code));
  const known = backlog();
  // A code in the backlog that a case now reaches is the ratchet turning, and
  // the file has to be told: left there, the next uncovered code could hide
  // behind it.
  const closed = [...known].filter((code) => !missing.includes(code)).sort();
  const unlisted = missing.filter((code) => !known.has(code));

  if (argv.includes("--update")) {
    writeBacklog(missing, byCode);
    process.stdout.write(`wrote ${path.relative(root, BACKLOG)} (${missing.length} codes)\n`);
    return 0;
  }
  if (argv.includes("--list")) {
    for (const code of missing) process.stdout.write(`${code}  ${byCode.get(code) ?? ""}\n`);
  }
  for (const code of unlisted) {
    process.stdout.write(`  FAIL ${code} is exercised by no case and is not in the backlog: ${byCode.get(code)}\n`);
  }
  for (const code of closed) {
    process.stdout.write(`  FAIL ${code} is covered now — remove it from ${path.relative(root, BACKLOG)}\n`);
  }
  for (const line of driver.wrong) process.stdout.write(`  FAIL ${line}\n`);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  process.stdout.write(
    `diagnostic coverage: ${all.length - missing.length}/${all.length} live codes exercised by ` +
      `${cases.length} negative cases, ${DRIVER_CASES.length} driver runs and ` +
      `${WARNING_CASES.length} warning runs (${seconds} s, ${jobs} jobs), ` +
      `${missing.length} in the backlog, ` +
      `${retired} retired and ${shadowed} shadowed rules not counted\n`
  );
  return unlisted.length === 0 && closed.length === 0 && driver.wrong.length === 0 ? 0 : 1;
}

process.exit(await main(process.argv.slice(2)));
