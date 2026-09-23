/**
 * Shared machinery for the differential harness (WP13): program discovery,
 * native build + run, frozen rewrite + Node run, byte-for-byte comparison, a
 * small process pool, and the known-failures list. Used by run.js and the
 * WP13 block of tests/run.js.
 *
 * **Neither half of a comparison is stage0 any more** (WP19 G2.4, R6). The
 * native half takes the compiler `compilerFor` resolves -- `--compiler`, then
 * the seed -- and the Node half takes the frozen rewrites in
 * `tests/differential/goldens/`, the only source of JavaScript left now that
 * the rewriter, which drove stage0's checker, is gone. A program with no frozen
 * rewrite is compared against nothing and says so: it is either named in
 * `goldens/unfrozen.txt` or it is a failure.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
// `pool` moved to tests/pool.js when the WP14 oracles needed it too; it is
// still re-exported below, so the runners that import it from here are
// unchanged. `run` below stays local: it is this harness's specialisation,
// with a cwd and a kill timeout the oracles do not want.
import { pool } from "../pool.js";
// The seed resolution is the one the WP14 oracles use (G2.3), so "the compiler
// that is not stage0" is spelled once in the repository.
import { defaultSeedSpec, resolveSeed } from "../self/seed.js";
import { materialize, readRegister, readStore, REGISTER, staleness } from "./goldens.js";

const root = path.resolve(import.meta.dirname, "..", "..");
const casesDir = path.join(root, "tests", "cases");
const corpusDir = path.join(import.meta.dirname, "corpus");
const buildDir = path.join(root, "build", "test", "differential");
const knownFile = path.join(import.meta.dirname, "known-failures.txt");

const RUN_TIMEOUT_MS = 30_000;

const words = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : [];

/**
 * `<name>.env`: one `NAME=value` per line, layered over the inherited
 * environment (and a bare `NAME` unsets one), the same sidecar `tests/run.js`
 * reads. Both sides need it and
 * for the same reason: `getenv` (WP19 R1) is only comparable when the native
 * binary and the Node rewrite are handed the same environment, and only the
 * runner can set one.
 */
function envFile(file) {
  if (!fs.existsSync(file)) return process.env;
  const env = { ...process.env };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const text = line.trim();
    if (text.length === 0 || text.startsWith("#")) continue;
    const eq = text.indexOf("=");
    // A bare `NAME` takes the variable *away*, which `NAME=` cannot do: an
    // empty value is a set variable, and `getenv`'s third answer — unset — is
    // otherwise only as reliable as the developer's own environment.
    if (eq < 0) delete env[text];
    else if (eq > 0) env[text.slice(0, eq)] = text.slice(eq + 1);
  }
  return env;
}

/**
 * A program the harness can run: `{ name, entry, args, argv, env, kind }`.
 * `args` are compiler flags (`<name>.args`), `argv` the command line both the
 * native binary and the Node rewrite receive (`<name>.argv`, WP7
 * `process.argv`), and `env` the environment both are given (`<name>.env`).
 */
function program(name, entry, argsFile, kind) {
  return {
    name,
    entry,
    args: words(argsFile),
    argv: words(argsFile.replace(/args$/, "argv")),
    env: envFile(argsFile.replace(/args$/, "env")),
    kind,
  };
}

/**
 * Every `tests/cases/*.ts` with an exported `main` in either spelling (WP22) and no `.err`, and
 * every corpus program: `tests/differential/corpus/<name>.ts` (+ `<name>.args`)
 * or `tests/differential/corpus/<name>/main.ts` (+ `args`) for multi-module ones.
 */
function discoverPrograms({ cases = true, corpus = true } = {}) {
  const out = [];
  if (cases) {
    for (const file of fs.readdirSync(casesDir).sort()) {
      if (!file.endsWith(".ts")) continue;
      const name = file.slice(0, -3);
      const src = path.join(casesDir, file);
      if (fs.existsSync(path.join(casesDir, `${name}.err`))) continue;
      if (!/\bexport\s+(?:function\s+main\b|const\s+main\s*=)/.test(fs.readFileSync(src, "utf8"))) continue;
      out.push(program(`cases/${name}`, src, path.join(casesDir, `${name}.args`), "case"));
    }
  }
  if (corpus && fs.existsSync(corpusDir)) {
    for (const file of fs.readdirSync(corpusDir).sort()) {
      const full = path.join(corpusDir, file);
      if (file.endsWith(".ts")) {
        const name = file.slice(0, -3);
        out.push(program(`corpus/${name}`, full, path.join(corpusDir, `${name}.args`), "corpus"));
      } else if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "main.ts"))) {
        out.push(program(`corpus/${file}`, path.join(full, "main.ts"), path.join(full, "args"), "corpus"));
      }
    }
  }
  return out;
}

