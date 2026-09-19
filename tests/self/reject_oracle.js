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
 *     measurement, not a hole. `tests/self/parser_refusals.txt` is that
 *     measurement written down, case by case and sentence by sentence, and it
 *     is compared with the bucket both ways: a rule that leaves the checker's
 *     reach fails until somebody registers it, and a rule that comes back
 *     fails until somebody deletes its line. Before that register the bucket
 *     was a number in the summary line below and nothing held it to anything,
 *     which is the caveat `docs/wp19-stage0-retirement.md` §5's R3 row states
 *     against its own declaration;
 *   - the compiler compiles it and only the link step refuses it. What this
 *     oracle runs is `self/dump_checked.ts`, a dump entry point with no
 *     `--link` of its own, so a case whose refusal comes from the linker has
 *     no message here to compare.
 *
 * Both of those judgements used to be stage0's, and the second was a *compile*
 * by stage0 (WP19 G2.3). It is the seed's now — the last released `nish`, or
 * whatever `--seed` names — because the question is "does a compiler accept
 * this program at all", every compiler in the chain answers it, and stage0 is
 * the one that will not be here to.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { extraArgs, linkPrograms, root } from "./corpus.js";
import { fileURLToPath } from "node:url";
import { linkWith, seedForOracle, spawnSeed, withoutSeed } from "./seed.js";

const CASES = path.join(root, "tests", "cases");
const BACKLOG = path.join(root, "tests", "self", "reject_backlog.txt");
const REFUSALS = path.join(root, "tests", "self", "parser_refusals.txt");

/** `--number-mode` is the only flag `self/dump_checked.ts` takes. */
const SUPPORTED_FLAGS = new Set(["--number-mode"]);

/**
 * A `<case>  <the rest of the line>` list, `#` for a whole-line comment — the
 * shape `tests/diagnostic_coverage.js` reads its two lists with, and the shape
 * both of this oracle's lists have:
 *
 *   - `reject_backlog.txt`, the cases stage1 does not refuse the same way
 *     *yet*, whose count the summary prints so that the remaining work is
 *     visible rather than hidden in a skip. Nothing follows the name;
 *   - `parser_refusals.txt`, the cases stage1's parser refuses before the
 *     phase that owns the rule can state it, where the rest of the line is the
 *     sentence stage1 answers with.
 *
 * Both are the current state rather than a permanent exemption, so both fail
 * in the direction that matters: a backlog case that starts agreeing, and a
 * registered case the parser stops refusing, each fail until the line goes.
 */
function register(file) {
  const rows = new Map();
  if (!fs.existsSync(file)) return rows;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const text = line.replace(/^\s*#.*$/, "").trim();
    if (text.length === 0) continue;
    const at = text.search(/\s/);
    rows.set(at < 0 ? text : text.slice(0, at), at < 0 ? "" : text.slice(at).trim());
  }
  return rows;
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

function compare(seed, binary, entry) {
  const { flags, unsupported } = argsFor(entry.file);
  if (unsupported.length > 0) return { skipped: `stage1's dump_checked has no ${unsupported.join(" ")}` };
  const named = path.relative(root, entry.file);
  // A `tests/link` case may be refused by the compiler or only by the linker,
  // and `expected.err` does not say which. A compile answers it: what compiles
  // is a `--link` failure, and the dump entry point below does not link.
  if (entry.linked && compiles(seed, named, flags)) {
    return { skipped: "it compiles; only `--link` refuses it, and dump_checked does not link" };
  }
  const run = spawnSync(binary, [...flags, named], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout}${run.stderr}`;
  if (run.status === 0) return { failed: "stage1 accepted it" };
  // A parser refusal is a different wording by design; the checker's is not.
  // The `syntax error: ` prefix is what puts the case in the bucket, so it is
  // the bucket's name rather than part of the sentence, and the register does
  // not repeat it on all 89 of its lines.
  if (/syntax error:/.test(output)) return { parser: firstLine(output).replace(/^syntax error: /, "") };
  const missing = entry.fragments.filter((fragment) => !output.includes(fragment));
  if (missing.length > 0) {
    return { failed: `wanted ${JSON.stringify(missing[0])}, got ${JSON.stringify(firstLine(output))}` };
  }
  return { fragments: entry.fragments.length };
}

/** Whether the seed compiles the program at all, IR written to a directory it then forgets. */
function compiles(seed, named, flags) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "nish-reject-"));
  const r = spawnSeed(seed, [named, "-o", `${out}${path.sep}`, ...flags]);
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
 * backlog and the parser-refusal register list a case under.
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

/**
 * `self/dump_checked.ts`, linked by the seed. What this oracle compares
 * against is each case's checked-in `.err` fragments, which outlive `src/`, so
 * the compiler that builds the binary must too (WP19 G2.3).
 */
function build(seed) {
  return linkWith(
    seed,
    path.join("self", "dump_checked.ts"),
    path.join(root, "build", "self", "dump_checked")
  );
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const named = withoutSeed(argv).filter((a) => !a.startsWith("--"));
  const seed = seedForOracle(argv);
  if (seed.error !== undefined) {
    process.stderr.write(`${seed.error}\n`);
    return 1;
  }
  const binary = build(seed);
  if (binary === null) return 1;
  const all = corpus();
  const inputs =
    named.length > 0
      ? named
          .map((f) => path.resolve(f))
          .map((f) => all.find((e) => e.file === f) ?? { name: f, file: f, linked: false, fragments: [] })
      : all;
  const known = register(BACKLOG);
  const refusals = register(REFUSALS);
  const registerName = path.relative(root, REFUSALS);
  let agreed = 0;
  let checked = 0;
  const parser = [];
  const refused = new Set();
  const skipped = [];
  const failed = [];
  const pending = [];
  for (const entry of inputs) {
    const result = compare(seed, binary, entry);
    const where = path.relative(root, entry.file);
    if (result.parser !== undefined) {
      parser.push(`${where}: ${result.parser}`);
      refused.add(entry.name);
      const pinned = refusals.get(entry.name);
      if (pinned === undefined) {
        failed.push(
          `${where}: refused by stage1's parser and not in ${registerName} — ` +
            `add the line: ${entry.name}\t${result.parser}`
        );
      } else if (pinned !== result.parser) {
        failed.push(
          `${where}: ${registerName} pins ${JSON.stringify(pinned)}, got ${JSON.stringify(result.parser)}`
        );
      }
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
  // The other direction, and the one the register is *for*: its purpose is to
  // shrink, so an entry the parser has stopped refusing is a claim about
  // nothing. Only a whole run may ask it — with a few cases named on the
  // command line, "nothing refuses this" would be a fact about the filter.
  if (named.length === 0) {
    const present = new Set(all.map((entry) => entry.name));
    for (const name of refusals.keys()) {
      if (refused.has(name)) continue;
      const why = present.has(name)
        ? "stage1's parser does not refuse it any more"
        : "names no case in this corpus";
      failed.push(`${name}: ${why} — remove it from ${registerName}`);
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
      `${parser.length} refused by the parser instead, ${skipped.length} skipped${note}, ` +
      `seed ${seed.label}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { compare, corpus, build };
