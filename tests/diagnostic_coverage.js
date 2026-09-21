#!/usr/bin/env node
/**
 * The diagnostic wordings, measured and pinned (WP19 gate G2.4, the half of it
 * `docs/wp19-stage0-retirement.md` §2B calls "the wording gap").
 *
 *   node tests/diagnostic_coverage.js                    verify and report
 *   node tests/diagnostic_coverage.js --compiler build/nish
 *   node tests/diagnostic_coverage.js --report           every uncovered code, named
 *   node tests/diagnostic_coverage.js --update           rewrite the `.err` pins
 *   node tests/diagnostic_coverage.js --require-coverage every code provoked or explained
 *   node tests/diagnostic_coverage.js --strict-refusals  the registers must describe this compiler exactly
 *
 * **What this answers.** `src/codes.ts` / `self/codes.ts` is the registry of
 * stable diagnostic codes, and a code is a promise about a rule. The prose
 * behind it is not promised — but until stage0 is deleted it is *proved*, by
 * two implementations printing the same sentence, and after R6 it would be
 * proved by nothing. So the question this tool asks is: **which registry codes
 * does the suite actually provoke, and where is the wording written down?**
 *
 * It asks it the only way that survives `src/` being deleted: by compiling
 * programs and reading `--json`, never by matching the compiler's source
 * against a table copied out of it. The registry it reads is `self/codes.ts`,
 * the half that outlives stage0, and the compiler it runs is a parameter.
 *
 * **What it checks.**
 *
 *   1. Every case in `tests/wordings/` produces the code its file name spells,
 *      with the message its `.err` pins, byte for byte. A reworded diagnostic
 *      fails twice over: the `.err` no longer matches, and the generator gives
 *      the new words a new number, so the code no longer matches either.
 *   2. Under `--require-coverage`, every registry code is either provoked by
 *      the corpus, listed in `tests/wordings/unreachable.txt` with a reason, or
 *      listed in `tests/wordings/stage0_only.txt` with the programs that
 *      provoke it under stage0. A new diagnostic therefore arrives with a case
 *      or with a sentence saying why it cannot have one — which is the property
 *      the gate wants, and the one that quietly stops holding otherwise.
 *   3. A code listed as unreachable that turns out to be reachable fails, so
 *      the list can shrink but not rot. The same holds of `stage0_only.txt`
 *      under `--strict-refusals`, and running the tool against a compiler that
 *      *does* provoke those codes checks the other direction: the programs a
 *      line names must be exactly the ones the run found.
 *
 * **The corpus.** The `reject_*` cases and the `tests/link/` negatives, which
 * `tests/self/reject_oracle.js` owns and which survive stage0; the `perf_*`
 * cases, because a WP15 §8 warning is a diagnostic on a program that compiles
 * and so can never be a `reject_*` case (their wordings are pinned by the
 * performance block of `tests/run.js`); and `tests/wordings/`, which is this
 * file's own corpus and exists to reach what the other two do not.
 *
 * **stage1's parser gets there first, sometimes.** `.claude/selfhost.md`: lex
 * and parse what is written, refuse in the phase that owns the rule. For the
 * constructs the language forbids outright, stage1's parser turns the syntax
 * down by name before Phase 0 or the checker can state the rule, which is
 * §A3's declared parity class. Such a case is listed in
 * `tests/wordings/parser_refusals.txt`: the pinned wording is stage0's, and
 * stage1 is allowed to answer it with a syntax error instead. **Those wordings
 * do not survive R6**, because after it nothing prints them; the summary
 * counts them apart for exactly that reason.
 *
 * **The criterion, asked of the compiler that survives.** G2 reads "every
 * registry code provoked by something that outlives stage0, or unreachable with
 * a reason", and until `stage0_only.txt` existed the only compiler this tool
 * could ask it of was stage0 — which does not outlive stage0. Asked of stage1,
 * `--require-coverage` answered with 80 findings telling the reader to write a
 * reason that was already written: every program provoking those 80 codes was
 * recorded, with the sentence stage1 answers instead, in
 * `tests/self/parser_refusals.txt`, `parser_refusals.txt` or
 * `stage1_divergence.txt`. Those registers are per *case* and the criterion is
 * per *code*, and nothing joined the two. `stage0_only.txt` is that join and
 * nothing else — it names programs rather than repeating sentences, so it
 * cannot drift from the registers without failing — and it is why `npm test`
 * can now pass `--require-coverage` on the stage1 run as well as the stage0
 * one. It empties into `unreachable.txt` at R6, when nothing prints those
 * wordings any more.
 *
 * `tests/wordings/stage1_divergence.txt` is the other list, and it is not a
 * declaration of anything: it names the programs the two compilers answer
 * differently — some of which stage1 *compiles* — found by writing this corpus
 * and reported rather than fixed, because a code is keyed on its message text
 * and rewording one retires the code. The summary line counts both lists; the
 * counts move, so read them there rather than here.
 *
 * `npm test` runs this tool over stage1 with `--strict-refusals` and
 * `--require-coverage`, so all three registers have to match what stage1 does
 * exactly: they can shrink, and they cannot grow by accident.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jobsFrom, pool, run } from "./pool.js";
import { readCodesRegistry } from "../scripts/codes-registry.js";
import { extraArgs, linkPrograms, root } from "./self/corpus.js";

const WORDINGS = path.join(root, "tests", "wordings");
const CASES = path.join(root, "tests", "cases");
const REGISTRY = path.join(root, "self", "codes.ts");
const UNREACHABLE = path.join(WORDINGS, "unreachable.txt");
const REFUSALS = path.join(WORDINGS, "parser_refusals.txt");
const DIVERGENCE = path.join(WORDINGS, "stage1_divergence.txt");
const STAGE0_ONLY = path.join(WORDINGS, "stage0_only.txt");
/** The reject corpus's register, `tests/self/reject_oracle.js`'s, read here only to join against. */
const SELF_REFUSALS = path.join(root, "tests", "self", "parser_refusals.txt");
const BUILD = path.join(root, "build", "test", "wordings");

