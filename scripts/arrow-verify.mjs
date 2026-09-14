/**
 * Prove a `function`-to-arrow rewrite changed nothing, by compiling the corpus
 * before and after it and comparing every emitted byte.
 *
 *   node scripts/arrow-verify.mjs                       the whole corpus
 *   node scripts/arrow-verify.mjs self                  only programs under self/
 *   node scripts/arrow-verify.mjs --concise docs        hunt WP22 §8a's bug class
 *   node scripts/arrow-verify.mjs --debug tests/cases   add `-g` to every compile
 *   node scripts/arrow-verify.mjs --applied self        verify the rewrite already
 *                                                       applied to the working tree
 *
 * WP22 §2 is the reason this is the right check rather than a proxy for one:
 * the emitter reads `FunctionSig`s and there is no `isFunctionDeclaration`
 * anywhere in `src/codegen/`, so an arrow-declared function must produce the
 * same `define`, the same attributes and the same body. **A byte of difference
 * is a bug in the rewrite until proven otherwise.** §8 says the docs half of
 * stage C worked because `regen.sh` made that diff one command; this is the
 * same command for every other surface.
 *
 * The corpus is compiled **twice out of one directory**: a copy of the tracked
 * tree is compiled, changed in place, and compiled again. Both runs therefore
 * see identical absolute paths, which is what lets `-g` be compared at all —
 * `!DIFile` and `; ModuleID` carry the path, and two sibling copies would
 * differ in every module for a reason that has nothing to do with arrows
 * (`docs/wp19-stage0-retirement.md` §A3).
 *
 * **Two modes, because they answer two different questions.** By default the
 * sweep *derives* the rewrite — it runs the codemod on the copy — which asks
 * "would this rewrite be safe?". `--applied` compares the working tree against
 * a revision (`--rev`, default `HEAD`) and runs no codemod at all, which asks
 * "was the rewrite that is sitting in my tree safe?" — of a file the index can
 * see, so add a module the rewrite created before asking. The second is the one
 * §8b's recipe needs: after `arrowify` has rewritten `self/` in place there is
 * nothing left for a derived rewrite to do, so a derived run would compile the
 * same source twice and report a reassuring zero. This tool therefore refuses
 * to report success over ground it did not check: a derived run that rewrites
 * nothing, and an applied run with nothing changed since the revision, both
 * **fail** rather than passing quietly.
 *
 * `--debug` is not decoration. §A5 records a closed parity gate reopening
 * because stage0 took an arrow-declared function's position from the
 * `ArrowFunction` rather than from the declaration, and *no corpus program had
 * ever been compiled as an arrow with `-g`*. Running the sweep under `-g` asks
 * that question of every program at once.
 *
 * The IR is only half of what a compiler emits, so the sweep also puts every
 * rejection through `--json` on both sides and diffs the objects. That is the
 * §A5 question asked of the other surface: a diagnostic carries a line and a
 * column, the parity gate is keyed on them, and a declaration that changes
 * shape can move one without moving a byte of anybody's IR. The two halves of
 * that comparison are weighed differently, and the split is WP22 §8c's:
 *
 *   - the **words** — the severity, the stable `NL` code and the message, with
 *     every position stripped — may not change at all. A `reject_*` case that
 *     starts compiling, or is refused for a different rule, is the worst thing
 *     a codemod can do (§8c), so it fails the run;
 *   - a **position** that moves is reported and does not fail, because under
 *     `--concise` the lines move by construction and a block-bodied rewrite is
 *     allowed to move a caret pointed at the function's own name.
 *
 * **What is rewritten is what is compared, and the set is derived rather than
 * declared.** The sweep compiles every whole program of the corpus — the six
 * directories `tests/self/corpus.js` enumerates, the multi-module programs of
 * `tests/link/`, and `tests/differential/corpus/` — diagnoses every rejection
 * beside them, and rewrites exactly those files plus the modules they import,
 * computed by following the import graph. A file outside that closure is never
 * touched, because nothing here would compile it afterwards, and a summary
 * line that counted a whole-tree rewrite against a corpus-sized comparison
 * would be describing two different sets.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { CORPUS_DIRS, extraArgs, linkPrograms, programs, root } from "../tests/self/corpus.js";
import { rewrite } from "./arrowify.mjs";

const work = path.join(root, "build", "arrowify");
const tree = path.join(work, "tree");
const lock = path.join(root, "build", "arrowify.lock");

/**
 * One sweep at a time, because they share `build/arrowify`: a second run's
 * `copyTree` deletes the tree the first is compiling out of, and the first then
 * dies somewhere arbitrary with whatever error the missing file happened to
 * produce. `mkdir` is the atomic test-and-set every filesystem has.
 *
 * A lock left behind by a run that was killed is a directory to delete, and the
 * message says so rather than leaving somebody to guess.
 */
