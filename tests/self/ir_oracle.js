/**
 * The S4 emitter oracle: `IR(stage0, p) == IR(stage1, p)`, byte for byte, over
 * every import-free program in the corpus (docs/wp14-selfhost.md §6 rule 3).
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
 * Three kinds of file are skipped, and each skip is a fact about how far S4
 * has got rather than a file that is allowed to disagree:
 *
 *   - it imports, which needs the module driver of S5;
 *   - its `.args` ask for something stage1 does not do (`-g`, the dump flags):
 *     debug info is stage0's, as `--link` is (docs/wp14-selfhost.md §3a D4);
 *   - stage0 itself rejects it, so there is no IR to compare against.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");

/** Flags that change the IR and that stage1 accepts; anything else is a skip. */
const SHARED_FLAGS = new Set([
  "--plain",
  "--strict-exports",
  "--unchecked-indexing",
  "--nsw",
  "--no-stack-alloc",
  "--runtime-decls",
]);
const VALUE_FLAGS = new Set(["--number-mode", "--target"]);

/** The `.args` of a case, split into what both compilers take and what stage1 cannot. */
function argsFor(file) {
  const argsFile = file.replace(/\.ts$/, ".args");
  if (!fs.existsSync(argsFile)) return { flags: [], unsupported: [] };
  const raw = fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean);
  const flags = [];
  const unsupported = [];
  for (let i = 0; i < raw.length; i++) {
    if (SHARED_FLAGS.has(raw[i])) flags.push(raw[i]);
    else if (VALUE_FLAGS.has(raw[i])) flags.push(raw[i], raw[++i]);
    else unsupported.push(raw[i]);
  }
  return { flags, unsupported };
}

function compare(binary, outDir, file) {
  const source = fs.readFileSync(file, "utf8");
  if (/^\s*import\s/m.test(source)) return { skipped: "imports (needs the S5 driver)" };
  const { flags, unsupported } = argsFor(file);
  if (unsupported.length > 0) return { skipped: `stage1 has no ${unsupported.join(" ")}` };
  // Both sides name the module by the path they were given, and stage0 writes
  // that path into the module header, so the input must be spelled the same.
  const named = path.relative(root, file);

  const stage0 = spawnSync("node", [cli, named, "-o", `${outDir}/`, ...flags], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage0.status !== 0) return { skipped: "stage0 rejects it" };
  const written = path.join(outDir, `${path.basename(file, ".ts")}.ll`);
  if (!fs.existsSync(written)) return { skipped: "stage0 wrote no IR" };
  const want = fs.readFileSync(written, "utf8");

  const stage1 = spawnSync(binary, [...flags, named], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage1.status !== 0) {
    const first = stage1.stderr.trim().split("\n")[0] ?? `exit ${stage1.status}`;
    return { rejected: first };
  }
  if (stage1.stdout === want) return { lines: want.split("\n").length };

  const got = stage1.stdout.split("\n");
  const expected = want.split("\n");
  for (let i = 0; i < Math.max(got.length, expected.length); i++) {
    if (got[i] !== expected[i]) {
      return {
        failed: `line ${i + 1}: ours \`${got[i] ?? "<end>"}\`, stage0 \`${expected[i] ?? "<end>"}\``,
      };
    }
  }
  return { failed: "the texts differ but no line does (a trailing newline?)" };
}

/** Every positive StaticTS program the other oracles read, plus `self/` itself. */
function corpus() {
  const dirs = [
    path.join(root, "tests", "cases"),
    path.join(root, "examples"),
    path.join(root, "self"),
    path.join(root, "docs", "cookbook"),
    path.join(root, "bench"),
    path.join(root, "tests", "parser"),
  ];
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith(".ts")) continue;
      const file = path.join(dir, name);
      // A `.err` case is a rejection: there is no IR on either side.
      if (fs.existsSync(file.replace(/\.ts$/, ".err"))) continue;
      files.push(file);
    }
  }
  return files;
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
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sts-ir-"));
  const inputs = named.length > 0 ? named.map((f) => path.resolve(f)) : corpus();
  let agreed = 0;
  let lines = 0;
  const skipped = [];
  const rejected = [];
  const failed = [];
  for (const file of inputs) {
    const result = compare(binary, outDir, file);
    const name = path.relative(root, file);
    if (result.skipped !== undefined) skipped.push(`${name}: ${result.skipped}`);
    else if (result.rejected !== undefined) rejected.push(`${name}: ${result.rejected}`);
    else if (result.failed !== undefined) failed.push(`${name}: ${result.failed}`);
    else {
      agreed++;
      lines += result.lines;
    }
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose || showDiff) {
    for (const r of rejected) process.stdout.write(`  reject ${r}\n`);
  }
  if (verbose) {
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
  }
  const compared = inputs.length - skipped.length - rejected.length;
  // Rejections are counted apart from the other skips and named in the
  // summary: a file stage0 accepts and stage1 does not is the remaining work
  // of this milestone, and it must not be able to hide inside a skip count.
  const note = rejected.length > 0 ? `, ${rejected.length} rejected by stage1` : "";
  process.stdout.write(
    `${agreed}/${compared} files agree (${lines} IR lines), ${skipped.length} skipped${note}\n`
  );
  return failed.length === 0 && rejected.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { compare, corpus, build };
