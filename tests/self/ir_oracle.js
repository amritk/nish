/**
 * The S4 emitter oracle: `IR(stage0, p) == IR(stage1, p)`, byte for byte, over
 * every program in the corpus (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/ir_oracle.js              the whole corpus
 *   node tests/self/ir_oracle.js <file>...    just those files
 *   node tests/self/ir_oracle.js --verbose    name every skip
 *   node tests/self/ir_oracle.js --diff       print the first differing lines
 *
 * There is nothing to normalise: the module header names the path both
 * compilers were given, and everything after it is the emitter's own text. So
 * a difference of one character in one attribute is a failure, which is the
 * point — the attributes are the half of the output a golden test reads past.
 *
 * A program that imports is compiled whole, by both compilers, and every
 * module of it is compared — the module *set* included, so a stage that
 * emitted one module fewer has not agreed about the rest. Every program is
 * given the flags it is compiled with everywhere else, from its `.args`
 * sidecar or its `// smoke: args` line (`tests/self/corpus.js`): a program
 * that needs `--number-mode f64` and does not get it is refused by stage0,
 * and a file nobody compares must not be able to look like one that agrees.
 *
 * What is left out is left out for a reason, and each reason is counted apart:
 *
 *   - its `.args` ask for something stage1 does not do (the dump flags), which
 *     is stage0's the way `--link` is (docs/wp14-selfhost.md §3a D4);
 *   - it is one of the `tests/link/` programs that exists to be *refused*, so
 *     there is no IR on either side and `tests/self/reject_oracle.js` is what
 *     compares it;
 *   - stage0 itself rejects it, so there is no IR to compare against. The
 *     reason stage0 gives is printed with the skip, because that is what says
 *     whether the file is a fixture nothing can type-check or a program this
 *     oracle is compiling wrongly.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { extraArgs, linkPrograms, programs, root } = require("./corpus");

const cli = path.join(root, "dist", "index.js");

/** Flags that change the IR and that stage1 accepts; anything else is a skip. */
const SHARED_FLAGS = new Set([
  "--plain",
  "--strict-exports",
  "--unchecked-indexing",
  "--nsw",
  "--no-stack-alloc",
  "--runtime-decls",
  // `-g` is compared like any other flag, metadata and all: the `DIFile` both
  // compilers write names the entry as it was spelled and `.` for the
  // directory, so nothing here depends on the working directory.
  "-g",
]);
const VALUE_FLAGS = new Set(["--number-mode", "--target"]);

/** The flags a program is compiled with, split into what both compilers take and what stage1 cannot. */
function argsFor(file) {
  const raw = extraArgs(file);
  const flags = [];
  const unsupported = [];
  for (let i = 0; i < raw.length; i++) {
    if (SHARED_FLAGS.has(raw[i])) flags.push(raw[i]);
    else if (VALUE_FLAGS.has(raw[i])) flags.push(raw[i], raw[++i]);
    else unsupported.push(raw[i]);
  }
  return { flags, unsupported };
}

function llFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ll"))
    .sort();
}

function compare(binary, work, file, negatives) {
  const { flags, unsupported } = argsFor(file);
  if (unsupported.length > 0) return { skipped: `stage1 has no ${unsupported.join(" ")}` };
  // A `tests/link` program that carries an `expected.err` may be a compile-time
  // rejection — no IR on either side — or one only `--link` refuses, which
  // still emits every module. stage0 below is what tells the two apart.
  const negative = negatives.has(file);
  // Both sides name each module by the path they resolved it to, and stage0
  // writes that path into the module header, so the entry must be spelled the
  // same for both.
  const named = path.relative(root, file);
  const dir0 = fresh(path.join(work, "stage0"));
  const dir1 = fresh(path.join(work, "stage1"));

  const stage0 = spawnSync("node", [cli, named, "-o", `${dir0}/`, ...flags], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage0.status !== 0) {
    if (negative) return { negative: true };
    return { skipped: `stage0 rejects it: ${firstLine(stage0.stderr)}` };
  }
  const names = llFiles(dir0);
  if (names.length === 0) return { skipped: "stage0 wrote no IR" };

  const stage1 = spawnSync(binary, [...flags, named, "--out-dir", dir1], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage1.status !== 0) return { rejected: firstLine(stage1.stderr) || `exit ${stage1.status}` };
  const ours = llFiles(dir1);
  if (names.join(",") !== ours.join(",")) {
    return { failed: `stage0 emitted [${names.join(" ")}], ours [${ours.join(" ")}]` };
  }

  let lines = 0;
  for (const name of names) {
    const want = fs.readFileSync(path.join(dir0, name), "utf8");
    const got = fs.readFileSync(path.join(dir1, name), "utf8");
    if (want === got) {
      lines += want.split("\n").length;
      continue;
    }
    const wantLines = want.split("\n");
    const gotLines = got.split("\n");
    for (let i = 0; i < Math.max(wantLines.length, gotLines.length); i++) {
      if (wantLines[i] !== gotLines[i]) {
        return {
          failed: `${name} line ${i + 1}: ours \`${gotLines[i] ?? "<end>"}\`, stage0 \`${wantLines[i] ?? "<end>"}\``,
        };
      }
    }
    return { failed: `${name}: the texts differ but no line does` };
  }
  return { lines, modules: names.length };
}

