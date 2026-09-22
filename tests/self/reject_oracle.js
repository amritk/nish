/**
 * The S3 rejection oracle: every negative case in the suite, refused by stage1
 * with the message the case pins (docs/wp14-selfhost.md §4, milestone S3).
 *
 *   node tests/self/reject_oracle.js             the whole set
 *   node tests/self/reject_oracle.js --verbose   name every skip
 *
 * Accepting the right programs is half of a checker being correct; *refusing*
 * the right ones, for the right reason, is the other half, and it is the half a
 * dump comparison cannot see. Each case's expected fragments are the ones the
 * suite already requires of the driver — one per line of
 * `tests/cases/<name>.err`, and the whole of `tests/link/<name>/expected.err`
 * for a program of several modules — so this asserts the same thing of the
 * checker on its own: it must exit non-zero and its output must contain every
 * fragment.
 *
 * The `tests/link/` cases are here because a rejection that needs more than
 * one module — a name imported twice, a `main` outside the entry, a class
 * reached through a chain of modules — can only be provoked by a whole
 * program, and stage1 has driven whole programs since S5.
 *
 * Two kinds of case are counted and named apart from the rest, so that neither
 * can hide in a total:
 *
 *   - it is refused by the S2 *parser*, which turns forbidden syntax down by
 *     name rather than by the message stage0's Phase 0 validator wrote. Those
 *     wordings were deliberately different — a message about the operator the
 *     programmer wrote beats one about a node kind — and since stage0 retired
 *     the case's `.err` pins stage1's sentence, so a parser refusal is held to
 *     its fragments like any other case *and* counted in the bucket, whose size
 *     is the measurement rather than a hole. `tests/self/parser_refusals.txt` is that
 *     measurement case by case, and its header is the contract; the bucket and
 *     the register are compared both ways below, so a rule leaving the
 *     checker's reach and a rule coming back each fail until somebody says so.
 *     Before the register the bucket was a number in the summary line and
 *     nothing held it to anything, which is the caveat
 *     `docs/wp19-stage0-retirement.md` §5's R3 row states against its own
 *     declaration. It gates on every run, where the same shrink-only rule in
 *     `tests/diagnostic_coverage.js` waits for `--strict-refusals`: that tool
 *     runs over *two* compilers and its list is true of one of them, so
 *     `tests/run.js` passes the flag on one of its two runs. This oracle has
 *     only ever run stage1, so there is no run the register is not true of and
 *     no flag to put it behind;
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

/** The register, as every message about it names it. */
const REFUSALS_FILE = path.relative(root, REFUSALS);

/** `--number-mode` is the only flag `self/dump_checked.ts` takes. */
const SUPPORTED_FLAGS = new Set(["--number-mode"]);

/**
 * A `<case>  <the rest of the line>` list — the shape
 * `tests/diagnostic_coverage.js` reads its two shrink-only lists with, and the
 * shape of both of this oracle's: `reject_backlog.txt`, the cases stage1 does
 * not refuse the same way *yet*, where nothing follows the name, and
 * `parser_refusals.txt`, where the rest of the line is the sentence stage1
 * answers with. Neither is a permanent exemption: a line that stops being true
 * fails the run in each of them.
 *
 * `#` starts a comment only at the start of a line, where `backlog()` used to
 * strip one anywhere. A registered sentence can contain a `#` — a diagnostic
 * quotes what the programmer wrote — and no case name can.
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

/**
 * The register against the bucket, in both directions, as a function of what a
 * run observed and of nothing else:
 *
 *   - `bucket` is `{ name, where, sentence }` per case stage1's parser refused;
 *   - `unproven` is the registered names this run could not ask, because the
 *     case was skipped. Unproven is not stale, and keeping the two apart is
 *     the whole reason this is a set rather than an absence;
 *   - `registered` is the register as read, and is **consumed**: what is left
 *     after the bucket is walked is exactly the lines nothing matched;
 *   - `present` is the case names this corpus has, so that a file named on the
 *     command line and not in it is held to nothing;
 *   - `whole` is whether every case ran. The second direction is a question
 *     only a whole run may ask: with a handful of cases named on the command
 *     line, "nothing refuses this" would be a fact about the filter rather
 *     than about the parser, which is why `--require-coverage` is asked of one
 *     of `tests/diagnostic_coverage.js`'s two runs and not the other.
 *
 * It takes its inputs rather than reading them so that `selfCheck` can watch
 * each of its four failures happen, on every run. A gate nobody has seen fail
 * is a wish, which is the argument the register itself makes.
 */
