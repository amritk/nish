#!/usr/bin/env node
/**
 * The parent half of the batched compile: it hands chunks of golden cases to
 * `tests/batch_worker.js`, reassembles the per-case results, and answers a map
 * `tests/run.js` can read a `spawnSync`-shaped result out of.
 *
 * Three things it owes the suite, in the order they matter:
 *
 *   1. **Nothing is lost.** A case the worker declined (a flag the library API
 *      cannot express) is simply absent from the map, and `tests/run.js`
 *      spawns the real CLI for it — the fallback is the code that was already
 *      there, so there is only one place a case can be compiled from besides
 *      here.
 *   2. **A crash names a case.** An internal error is caught in the worker, but
 *      an OOM, a `process.exit` or a stack overflow is not: the process dies
 *      with N cases unreported. So a chunk that dies is re-run one case per
 *      process — the whole chunk, not only the unreported tail, because a
 *      process that died may have been misbehaving before it did — and the case
 *      that dies on its own gets a result that *fails*, naming itself, rather
 *      than falling back to a CLI run that would quietly pass.
 *   3. **The fast path is checked against the slow one.** `gateCases` and
 *      `compareWithCli` below are the correctness gate: the same case through
 *      both paths, byte for byte. See `gateCases` for what is checked on every
 *      run and what waits for CI.
 */
import fs from "node:fs";
import path from "node:path";
import { pool, run, defaultJobs } from "./pool.js";

const root = path.resolve(import.meta.dirname, "..");
const casesDir = path.join(root, "tests", "cases");
const buildDir = path.join(root, "build", "test");
const worker = path.join(root, "tests", "batch_worker.js");

/**
 * Cases per worker process.
 *
 * A worker costs about 600 ms to start (Node, the `typescript` package,
 * `dist/`) and about 3 ms per case after that, so the chunk size is entirely a
 * trade between startup overhead and how much work a crash costs to re-attribute.
 * Sixty-four puts ten processes over a six-hundred-case corpus — about 6 s of
 * startup, spread over `defaultJobs()` cores, against the 6+ minutes of one
 * process per case — and makes the one-case-per-process re-run of a dead chunk
 * a minute rather than the whole section.
 */
const CHUNK = 64;

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** The `.args` of a case as the CLI is handed them, or `[]`. */
export const argsFor = (name) => {
  const file = path.join(casesDir, `${name}.args`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : [];
};

/** Read whatever records a worker managed to append, ignoring a half-written last line. */
const readRecords = (file) => {
  if (!fs.existsSync(file)) return [];
  const records = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.length === 0) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // A record cut in half by a process dying mid-write: the case it belongs
      // to counts as unreported, which is exactly how it is treated below.
    }
  }
  return records;
};

