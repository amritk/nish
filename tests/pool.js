#!/usr/bin/env node
/**
 * The two things a parallel runner in this tree needs: a bounded worker pool
 * that keeps the input order, and `spawn` shaped like a promise.
 *
 * **Order is the whole point, not a nicety.** Every runner here ends in a
 * summary and names the files that failed, and a runner whose output depended
 * on which child finished first would report the same corpus differently from
 * one run to the next -- a failure that moves is a failure nobody bisects. So
 * `pool` writes each result into the slot its input came from and the caller
 * walks the results in input order: N jobs print exactly what one job printed.
 *
 * That is also what makes the width safe to change. `--jobs 1` is the
 * sequential runner these oracles used to be, and is the first thing to reach
 * for when a parallel run says something surprising.
 *
 * `pool` was `tests/differential/lib.js`'s first, and that module still
 * re-exports it for the runners that import it from there.
 */
import { spawn } from "node:child_process";
import os from "node:os";

/**
 * One job per core, capped. The cap is not politeness: these jobs are whole
 * compilers holding a module graph each, so the ceiling is memory rather than
 * cores, and a 64-core runner forking 64 of them is how a suite gets OOM-killed
 * instead of getting faster.
 */
export const defaultJobs = () => Math.min(8, os.cpus().length || 2);

/** Read `--jobs N` out of an argv, falling back to {@link defaultJobs}. */
export const jobsFrom = (argv) => {
  const i = argv.indexOf("--jobs");
  if (i < 0) return defaultJobs();
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : defaultJobs();
};

/** Run `fn` over `items` with at most `n` in flight; results keep the input order. */
export const pool = async (items, n, fn) => {
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
};

/**
 * `spawn` as a promise, shaped like `spawnSync` so a sequential runner becomes
 * a parallel one by adding `await`: same options, same `{ status, signal,
 * stdout, stderr }`, and `encoding: "utf8"` to get strings instead of buffers.
 *
 * It never rejects. A child that cannot be spawned resolves with a null status
 * and the reason on stderr, which is what `spawnSync` reports too, so a caller
 * testing `status !== 0` keeps working either way.
 */
export const run = (cmd, args, opts = {}) => {
  const { encoding, ...spawnOpts } = opts;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...spawnOpts });
    const out = [];
    const err = [];
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));
    const decode = (chunks) => {
      const buf = Buffer.concat(chunks);
      return encoding === "utf8" ? buf.toString("utf8") : buf;
    };
    child.on("close", (status, signal) => {
      resolve({ status, signal, stdout: decode(out), stderr: decode(err) });
    });
    child.on("error", (e) => {
      resolve({ status: null, signal: null, stdout: decode(out), stderr: decode([Buffer.from(String(e))]) });
    });
  });
};
