/**
 * The S3 checker oracle: stage1's checker against stage0's, through the
 * `--emit-checked` dump both of them write (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/checked_oracle.js              the whole corpus
 *   node tests/self/checked_oracle.js <file>...    just those files
 *   node tests/self/checked_oracle.js --verbose    name every skip
 *
 * `self/dump_checked.ts` prints what the checker collected in exactly the
 * format `src/dump.ts` prints it, so what is compared is not "it accepted the
 * file" but every struct's layout — field indices and byte offsets included —
 * every signature, every folded constant, every local and callee of every
 * body, and the order they all come out in.
 *
 * A program that imports is loaded whole, by both compilers, and every module
 * of it is dumped in load order — the module *set* and the binding of each
 * imported name included, so a stage that resolved one import differently has
 * not agreed about the rest.
 *
 * A file is skipped only when there is nothing to compare: stage0 itself
 * rejects it, so it has no dump of its own. The reason stage0 gives is printed
 * with the skip, because a file the corpus cannot type-check at all (a parser
 * fixture, say) and a file that is merely missing a flag read the same in a
 * summary line otherwise. Every skip is a fact about the corpus rather than a
 * file that is allowed to disagree.
 *
 * The lines stage0 prints that the checker is not responsible for — the
 * attribute pass's facts, escape sets and stack sites — are dropped here
 * rather than left out of the format, so they start being compared the moment
 * that phase is ported.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkerArgs, programs, root } from "./corpus.js";
import { fileURLToPath } from "node:url";

const cli = path.join(root, "dist", "index.js");

/**
 * Lines of the dump that a later phase fills in. Only the attribute pass is
 * left: the locals and callees of each body are pass 2's, and are compared.
 */
const LATER_PHASES = /^ {2}(facts:|escaping:|calls:|pointer |stackSites)/;

function signatureLines(dump) {
  return dump.split("\n").filter((line) => line.length > 0 && !LATER_PHASES.test(line));
}

function compare(binary, file) {
  // The flags the dump depends on -- what `number` is, and whether the
  // constant folder wraps -- and no others: the rest change the IR, which is
  // `ir_oracle.js`'s half of the comparison.
  const flags = checkerArgs(file);
  // Both sides name each module by the path they resolved it to, and stage0's
  // dump is relative to the working directory, so the entry must be too.
  const named = path.relative(root, file);

  const stage0 = spawnSync("node", [cli, named, "--emit-checked", ...flags], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage0.status !== 0) return { skipped: `stage0 rejects it: ${firstLine(stage0.stderr)}` };

  const stage1 = spawnSync(binary, [...flags, named], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stage1.status !== 0) return { rejected: firstLine(stage1.stderr) };

  const want = signatureLines(stage0.stdout);
  const got = signatureLines(stage1.stdout);
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (want[i] !== got[i]) {
      return { failed: `line ${i + 1}: ours \`${got[i] ?? "<end>"}\`, stage0 \`${want[i] ?? "<end>"}\`` };
    }
  }
  return { lines: want.length };
}

/** The first diagnostic of a compiler's stderr, without its file:line:col prefix. */
function firstLine(output) {
  const line = output.trim().split("\n")[0] ?? "";
  return line.replace(/^[^:]*:\d+:\d+: /, "");
}

/** Every positive AmritScript program of the corpus, plus `self/` itself. */
function corpus() {
  return programs();
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

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { compare, corpus, build };
