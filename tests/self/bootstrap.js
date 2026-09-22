/**
 * The bootstrap: milestone S5, and the claim the whole work package exists for
 * (docs/wp14-selfhost.md §1).
 *
 *   node tests/self/bootstrap.js                 run the stages and compare
 *   node tests/self/bootstrap.js --seed <nish>   name the seed (seed.js's order otherwise)
 *   node tests/self/bootstrap.js --verbose       name every module as it is compared
 *   node tests/self/bootstrap.js --keep          leave the stage outputs on disk
 *
 * Four compilers, two equalities:
 *
 *   seed    the last released `nish`, or whatever `tests/self/seed.js` resolves
 *   stage1  `self/`, built by the seed
 *   stage2  `self/`, built by stage1
 *   stage3  `self/`, built by stage2
 *
 *   IR(stage1, self/) == IR(stage2, self/)   *the self-hosting proof*
 *   stage3 == stage2                          byte for byte, as files
 *
 * The first is the one that matters: if the compiler the seed built and the
 * compiler stage1 built emit the same text for the same input, the source has
 * reached a fixed point and nothing about the seed leaks into the result any
 * more. The second exists so the binaries are compared as well as the IR.
 *
 * What is deliberately *not* asserted is `IR(seed, self/) == IR(stage1,
 * self/)`. While stage0 was the seed that equality said two independently
 * written implementations of this revision agree, which is diverse
 * double-compiling; with a released seed it asks whether codegen has changed
 * since that release, which forbids every improvement a release cycle exists to
 * carry and says nothing about the bootstrap (`docs/wp19-stage0-retirement.md`
 * G3, and the header of `scripts/bootstrap.sh`, which reports it as a note).
 *
 * Everything is compared **byte for byte**, module by module. A single
 * attribute out of place fails, which is the point.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { linkWith, seedForOracle } from "./seed.js";

const root = path.resolve(import.meta.dirname, "..", "..");
const buildSh = path.join(root, "scripts", "build.sh");
const runtimeC = path.join(root, "runtime", "runtime.c");

/** The entry of `self/`: the driver, which imports every other module. */
const ENTRY = path.join("self", "compile.ts");

function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
  const stage1Dir = fresh(path.join(work, "ir1"));
  const stage2Dir = fresh(path.join(work, "ir2"));
  const stage1 = path.join(work, "stage1");
  const stage2 = path.join(work, "stage2");
  const stage3 = path.join(work, "stage3");

  const fail = (message) => {
    process.stdout.write(`  FAIL ${message}\n`);
    return 1;
  };

  // stage1: `self/` built by the seed. A seed that cannot build it is the
  // rolling freeze broken -- `self/` using something the last release does
  // not have -- and `linkWith` has already printed the seed's report.
  const seed = seedForOracle(argv);
  if (seed.error !== undefined) return fail(seed.error);
  if (linkWith(seed, ENTRY, stage1) === null) return fail(`the seed (${seed.label}) could not build stage1`);

  const e1 = compileWithStage(stage1, stage1Dir);
  if (e1 !== null) return fail(e1);
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
      `IR(stage1)==IR(stage2), stage3 == stage2 (${binary2.length} bytes), seed ${seed.label}\n`
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
export { main };