const takeLock = () => {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return false;
  }
  const release = () => fs.rmSync(lock, { recursive: true, force: true });
  process.on("exit", release);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      release();
      process.exit(130);
    });
  }
  return true;
};

/**
 * Reproduce one tracked path in the copy: a file as its bytes, a symlink as the
 * same link.
 *
 * A symlink has to stay a symlink. `tests/link/package_symlink` is a package
 * reached twice, once through a link, and what the compiler is asked there is
 * what that resolves to -- copying the target instead answers a different
 * question than the tree asks, and `copyFileSync` on a link to a directory does
 * not get that far: it throws `EISDIR` and takes the whole sweep with it.
 */
export const copyInto = (from, to) => {
  if (fs.lstatSync(from).isSymbolicLink()) {
    fs.symlinkSync(fs.readlinkSync(from), to);
    return "link";
  }
  fs.copyFileSync(from, to);
  return "file";
};

/** Copy every tracked file, so the copy resolves imports exactly as the repo does. */
const copyTree = () => {
  fs.rmSync(work, { recursive: true, force: true });
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 1 << 28 })
    .toString()
    .split("\0")
    .filter(Boolean);
  const missing = [];
  for (const rel of files) {
    const from = path.join(root, rel);
    // `git ls-files` prints the index, which can name a file the working tree no
    // longer has. Aborting the whole sweep on the first of them is not a useful
    // answer to "somebody deleted a file"; the copy is of what is there, and what
    // is not there is counted and named.
    // `lstat` rather than `existsSync`, which follows a link: a tracked symlink
    // whose target is gone is a link the tree still has, and copying it is how
    // the sweep compiles what the repository actually holds.
    if (!fs.lstatSync(from, { throwIfNoEntry: false })) {
      missing.push(rel);
      continue;
    }
    const to = path.join(tree, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    copyInto(from, to);
  }
  return { files, missing };
};

/**
 * The whole programs of `tests/differential/corpus/`: one per file, plus the
 * `main.ts` of each directory, which is how the multi-module ones are written
 * (`tests/differential/lib.js`). They are not in `CORPUS_DIRS` because the
 * stage1 oracles do not read them; they are here because the rewrite reaches
 * them, and a file this sweep rewrites is a file it has to compile.
 */
const differentialPrograms = () => {
  const dir = path.join(root, "tests", "differential", "corpus");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(path.join(full, "main.ts"))) out.push(path.relative(root, path.join(full, "main.ts")));
    } else if (entry.name.endsWith(".ts")) {
      out.push(path.relative(root, full));
    }
  }
  return out;
};

/** Every positive whole program the sweep compiles, as a path relative to the repo. */
const sweepPrograms = () => {
  const out = programs().map((file) => path.relative(root, file));
  for (const program of linkPrograms()) {
    if (program.expectedErr === null) out.push(path.relative(root, program.main));
  }
  out.push(...differentialPrograms());
  return [...new Set(out)].sort();
};

/**
 * Every program the sweep re-diagnoses rather than compiles: the `.err` cases of
 * the corpus, which `programs()` leaves out because they are the reject
 * oracle's; `tests/wordings/`, one small program per diagnostic code; and the
 * `tests/link/` programs whose subject is a rejection several modules make.
 * Here they are the other half of what the compiler emits.
 */
const sweepRejections = () => {
  const out = [];
  for (const dir of [...CORPUS_DIRS, "tests/wordings"]) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).sort()) {
      if (!name.endsWith(".ts")) continue;
      const rel = path.join(dir, name);
      const isWording = dir === "tests/wordings";
      if (!isWording && !fs.existsSync(path.join(root, rel.replace(/\.ts$/, ".err")))) continue;
      out.push(rel);
    }
  }
  for (const program of linkPrograms()) {
    if (program.expectedErr !== null) out.push(path.relative(root, program.main));
  }
  return [...new Set(out)].sort();
};

/**
 * The modules one source imports, memoised: the closure is walked once for the
 * whole scope and then again per program, to ask which of them the change
 * reached, so without this every file would be parsed a few hundred times.
 */
const importCache = new Map();
const importsOf = (rel) => {
  const cached = importCache.get(rel);
  if (cached !== undefined) return cached;
  const found = readImports(rel);
  importCache.set(rel, found);
  return found;
};

/**
 * The modules one source imports, as repo-relative paths. A specifier that
 * names a builtin namespace (`nish:fs`) or a package outside the tree resolves
 * to nothing and is skipped — those are not this repository's files to rewrite.
 *
 * Read from the parse tree rather than from a regular expression, for the
 * reason WP22 §8 gives about the three regexes that decided whether a case had
 * an entry point: tooling that reads Nish with a pattern is the part of this
 * migration that keeps being wrong.
 */