function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** The first diagnostic of a compiler's stderr, without its file:line:col prefix. */
function firstLine(output) {
  const line = output.trim().split("\n")[0] ?? "";
  return line.replace(/^[^:]*:\d+:\d+: /, "");
}

/**
 * Every positive AmritScript program of the corpus, plus `self/` itself, plus
 * the whole programs of `tests/link/`, which is where the multi-module shapes
 * live: cycles, diamonds, re-exported classes, reachable structs.
 */
function corpus() {
  return [...programs(), ...linkPrograms().map((program) => program.main)];
}

/** The `tests/link` programs that exist to be refused; `reject_oracle.js` owns their message. */
function negativePrograms() {
  return new Set(linkPrograms().filter((p) => p.expectedErr !== null).map((p) => p.main));
}

function build() {
  const out = path.join(root, "build", "self", "compile");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync("node", [cli, path.join(root, "self", "compile.ts"), "--link", out], {
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
  const showDiff = argv.includes("--diff");
  const named = argv.filter((a) => !a.startsWith("--"));
  const binary = build();
  if (binary === null) return 1;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "sts-ir-"));
  const inputs = named.length > 0 ? named.map((f) => path.resolve(f)) : corpus();
  const negatives = negativePrograms();
  let agreed = 0;
  let lines = 0;
  let modules = 0;
  const skipped = [];
  const rejected = [];
  const failed = [];
  const refused = [];
  for (const file of inputs) {
    const result = compare(binary, work, file, negatives);
    const name = path.relative(root, file);
    if (result.negative !== undefined) refused.push(name);
    else if (result.skipped !== undefined) skipped.push(`${name}: ${result.skipped}`);
    else if (result.rejected !== undefined) rejected.push(`${name}: ${result.rejected}`);
    else if (result.failed !== undefined) failed.push(`${name}: ${result.failed}`);
    else {
      agreed++;
      lines += result.lines;
      modules += result.modules;
    }
  }
  fs.rmSync(work, { recursive: true, force: true });
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose || showDiff) {
    for (const r of rejected) process.stdout.write(`  reject ${r}\n`);
  }
  if (verbose) {
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
    for (const r of refused) process.stdout.write(`  negative ${r}\n`);
  }
  const compared = inputs.length - skipped.length - rejected.length - refused.length;
  // Each of these is counted apart from the others and named in the summary. A
  // file stage0 accepts and stage1 does not is the remaining work of this
  // milestone and must not be able to hide inside a skip count; a program that
  // exists to be refused is compared in full by `reject_oracle.js` and is not
  // a gap at all.
  const negativeNote =
    refused.length > 0 ? `, ${refused.length} negatives (tests/self/reject_oracle.js compares them)` : "";
  const note = rejected.length > 0 ? `, ${rejected.length} rejected by stage1` : "";
  process.stdout.write(
    `${agreed}/${compared} programs agree (${modules} modules, ${lines} IR lines), ` +
      `${skipped.length} skipped${negativeNote}${note}\n`
  );
  return failed.length === 0 && rejected.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { compare, corpus, build };