const auditRegister = ({ bucket, unproven, registered, present, whole }) => {
  const failed = [];
  for (const { name, where, sentence } of bucket) {
    const pinned = registered.get(name);
    registered.delete(name);
    if (pinned === undefined) {
      if (present.has(name)) {
        failed.push(
          `${where}: refused by stage1's parser and not in ${REFUSALS_FILE} — ` +
            `add the line: ${name}\t${sentence}`
        );
      }
    } else if (pinned !== sentence) {
      failed.push(
        `${where}: ${REFUSALS_FILE} pins ${JSON.stringify(pinned)}, got ${JSON.stringify(sentence)}`
      );
    }
  }
  if (!whole) return failed;
  // The direction the register is *for*: its purpose is to shrink, so a line
  // the walk above did not match is a claim about nothing.
  for (const name of registered.keys()) {
    if (unproven.has(name)) {
      failed.push(
        `${name}: skipped by this run, so nothing here proves it — remove it ` +
          `from ${REFUSALS_FILE}, or the flag in its \`.args\` that skipped it`
      );
      continue;
    }
    const why = present.has(name)
      ? "stage1's parser does not refuse it any more"
      : "names no case in this corpus";
    failed.push(`${name}: ${why} — remove it from ${REFUSALS_FILE}`);
  }
  return failed;
};

/**
 * `auditRegister`'s four failures, watched happening, before a compiler is
 * built and in about a millisecond.
 *
 * The corpus cannot do this. A green run is one where every one of those
 * failures is unreached, so deleting the `registered.delete(name)` above — or
 * any other branch of it — would change nothing about `npm test`, and the
 * register would go back to being a file nothing compares. That is the defect
 * the register exists to close, one level up, and it would be a strange file
 * to add without answering it here.
 */
