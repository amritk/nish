/**
 * Shared machinery for the differential harness (WP13): program discovery,
 * native build + run, rewrite + Node run, byte-for-byte comparison, a small
 * process pool, and the known-failures list. Used by run.js, fuzz.js, and the
 * WP13 block of tests/run.js.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rewriteProgram } from "./rewrite.js";

const root = path.resolve(import.meta.dirname, "..", "..");
const cli = path.join(root, "dist", "index.js");
const casesDir = path.join(root, "tests", "cases");
const corpusDir = path.join(import.meta.dirname, "corpus");
const buildDir = path.join(root, "build", "test", "differential");
const knownFile = path.join(import.meta.dirname, "known-failures.txt");

const RUN_TIMEOUT_MS = 30_000;

const words = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : []);

/**
 * A program the harness can run: `{ name, entry, args, argv, kind }`. `args`
 * are compiler flags (`<name>.args`), `argv` the command line both the native
 * binary and the Node rewrite receive (`<name>.argv`, WP7 `process.argv`).
 */
function program(name, entry, argsFile, kind) {
  return { name, entry, args: words(argsFile), argv: words(argsFile.replace(/args$/, "argv")), kind };
}

/**
 * Every `tests/cases/*.ts` with `export function main` and no `.err`, and
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
      if (!/\bexport\s+function\s+main\b/.test(fs.readFileSync(src, "utf8"))) continue;
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

function numberModeOf(args) {
  const i = args.indexOf("--number-mode");
  return i >= 0 ? args[i + 1] : "i32";
}

/**
 * Build, run, rewrite, run, compare. Never throws; the result carries
 *   verdict: "match" | "mismatch" | "compile-error" | "rewrite-error"
 * plus both sides' `{ status, signal, stdout, stderr }` when they ran.
 */
async function runProgram(prog) {
  const work = path.join(buildDir, prog.name.replace(/[\\/]/g, "_"));
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const exe = path.join(work, "app");
  const t0 = Date.now();

  const cc = await run("node", [cli, prog.entry, "-o", `${path.join(work, "ir")}${path.sep}`, "--link", exe, ...prog.args]);
  if (cc.status !== 0) {
    return { prog, verdict: "compile-error", detail: String(cc.stderr), ms: Date.now() - t0 };
  }
  const argv = prog.argv ?? []; // fuzz programs carry no command line
  const native = await run(exe, argv);

  let js;
  try {
    js = rewriteProgram(
      prog.entry,
      { numberMode: numberModeOf(prog.args), nsw: !prog.args.includes("--wrapping") },
      path.join(work, "js")
    );
  } catch (e) {
    return { prog, verdict: "rewrite-error", detail: e.stack ?? String(e), native, ms: Date.now() - t0 };
  }
  const node = await run("node", [js.entry, ...argv]);

  const same = native.status === node.status && native.signal === node.signal && native.stdout.equals(node.stdout);
  return { prog, verdict: same ? "match" : "mismatch", native, node, ms: Date.now() - t0, work };
}

/** Run `fn` over `items` with at most `n` in flight; results keep the input order. */
async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return results;
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
  if (b.stderr.length > 0 && b.status !== 1) lines.push(`node stderr: ${String(b.stderr).trim().split("\n")[0]}`);
  if (a.stderr.length > 0 && a.status !== 1) lines.push(`native stderr: ${String(a.stderr).trim().split("\n")[0]}`);
  return lines.join("\n");
}

/** Whether clang is on PATH; the toolchain-dependent checks skip rather than fail without it. */
const hasClang = () => spawnSync("which", ["clang"]).status === 0;

export {
  root,
  buildDir,
  knownFile,
  discoverPrograms,
  runProgram,
  pool,
  readKnownFailures,
  describeMismatch,
  summarize,
  numberModeOf,
  hasClang,
};
