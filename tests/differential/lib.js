/**
 * Shared machinery for the differential harness (WP13): program discovery,
 * native build + run, rewrite + Node run, byte-for-byte comparison, a small
 * process pool, and the known-failures list. Used by run.js, fuzz.js, and the
 * WP13 block of tests/run.js.
 *
 * **Neither half of a comparison names stage0 any more** (WP19 G2.4). The
 * native half takes whatever compiler `compilerFor` resolves — `dist/index.js`
 * while there is one, the seed otherwise — and the Node half takes either the
 * live rewriter or the frozen rewrites in `tests/differential/goldens/`. Both
 * fall back with a note on stderr rather than silently, because a run that
 * proved something weaker than its summary line suggests is worse than a run
 * that refused. `rewrite.js` is therefore imported lazily: it drives stage0's
 * `Compilation` at module scope, so a static import here would stop this file
 * loading at all in a tree where `src/` has been deleted.
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
import { loadRewriter, materialize, readStore, rewriteOptions, staleness } from "./goldens.js";

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

/** `dist/index.js`, spelled the way `resolveSeed` wants it. */
const STAGE0 = path.join("dist", "index.js");

/**
 * The compiler that builds the native half of every comparison.
 *
 * It used to be `dist/index.js` and nothing else, which is what made this
 * oracle stage0's twice over: once for the binary and once for the rewrite.
 * Only the rewrite needs stage0's checker, so the binary is built by whatever
 * compiler is resolved here — `--compiler <path>`, then stage0 while there is a
 * stage0, then the seed (`NISH_BOOTSTRAP`, then `build/nish`). Stage0 stays the
 * default on purpose while it lives: the native side of the published claim is
 * the shipped compiler's codegen, and switching that quietly would change what
 * the summary line means.
 */
const compilerFor = (spec) => {
  if (spec !== undefined && spec !== null) return resolveSeed(spec);
  if (fs.existsSync(path.join(root, STAGE0))) return resolveSeed(STAGE0);
  const seed = defaultSeedSpec();
  if (seed === null) {
    return {
      error:
        "no compiler: there is no dist/index.js, so pass --compiler <nish>, set NISH_BOOTSTRAP, " +
        "or run `npm run bootstrap` to leave one in build/nish",
    };
  }
  process.stderr.write(`note: no dist/index.js, so the native side is built with the seed (${seed}).\n`);
  return resolveSeed(seed);
};

/**
 * The Node half's source of JavaScript: the live rewriter, or the frozen
 * rewrites checked in under `tests/differential/goldens/`.
 *
 * `frozen: true` demands the store, `false` demands the live rewriter, and
 * neither takes the live one while it exists and the store when it does not —
 * with a note, because the two are not equally strong. The live rewriter reads
 * today's source; the store is a recording, and a recording of a program that
 * has since changed is a lie the guard in `goldens.js` turns into a hard
 * failure rather than a verdict.
 */
const rewriterFor = async ({ frozen } = {}) => {
  if (frozen !== true) {
    const live = await loadRewriter();
    if (live.error === undefined) {
      return {
        label: "live rewrite",
        rewrite: (prog, dir) => live.rewriteProgram(prog.entry, rewriteOptions(prog.args), dir),
      };
    }
    if (frozen === false) return { error: live.error };
    process.stderr.write(
      `note: ${live.error}\n` +
        "      the Node side is the frozen rewrite in tests/differential/goldens/ (WP19 G2.4).\n"
    );
  }
  const store = readStore();
  if (store.error !== undefined) return { error: store.error };
  return {
    label: "frozen rewrite",
    rewrite: (prog, dir) => {
      const record = store.programs.get(prog.name);
      if (record === undefined) {
        // A generated program is the one case where this is not somebody's
        // oversight: the fuzzer invents its corpus from a seed, so a reference
        // for it has to be *computed* and there is nothing a store could hold.
        // That is why the fuzz differential against Node dies with the
        // rewriter rather than being frozen with everything else.
        throw stale(
          prog.kind === "fuzz"
            ? `${prog.name} is generated, so no store can hold its rewrite: the fuzz differential against Node needs the rewriter (wp19 §6 item 6)`
            : `${prog.name} has no frozen rewrite: run \`npm run test:update\` while stage0 exists`
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

/** The compiler and rewriter a caller did not name, resolved once per process. */
let shared = null;

const sharedContext = async () => {
  if (shared === null) shared = { compiler: compilerFor(), rewriter: await rewriterFor({}) };
  return shared;
};

/**
 * Build, run, rewrite, run, compare. Never throws; the result carries
 *   verdict: "match" | "mismatch" | "compile-error" | "rewrite-error" | "stale-golden"
 * plus both sides' `{ status, signal, stdout, stderr }` when they ran.
 */
async function runProgram(prog, options = {}) {
  const t0 = Date.now();
  const context =
    options.compiler !== undefined && options.rewriter !== undefined ? options : await sharedContext();
  const refused = context.compiler.error ?? context.rewriter.error;
  if (refused !== undefined) return { prog, verdict: "compile-error", detail: refused, ms: Date.now() - t0 };

  const work = path.join(buildDir, prog.name.replace(/[\\/]/g, "_"));
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
  const argv = prog.argv ?? []; // fuzz programs carry no command line
  const env = prog.env ?? process.env; // and no environment of their own either
  const native = await run(exe, argv, { env });

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
  const node = await run("node", [js.entry, ...argv], { env });

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