const selfCheck = () => {
  const present = new Set(["reject_here", "reject_gone", "reject_flagged"]);
  const one = (name, sentence, where = `tests/cases/${name}.ts`) => [{ name, where, sentence }];
  const audit = (over) =>
    auditRegister({
      bucket: [],
      unproven: new Set(),
      registered: new Map(),
      present,
      whole: true,
      ...over,
    });
  const pinned = () => new Map([["reject_here", "found `??`"]]);
  const cases = [
    [
      "a registered case refused with its sentence says nothing",
      audit({ bucket: one("reject_here", "found `??`"), registered: pinned() }),
      [],
    ],
    [
      "a case in the bucket and not in the register",
      audit({ bucket: one("reject_here", "found `??`") }),
      ["reject_here", "not in", "add the line"],
    ],
    [
      "a sentence that is not the one pinned",
      audit({ bucket: one("reject_here", "found `?.`"), registered: pinned() }),
      ["reject_here", "pins"],
    ],
    [
      "a case the parser has stopped refusing",
      audit({ registered: new Map([["reject_gone", "found `??`"]]) }),
      ["reject_gone", "does not refuse it any more"],
    ],
    [
      "a line naming no case in this corpus",
      audit({ registered: new Map([["reject_absent", "found `??`"]]) }),
      ["reject_absent", "names no case"],
    ],
    [
      "a registered case this run skipped is unproven, not stale",
      audit({
        registered: new Map([["reject_flagged", "found `??`"]]),
        unproven: new Set(["reject_flagged"]),
      }),
      ["reject_flagged", "skipped by this run"],
    ],
    [
      "a file named on the command line that this corpus has not",
      audit({ bucket: one("/tmp/scratch.ts", "found `??`", "/tmp/scratch.ts") }),
      [],
    ],
    [
      "a filtered run does not ask what only a whole run may",
      audit({ registered: new Map([["reject_gone", "found `??`"]]), whole: false }),
      [],
    ],
  ];
  const failed = [];
  for (const [what, got, wanted] of cases) {
    if (wanted.length === 0) {
      if (got.length > 0) failed.push(`self-check: ${what} — reported ${JSON.stringify(got[0])}`);
    } else if (got.length !== 1) {
      failed.push(`self-check: ${what} — wanted one failure, got ${got.length}`);
    } else {
      const missing = wanted.find((fragment) => !got[0].includes(fragment));
      if (missing !== undefined) {
        failed.push(`self-check: ${what} — wanted ${JSON.stringify(missing)} in ${JSON.stringify(got[0])}`);
      }
    }
  }
  return { failed, count: cases.length };
};

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
  const missing = entry.fragments.filter((fragment) => !output.includes(fragment));
  const failed =
    missing.length > 0 ? `wanted ${JSON.stringify(missing[0])}, got ${JSON.stringify(firstLine(output))}` : null;
  // A parser refusal is counted in the bucket, which the register holds to a
  // ceiling, and it is held to the case's fragments as well: since stage0
  // retired, a case's `.err` pins the sentence stage1 answers with, whichever
  // phase says it. The `syntax error: ` prefix is what puts the case in the
  // bucket, so it is the bucket's name rather than part of the sentence, and
  // the register does not repeat it on every line.
  if (/syntax error:/.test(output)) {
    return { parser: firstLine(output).replace(/^syntax error: /, ""), failed, fragments: entry.fragments.length };
  }
  if (failed !== null) return { failed };
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
  // Before anything is built, because a broken gate should cost a millisecond
  // to find rather than the two minutes the corpus takes.
  const selfChecked = selfCheck();
  if (selfChecked.failed.length > 0) {
    for (const f of selfChecked.failed) process.stdout.write(`  FAIL ${f}\n`);
    return 1;
  }
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
      ? // Deduplicated, so that naming a case twice does not compile it twice
        // and does not ask the register for two lines about it.
        [...new Set(named.map((f) => path.resolve(f)))].map(
          (f) => all.find((e) => e.file === f) ?? { name: f, file: f, linked: false, fragments: [] }
        )
      : all;
  const known = register(BACKLOG);
  let agreed = 0;
  let checked = 0;
  const parser = [];
  const bucket = [];
  const skipped = [];
  // Registered cases this run could not ask the question of, so that a skip is
  // never audited as the parser having changed its mind.
  const unproven = new Set();
  const failed = [];
  const pending = [];
  for (const entry of inputs) {
    const result = compare(seed, binary, entry);
    const where = path.relative(root, entry.file);
    if (result.parser !== undefined) {
      parser.push(`${where}: ${result.parser}`);
      bucket.push({ name: entry.name, where, sentence: result.parser });
      if (result.failed !== null) failed.push(`${where}: ${result.failed}`);
      else checked += result.fragments;
    } else if (result.skipped !== undefined) {
      skipped.push(`${where}: ${result.skipped}`);
      unproven.add(entry.name);
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
  failed.push(
    ...auditRegister({
      bucket,
      unproven,
      registered: register(REFUSALS),
      present: new Set(all.map((entry) => entry.name)),
      whole: named.length === 0,
    })
  );
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
      `${parser.length} refused by the parser instead (register self-check ` +
      `${selfChecked.count}/${selfChecked.count}), ${skipped.length} skipped${note}, ` +
      `seed ${seed.label}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { compare, corpus, build };
