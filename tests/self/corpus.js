/**
 * The corpus the stage1 oracles read, and the flags each of its programs is
 * compiled with.
 *
 * Three oracles walk the same set of Nish programs — `checked_oracle.js`,
 * `ir_oracle.js` and, for the negatives, `reject_oracle.js` — and a program
 * that is only compilable with a flag has to be given it by all of them.
 * Otherwise stage0 refuses it, the oracle records "stage0 rejects it", and a
 * file nobody is comparing looks like a fact about the port.
 *
 * Nothing here invents a flag: the answer already exists next to the program,
 * in the form its own directory uses, and this module only knows where to look.
 *
 *   - `<name>.args` beside the source — `tests/cases`, and `bench/`, whose
 *     runner (`bench/run.mjs`) reads the same file;
 *   - `args` in the directory — `tests/link/<name>/`, one whole program per
 *     directory (`tests/run.js`);
 *   - `// smoke: args <flags>` on a line of the source — `examples/`, the
 *     marker `scripts/smoke.sh` reads.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");

/**
 * Every directory of positive programs, in the order the oracles report them.
 *
 * `tests/differential/corpus` is in it since WP19 §A5's sixth entry, and was
 * not before: 71 whole programs — the WP13 differential set, which is where
 * the *runtime* behaviour of the language is pinned — had never been compiled
 * by stage1 by any oracle or by `--parity`, while `.claude/selfhost.md` said
 * the corpus held them and `scripts/arrow-verify.mjs` carried a
 * `differentialPrograms()` of its own precisely because it did not. Two of
 * the 71 were compile errors on the stage1 side when they were first run
 * (`-1 / z` with `z: f64`, `docs/LANGUAGE.md`'s "`-5` and `(5)` count as the
 * literal"), which is what a corpus nobody compares is worth.
 */
const CORPUS_DIRS = [
  "tests/cases",
  "examples",
  "self",
  "docs/cookbook",
  "bench",
  "tests/parser",
  "tests/differential/corpus",
];

/**
 * The extra CLI flags this program is compiled with, exactly as written where
 * they live. The caller decides which of them it can pass on.
 */
function extraArgs(file) {
  const sidecar = file.replace(/\.ts$/, ".args");
  if (fs.existsSync(sidecar)) return split(fs.readFileSync(sidecar, "utf8"));
  const dirArgs = path.join(path.dirname(file), "args");
  if (path.basename(file) === "main.ts" && fs.existsSync(dirArgs)) {
    return split(fs.readFileSync(dirArgs, "utf8"));
  }
  const marker = /^\/\/ smoke: args (.*)$/m.exec(fs.readFileSync(file, "utf8"));
  return marker ? split(marker[1]) : [];
}

function split(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * The flags of a program that the *checker* reads, so a dump comparison runs
 * the program as its own `.args` mean it to be run. Two of them:
 * `--number-mode <mode>`, which decides what `number` is, and `--wrapping`,
 * which the constant folder reads — `tests/cases/const_wrap.ts` is a fold that
 * only succeeds under it, and passing only the first is why that program used
 * to be refused by stage0 and counted as a skip (WP19 G1). Everything else in
 * an `.args` changes the IR and belongs to `ir_oracle.js`.
 */
function checkerArgs(file) {
  const flags = extraArgs(file);
  const out = [];
  const at = flags.indexOf("--number-mode");
  if (at >= 0) out.push("--number-mode", flags[at + 1]);
  if (flags.includes("--wrapping")) out.push("--wrapping");
  return out;
}

/**
 * Every positive whole program of the corpus. A source with a `.err` sidecar
 * is a rejection and belongs to `reject_oracle.js`, so it is left out here.
 *
 * A **subdirectory holding a `main.ts`** is one program too, which is how the
 * multi-module shapes are written everywhere in this repository that is not
 * `tests/link/`: `tests/differential/corpus/modules_diamond/`,
 * `const_modules/`, `modules_basic/` and `examples/multi/`. Enumerating only
 * the files directly in a directory left those four out of every oracle —
 * three of them arriving with the directory above, and `examples/multi` for
 * as long as it has existed — so the rule is one level deep rather than one
 * directory wide. It is deliberately *one* level: a corpus program is a file
 * a reader can point at, and `docs/cookbook/node_modules/` is a package
 * fixture rather than a program.
 */
function programs() {
  const files = [];
  for (const dir of CORPUS_DIRS) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).sort()) {
      const file = path.join(full, name);
      if (!name.endsWith(".ts")) {
        const main = path.join(file, "main.ts");
        if (fs.statSync(file).isDirectory() && fs.existsSync(main)) files.push(main);
        continue;
      }
      if (fs.existsSync(file.replace(/\.ts$/, ".err"))) continue;
      files.push(file);
    }
  }
  return files;
}

/**
 * The whole programs of `tests/link/`, which is where the multi-module shapes
 * live: cycles, diamonds, re-exported classes, reachable structs, and the
 * rejections only a program of several modules can provoke. `expectedErr` is
 * the needle `tests/run.js` requires of such a rejection, or null when the
 * program is a positive one.
 */
function linkPrograms() {
  const dir = path.join(root, "tests", "link");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const main = path.join(dir, name, "main.ts");
    if (!fs.existsSync(main)) continue;
    const err = path.join(dir, name, "expected.err");
    out.push({
      name,
      main,
      expectedErr: fs.existsSync(err) ? fs.readFileSync(err, "utf8").trim() : null,
    });
  }
  return out;
}

export { CORPUS_DIRS, checkerArgs, extraArgs, programs, linkPrograms, root };
