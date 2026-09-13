/**
 * Prove a `function`-to-arrow rewrite changed nothing, by compiling the corpus
 * before and after it and comparing every emitted byte.
 *
 *   node scripts/arrow-verify.mjs                       the whole corpus
 *   node scripts/arrow-verify.mjs self                  only programs under self/
 *   node scripts/arrow-verify.mjs --concise docs        hunt WP22 §8a's bug class
 *   node scripts/arrow-verify.mjs --debug tests/cases   add `-g` to every compile
 *
 * WP22 §2 is the reason this is the right check rather than a proxy for one:
 * the emitter reads `FunctionSig`s and there is no `isFunctionDeclaration`
 * anywhere in `src/codegen/`, so an arrow-declared function must produce the
 * same `define`, the same attributes and the same body. **A byte of difference
 * is a bug in the rewrite until proven otherwise.** §8 says the docs half of
 * stage C worked because `regen.sh` made that diff one command; this is the
 * same command for every other surface.
 *
 * The whole corpus is compiled **twice out of one directory**: a copy of the
 * tracked tree is compiled, rewritten in place, and compiled again. Both runs
 * therefore see identical absolute paths, which is what lets `-g` be compared
 * at all — `!DIFile` and `; ModuleID` carry the path, and two sibling copies
 * would differ in every module for a reason that has nothing to do with
 * arrows (`docs/wp19-stage0-retirement.md` §A3).
 *
 * `--debug` is not decoration. §A5 records a closed parity gate reopening
 * because stage0 took an arrow-declared function's position from the
 * `ArrowFunction` rather than from the declaration, and *no corpus program had
 * ever been compiled as an arrow with `-g`*. Running the sweep under `-g` asks
 * that question of every program at once.
 *
 * The IR is only half of what a compiler emits, so the sweep also puts every
 * `reject_*` case through `--json` on both sides and diffs the objects. That is
 * the §A5 question asked of the other surface: a diagnostic carries a line and
 * a column, the parity gate is keyed on them, and a declaration that changes
 * shape can move one without moving a byte of anybody's IR. The answer for a
 * block-bodied rewrite turns out to be a pleasant accident of arithmetic —
 * `function NAME(` and `const NAME = (` are the same width for every NAME, so
 * the parameters, the return type and the `{` all keep their column, and the
 * only thing that moves is a caret pointed at the name itself.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORPUS_DIRS, extraArgs, programs, root } from "../tests/self/corpus.js";
import { rewrite } from "./arrowify.mjs";

const work = path.join(root, "build", "arrowify");
const tree = path.join(work, "tree");

/** Copy every tracked file, so the copy resolves imports exactly as the repo does. */
const copyTree = () => {
  fs.rmSync(work, { recursive: true, force: true });
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 1 << 28 })
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const rel of files) {
    const to = path.join(tree, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, rel), to);
  }
  return files;
};

/**
 * Every negative case of the corpus: a source with a `.err` sidecar, which
 * `programs()` leaves out because it is the reject oracle's rather than the IR
 * oracle's. Here it is the other half of what the compiler emits.
 */
const rejections = () => {
  const out = [];
  for (const dir of CORPUS_DIRS) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).sort()) {
      if (!name.endsWith(".ts")) continue;
      if (!fs.existsSync(path.join(full, name.replace(/\.ts$/, ".err")))) continue;
      out.push(path.join(dir, name));
    }
  }
  return out;
};

/** The `--json` diagnostics of one program, as the lines the compiler printed them on. */
const diagnose = (rel) => {
  // A rejection writes nothing, but name a directory rather than a file so that
  // a case which stops being one does not land its IR on top of the last.
  const out = path.join(work, "diagnose");
  fs.mkdirSync(out, { recursive: true });
  const args = [path.join(root, "dist", "index.js"), path.join(tree, rel), "--json", "-o", `${out}/`];
  args.push(...extraArgs(path.join(root, rel)));
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  return (run.stdout ?? "").trim();
};

/**
 * Compile every program into `<out>/<program>/`. A program the compiler
 * refuses is recorded rather than thrown: the corpus holds a few that only
 * compile with a flag this sweep does not pass on, and what matters is that
 * the *same* program is refused on both sides.
 */
const compileAll = (relPrograms, out, debug) => {
  const results = new Map();
  for (const rel of relPrograms) {
    const dir = path.join(out, rel.replace(/[/.]/g, "_"));
    fs.mkdirSync(dir, { recursive: true });
    const args = [path.join(root, "dist", "index.js"), path.join(tree, rel), "-o", `${dir}/`];
    args.push(...extraArgs(path.join(root, rel)));
    if (debug) args.push("-g");
    const run = spawnSync(process.execPath, args, { encoding: "utf8" });
    results.set(rel, { status: run.status, stderr: run.stderr, dir });
  }
  return results;
};