const readImports = (rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return [];
  const sf = ts.createSourceFile(rel, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const out = [];
  for (const stmt of sf.statements) {
    const specifier = ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt) ? stmt.moduleSpecifier : undefined;
    if (specifier === undefined || !ts.isStringLiteral(specifier)) continue;
    const text = specifier.text;
    let target;
    if (text.startsWith(".")) target = path.resolve(path.dirname(file), text.replace(/\.js$/, ""));
    else if (text.startsWith("nish/")) target = path.join(root, "std", text.slice("nish/".length));
    else continue;
    const candidate = target.endsWith(".ts") ? target : `${target}.ts`;
    if (fs.existsSync(candidate)) out.push(path.relative(root, candidate));
  }
  return out;
};

/**
 * Every source the sweep is answerable for: the programs and rejections it
 * compares, and the modules they reach. This is the set the rewrite is applied
 * to, so that no file is changed without something afterwards asking what the
 * change did.
 */
const closure = (roots) => {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    for (const next of importsOf(rel)) if (!seen.has(next)) queue.push(next);
  }
  return [...seen].sort();
};

/** The `--json` diagnostics of one program, and the status it exited with. */
const diagnose = (rel) => {
  // A rejection writes nothing, but name a directory rather than a file so that
  // a case which stops being one does not land its IR on top of the last.
  const out = path.join(work, "diagnose");
  fs.mkdirSync(out, { recursive: true });
  const args = [path.join(root, "dist", "index.js"), path.join(tree, rel), "--json", "-o", `${out}/`];
  args.push(...extraArgs(path.join(tree, rel)));
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { status: run.status, said: (run.stdout ?? "").trim() };
};

/**
 * Whether a compile said anything a diagnostic comparison should read: a
 * refusal, or a warning on a compile that otherwise succeeded. The progress
 * lines a successful compile prints (`wrote <path>`, on stderr so that stdout
 * carries objects and nothing else) are not that.
 */
const speaks = (run) =>
  (!run.absent && run.status !== 0) ||
  run.stderr.split("\n").some((line) => line.trim().length > 0 && !line.startsWith("wrote "));

/**
 * The `--json` diagnostics of every subject that had any, this side of the
 * sweep.
 *
 * **A successful compile has diagnostics too**, and they were read on neither
 * side: `readRefusals` asked only where the status was non-zero, so a
 * `performance:` warning — 76 corpus programs emit one, most of `self/` among
 * them — could move, change or disappear under a rewrite and the sweep would
 * report `0 difference(s)`. That is precisely the half this tool's own header
 * claims to cover: "a declaration that changes shape can move [a line and a
 * column] without moving a byte of anybody's IR". It is asked of every subject
 * now, and asked only where a subject spoke, so the cost is one process per
 * program that has something to say rather than per program.
 */
const readDiagnostics = (subjects, results) =>
  new Map(subjects.filter((rel) => speaks(results.get(rel))).map((rel) => [rel, diagnose(rel).said]));

/**
 * One program's diagnostics with every position stripped: the severity, the
 * stable `NL` code and the message, and nothing that a line or a column can
 * move. This is what may not change — WP22 §8c's "comparing the codes and the
 * words alone" — while the raw text is what tells the sweep a caret moved.
 *
 * A line that is not an object is kept verbatim rather than dropped, because
 * the one thing worse than a diagnostic that moved is a diagnostic this
 * comparison could not read and therefore said nothing about.
 */
export const diagnosticWords = (said) =>
  said
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        const one = JSON.parse(line);
        return JSON.stringify({ severity: one.severity, code: one.code, message: one.message });
      } catch {
        return line;
      }
    })
    .join("\n");

/**
 * Compile every program into `<out>/<program>/`. A program the compiler
 * refuses is recorded rather than thrown: the corpus holds a few that only
 * compile with a flag this sweep does not pass on, and what matters is that
 * the *same* program is refused on both sides.
 */