/** `.js` / `.mjs` / `.cjs` is a Node entry point; anything else a native binary. */
const NODE_ENTRY = /\.(?:js|mjs|cjs)$/;

/** A wordings case is named for the code it pins, so the directory is the coverage map. */
const CASE_NAME = /^(nl\d{4})_[a-z0-9_]+\.ts$/;

/**
 * The registry as the compilers hold it: fragment first, code second, flat,
 * longest fragment first. `self/codes.ts` rather than `src/codes.ts` because
 * this tool has to keep working in a tree where stage0 has been deleted; the
 * two files are required to be identical by `tests/run.js`, so reading either
 * reads both.
 *
 * The indentation is not part of the contract, and reading it as though it were
 * is what turned this tool's coverage half off. `self/codes.ts`'s tables lost a
 * level when WP22 stage C rewrote them as arrows with concise bodies, and a
 * pattern keyed on four literal spaces then parsed **0 of 408** codes rather
 * than failing: `--require-coverage` iterated an empty map, the per-case
 * registry-fragment cross-check found no fragment for any code, and the tool
 * printed `coverage 0/0 codes` and exited 0.
 *
 * The parse and both halves of that fix -- `^\s+`, and raising rather than
 * answering an empty registry -- now live once, in
 * [`scripts/codes-registry.js`](../scripts/codes-registry.js). Three readers
 * drifting apart is what issue #96 is about; this one keys the result by code,
 * because what it asks of the registry is which rule a `--json` object names.
 */
const registry = () => new Map(readCodesRegistry(REGISTRY).map(({ fragment, code }) => [code, fragment]));

/**
 * A `CODE  reason` list, `#` for a comment. Two of these exist and both are
 * the same shape as `tests/self/reject_backlog.txt`: a line is a thing
 * somebody wrote down, and the run says when one has gone stale.
 */
const readList = (file) => {
  const rows = new Map();
  if (!fs.existsSync(file)) return rows;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const text = line.replace(/^\s*#.*$/, "").trim();
    if (text.length === 0) continue;
    const at = text.search(/\s/);
    if (at < 0) rows.set(text, "");
    else rows.set(text.slice(0, at), text.slice(at).trim());
  }
  return rows;
};

