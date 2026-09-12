/**
 * The S3 checker oracle: stage1's checker against stage0's, through the
 * `--emit-checked` dump both of them write (docs/wp14-selfhost.md §6 rule 3).
 *
 *   node tests/self/checked_oracle.js              the whole corpus
 *   node tests/self/checked_oracle.js <file>...    just those files
 *   node tests/self/checked_oracle.js --verbose    name every skip
 *   node tests/self/checked_oracle.js --jobs N     compare N programs at once
 *
 * Each program is a dump from each compiler and a line-by-line diff of the
 * two, independent of every other program, so they are compared `--jobs` at a
 * time (one per core, capped; `tests/pool.js`). The results are walked in
 * corpus order regardless of the order they finished in, so a parallel run
 * prints exactly what `--jobs 1` prints.
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
 * attribute pass's facts, escape sets and stack sites — used to be dropped
 * here rather than left out of the format, so that they would start being
 * compared the moment that phase was ported. It is ported (WP19 R1,
 * `self/dump.ts`), the filter is gone, and every line of the dump is compared.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { checkerArgs, programs, root } from "./corpus.js";
import { jobsFrom, pool, run } from "../pool.js";
import { fileURLToPath } from "node:url";

const cli = path.join(root, "dist", "index.js");

/** The dump's lines, blanks dropped; nothing else is filtered out any more. */
function dumpLines(dump) {
  return dump.split("\n").filter((line) => line.length > 0);
}

async function compare(binary, file) {
  // The flags the dump depends on -- what `number` is, and whether the
  // constant folder wraps -- and no others: the rest change the IR, which is
  // `ir_oracle.js`'s half of the comparison.
  const flags = checkerArgs(file);
  // Both sides name each module by the path they resolved it to, and stage0's
  // dump is relative to the working directory, so the entry must be too.
  const named = path.relative(root, file);

  const stage0 = await run("node", [cli, named, "--emit-checked", ...flags], {
    cwd: root,
    encoding: "utf8",
  });
  if (stage0.status !== 0) return { skipped: `stage0 rejects it: ${firstLine(stage0.stderr)}` };

  const stage1 = await run(binary, [...flags, named], {
    cwd: root,
    encoding: "utf8",
  });
  if (stage1.status !== 0) return { rejected: firstLine(stage1.stderr) };

  const want = dumpLines(stage0.stdout);
  const got = dumpLines(stage1.stdout);
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

/** Every positive Nish program of the corpus, plus `self/` itself. */
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

async function main(argv) {
  const verbose = argv.includes("--verbose");
  const jobs = jobsFrom(argv);
  // `--jobs N` takes a value, so its number is not a file even though it does
  // not start with a dash. Guarded on the flag being present: an `indexOf` of
  // -1 would make `jobsAt + 1` index 0 and drop the first file named.
  const jobsAt = argv.indexOf("--jobs");
  const named = argv.filter((a, i) => !a.startsWith("--") && !(jobsAt >= 0 && i === jobsAt + 1));
  const binary = build();
  if (binary === null) return 1;
  const inputs = named.length > 0 ? named.map((f) => path.resolve(f)) : corpus();
  let agreed = 0;
  let lines = 0;
  const skipped = [];
  const rejected = [];
  const failed = [];
  const t0 = Date.now();
  const results = await pool(inputs, jobs, (file) => compare(binary, file));
  // Walked in corpus order, whatever order they finished in: every count and
  // every name below is what a sequential run produced.
  for (const [i, file] of inputs.entries()) {
    const result = results[i];
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
    `${agreed}/${compared} files agree (${lines} dump lines, ` +
      `${((Date.now() - t0) / 1000).toFixed(1)} s, ${jobs} jobs), ${skipped.length} skipped${note}\n`
  );
  return failed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // `process.exitCode`, not `process.exit`: stdout is a pipe when tests/run.js
  // spawns this, writes to a pipe are asynchronous, and `process.exit` does not
  // wait for them. The summary this prints is the whole result, so losing its
  // tail to a forced exit would read as an oracle that said nothing. Every
  // child is awaited by then, so the loop drains and the process ends on its
  // own with this status.
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
export { compare, corpus, build };