const compileAll = (relPrograms, out, debug) => {
  const results = new Map();
  for (const rel of relPrograms) {
    const dir = path.join(out, subjectDir(rel));
    fs.mkdirSync(dir, { recursive: true });
    // A subject can be legitimately absent on one side: a file added since the
    // revision has no `<rev>:<path>`, so `--applied` empties it out of the copy
    // for the before compile. Reading it anyway is how this crashed — `extraArgs`
    // opens the source for its `// smoke: args` marker — and a stack trace is the
    // wrong answer at the exact moment §8b's recipe needs one, because the tool's
    // own header tells a migrator to add a module the rewrite created and then ask.
    // It is a verdict instead.
    if (!fs.existsSync(path.join(tree, rel))) {
      results.set(rel, { status: null, absent: true, stdout: "", stderr: "", dir });
      continue;
    }
    const args = [path.join(root, "dist", "index.js"), path.join(tree, rel), "-o", `${dir}/`];
    // The flags come out of the *copy*, not out of the working tree, so that each
    // side is compiled the way its own `.args` sidecar says. Reading them from the
    // working tree made `--applied` hand the before side the after side's flags,
    // and a changed `.args` then verified as clean.
    args.push(...intoDir(extraArgs(path.join(tree, rel)), dir));
    if (debug) args.push("-g");
    const run = spawnSync(process.execPath, args, { encoding: "utf8" });
    results.set(rel, { status: run.status, stdout: run.stdout ?? "", stderr: run.stderr ?? "", dir });
  }
  return results;
};

/**
 * One subject's own output directory name, and it has to be injective.
 * `a/b.ts` and `a_b.ts` both became `a_b_ts` under a `[/.]` → `_` replacement,
 * and two subjects sharing a directory can hide each other's difference: the
 * second side's identical write covers the first's. There is no such pair in
 * the corpus today, which is the only reason this was latent rather than wrong.
 */
const subjectDir = (rel) => encodeURIComponent(rel);

/**
 * The flags that name an output file of their own, which the compiler resolves
 * against its working directory rather than against `-o`. Pointed where the
 * `.args` sidecar points them, the WP8 sidecars land outside the directory this
 * sweep compares — so both sides write the *same* path and the after side
 * overwrites the before side before anything can read it. Each is redirected
 * into the subject's own directory, keeping the basename, which is what makes
 * "every file each side wrote" true rather than aspirational.
 */
const OUTPUT_FLAGS = new Set(["--emit-header", "--emit-dts", "--emit-napi", "--emit-napi-async"]);

// `--link <exe>` names a path too and is deliberately not in that set: this sweep
// compiles and never links, `compileAll` never passes it, and no `.args` sidecar
// in the corpus carries it. If one ever does, it belongs in `OUTPUT_FLAGS` with
// the rest — an executable written outside the compared directory is the same
// hole, and both sides would write the same path.

const intoDir = (args, dir) => {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    out.push(args[i]);
    if (OUTPUT_FLAGS.has(args[i]) && i + 1 < args.length) {
      out.push(path.join(dir, path.basename(args[i + 1])));
      i += 1;
    }
  }
  return out;
};

/**
 * Every file a compile wrote, keyed by its path relative to the output
 * directory. Every file rather than every `.ll`: the WP8 sidecars — the C
 * header, the `.d.ts` and its loader, the N-API shim — are redirected into this
 * directory by `intoDir`, and a comparison that collected only modules would go
 * quiet about them the first time an in-scope program asked for one.
 */
const emittedFiles = (dir) => {
  const out = new Map();
  const walk = (at, prefix) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else out.set(`${prefix}${entry.name}`, fs.readFileSync(full));
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out;
};

/**
 * The differences between what one subject emitted before and after, over the
 * **union** of the two sides. Iterating the before side alone would
 * make a module that only exists afterwards invisible, which is the one shape
 * of difference a comparison is most obliged to notice: it means the rewrite
 * changed what the program is, not only how it is spelled.
 */
export const diffEmitted = (before, after) => {
  const out = [];
  for (const name of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const one = before.get(name);
    const two = after.get(name);
    if (one === undefined) out.push({ name, why: "emitted only after the rewrite" });
    else if (two === undefined) out.push({ name, why: "is missing after the rewrite" });
    else if (!one.equals(two)) out.push({ name, why: `differs (${one.length} vs ${two.length} bytes)` });
  }
  return out;
};

/**
 * What a comparison is evidence of, which is not the same as what it compared.
 *
 * A program whose own modules are identical on both sides is compiled twice and
 * agrees with itself; counting it as covered is how a sweep over a surface that
 * is already migrated — or over a slice where one file in seventy-seven still
 * had a `function` in it — reports a reassuring `0 difference(s)` that stands
 * for nothing at all. So each program and each rejection is asked whether the
 * change reached its own import closure, and the summary says how many did.
 */
export const sitsOnChange = (rel, touched) => closure([rel]).some((file) => touched.has(file));

