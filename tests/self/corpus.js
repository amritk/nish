/**
 * The corpus the stage1 oracles read, and the flags each of its programs is
 * compiled with.
 *
 * Three oracles walk the same set of AmritScript programs — `checked_oracle.js`,
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
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

/** Every directory of positive programs, in the order the oracles report them. */
const CORPUS_DIRS = ["tests/cases", "examples", "self", "docs/cookbook", "bench", "tests/parser"];

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

/** `--number-mode <mode>` when the program needs it: the only flag pass 1 reads. */
function numberModeArgs(file) {
  const flags = extraArgs(file);
  const at = flags.indexOf("--number-mode");
  return at >= 0 ? ["--number-mode", flags[at + 1]] : [];
}

/**
 * Every positive whole program of the corpus. A source with a `.err` sidecar
 * is a rejection and belongs to `reject_oracle.js`, so it is left out here.
 */
function programs() {
  const files = [];
  for (const dir of CORPUS_DIRS) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).sort()) {
      if (!name.endsWith(".ts")) continue;
      const file = path.join(full, name);
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

module.exports = { CORPUS_DIRS, extraArgs, numberModeArgs, programs, linkPrograms, root };