/** Every `.ll` under a directory, keyed by its path relative to that directory. */
const modules = (dir) => {
  const out = new Map();
  const walk = (at, prefix) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".ll")) out.set(`${prefix}${entry.name}`, fs.readFileSync(full));
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out;
};

const main = (argv) => {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const filters = argv.filter((a) => !a.startsWith("--"));
  const concise = flags.has("--concise");
  const debug = flags.has("--debug");

  if (!fs.existsSync(path.join(root, "dist", "index.js"))) {
    process.stderr.write("arrow-verify: dist/index.js is missing; run `npm run build` first\n");
    return 2;
  }

  const relPrograms = programs()
    .map((file) => path.relative(root, file))
    .filter((rel) => filters.length === 0 || filters.some((f) => rel.includes(f)));
  if (relPrograms.length === 0) {
    process.stderr.write(`arrow-verify: no corpus program matches ${filters.join(", ")}\n`);
    return 2;
  }

  process.stdout.write(`arrow-verify: ${relPrograms.length} program(s)${debug ? ", with -g" : ""}\n`);
  const tracked = copyTree();
  const negatives = rejections().filter((rel) => filters.length === 0 || filters.some((f) => rel.includes(f)));
  const before = compileAll(relPrograms, path.join(work, "before"), debug);
  const saidBefore = new Map(negatives.map((rel) => [rel, diagnose(rel)]));

  // Rewrite every Nish source in the copy. `std/` and `tests/` are in the set
  // because a program compiles its imports, so a module nobody names directly
  // still reaches the emitter.
  let rewritten = 0;
  const skipped = [];
  for (const rel of tracked) {
    if (!rel.endsWith(".ts") || rel.startsWith("src/")) continue;
    const file = path.join(tree, rel);
    const text = fs.readFileSync(file, "utf8");
    const result = rewrite(text, rel, { concise });
    for (const skip of result.skipped) skipped.push(`${rel}:${skip.line} ${skip.name} — ${skip.reason}`);
    if (result.changed === 0) continue;
    fs.writeFileSync(file, result.text);
    rewritten += result.changed;
  }
  process.stdout.write(`arrow-verify: rewrote ${rewritten} declaration(s)${concise ? ", concise bodies" : ""}\n`);

  const after = compileAll(relPrograms, path.join(work, "after"), debug);

  // The diagnostics half. A moved caret is reported rather than failed: under
  // `--concise` the line numbers move by construction, and even a block-bodied
  // rewrite is allowed to move a caret pointed at the function's own name.
  let moved = 0;
  for (const rel of negatives) {
    const said = diagnose(rel);
    if (said === saidBefore.get(rel)) continue;
    moved += 1;
    if (flags.has("--verbose")) {
      process.stdout.write(`MOVED ${rel}\n      before ${saidBefore.get(rel).split("\n")[0]}\n      after  ${said.split("\n")[0]}\n`);
    }
  }
  process.stdout.write(
    `arrow-verify: ${negatives.length} rejection(s) re-diagnosed, ${moved} whose \`--json\` moved\n`
  );

  let differed = 0;
  let compared = 0;
  for (const rel of relPrograms) {
    const a = before.get(rel);
    const b = after.get(rel);
    if (a.status !== b.status) {
      differed += 1;
      process.stdout.write(`DIFF  ${rel}: exit ${a.status} before, ${b.status} after\n`);
      const said = (b.status === 0 ? a.stderr : b.stderr).trim().split("\n")[0];
      if (said) process.stdout.write(`      ${said}\n`);
      continue;
    }
    if (a.status !== 0) continue; // refused on both sides, for a reason the rewrite did not invent
    const one = modules(a.dir);
    const two = modules(b.dir);
    for (const [name, bytes] of one) {
      compared += 1;
      const other = two.get(name);
      if (other === undefined) {
        differed += 1;
        process.stdout.write(`DIFF  ${rel}: ${name} is missing after the rewrite\n`);
      } else if (!bytes.equals(other)) {
        differed += 1;
        process.stdout.write(`DIFF  ${rel}: ${name} differs (${bytes.length} vs ${other.length} bytes)\n`);
        process.stdout.write(`      diff ${path.join(a.dir, name)} ${path.join(b.dir, name)}\n`);
      }
    }
  }

  if (skipped.length > 0 && flags.has("--verbose")) {
    for (const line of skipped) process.stdout.write(`skip  ${line}\n`);
  }
  process.stdout.write(
    `arrow-verify: ${compared} module(s) compared, ${differed} difference(s), ${skipped.length} declaration(s) left alone\n`
  );
  return differed > 0 ? 1 : 0;
};

process.exit(main(process.argv.slice(2)));