/**
 * One subject's verdict, from what each side of it produced and nothing else.
 *
 * **This is the single exit path, and it is single on purpose.** The sweep has
 * two kinds of subject — a program it compiles and a rejection it diagnoses —
 * and for four review rounds they had two comparison loops with two sets of
 * rules, which is why the same defect was found five times: a subject counted as
 * covered and then never compared. Four were in the program loop and the fifth
 * was in the other one, reached the moment a "rejection" turned out not to be
 * rejected under the flags this sweep passes (`tests/link/no_main` is refused by
 * `--link`, which is not one of them) — `"" === ""`, `continue`, and a file that
 * was rewritten, emitted and never looked at. There is one loop now, and every
 * subject leaves it through here:
 *
 *   - `status`   — refused on one side and not the other, which means the
 *                  rewrite changed whether the program compiles at all;
 *   - `refusal`  — refused on both, compared by the words of its `--json`
 *                  diagnostics with the positions stripped. `moved` says the
 *                  words held and a caret did not, which `--concise` does by
 *                  construction;
 *   - `reworded` — refused on both, for different words. A `reject_*` case that
 *                  starts compiling, or is refused under another rule, is the
 *                  worst thing a codemod can do (WP22 §8c);
 *   - `emitted`  — compiled on both, compared file by file over the union of
 *                  what each side wrote;
 *   - `dump`     — compiled on both and wrote nothing, so stdout is what it
 *                  produced: `--emit-ast` and `--emit-checked` print there;
 *   - `blind`    — none of the above, including a refusal that printed no
 *                  diagnostics at all. Nothing to compare is a failure, because
 *                  a sweep cannot verify what it cannot see.
 *
 * Each side is `{ status, stdout, said, emitted }`: the exit status, stdout, the
 * `--json` diagnostics (read only where the status says there are some), and the
 * map of files it wrote.
 */
export const verdict = (a, b) => {
  // Absence first: a subject that exists on one side only has no before-and-after
  // to compare, and the sweep may not call that agreement. It is the shape a
  // module *added* by a rewrite has — Phase 2 splitting a `self/` module is the
  // obvious one — so the message says which side it was missing from rather than
  // leaving a migrator with a stack trace where a verdict should be.
  if (a.absent === true || b.absent === true) {
    if (a.absent === true && b.absent === true) {
      return { kind: "blind", why: "has no source on either side, so nothing was compiled" };
    }
    return {
      kind: "absent",
      why: a.absent === true ? "did not exist before the change" : "exists only before the change",
    };
  }
  if (a.status !== b.status) return { kind: "status" };
  if (a.status !== 0) {
    // A refusal with nothing in it is the same empty comparison in its last
    // hiding place: `"" === ""` is true and says nothing. Every failure is a
    // `--json` object by contract (AGENTS.md, "Machine-readable surfaces"), so
    // a refusal that produced none is a subject this sweep cannot read rather
    // than one it agrees with.
    if (a.said.length === 0 && b.said.length === 0) {
      return { kind: "blind", why: "was refused and printed no diagnostics to compare" };
    }
    if (diagnosticWords(a.said) !== diagnosticWords(b.said)) return { kind: "reworded" };
    return { kind: "refusal", moved: a.said !== b.said };
  }
  // A compile that succeeded still has a diagnostic surface — the performance
  // warnings — and it is compared by the same rule the refusals are: the words
  // may not change, a position may move. Under `--concise` every warning below a
  // collapsed declaration moves by construction, so a move is reported rather
  // than failed; what may not happen is a warning that appears, disappears, or
  // says something else.
  const talk = diagnosticWords(a.said) === diagnosticWords(b.said);
  const moved = talk && a.said !== b.said;
  const spoke = a.said.length > 0 || b.said.length > 0;
  const said = talk ? [] : [{ name: "--json", why: "says something else after the change" }];
  const names = new Set([...a.emitted.keys(), ...b.emitted.keys()]);
  if (names.size > 0) {
    return {
      kind: "emitted",
      compared: names.size,
      spoke,
      moved,
      differences: [...diffEmitted(a.emitted, b.emitted), ...said],
    };
  }
  if (a.stdout.length > 0 || b.stdout.length > 0) {
    return {
      kind: "dump",
      spoke,
      moved,
      differences: [
        ...(a.stdout === b.stdout
          ? []
          : [{ name: "stdout", why: `differs (${a.stdout.length} vs ${b.stdout.length} bytes)` }]),
        ...said,
      ],
    };
  }
  return { kind: "blind", why: "compiled clean and produced nothing to compare" };
};

/**
 * The files that differ between a revision and the working tree, with both
 * texts. A change outside the sweep's scope is counted and named rather than
 * dropped: this sweep says nothing about it, and a caller who rewrote a file
 * nothing here compiles should hear that from the tool rather than assume the
 * green line covered it.
 */