/** Spawn asynchronously; resolves with `{ status, signal, stdout, stderr }` (Buffers). */
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...opts });
    const out = [];
    const err = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeout ?? RUN_TIMEOUT_MS);
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ status: null, signal: null, stdout: Buffer.concat(out), stderr: Buffer.from(String(e)) });
    });
  });
}

/**
 * The compiler that builds the native half of every comparison: `--compiler
 * <path>`, then the seed (`NISH_BOOTSTRAP`, then `build/nish`). It used to
 * default to stage0's `dist/index.js`, the shipped compiler while there was
 * one; R6 deletes it, and `tests/run.js` names the stage1 it built.
 */
const compilerFor = (spec) => {
  const named = spec ?? defaultSeedSpec();
  if (named === null) {
    return {
      error:
        "no compiler: pass --compiler <nish>, set NISH_BOOTSTRAP, " +
        "or run `npm run bootstrap` to leave one in build/nish",
    };
  }
  return resolveSeed(named);
};

/**
 * The Node half's source of JavaScript: the frozen rewrites checked in under
 * `tests/differential/goldens/`. A recording of a program that has since
 * changed is a lie, and the guard in `goldens.js` turns it into a hard failure
 * rather than a verdict; a program the register names has no recording at all
 * and is reported as not compared.
 */
const rewriterFor = () => {
  const store = readStore();
  if (store.error !== undefined) return { error: store.error };
  const register = readRegister();
  return {
    label: "frozen rewrite",
    // Why the register says this program has no frozen rewrite, or null.
    unfrozen: (prog) =>
      !store.programs.has(prog.name) && register.has(prog.name) ? register.get(prog.name) : null,
    rewrite: (prog, dir) => {
      const record = store.programs.get(prog.name);
      if (record === undefined) {
        throw stale(
          `${prog.name} has no frozen rewrite and is not in ${path.relative(root, REGISTER)}: ` +
            "`node tests/differential/goldens.js --update` registers it"
        );
      }
      const why = staleness(record, prog, store.bodies);
      if (why !== null) throw stale(`${prog.name}'s frozen rewrite is stale: ${why}`);
      return materialize(record, store.bodies, dir);
    },
  };
};

/**
 * A staleness failure, which is not a rewrite failure: the comparison could
 * have been run, and would have compared today's binary against yesterday's
 * JavaScript. `known-failures.txt` may not excuse one.
 */
const stale = (message) => {
  const e = new Error(message);
  e.stale = true;
  return e;
};

/** Everything one program's run leaves behind: `build/test/differential/<name>`. */
const workFor = (name) => path.join(buildDir, name.replace(/[\\/]/g, "_"));

/**
 * The working directory one side of one program runs in: `<work>/<side>-cwd`,
 * a stand-in for the repository root whose `build/` is its own.
 *
 * **The programs write by relative path, and the runs are parallel.** A corpus
 * program that writes `build/test/io_nish_import.txt` and reads it back is
 * correct on its own and wrong beside a second program writing the same path:
 * `io_nish_import` and its twin `io_nish_import_global` do exactly that, by
 * design, since `tests/run.js` requires the two to emit the same IR, and under
 * `--jobs 8` one of them would read the file the other had just truncated. So
 * nothing a program writes may be shared, and the isolation is the working
 * directory rather than the path: the sources are frozen (a changed path would
 * stale the rewrite), and a rule that every program pick a unique path is one
 * the next program forgets.
 *
 * Everything else at the root is a symlink back to the checkout, so a program
 * that reads a checked-in file by the path a user at the root would type
 * (`corpus/io_streams` reads its own source) still finds it. `build/test/` and
 * `build/test/differential/` are made empty, because those are the directories
 * the corpus has always been able to assume. The native binary and the Node
 * rewrite each get one, so neither can see what the other left behind either.
 */
const cwdFor = (name, side) => path.join(workFor(name), `${side}-cwd`);

/** Make {@link cwdFor}'s directory for `side` of `prog`, and answer its path. */
const scratchRoot = (prog, side) => {
  const dir = cwdFor(prog.name, side);
  fs.mkdirSync(path.join(dir, "build", "test", "differential"), { recursive: true });
  for (const entry of fs.readdirSync(root)) {
    if (entry !== "build") fs.symlinkSync(path.join(root, entry), path.join(dir, entry));
  }
  return dir;
};