/** The flags a case is compiled with, from the `.args` sidecar the rest of the suite uses. */
const argsOf = (file) => extraArgs(file);

/** `tests/wordings/nl2200_empty_import_list.ts`: the code it pins and the wording it expects. */
const wordingCases = () => {
  const cases = [];
  for (const name of fs.readdirSync(WORDINGS).sort()) {
    const named = CASE_NAME.exec(name);
    if (named === null) continue;
    const file = path.join(WORDINGS, name);
    const err = file.replace(/\.ts$/, ".err");
    const stem = path.basename(name, ".ts");
    cases.push({
      stem,
      file,
      args: argsOf(file),
      code: named[1].toUpperCase(),
      expected: fs.existsSync(err) ? fs.readFileSync(err, "utf8").trim() : null,
    });
  }
  return cases;
};

/**
 * Everything else that provokes a diagnostic and outlives stage0: the
 * single-module negatives, the `tests/link/` negatives, and the `perf_*`
 * positives. Nothing here is asserted on — `tests/run.js` and
 * `reject_oracle.js` already own these files — they are read for the
 * measurement, so that a wording those cases already reach does not get a
 * second case here for no reason.
 */
const corpusPrograms = () => {
  const programs = [];
  for (const name of fs.readdirSync(CASES).sort()) {
    if (!name.endsWith(".ts")) continue;
    const negative =
      name.startsWith("reject_") && fs.existsSync(path.join(CASES, `${name.slice(0, -3)}.err`));
    if (!negative && !name.startsWith("perf_")) continue;
    const file = path.join(CASES, name);
    programs.push({ stem: path.basename(name, ".ts"), file, args: argsOf(file) });
  }
  for (const program of linkPrograms()) {
    if (program.expectedErr === null) continue;
    programs.push({ stem: `link/${program.name}`, file: program.main, args: argsOf(program.main) });
  }
  return programs;
};

/** A compiler as something spawnable, the way `tests/nish-cmp.js` spells one. */
const resolveCompiler = (spec) => {
  const file = path.resolve(root, spec);
  const refuse = (why) => ({ error: `compiler ${spec} ${why}` });
  if (!fs.existsSync(file)) return refuse("does not exist");
  if (!fs.statSync(file).isFile()) return refuse("is not a file");
  const compiler = NODE_ENTRY.test(file)
    ? { label: spec, cmd: process.execPath, prefix: [file] }
    : { label: spec, cmd: file, prefix: [] };
  if (compiler.prefix.length === 0) {
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      return refuse("is not executable (only .js/.mjs/.cjs are run under node)");
    }
  }
  return compiler;
};

/**
 * The compiler nobody named. `NISH_BOOTSTRAP` first, because that is the seed
 * `scripts/bootstrap.sh` and CI already agree on (G3), then what
 * `npm run bootstrap` leaves behind, and stage0 last — which is the order that
 * keeps this runnable in a tree where `dist/` is all there is *and* in the one
 * after R6 where it is not.
 */
const defaultCompiler = () => {
  const seed = process.env.NISH_BOOTSTRAP;
  if (seed !== undefined && seed !== "") return seed;
  for (const candidate of [path.join("build", "nish"), path.join("dist", "index.js")]) {
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }
  return null;
};

/**
 * Whether a run's `--json` objects are the parser turning the file down rather
 * than a phase naming a rule. Every syntax error carries one code (`SYNTAX` in
 * `self/codes.ts`), which is the field to key on: the prose is two different
 * parsers' and is allowed to improve.
 */
const refusedByParser = (result) => result.objects.some((o) => o.code === "NL0001");

/**
 * One program through the compiler, with every `--json` object it printed.
 *
 * `-o` is a directory of its own per program, and not because anyone reads it:
 * a program one compiler refuses and the other compiles would otherwise drop a
 * `.ll` beside its source, and the corpus directory would grow build output
 * every time the two disagreed. The directory form takes a multi-module
 * `tests/link/` program as happily as a single file.
 */