const changedSince = (rev, scope) => {
  const inScope = new Set(scope);
  const all = execFileSync(
    "git",
    // `args` on its own is a literal path from the repo root, so it matched nothing:
    // the per-directory sidecar `tests/link/<name>/args` — the one `owns()` exists to
    // map — was invisible to the diff, not restored on the before side, and not even
    // reported as out of scope. `:(glob)**/args` matches it at any depth.
    ["diff", "--name-only", rev, "--", "*.ts", "*.args", ":(glob)**/args"],
    { cwd: root, maxBuffer: 1 << 28 }
  )
    .toString()
    .split("\n")
    .filter((rel) => rel.length > 0);
  const outside = all.filter((rel) => !inScope.has(owns(rel)));
  const changes = all
    .filter((rel) => inScope.has(owns(rel)))
    .map((rel) => {
      const show = spawnSync("git", ["show", `${rev}:${rel}`], { cwd: root, maxBuffer: 1 << 28 });
      const file = path.join(root, rel);
      return {
        rel,
        owner: owns(rel),
        before: show.status === 0 ? show.stdout : null,
        after: fs.existsSync(file) ? fs.readFileSync(file) : null,
      };
    });
  return { changes, outside };
};

/**
 * The source a changed file belongs to. A `.args` sidecar is not a program but
 * it decides how one is compiled, so a change to it is a change to that program
 * — and it used to be invisible twice over: the diff only asked about `*.ts`,
 * and both sides were then compiled with the flags in the *working tree*, so a
 * `.args` somebody edited was verified as clean. `tests/link/<name>/args` is the
 * same sidecar spelled per directory (`tests/self/corpus.js`).
 */
const owns = (rel) => {
  if (rel.endsWith(".args")) return rel.replace(/\.args$/, ".ts");
  if (path.basename(rel) === "args") return path.posix.join(path.posix.dirname(rel), "main.ts");
  return rel;
};

