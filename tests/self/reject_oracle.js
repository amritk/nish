/**
 * The S3 rejection oracle: every `reject_*` case, refused by stage1 with the
 * message the case pins (docs/wp14-selfhost.md §4, milestone S3).
 *
 *   node tests/self/reject_oracle.js             the whole set
 *   node tests/self/reject_oracle.js --verbose   name every skip
 *
 * Accepting the same programs is half of a checker being the same checker;
 * *refusing* the same ones, for the same reason, is the other half, and it is
 * the half a dump comparison cannot see. Each case's `.err` file holds the
 * message fragments the suite already requires of stage0, so this asserts
 * exactly the same thing of stage1: it must exit non-zero and its output must
 * contain every fragment.
 *
 * A case is skipped only when it is not stage1's to answer yet:
 *
 *   - it needs the module driver of S5 (it imports, or it is a `tests/link`
 *     case);
 *   - it is rejected by the S2 *parser*, which turns forbidden syntax down by
 *     name rather than by the message stage0's Phase 0 validator writes. Those
 *     wordings are deliberately different — a message about the operator the
 *     programmer wrote beats one about a node kind — and the count is the
 *     measurement, not a hole.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");
const CASES = path.join(root, "tests", "cases");
const BACKLOG = path.join(root, "tests", "self", "reject_backlog.txt");

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

/** The fragments `<name>.err` requires, one per line. */
function fragments(file) {
  return fs
    .readFileSync(file.replace(/\.ts$/, ".err"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function argsFor(file) {
  const argsFile = file.replace(/\.ts$/, ".args");
  if (!fs.existsSync(argsFile)) return [];
  const flags = fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean);
  const at = flags.indexOf("--number-mode");
  return at >= 0 ? ["--number-mode", flags[at + 1]] : [];
}

function compare(binary, file) {
  const source = fs.readFileSync(file, "utf8");
  if (/^\s*import\s/m.test(source)) return { skipped: "imports (needs the S5 driver)" };
  const named = path.relative(root, file);
  const run = spawnSync(binary, [...argsFor(file), named], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout}${run.stderr}`;
  if (run.status === 0) return { failed: "stage1 accepted it" };
  // A parser refusal is a different wording by design; the checker's is not.
  if (/syntax error:/.test(output)) return { skipped: `refused by the parser: ${firstLine(output)}` };
  const missing = fragments(file).filter((fragment) => !output.includes(fragment));
  if (missing.length > 0) {
    return { failed: `wanted ${JSON.stringify(missing[0])}, got ${JSON.stringify(firstLine(output))}` };
  }
  return { fragments: fragments(file).length };
}

function firstLine(output) {
  const line = output.trim().split("\n")[0] ?? "";
  return line.replace(/^[^:]*:\d+:\d+: /, "");
}

function corpus() {
  return fs
    .readdirSync(CASES)
    .filter((name) => name.startsWith("reject_") && name.endsWith(".ts"))
    .filter((name) => fs.existsSync(path.join(CASES, name.replace(/\.ts$/, ".err"))))
    .sort()
    .map((name) => path.join(CASES, name));
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
  const known = backlog();
  let agreed = 0;
  let checked = 0;
  const skipped = [];
  const failed = [];
  const pending = [];
  for (const file of inputs) {
    const result = compare(binary, file);
    const name = path.basename(file, ".ts");
    const where = path.relative(root, file);
    if (result.skipped !== undefined) {
      skipped.push(`${where}: ${result.skipped}`);
    } else if (result.failed !== undefined) {
      if (known.has(name)) pending.push(`${where}: ${result.failed}`);
      else failed.push(`${where}: ${result.failed}`);
    } else if (known.has(name)) {
      failed.push(`${where}: agrees now — remove it from tests/self/reject_backlog.txt`);
    } else {
      agreed++;
      checked += result.fragments;
    }
  }
  for (const f of failed) process.stdout.write(`  FAIL ${f}\n`);
  if (verbose) {
    for (const p of pending) process.stdout.write(`  backlog ${p}\n`);
    for (const s of skipped) process.stdout.write(`  skip ${s}\n`);
  }
  const compared = inputs.length - skipped.length - pending.length;
  const note = pending.length > 0 ? `, ${pending.length} in the backlog` : "";
  process.stdout.write(
    `${agreed}/${compared} cases rejected with the expected message (${checked} fragments), ${skipped.length} skipped${note}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { compare, corpus, build };
