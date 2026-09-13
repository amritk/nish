/**
 * The bootstrap: milestone S5, and the claim the whole work package exists for
 * (docs/wp14-selfhost.md §1).
 *
 *   node tests/self/bootstrap.js            run the stages and compare
 *   node tests/self/bootstrap.js --verbose  name every module as it is compared
 *   node tests/self/bootstrap.js --keep     leave the stage outputs on disk
 *
 * Four compilers, three equalities:
 *
 *   stage0  `src/`, TypeScript on Node, built by tsc          the bootstrap seed
 *   stage1  `self/`, built by stage0
 *   stage2  `self/`, built by stage1
 *   stage3  `self/`, built by stage2
 *
 *   IR(stage0, self/) == IR(stage1, self/)   the two implementations agree
 *   IR(stage1, self/) == IR(stage2, self/)   *the self-hosting proof*
 *   stage3 == stage2                          byte for byte, as files
 *
 * The middle one is the one that matters: if the compiler stage0 built and the
 * compiler stage1 built emit the same text for the same input, the source has
 * reached a fixed point and nothing about stage0 leaks into the result any
 * more. The first is the stronger equality §1 said was worth aiming at and not
 * worth blocking on; it holds, so it is checked. The third exists so the
 * binaries are compared as well as the IR.
 *
 * The seed here is stage0 and only stage0, which is what makes the first
 * equality assertable: it says two independently written implementations of
 * *this* revision emit the same IR for it, which is diverse double-compiling.
 * `scripts/bootstrap.sh` takes its seed from `NISH_BOOTSTRAP` and therefore
 * asserts that equality only when the seed is stage0 — with a released binary
 * the same comparison is a codegen freeze between releases rather than a claim
 * about the bootstrap, so it is reported there instead
 * (`docs/wp19-stage0-retirement.md` G3). This file has no such branch and must
 * not grow one.
 *
 * Everything is compared **byte for byte**, module by module. A single
 * attribute out of place fails, which is the point.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");
const buildSh = path.join(root, "scripts", "build.sh");
const runtimeC = path.join(root, "runtime", "runtime.c");

/** The entry of `self/`: the driver, which imports every other module. */
const ENTRY = path.join("self", "compile.ts");

function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** stage0 compiles `self/` into `dir`, one `.ll` per module. */
function compileWithStage0(dir) {
  const r = spawnSync("node", [cli, ENTRY, "-o", `${dir}/`], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? null : `stage0: ${r.stderr || r.stdout}`;
}

/** A stage1-or-later compiler compiles `self/` into `dir`. */
function compileWithStage(binary, dir) {
  const r = spawnSync(binary, [ENTRY, "-o", `${dir}/`], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? null : `${path.basename(binary)}: ${r.stderr || r.stdout}`;
}

/** Link one stage's `.ll` files with the runtime into an executable. */
function link(dir, exe) {
  const modules = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ll"))
    .sort()
    .map((f) => path.join(dir, f));
  const r = spawnSync("bash", [buildSh, ...modules, runtimeC, "-o", exe, "--profile", "speed"], {
    cwd: root,
    encoding: "utf8",
  });
  return r.status === 0 ? null : `link ${path.basename(exe)}: ${r.stderr || r.stdout}`;
}

/**
 * Compare two directories of `.ll` files. The module set must match too: a
 * stage that emitted one module fewer has not agreed about the rest.
 */
function compareIR(a, b, labelA, labelB, verbose) {
  const namesA = fs.readdirSync(a).filter((f) => f.endsWith(".ll")).sort();
  const namesB = fs.readdirSync(b).filter((f) => f.endsWith(".ll")).sort();
  if (namesA.join(",") !== namesB.join(",")) {
    return { error: `${labelA} emitted ${namesA.length} modules, ${labelB} ${namesB.length}` };
  }
  let bytes = 0;
  for (const name of namesA) {
    const want = fs.readFileSync(path.join(a, name));
    const got = fs.readFileSync(path.join(b, name));
    if (!want.equals(got)) {
      const wantLines = want.toString("utf8").split("\n");
      const gotLines = got.toString("utf8").split("\n");
      for (let i = 0; i < Math.max(wantLines.length, gotLines.length); i++) {
        if (wantLines[i] !== gotLines[i]) {
          return {
            error: `${name} line ${i + 1}: ${labelA} \`${wantLines[i] ?? "<end>"}\`, ${labelB} \`${gotLines[i] ?? "<end>"}\``,
          };
        }
      }
      return { error: `${name}: the bytes differ but no line does` };
    }
    bytes += want.length;
    if (verbose) process.stdout.write(`  ok ${name} (${want.length} bytes)\n`);
  }
  return { modules: namesA.length, bytes };
}

function main(argv) {
  const verbose = argv.includes("--verbose");
  const keep = argv.includes("--keep");
  const work = fresh(path.join(root, "build", "bootstrap"));
  const stage0Dir = fresh(path.join(work, "ir0"));
  const stage1Dir = fresh(path.join(work, "ir1"));
  const stage2Dir = fresh(path.join(work, "ir2"));
  const stage1 = path.join(work, "stage1");
  const stage2 = path.join(work, "stage2");
  const stage3 = path.join(work, "stage3");

  const fail = (message) => {
    process.stdout.write(`  FAIL ${message}\n`);
    return 1;
  };

  // stage1: `self/` built by stage0.
  const built = spawnSync("node", [cli, ENTRY, "--link", stage1], { cwd: root, encoding: "utf8" });
  if (built.status !== 0) return fail(`stage0 could not build stage1: ${built.stderr || built.stdout}`);

  const e0 = compileWithStage0(stage0Dir);
  if (e0 !== null) return fail(e0);
  const e1 = compileWithStage(stage1, stage1Dir);
  if (e1 !== null) return fail(e1);

  // The stronger equality of §1: the TypeScript implementation and the
  // Nish one emit the same module for the same source.
  const agree01 = compareIR(stage0Dir, stage1Dir, "stage0", "stage1", verbose);
  if (agree01.error !== undefined) return fail(`IR(stage0) != IR(stage1): ${agree01.error}`);

  const l2 = link(stage1Dir, stage2);
  if (l2 !== null) return fail(l2);
  const e2 = compileWithStage(stage2, stage2Dir);
  if (e2 !== null) return fail(e2);

  // The self-hosting proof.
  const agree12 = compareIR(stage1Dir, stage2Dir, "stage1", "stage2", verbose);
  if (agree12.error !== undefined) return fail(`IR(stage1) != IR(stage2): ${agree12.error}`);

  const l3 = link(stage2Dir, stage3);
  if (l3 !== null) return fail(l3);
  const binary2 = fs.readFileSync(stage2);
  const binary3 = fs.readFileSync(stage3);
  if (!binary2.equals(binary3)) {
    return fail(`stage3 is not byte-identical to stage2 (${binary2.length} vs ${binary3.length} bytes)`);
  }

  if (!keep) fs.rmSync(work, { recursive: true, force: true });
  process.stdout.write(
    `${agree12.modules} modules, ${agree12.bytes} bytes of IR: ` +
      `IR(stage0)==IR(stage1)==IR(stage2), stage3 == stage2 (${binary2.length} bytes)\n`
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { main };