const compile = async (compiler, program) => {
  const named = path.relative(root, program.file).split(path.sep).join("/");
  const out = path.join(BUILD, program.stem.replace(/[^\w.-]+/g, "_"));
  fs.mkdirSync(out, { recursive: true });
  const result = await run(
    compiler.cmd,
    [...compiler.prefix, named, "--json", "-o", `${out}${path.sep}`, ...program.args],
    { cwd: root, encoding: "utf8" }
  );
  const objects = [];
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("{")) objects.push(JSON.parse(line));
  }
  return { ...result, objects };
};

/** `--jobs N`, `--compiler <spec>` and the flags; everything else is a case name filter. */
const parse = (argv) => {
  const options = {
    compiler: undefined,
    report: false,
    update: false,
    strict: false,
    coverage: false,
    names: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--compiler") options.compiler = argv[++i];
    else if (arg === "--report") options.report = true;
    else if (arg === "--update") options.update = true;
    else if (arg === "--strict-refusals") options.strict = true;
    else if (arg === "--require-coverage") options.coverage = true;
    else if (arg === "--jobs")
      i++; // read by `jobsFrom`
    else if (!arg.startsWith("--")) options.names.push(arg);
  }
  return options;
};

const main = async (argv) => {
  const options = parse(argv);
  const spec = options.compiler ?? defaultCompiler();
  if (spec === null) {
    process.stderr.write("no compiler: pass --compiler <nish>, set NISH_BOOTSTRAP, or run `npm run build`\n");
    return 2;
  }
  const compiler = resolveCompiler(spec);
  if (compiler.error !== undefined) {
    process.stderr.write(`${compiler.error}\n`);
    return 2;
  }

  const codes = registry();
  const unreachable = readList(UNREACHABLE);
  const refusals = readList(REFUSALS);
  const divergence = readList(DIVERGENCE);
  const filter = (stem) => options.names.length === 0 || options.names.some((n) => stem.includes(n));

  const cases = wordingCases().filter((c) => filter(c.stem));
  const others = options.names.length > 0 ? [] : corpusPrograms();
  const jobs = jobsFrom(argv);
  const caseRuns = await pool(cases, jobs, (c) => compile(compiler, c));
  const otherRuns = await pool(others, jobs, (p) => compile(compiler, p));

  // Which codes the whole corpus reached, and where. Every program that reaches
  // a code is recorded rather than the first alone, because `stage0_only.txt`
  // is checked against the whole set: a line there names the programs that
  // provoke its code, and "the first one in corpus order" would let a second
  // program arrive without the line noticing. The report still names the first,
  // and corpus order is stable, so two runs of this tool name the same file.
  const reached = new Map();
  const uncoded = new Map();
  const note = (stem, objects) => {
    for (const object of objects) {
      const where = reached.get(object.code);
      if (where === undefined) reached.set(object.code, [stem]);
      else if (!where.includes(stem)) where.push(stem);
      if (object.code === "NL0000" && !uncoded.has(object.message)) uncoded.set(object.message, stem);
    }
  };
  others.forEach((program, i) => {
    note(program.stem, otherRuns[i].objects);
  });

  const failed = [];
  const refused = [];
  const diverged = [];
  let pinned = 0;
  cases.forEach((c, i) => {
    const result = caseRuns[i];
    note(c.stem, result.objects);
    const hit = result.objects.find((o) => o.code === c.code);
    if (hit === undefined) {
      // stage1's parser refuses forbidden syntax by name before the phase that
      // owns the rule can state it (§A3's declared class), and stage1 answers
      // a handful of these programs differently or not at all (§2B). Both are
      // per-case declarations, and anything else is a failure.
      //
      // The refusal is read off the objects and not off stderr: this runs the
      // compiler with `--json`, and under `--json` a diagnostic is an object on
      // stdout and stderr is empty (`docs/LANGUAGE.md`). stage1 used to print
      // its parser's refusals to stderr whatever the command line said, so a
      // stderr test here would pass exactly when that bug came back — which is
      // what makes these 41 cases the thing that asks, on every `npm test`,
      // whether stage1 still answers the flag.
      if (refusedByParser(result) && refusals.has(c.stem)) {
        refused.push(c.stem);
        return;
      }
      if (divergence.has(c.stem)) {
        diverged.push(c.stem);
        return;
      }
      const saw = result.objects.map((o) => `${o.code} ${o.message}`).join(" | ") || "(no diagnostic)";
      failed.push(`${c.stem}: expected ${c.code}, got ${saw}`);
      return;
    }
    if ((refusals.has(c.stem) || divergence.has(c.stem)) && options.strict) {
      const list = refusals.has(c.stem) ? REFUSALS : DIVERGENCE;
      failed.push(`${c.stem}: agrees now — remove it from ${path.relative(root, list)}`);
      return;
    }
    if (options.update) {
      fs.writeFileSync(c.file.replace(/\.ts$/, ".err"), `${hit.message}\n`);
      pinned++;
      return;
    }
    if (c.expected === null) {
      failed.push(`${c.stem}: no .err beside it (run with --update to write one)`);
      return;
    }
    if (c.expected !== hit.message) {
      failed.push(`${c.stem}: pinned ${JSON.stringify(c.expected)}, got ${JSON.stringify(hit.message)}`);
      return;
    }
    // The `.err` is the whole message; the registry fragment is the run of it
    // the code is keyed on. Both have to hold, because a reword that kept the
    // fragment would still be a reword, and one that kept the message while
    // the registry moved would mean the code had been renumbered by hand.
    const fragment = codes.get(c.code);
    if (fragment !== undefined && !hit.message.includes(fragment)) {
      failed.push(`${c.stem}: message does not contain ${c.code}'s registry fragment`);
      return;
    }
    pinned++;
  });

  // Coverage. A code is covered when some program in the corpus provoked it,
  // explained when `unreachable.txt` says why no program can, and explained the
  // other way when `stage0_only.txt` names the programs that do provoke it and
  // the compiler under test answers them in its parser instead.
  const covered = [...codes.keys()].filter((code) => reached.has(code));
  const stage0Only = readList(STAGE0_ONLY);
  const declaredBy = new Map();
  for (const [file, label] of [
    [SELF_REFUSALS, "tests/self/parser_refusals.txt"],
    [REFUSALS, path.relative(root, REFUSALS)],
    [DIVERGENCE, path.relative(root, DIVERGENCE)],
  ]) {
    for (const stem of readList(file).keys()) if (!declaredBy.has(stem)) declaredBy.set(stem, label);
  }
  const compiled = new Set([...cases, ...others].map((p) => p.stem));

  // The criterion WP19 G2 states is "every registry code provoked by something
  // that outlives stage0, or unreachable with a reason", and until this block
  // existed it could only be asked of stage0 — which does not outlive stage0.
  // Asked of stage1 it answered with 80 findings, every one of which had a
  // reason on file in a register this tool did not read: the registers are per
  // *case* and the criterion is per *code*, and nothing joined them.
  // `stage0_only.txt` is that join, and these are the checks that keep it one.
  //
  // The two directions are not the same check and neither replaces the other.
  // Run against a compiler that provokes the code — stage0 today — the named
  // set must be exactly the set the run found, so the line cannot go stale as
  // the corpus grows a case. Run against stage1, the code must not be provoked
  // at all, and `--strict-refusals` is what says so: it is the flag that means
  // "the registers describe this compiler exactly", which is what it already
  // enforces for the other two. A line that stops being true fails until it is
  // deleted, which is the rule every register in this directory follows.
  //
  // A filtered run gates nothing: with a handful of programs compiled,
  // "nothing provokes this code" would be a fact about the filter.
  if ((options.coverage || options.strict) && options.names.length === 0) {
    for (const [code, named] of stage0Only) {
      const stems = named
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const where = reached.get(code);
      if (stems.length === 0) {
        failed.push(`${code} names no program in ${path.relative(root, STAGE0_ONLY)}`);
        continue;
      }
      if (!codes.has(code)) {
        failed.push(
          `${code} is not in the registry any more — remove it from ${path.relative(root, STAGE0_ONLY)}`
        );
        continue;
      }
      if (unreachable.has(code)) {
        failed.push(
          `${code} is in ${path.relative(root, STAGE0_ONLY)} and ${path.relative(root, UNREACHABLE)} at once — a code a program provokes is not unreachable`
        );
      }
      for (const stem of stems) {
        if (!compiled.has(stem)) {
          failed.push(
            `${code}: ${path.relative(root, STAGE0_ONLY)} names ${stem}, which is not a program this corpus has`
          );
        } else if (!declaredBy.has(stem)) {
          failed.push(
            `${code}: nothing records what this compiler answers ${stem} with — declare it in tests/self/parser_refusals.txt, ${path.relative(root, REFUSALS)} or ${path.relative(root, DIVERGENCE)}`
          );
        }
      }
      if (where === undefined) continue;
      if (options.strict) {
        failed.push(
          `${code} is provoked after all (${where.join(", ")}) — remove it from ${path.relative(root, STAGE0_ONLY)}`
        );
        continue;
      }
      const missing = where.filter((stem) => !stems.includes(stem));
      const extra = stems.filter((stem) => !where.includes(stem));
      if (missing.length > 0 || extra.length > 0) {
        failed.push(
          `${code}: ${path.relative(root, STAGE0_ONLY)} names ${stems.join(",")}, this run found ${where.join(",")}` +
            `${missing.length > 0 ? ` (add ${missing.join(",")})` : ""}${extra.length > 0 ? ` (drop ${extra.join(",")})` : ""}`
        );
      }
    }
  }

  if (options.coverage && options.names.length === 0) {
    for (const code of codes.keys()) {
      if (reached.has(code) || unreachable.has(code) || stage0Only.has(code)) continue;
      failed.push(
        `${code} is provoked by nothing: add a case to tests/wordings/, a reason to ${path.relative(root, UNREACHABLE)}, ` +
          `or — if a program provokes it and this compiler answers that program in its parser — a line to ${path.relative(root, STAGE0_ONLY)}`
      );
    }
    for (const code of unreachable.keys()) {
      if (!reached.has(code)) continue;
      failed.push(
        `${code} is reachable after all (${reached.get(code).join(", ")}) — remove it from ${path.relative(root, UNREACHABLE)}`
      );
    }
  }

  // Three states, and the third is the one this report used to call the second.
  // A code no program provokes is `unreachable`; a code some program provokes
  // that this compiler answers in its parser is `stage0 only`, and naming those
  // "(no reason on file)" was what made 80 codes look like a gap in the corpus
  // rather than the declared parity class they are.
  if (options.report) {
    for (const code of [...codes.keys()].sort()) {
      const where = reached.get(code);
      const why = unreachable.get(code);
      const named = stage0Only.get(code);
      const state =
        where !== undefined
          ? `covered by ${where[0]}`
          : named !== undefined
            ? `stage0 only: ${named} (${declaredBy.get(named.split(",")[0].trim()) ?? "no register"})`
            : `unreachable: ${why ?? "(no reason on file)"}`;
      process.stdout.write(`  ${code} ${state}\n`);
    }
  }
  for (const line of failed) process.stdout.write(`  FAIL ${line}\n`);

  // The uncoded remainder: a diagnostic whose message has no literal run long
  // enough to key a rule on. `tests/run.js` pins the count; every one of them
  // is named here, because this is the run that has every message in front of
  // it and the fix is to give that message words of its own.
  for (const [message, stem] of uncoded) process.stdout.write(`  uncoded: ${message} (${stem})\n`);
  const aside =
    refused.length + diverged.length > 0
      ? ` (${refused.length} refused by the parser, ${diverged.length} answered differently)`
      : "";
  // `stage0 only` is counted apart from `unreachable` for the reason §2B gives
  // about the 41: those wordings do not survive R6, and a count that folded
  // them in would say the registry was better covered than it will be.
  const stage0OnlyUnreached = [...stage0Only.keys()].filter((code) => !reached.has(code)).length;
  process.stdout.write(
    `wordings: ${pinned}/${cases.length} cases pin their code${aside}, ` +
      `coverage ${covered.length}/${codes.size} codes, ${unreachable.size} unreachable, ` +
      `${stage0OnlyUnreached} stage0-only, uncoded=${uncoded.size} (compiler ${compiler.label})\n`
  );
  return failed.length === 0 ? 0 : 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));

export { corpusPrograms, registry, wordingCases };