const runWorker = async (names, tag) => {
  const file = path.join(buildDir, "batch", `${tag}.ndjson`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.rmSync(file, { force: true });
  const r = await run("node", [worker, file, ...names], { cwd: root, encoding: "utf8" });
  return { records: readRecords(file), status: r.status, stderr: String(r.stderr) };
};

/**
 * Compile `names` in as few processes as the crash-isolation rule allows.
 *
 * Returns `Map<name, { status, stdout, stderr }>`. A name missing from the map
 * was not compiled here and is the caller's to spawn; a name present with a
 * non-zero status was compiled here and refused, exactly as the CLI would have
 * answered.
 */
export const compileCases = async (names, jobs = defaultJobs()) => {
  const results = new Map();
  // Without a built `dist/` there is nothing to drive in process. The CLI the
  // caller falls back to is just as broken, and reports it the way it always
  // has, so this stays out of the business of diagnosing it.
  if (names.length === 0 || !fs.existsSync(path.join(root, "dist", "compiler.js"))) return results;

  const chunks = chunk(names, CHUNK);
  const outcomes = await pool(chunks, jobs, (group, i) => runWorker(group, `chunk-${i}`));

  const retries = [];
  outcomes.forEach(({ records, status, stderr }, i) => {
    const group = chunks[i];
    const complete = records.length === group.length && status === 0;
    if (complete) {
      for (const record of records) results.set(record.name, record);
      return;
    }
    const died = records.length < group.length ? group[records.length] : "(none)";
    retries.push({
      group,
      why: `worker exited ${status} after ${records.length}/${group.length} cases (at ${died})\n${stderr}`,
    });
  });

  // One process per case, so the failure lands on the case that caused it.
  for (const { group, why } of retries) {
    const each = await pool(group, jobs, (name, i) => runWorker([name], `retry-${name}-${i}`));
    group.forEach((name, i) => {
      const { records, status, stderr } = each[i];
      if (records.length === 1 && status === 0) {
        results.set(name, records[0]);
        return;
      }
      // A case that takes its own process down must not fall through to a CLI
      // run that would pass: it is a failure, and it says so here.
      results.set(name, {
        name,
        status: status === 0 ? 1 : (status ?? 1),
        stdout: "",
        stderr: `the batched compile crashed on this case\n${stderr}${why}`,
      });
    });
  }
  return results;
};

/** How a case asserts: which sidecar `tests/run.js` reads its answer out of. */
const outcomeClass = (name) => {
  const side = (ext) => fs.existsSync(path.join(casesDir, `${name}.${ext}`));
  if (side("err")) return "err";
  if (side("stdout")) return "stdout";
  if (side("out")) return "out";
  return "ll";
};

/**
 * The cases the every-run correctness gate compiles twice.
 *
 * The whole corpus through both paths is the complete claim, and it costs about
 * one CLI spawn per case — six minutes and the entire saving — so it is not
 * what every `npm test` pays for. It runs in full behind `--verify-batch`, and
 * CI runs that on every pull request (the `batch-parity` job in
 * `.github/workflows/ci.yml`), which is where a whole-corpus comparison belongs:
 * a machine that is already spending ten minutes, not a developer's inner loop.
 *
 * What runs every time is chosen to be the part a *drift* would show up in.
 * The batched path reimplements one thing only — the slice of `src/index.ts`
 * that turns flags into `CompilerOptions` and decides what to write — so the
 * gate takes one case per distinct combination of the three inputs to that
 * decision: the exact `.args` text, which sidecar the case asserts through, and
 * whether the source pulls in a second module. That is derived from the corpus
 * rather than listed here, so a case that introduces a new flag spelling enters
 * the gate by existing, and the set cannot quietly stop covering something.
 * A sampled rotation was the alternative and was rejected: a gate that checks
 * different cases on different days makes a failure something you cannot
 * reproduce by re-running.
 */
export const gateCases = (names) => {
  const seen = new Set();
  const picked = [];
  for (const name of names) {
    const args = argsFor(name).join(" ");
    const imports = /^\s*import\b/m.test(fs.readFileSync(path.join(casesDir, `${name}.ts`), "utf8"));
    const key = JSON.stringify([args, outcomeClass(name), imports]);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(name);
  }
  return picked;
};

/**
 * Compile `names` through the CLI and compare with what the batch produced.
 *
 * Everything the CLI is judged on in section A is compared: the exit status,
 * stdout, stderr and the bytes of the emitted module. The only normalisation is
 * the output path, which the two paths deliberately do not share — the CLI
 * writes into a scratch directory so that the file the rest of the section
 * reads is still the batch's — and which the IR does not record.
 */
export const compareWithCli = async (names, batched, cli, jobs = defaultJobs()) => {
  const cliDir = path.join(buildDir, "batch", "cli");
  fs.mkdirSync(cliDir, { recursive: true });
  return pool(names, jobs, async (name) => {
    const mine = batched.get(name);
    if (mine === undefined) return { name, ok: true, detail: "(not batched; the CLI is what ran)" };
    const src = path.join(casesDir, `${name}.ts`);
    const cliLl = path.join(cliDir, `${name}.ll`);
    const theirs = await run("node", [cli, src, "-o", cliLl, ...argsFor(name)], {
      cwd: root,
      encoding: "utf8",
    });
    const normalise = (text) =>
      String(text)
        .split(cliLl)
        .join("<out>")
        .split(path.join(buildDir, `${name}.ll`))
        .join("<out>");
    const mineLl = path.join(buildDir, `${name}.ll`);
    const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
    const differences = [];
    if (mine.status !== theirs.status) differences.push(`exit ${mine.status} vs the CLI's ${theirs.status}`);
    if (String(mine.stdout) !== String(theirs.stdout))
      differences.push(`stdout\n--- batched\n${mine.stdout}\n--- CLI\n${theirs.stdout}`);
    if (normalise(mine.stderr) !== normalise(theirs.stderr))
      differences.push(
        `stderr\n--- batched\n${normalise(mine.stderr)}\n--- CLI\n${normalise(theirs.stderr)}`
      );
    if (mine.status === 0 && theirs.status === 0) {
      const a = read(mineLl);
      const b = read(cliLl);
      if (a !== b) differences.push(a === null || b === null ? "one path wrote no module" : "the emitted IR");
    }
    return { name, ok: differences.length === 0, detail: differences.join("\n") };
  });
};
