/**
 * The seed: whatever compiler builds a stage1 binary for a check to run.
 *
 *   import { linkWith, seedForOracle } from "./seed.js";
 *
 * Every check that runs stage1 has to *have* a stage1 first, and building one
 * takes a compiler. That compiler is the **seed**, the last released `nish`
 * (WP19 G2.3): `tests/run.js` builds the compiler under test with it, and the
 * oracles (`lexer_oracle.js`, `parser_oracle.js`, `support_oracle.js`,
 * `reject_oracle.js`) build their binaries with it.
 *
 * **The order, and why it is this one.**
 *
 *   1. `--seed <path>`, so a caller — `tests/run.js` above all — can name it.
 *   2. `NISH_BOOTSTRAP`, the variable `scripts/bootstrap.sh` reads and CI's
 *      `bootstrap` job sets to the release it downloaded (G3). One spelling of
 *      "the seed" across the scripts, the suite and the workflow.
 *   3. `build/nish`, what `npm run bootstrap` leaves in the tree, so a
 *      workstation that has bootstrapped once needs no environment at all.
 *   4. `build/seed/bin/nish`, the released compiler `scripts/fetch-seed.sh`
 *      unpacks (and the session hook fetches), so a fresh clone is one
 *      command from a seed. After `build/nish` rather than before it: a
 *      compiler this tree built was asked for by whoever built it, and the
 *      download is only ever the default.
 *
 * `tests/self/goldens.js` stops there and refuses. `seedForOracle` has one
 * more step: with none of the four in place it runs `scripts/fetch-seed.sh`,
 * *says so on stderr*, and uses the release it unpacked, so a fresh clone runs
 * `npm test` without a separate command first. Where the download fails, the
 * answer is an error naming every way to supply a seed.
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

/** Where `scripts/fetch-seed.sh` leaves the released compiler. */
const FETCHED = path.join("build", "seed", "bin", "nish");

/**
 * The seed nobody named: `NISH_BOOTSTRAP` first, then a compiler left in the
 * tree by `npm run bootstrap`, then the release `scripts/fetch-seed.sh`
 * fetched. An empty `NISH_BOOTSTRAP` counts as unset, the way
 * `NISH_BOOTSTRAP= npm test` turns the seed off for one run.
 */
function defaultSeedSpec() {
  const fromEnvironment = process.env.NISH_BOOTSTRAP;
  if (fromEnvironment !== undefined && fromEnvironment !== "") return fromEnvironment;
  for (const inTree of [path.join("build", "nish"), FETCHED]) {
    if (fs.existsSync(path.join(root, inTree))) return inTree;
  }
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
 * The seed for `tests/run.js` and the oracles: the order above, then the
 * release `scripts/fetch-seed.sh` fetches, announced — the download is the
 * one step here that reaches the network, and a run should say when it did.
 */
function seedForOracle(argv) {
  const named = namedSeedSpec(argv);
  const spec = named ?? defaultSeedSpec();
  if (spec !== null) return resolveSeed(spec);
  process.stderr.write("note: no seed in the tree, so scripts/fetch-seed.sh is fetching the last release\n");
  const fetched = spawnSync("sh", [path.join(root, "scripts", "fetch-seed.sh")], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (fetched.status !== 0 || !fs.existsSync(path.join(root, FETCHED))) {
    return {
      error:
        "no seed: pass --seed <nish>, set NISH_BOOTSTRAP, run `bash scripts/fetch-seed.sh` " +
        "to fetch the last release into build/seed (it just failed), or run `npm run build` " +
        "to leave one in build/nish",
    };
  }
  return resolveSeed(FETCHED);
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
