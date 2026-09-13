/**
 * The seed: whatever compiler builds a stage1 binary for a check to run.
 *
 *   import { linkWith, seedForOracle } from "./seed.js";
 *
 * Every oracle that compares stage1 with something has to *have* a stage1
 * first, and building one takes a compiler. Which compiler that is used to be
 * a constant in each oracle — `dist/index.js`, stage0 — and WP19 G2.3 is the
 * gate that says it may not stay one: the oracles that survive stage0's
 * deletion (`lexer_oracle.js`, `parser_oracle.js`, `support_oracle.js`,
 * `reject_oracle.js`) have to build their binary with the **seed**, the last
 * released `nish`, and stay green. An oracle that cannot even link its subject
 * without stage0 does not survive stage0 whatever it compares against.
 *
 * **The order, and why it is this one.**
 *
 *   1. `--seed <path>`, so a caller — `tests/run.js` above all — can name it.
 *   2. `NISH_BOOTSTRAP`, the variable `scripts/bootstrap.sh` reads and CI's
 *      `bootstrap` job sets to the release it downloaded (G3). One spelling of
 *      "the seed" across the scripts, the suite and the workflow.
 *   3. `build/nish`, what `npm run bootstrap` leaves in the tree, so a
 *      workstation that has bootstrapped once needs no environment at all.
 *
 * `tests/self/goldens.js` stops there and refuses: it is the tool whose whole
 * point is that stage0 is nowhere in it, so a fourth answer would be the
 * dependency the gate exists to remove. The four oracles above are not that
 * tool — they still compare against stage0's own parser, scanner and escapes
 * while it lives — so `seedForOracle` has a fourth answer, `dist/index.js`,
 * and *says so on stderr* when it uses it. A hand-run oracle in a fresh clone
 * keeps working; a run that quietly proved something weaker than it looks does
 * not exist. After R6 the fourth answer has nothing to point at and goes.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** The repository root, resolved without asking any module that might not survive R6. */
const root = path.resolve(import.meta.dirname, "..", "..");

/**
 * `.js` / `.mjs` / `.cjs` is a Node entry point and everything else a native
 * binary — `scripts/bootstrap.sh`'s rule for `NISH_BOOTSTRAP`, so that one
 * path spells a seed in both places.
 */
const NODE_ENTRY = /\.(?:js|mjs|cjs)$/;

/** Stage0, the answer of last resort while there is a stage0 to be the answer. */
const STAGE0 = path.join("dist", "index.js");

/** A spawnable compiler: `cmd` plus what comes before the program's own arguments. */
function resolveSeed(spec) {
  const file = path.resolve(root, spec);
  const refuse = (why) => ({ error: `seed ${spec} ${why}` });
  if (!fs.existsSync(file)) return refuse("does not exist");
  if (!fs.statSync(file).isFile()) return refuse("is not a file");
  const seed = NODE_ENTRY.test(file)
    ? { label: spec, cmd: process.execPath, prefix: [file] }
    : { label: spec, cmd: file, prefix: [] };
  if (seed.prefix.length === 0) {
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      return refuse("is not executable (only .js/.mjs/.cjs are run under node)");
    }
  }
  if (spawnSeed(seed, ["--version"]).status !== 0) return refuse("is not runnable (`--version` failed)");
  return seed;
}

/**
 * The seed nobody named: `NISH_BOOTSTRAP` first, then a compiler left in the
 * tree by `npm run bootstrap`. An empty `NISH_BOOTSTRAP` counts as unset, the
 * way `NISH_BOOTSTRAP= npm test` turns the seed off for one run.
 */
function defaultSeedSpec() {
  const fromEnvironment = process.env.NISH_BOOTSTRAP;
  if (fromEnvironment !== undefined && fromEnvironment !== "") return fromEnvironment;
  const bootstrapped = path.join("build", "nish");
  if (fs.existsSync(path.join(root, bootstrapped))) return bootstrapped;
  return null;
}

/** `--seed <path>` out of an argument list, or null when it is not there. */
function namedSeedSpec(argv) {
  const at = argv.indexOf("--seed");
  return at >= 0 ? (argv[at + 1] ?? null) : null;
}

/**
 * The same list without `--seed` and its value. Every oracle reads its
 * positional arguments as "the files to check", and a seed *path* is the one
 * value on the command line that looks exactly like one.
 */
function withoutSeed(argv) {
  const at = argv.indexOf("--seed");
  return at >= 0 ? [...argv.slice(0, at), ...argv.slice(at + 2)] : argv;
}

/**
 * The seed for one of the four surviving oracles: the order above, then
 * stage0, announced. The announcement is the point — an oracle that fell back
 * has proved that stage1 agrees with stage0 *and* was built by it, which is a
 * weaker run than the same summary line usually means.
 */
function seedForOracle(argv) {
  const named = namedSeedSpec(argv);
  const spec = named ?? defaultSeedSpec();
  if (spec !== null) return resolveSeed(spec);
  if (!fs.existsSync(path.join(root, STAGE0))) {
    return {
      error:
        "no seed: pass --seed <nish>, set NISH_BOOTSTRAP, or run `npm run bootstrap` " +
        "to leave one in build/nish (and there is no dist/index.js to fall back to)",
    };
  }
  process.stderr.write(
    `note: no seed named, so stage0 (${STAGE0}) built the binary under test. ` +
      "Pass --seed <nish> or set NISH_BOOTSTRAP for the run WP19 G2.3 asks for.\n"
  );
  return resolveSeed(STAGE0);
}

function spawnSeed(seed, args, options = {}) {
  return spawnSync(seed.cmd, [...seed.prefix, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
}

/**
 * Build one Nish program natively with the seed and answer where the binary
 * landed, or null after printing why it did not. The oracles' `build()` is
 * this call and a path; a failure here is the seed refusing the program, which
 * on a real seed is the rolling freeze doing its job and worth reading.
 */
function linkWith(seed, source, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const built = spawnSeed(seed, [path.join(root, source), "--link", out]);
  if (built.status !== 0) {
    process.stderr.write(`${seed.label} could not build ${source}:\n${built.stderr}\n`);
    return null;
  }
  return out;
}

export { defaultSeedSpec, linkWith, namedSeedSpec, resolveSeed, root, seedForOracle, spawnSeed, withoutSeed };