/** Put one side of an `--applied` comparison into the copy of the tree. */
const put = (rel, content) => {
  const file = path.join(tree, rel);
  if (content === null) {
    fs.rmSync(file, { force: true });
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const usage = `usage: node scripts/arrow-verify.mjs [--concise] [--debug] [--applied [--rev <ref>]] [--verbose] [<filter>...]

  --concise  derive the rewrite with concise bodies collapsed too
  --debug    compile everything with -g, so a moved position is a moved byte
  --applied  compare the working tree against --rev instead of deriving a rewrite
  --rev      the revision --applied compares against (default HEAD)
  --verbose  name every skipped declaration, and every diagnostic that moved
`;

/**
 * The flags this sweep has. An unknown one is refused rather than ignored, for
 * the reason `arrowify` refuses one: `--debg` silently dropped `-g` and the
 * banner went on saying nothing about it, and `--rev=HEAD~1` was a different
 * token from `--rev`, so the guard that checks the revision never saw it and the
 * run quietly compared against `HEAD`. A verifier is worth what its flags are.
 */
const FLAGS = new Set(["--concise", "--debug", "--applied", "--verbose", "--help", "--rev"]);

const main = (argv) => {
  const words = argv.filter((a) => a.startsWith("-"));
  const flags = new Set(words.map((a) => (a.startsWith("--rev=") ? "--rev" : a)));
  const rest = argv.filter((a) => !a.startsWith("-"));
  const inline = argv.find((a) => a.startsWith("--rev="));
  const revAt = argv.indexOf("--rev");
  const revArg = inline !== undefined ? inline.slice("--rev=".length) : revAt >= 0 ? argv[revAt + 1] : undefined;
  const rev = flags.has("--rev") ? revArg : "HEAD";
  const filters = revAt >= 0 ? rest.filter((a) => a !== rev) : rest;
  const unknown = words.filter((a) => !FLAGS.has(a.startsWith("--rev=") ? "--rev" : a) && a !== revArg);
  if (unknown.length > 0) {
    process.stderr.write(`arrow-verify: unknown flag ${unknown.join(", ")}\n${usage}`);
    return 2;
  }
  const concise = flags.has("--concise");
  const debug = flags.has("--debug");
  const applied = flags.has("--applied");

  if (flags.has("--help")) {
    process.stdout.write(usage);
    return 0;
  }
  if (!fs.existsSync(path.join(root, "dist", "index.js"))) {
    process.stderr.write("arrow-verify: dist/index.js is missing; run `npm run build` first\n");
    return 2;
  }
  // A `--rev` that swallowed the next flag would compare the working tree with
  // the index and go on printing the revision's name in the banner.
  if (flags.has("--rev") && (revArg === undefined || revArg.length === 0 || revArg.startsWith("-"))) {
    process.stderr.write(`arrow-verify: --rev needs a revision, not ${revArg ?? "the end of the command"}\n`);
    return 2;
  }
  if (applied && concise) {
    process.stderr.write("arrow-verify: --applied verifies the tree as it stands; --concise derives a rewrite\n");
    return 2;
  }

  const matches = (rel) => filters.length === 0 || filters.some((f) => rel.includes(f));
  const relPrograms = sweepPrograms().filter(matches);
  const negatives = sweepRejections().filter(matches);
  if (relPrograms.length === 0 && negatives.length === 0) {
    process.stderr.write(`arrow-verify: no corpus program matches ${filters.join(", ")}\n`);
    return 2;
  }
  // One list. A program and a rejection differ in how they are *reported*, not in
  // how they are compared: both are compiled, both are compared through `verdict`,
  // and a "rejection" that turns out to compile is therefore compared by what it
  // emitted rather than falling out of the run.
  const subjects = [...new Set([...relPrograms, ...negatives])].sort();
  const scope = closure(subjects);

  process.stdout.write(
    `arrow-verify: ${relPrograms.length} program(s), ${negatives.length} rejection(s), ` +
      `${scope.length} source file(s)${debug ? ", with -g" : ""}${applied ? `, against ${rev}` : ""}\n`
  );
  if (!takeLock()) {
    process.stderr.write(
      `arrow-verify: another sweep holds ${path.relative(root, lock)}; two of them share one work ` +
        "directory and would delete each other's tree. Wait for it, or remove that directory if no " +
        "sweep is running.\n"
    );
    return 2;
  }
  const copied = copyTree();
  if (copied.missing.length > 0) {
    process.stdout.write(
      `arrow-verify: ${copied.missing.length} tracked file(s) are not in the working tree and were not copied\n`
    );
    if (flags.has("--verbose")) for (const rel of copied.missing) process.stdout.write(`gone     ${rel}\n`);
  }

  // In `--applied` the copy starts as the working tree, so the *before* side is
  // the one that has to be put back; in the derived mode the copy is already
  // the before side and the codemod makes the after side.
  const { changes, outside } = applied ? changedSince(rev, scope) : { changes: [], outside: [] };
  if (applied) {
    if (outside.length > 0) {
      process.stdout.write(
        `arrow-verify: ${outside.length} changed file(s) are outside this sweep's scope and are not verified here\n`
      );
      if (flags.has("--verbose")) for (const rel of outside) process.stdout.write(`outside  ${rel}\n`);
    }
    if (changes.length === 0) {
      process.stderr.write(
        `arrow-verify: nothing in scope has changed since ${rev}, so there is no rewrite to verify\n`
      );
      return 1;
    }
    process.stdout.write(`arrow-verify: ${changes.length} file(s) changed since ${rev}\n`);
    for (const change of changes) put(change.rel, change.before);
  }

  const before = compileAll(subjects, path.join(work, "before"), debug);
  // A subject the compiler refuses prints its refusal and nothing else, so that is
  // what there will be to compare — and this side of it has to be read now, while
  // the before side is still what is in the tree.
  const saidBefore = readDiagnostics(subjects, before);

  let rewritten = 0;
  const touched = new Set();
  const skipped = [];
  if (applied) {
    for (const change of changes) {
      put(change.rel, change.after);
      touched.add(change.owner);
    }
  } else {
    for (const rel of scope) {
      const file = path.join(tree, rel);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      const result = rewrite(text, rel, { concise });
      for (const skip of result.skipped) skipped.push(`${rel}:${skip.line} ${skip.name} — ${skip.reason}`);
      if (result.changed === 0) continue;
      fs.writeFileSync(file, result.text);
      rewritten += result.changed;
      touched.add(rel);
    }
    process.stdout.write(
      `arrow-verify: rewrote ${rewritten} declaration(s)${concise ? ", concise bodies" : ""} in ` +
        `${touched.size} of ${scope.length} file(s), ${skipped.length} left alone\n`
    );
  }

  // What the run is evidence of. A derived sweep that rewrote nothing, and an
  // applied sweep whose changes reach no program, compile the same source twice
  // and then report that they found no difference — true, and worth nothing. It
  // is what happens when §8b's recipe is run in the wrong order, the codemod
  // having already rewritten the tree in place, so say so and fail rather than
  // handing back a zero somebody will read as a verification.
  const coveredPrograms = relPrograms.filter((rel) => sitsOnChange(rel, touched));
  const coveredNegatives = negatives.filter((rel) => sitsOnChange(rel, touched));
  process.stdout.write(
    `arrow-verify: ${coveredPrograms.length} of ${relPrograms.length} program(s) and ` +
      `${coveredNegatives.length} of ${negatives.length} rejection(s) sit on changed source; ` +
      `the rest are identical on both sides and prove nothing\n`
  );
  if (coveredPrograms.length === 0 && coveredNegatives.length === 0) {
    process.stderr.write(
      applied
        ? `arrow-verify: nothing this sweep compiles has changed since ${rev}, so there is no rewrite to verify\n`
        : "arrow-verify: nothing in scope was rewritten, so both compiles saw the same source. " +
            "Use `--applied` to verify a rewrite that is already in the tree.\n"
    );
    return 1;
  }

  const after = compileAll(subjects, path.join(work, "after"), debug);
  const saidAfter = readDiagnostics(subjects, after);

  // One loop, one exit path. Which list a subject came from decides how it is
  // reported and nothing else; `verdict` decides what happened to it.
  let differed = 0;
  let compared = 0;
  let dumps = 0;
  let refusals = 0;
  let reworded = 0;
  let moved = 0;
  let spoke = 0;
  const blind = [];
  for (const rel of subjects) {
    const a = before.get(rel);
    const b = after.get(rel);
    const answer = verdict(
      {
        status: a.status,
        absent: a.absent === true,
        stdout: a.stdout,
        said: saidBefore.get(rel) ?? "",
        emitted: emittedFiles(a.dir),
      },
      {
        status: b.status,
        absent: b.absent === true,
        stdout: b.stdout,
        said: saidAfter.get(rel) ?? "",
        emitted: emittedFiles(b.dir),
      }
    );
    if (answer.kind === "absent") {
      differed += 1;
      process.stdout.write(`DIFF  ${rel}: ${answer.why}, so there is nothing to compare it against\n`);
      continue;
    }
    if (answer.kind === "status") {
      differed += 1;
      process.stdout.write(`DIFF  ${rel}: exit ${a.status} before, ${b.status} after\n`);
      const said = (b.status === 0 ? a.stderr : b.stderr).trim().split("\n")[0];
      if (said) process.stdout.write(`      ${said}\n`);
      continue;
    }
    if (answer.kind === "reworded") {
      differed += 1;
      reworded += 1;
      process.stdout.write(`DIFF  ${rel}: refused differently after the change\n`);
      process.stdout.write(`      before ${diagnosticWords(saidBefore.get(rel) ?? "").split("\n")[0] || "(nothing)"}\n`);
      process.stdout.write(`      after  ${diagnosticWords(saidAfter.get(rel) ?? "").split("\n")[0] || "(nothing)"}\n`);
      continue;
    }
    if (answer.kind === "refusal") {
      refusals += 1;
      if (answer.moved) {
        moved += 1;
        if (flags.has("--verbose")) {
          process.stdout.write(
            `MOVED ${rel}\n      before ${(saidBefore.get(rel) ?? "").split("\n")[0]}\n` +
              `      after  ${(saidAfter.get(rel) ?? "").split("\n")[0]}\n`
          );
        }
      }
      continue;
    }
    if (answer.kind === "blind") {
      blind.push({ rel, why: answer.why });
      continue;
    }
    if (answer.kind === "dump") dumps += 1;
    else compared += answer.compared;
    if (answer.spoke) {
      spoke += 1;
      if (answer.moved) {
        moved += 1;
        if (flags.has("--verbose")) {
          process.stdout.write(
            `MOVED ${rel}\n      before ${(saidBefore.get(rel) ?? "").split("\n")[0]}\n` +
              `      after  ${(saidAfter.get(rel) ?? "").split("\n")[0]}\n`
          );
        }
      }
    }
    for (const difference of answer.differences) {
      differed += 1;
      process.stdout.write(`DIFF  ${rel}: ${difference.name} ${difference.why}\n`);
      if (answer.kind === "emitted" && difference.name !== "--json") {
        process.stdout.write(`      diff ${path.join(a.dir, difference.name)} ${path.join(b.dir, difference.name)}\n`);
      }
      if (difference.name === "--json") {
        process.stdout.write(`      before ${diagnosticWords(saidBefore.get(rel) ?? "").split("\n")[0] || "(nothing)"}\n`);
        process.stdout.write(`      after  ${diagnosticWords(saidAfter.get(rel) ?? "").split("\n")[0] || "(nothing)"}\n`);
      }
    }
  }

  for (const one of blind) {
    process.stdout.write(`BLIND ${one.rel}: ${one.why}\n`);
  }

  if (skipped.length > 0 && flags.has("--verbose")) {
    for (const line of skipped) process.stdout.write(`skip  ${line}\n`);
  }
  process.stdout.write(
    `arrow-verify: ${subjects.length} subject(s) — ${compared} emitted file(s), ${dumps} dump(s) and ` +
      `${refusals} refusal(s) compared, ${blind.length} with nothing to compare\n`
  );
  process.stdout.write(
    `arrow-verify: ${spoke} compile(s) that also warned, compared by their words too\n`
  );
  process.stdout.write(
    `arrow-verify: ${differed} difference(s), of which ${reworded} refused differently; ` +
      `${moved} diagnostic(s) whose positions moved\n`
  );
  return differed > 0 || blind.length > 0 ? 1 : 0;
};

if (process.argv[1] === import.meta.filename) process.exit(main(process.argv.slice(2)));
