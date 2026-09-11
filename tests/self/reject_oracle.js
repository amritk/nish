/**
 * The S3 rejection oracle: every negative case in the suite, refused by stage1
 * with the message the case pins (docs/wp14-selfhost.md §4, milestone S3).
 *
 *   node tests/self/reject_oracle.js             the whole set
 *   node tests/self/reject_oracle.js --verbose   name every skip
 *
 * Accepting the same programs is half of a checker being the same checker;
 * *refusing* the same ones, for the same reason, is the other half, and it is
 * the half a dump comparison cannot see. Each case's expected fragments are
 * the ones the suite already requires of stage0 — one per line of
 * `tests/cases/<name>.err`, and the whole of `tests/link/<name>/expected.err`
 * for a program of several modules — so this asserts exactly the same thing of
 * stage1: it must exit non-zero and its output must contain every fragment.
 *
 * The `tests/link/` cases are here because a rejection that needs more than
 * one module — a name imported twice, a `main` outside the entry, a class
 * reached through a chain of modules — can only be provoked by a whole
 * program, and stage1 has driven whole programs since S5.
 *
 * Two kinds of case are not stage1's to answer, and each is counted and named
 * apart from the other so that neither can hide in a total:
 *
 *   - it is refused by the S2 *parser*, which turns forbidden syntax down by
 *     name rather than by the message stage0's Phase 0 validator writes. Those
 *     wordings are deliberately different — a message about the operator the
 *     programmer wrote beats one about a node kind — and the count is the
 *     measurement, not a hole;
 *   - stage0 compiles it and only the link step refuses it, and `--link` is
 *     stage0's half of the driver (docs/wp14-selfhost.md §3a D4), so stage1
 *     has no such message to write.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { extraArgs, linkPrograms, root } from "./corpus.js";
import { fileURLToPath } from "node:url";

const cli = path.join(root, "dist", "index.js");
const CASES = path.join(root, "tests", "cases");
const BACKLOG = path.join(root, "tests", "self", "reject_backlog.txt");

/** `--number-mode` is the only flag `self/dump_checked.ts` takes. */
const SUPPORTED_FLAGS = new Set(["--number-mode"]);

/**
 * The cases stage1 does not refuse the same way *yet*, one name per line.
 * Listing one keeps the suite green while the port finishes, and the count is
 * printed in the summary so the remaining work is visible rather than hidden
 * in a skip. A listed case that starts agreeing is a failure too: the file is
 * the current state of the port, not a permanent exemption.
 */
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

/** The flags this case is compiled with, split into what stage1 takes and what it does not. */
function argsFor(file) {
  const flags = [];
  const unsupported = [];
  const raw = extraArgs(file);
  for (let i = 0; i < raw.length; i++) {
    if (SUPPORTED_FLAGS.has(raw[i])) flags.push(raw[i], raw[++i]);
    else unsupported.push(raw[i]);
  }
  return { flags, unsupported };
}

function compare(binary, entry) {
  const { flags, unsupported } = argsFor(entry.file);
  if (unsupported.length > 0) return { skipped: `stage1's dump_checked has no ${unsupported.join(" ")}` };
  const named = path.relative(root, entry.file);
  // A `tests/link` case may be refused by the compiler or only by the linker,
  // and `expected.err` does not say which. stage0 answers it: what it compiles
  // is a `--link` failure, and `--link` never reached stage1 (D4).
  if (entry.linked && compiles(named, flags)) {
    return { skipped: "stage0 compiles it; only `--link` refuses it, and `--link` is stage0's" };
  }
  const run = spawnSync(binary, [...flags, named], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout}${run.stderr}`;
  if (run.status === 0) return { failed: "stage1 accepted it" };
  // A parser refusal is a different wording by design; the checker's is not.
  if (/syntax error:/.test(output)) return { parser: firstLine(output) };
  const missing = entry.fragments.filter((fragment) => !output.includes(fragment));
  if (missing.length > 0) {
    return { failed: `wanted ${JSON.stringify(missing[0])}, got ${JSON.stringify(firstLine(output))}` };
  }
  return { fragments: entry.fragments.length };
}

/** Whether stage0 compiles the program at all, IR written to a directory it then forgets. */
function compiles(named, flags) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "nish-reject-"));
  const r = spawnSync("node", [cli, named, "-o", `${out}${path.sep}`, ...flags], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.rmSync(out, { recursive: true, force: true });
  return r.status === 0;
}

function firstLine(output) {
  const line = output.trim().split("\n")[0] ?? "";
  return line.replace(/^[^:]*:\d+:\d+: /, "");
}

/**
 * Every negative case: the single-module `reject_*` goldens, then the whole
 * programs of `tests/link/` that carry an `expected.err`. `name` is what the
 * backlog file lists a case under.
 */
function corpus() {
  const entries = [];
  for (const name of fs.readdirSync(CASES).sort()) {
    if (!name.startsWith("reject_") || !name.endsWith(".ts")) continue;
    const file = path.join(CASES, name);
    const err = file.replace(/\.ts$/, ".err");
    if (!fs.existsSync(err)) continue;
    entries.push({
      name: path.basename(name, ".ts"),
      file,
      linked: false,
      // One expected fragment per line, as `tests/run.js` reads them.
      fragments: fs
        .readFileSync(err, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    });
  }
  for (const program of linkPrograms()) {
    if (program.expectedErr === null) continue;
    // `tests/link/<name>/expected.err` is one needle, newlines and all.
    entries.push({
      name: `link/${program.name}`,
      file: program.main,
      linked: true,
      fragments: [program.expectedErr],
    });
  }
  return entries;
}

function build() {
  const out = path.join(root, "build", "self", "dump_checked");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync("node", [cli, path.join(root, "self", "dump_checked.ts"), "--link", out], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    process.stderr.write(`${r.stderr}\n`);
    return null;
  }
  return out;
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const named = argv.filter((a) => !a.startsWith("--"));
  const binary = build();
  if (binary === null) return 1;
  const all = corpus();
  const inputs =
    named.length > 0
      ? named
          .map((f) => path.resolve(f))
          .map((f) => all.find((e) => e.file === f) ?? { name: f, file: f, linked: false, fragments: [] })
      : all;
  const known = backlog();
  let agreed = 0;
  let checked = 0;
  const parser = [];
  const skipped = [];
  const failed = [];
  const pending = [];
  for (const entry of inputs) {
    const result = compare(binary, entry);
    const where = path.relative(root, entry.file);
    if (result.parser !== undefined) {
      parser.push(`${where}: ${result.parser}`);
    } else if (result.skipped !== undefined) {
      skipped.push(`${where}: ${result.skipped}`);
    } else if (result.failed !== undefined) {
      if (known.has(entry.name)) pending.push(`${where}: ${result.failed}`);
      else failed.push(`${where}: ${result.failed}`);
    } else if (known.has(entry.name)) {
      failed.push(`${where}: agrees now — remove it from tests/self/reject_backlog.txt`);
    } else {
      agreed++;
      checked += result.fragments;
    }
  }
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose) {
    for (const p of pending) process.stdout.write(`  backlog ${p}\n`);
    for (const p of parser) process.stdout.write(`  parser ${p}\n`);
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
  }
  const compared = inputs.length - parser.length - skipped.length - pending.length;
  const note = pending.length > 0 ? `, ${pending.length} in the backlog` : "";
  process.stdout.write(
    `${agreed}/${compared} cases rejected with the expected message (${checked} fragments), ` +
      `${parser.length} refused by the parser instead, ${skipped.length} skipped${note}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { compare, corpus, build };
