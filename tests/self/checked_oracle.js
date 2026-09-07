/**
 * The S3 signature oracle: stage1's pass 1 against stage0's, through the
 * `--emit-checked` dump both of them write (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/checked_oracle.js              the whole corpus
 *   node tests/self/checked_oracle.js <file>...    just those files
 *   node tests/self/checked_oracle.js --verbose    name every skip
 *
 * `self/dump_checked.ts` prints what pass 1 collected in exactly the format
 * `src/dump.ts` prints it, so what is compared is not "it accepted the file"
 * but every struct's layout — field indices and byte offsets included — every
 * signature, every symbol, and the order they come out in.
 *
 * Three kinds of file are skipped, and each skip is a fact about how far S3
 * has got rather than a file that is allowed to disagree:
 *
 *   - it needs grammar the S2 parser turns down (the `reject_*` cases, whose
 *     forbidden constructs stage1 refuses by name);
 *   - it imports, which needs the module driver of S5;
 *   - stage0 itself rejects it, so there is no dump to compare against.
 *
 * The lines stage0 prints that pass 1 is not responsible for — the attribute
 * facts and the per-body locals and callees — are dropped here rather than
 * left out of the format, so they start being compared the moment the phase
 * that fills them lands.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");

/**
 * Lines of the dump that a later phase fills in. Only the attribute pass is
 * left: the locals and callees of each body are pass 2's, and are compared.
 */
const LATER_PHASES = /^ {2}(facts:|escaping:|calls:|pointer |stackSites)/;

function signatureLines(dump) {
  return dump.split("\n").filter((line) => line.length > 0 && !LATER_PHASES.test(line));
}

/** The `.args` a golden case is compiled with, when they matter to pass 1. */
function argsFor(file) {
  const argsFile = file.replace(/\.ts$/, ".args");
  if (!fs.existsSync(argsFile)) return { flags: [], skip: undefined };
  const flags = fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean);
  const numberMode = flags.indexOf("--number-mode");
  if (numberMode >= 0) return { flags: ["--number-mode", flags[numberMode + 1]], skip: undefined };
  return { flags: [], skip: undefined };
}

function compare(binary, file) {
  const source = fs.readFileSync(file, "utf8");
  if (/^\s*import\s/m.test(source)) return { skipped: "imports (needs the S5 driver)" };
  const { flags } = argsFor(file);
  // Both sides name the module by the path they were given, and stage0's
  // dump is relative to the working directory, so the input must be too.
  const named = path.relative(root, file);

  const stage0 = spawnSync("node", [cli, named, "--emit-checked", ...flags], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage0.status !== 0) return { skipped: "stage0 rejects it" };

  const stage1 = spawnSync(binary, [...flags, named], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage1.status !== 0) {
    const first = stage1.stderr.trim().split("\n")[0] ?? "";
    return { rejected: first };
  }

  const want = signatureLines(stage0.stdout);
  const got = signatureLines(stage1.stdout);
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) {
      return { failed: `line ${i + 1}: ours \`${got[i] ?? "<end>"}\`, stage0 \`${want[i] ?? "<end>"}\`` };
    }
  }
  return { lines: want.length };
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
      // A `.err` case is a rejection: there is no dump on either side.
      if (fs.existsSync(file.replace(/\.ts$/, ".err"))) continue;
      files.push(file);
    }
  }
  return files;
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
  const inputs = named.length > 0 ? named.map((f) => path.resolve(f)) : corpus();
  let agreed = 0;
  let lines = 0;
  const skipped = [];
  const rejected = [];
  const failed = [];
  for (const file of inputs) {
    const result = compare(binary, file);
    const name = path.relative(root, file);
    if (result.skipped !== undefined) skipped.push(`${name}: ${result.skipped}`);
    else if (result.rejected !== undefined) rejected.push(`${name}: ${result.rejected}`);
    else if (result.failed !== undefined) failed.push(`${name}: ${result.failed}`);
    else {
      agreed++;
      lines += result.lines;
    }
  }
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose) {
    for (const r of rejected) process.stdout.write(`  reject ${r}\n`);
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
  }
  const compared = inputs.length - skipped.length - rejected.length;
  // Rejections are counted apart from the other skips and named in the
  // summary: a file stage0 accepts and stage1 does not is the remaining work
  // of this milestone, and it must not be able to hide inside a skip count.
  const note = rejected.length > 0 ? `, ${rejected.length} rejected by stage1` : "";
  process.stdout.write(
    `${agreed}/${compared} files agree (${lines} dump lines), ${skipped.length} skipped${note}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { compare, corpus, build };