/**
 * Build, run, rewrite, run, compare. Never throws; the result carries
 *   verdict: "match" | "mismatch" | "compile-error" | "rewrite-error" | "stale-golden" | "unfrozen"
 * plus both sides' `{ status, signal, stdout, stderr }` when they ran.
 * `context` is `{ compiler, rewriter }`, from `compilerFor` and `rewriterFor`.
 */
async function runProgram(prog, context) {
  const t0 = Date.now();
  const refused = context.compiler.error ?? context.rewriter.error;
  if (refused !== undefined) return { prog, verdict: "compile-error", detail: refused, ms: Date.now() - t0 };
  // Asked before anything is built: a registered program is compared against
  // nothing, so building it would only spend the time.
  const why = context.rewriter.unfrozen(prog);
  if (why !== null) return { prog, verdict: "unfrozen", detail: why, ms: Date.now() - t0 };

  const work = workFor(prog.name);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const exe = path.join(work, "app");

  const { cmd, prefix } = context.compiler;
  const cc = await run(cmd, [
    ...prefix,
    prog.entry,
    "-o",
    `${path.join(work, "ir")}${path.sep}`,
    "--link",
    exe,
    ...prog.args,
  ]);
  if (cc.status !== 0) {
    return { prog, verdict: "compile-error", detail: String(cc.stderr), ms: Date.now() - t0 };
  }
  const native = await run(exe, prog.argv, { cwd: scratchRoot(prog, "native"), env: prog.env });

  let js;
  try {
    js = context.rewriter.rewrite(prog, path.join(work, "js"));
  } catch (e) {
    // A stale golden is counted apart from a rewrite failure because it means
    // the opposite of one: the comparison *could* have run, against a reference
    // that is no longer this program's. `run.js` fails on it whatever
    // `known-failures.txt` says.
    if (e.stale === true)
      return { prog, verdict: "stale-golden", detail: e.message, native, ms: Date.now() - t0 };
    return { prog, verdict: "rewrite-error", detail: e.stack ?? String(e), native, ms: Date.now() - t0 };
  }
  const node = await run("node", [js.entry, ...prog.argv], { cwd: scratchRoot(prog, "node"), env: prog.env });

  const same =
    native.status === node.status && native.signal === node.signal && native.stdout.equals(node.stdout);
  return { prog, verdict: same ? "match" : "mismatch", native, node, ms: Date.now() - t0, work };
}

function readKnownFailures() {
  if (!fs.existsSync(knownFile)) return new Set();
  return new Set(
    fs
      .readFileSync(knownFile, "utf8")
      .split("\n")
      .map((l) => l.replace(/#.*/, "").trim())
      .filter(Boolean)
  );
}

function summarize(side) {
  if (!side) return "-";
  const exit = side.signal ? side.signal : `exit ${side.status}`;
  return `${exit}, ${side.stdout.length} B`;
}

/** Human-readable explanation of a mismatch: exit status and the first differing stdout line. */
function describeMismatch(r) {
  const lines = [];
  const a = r.native;
  const b = r.node;
  if (a.status !== b.status || a.signal !== b.signal) {
    lines.push(`exit: native ${summarize(a)} vs node ${summarize(b)}`);
  }
  if (!a.stdout.equals(b.stdout)) {
    const la = String(a.stdout).split("\n");
    const lb = String(b.stdout).split("\n");
    const n = Math.max(la.length, lb.length);
    for (let i = 0; i < n; i++) {
      if (la[i] !== lb[i]) {
        lines.push(`stdout line ${i + 1}: native ${JSON.stringify(la[i])} vs node ${JSON.stringify(lb[i])}`);
        break;
      }
    }
  }
  if (b.stderr.length > 0 && b.status !== 1)
    lines.push(`node stderr: ${String(b.stderr).trim().split("\n")[0]}`);
  if (a.stderr.length > 0 && a.status !== 1)
    lines.push(`native stderr: ${String(a.stderr).trim().split("\n")[0]}`);
  return lines.join("\n");
}

/** Whether clang is on PATH; the toolchain-dependent checks skip rather than fail without it. */
const hasClang = () => spawnSync("which", ["clang"]).status === 0;

export {
  root,
  buildDir,
  cwdFor,
  knownFile,
  compilerFor,
  discoverPrograms,
  rewriterFor,
  runProgram,
  pool,
  readKnownFailures,
  describeMismatch,
  summarize,
  hasClang,
};
