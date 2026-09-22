#!/usr/bin/env node
/**
 * Where a CI job's wall clock actually goes, per check.
 *
 *   node scripts/ci-profile.mjs                          profile `node tests/run.js`
 *   node scripts/ci-profile.mjs --top 60                 more rows in each table
 *   node scripts/ci-profile.mjs --json                    the same numbers, machine-readable
 *   node scripts/ci-profile.mjs -- node tests/run.js --seed <nish>
 *   node scripts/ci-profile.mjs -- npm run test:nish
 *
 * Why this exists. `tests/run.js` is one process printing about nineteen
 * hundred `PASS` lines, and a slow run says only that the total grew. Every
 * attempt to find the slow part by hand ran into the trap that a filtered run
 * is not a measurement (`.claude/testing.md`: a filtered count means nothing
 * until `rm -rf build/test`, and fifteen `fs.existsSync` guards drop checks
 * silently rather than skipping them). So this profiles the *unfiltered* run
 * instead, from the outside, and attributes time to the checks that were
 * actually printed. It needs no change to the suite and cannot alter what the
 * suite proves.
 *
 * **How to read the numbers, including the one way they mislead.** A check's
 * cost here is the gap between the previous printed line and its own, so the
 * work is attributed to the line printed *after* it finished. That is the right
 * answer for a check that does its work and then reports, which is every check
 * in this suite. It is the wrong answer in one case worth naming: because
 * `tests/run.js` drives 234 `spawnSync` calls, the event loop is blocked for
 * the whole of each one and queued writes flush in bursts when it unblocks. So
 * a *gap* is real, and the line it lands on is real, but the ordering of the
 * lines inside one burst is not something to read a per-line cost out of. Look
 * at the expensive rows, not at the cheap ones.
 *
 * The totals are wall clock on the machine this runs on. A `ubuntu-latest`
 * runner measured about 1.34x this box on the same suite, so the shape
 * transfers and the absolute seconds do not.
 */
import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const topAt = argv.indexOf("--top");
const TOP = topAt >= 0 && Number.isFinite(Number(argv[topAt + 1])) ? Number(argv[topAt + 1]) : 40;

/**
 * Everything after `--` is the command to profile. The default is the suite as
 * CI runs it, minus the build: `npm test` would rebuild `dist/` first, and a
 * `tsc` run is not what this is measuring.
 */
const dashdash = argv.indexOf("--");
const command = dashdash >= 0 && argv.length > dashdash + 1 ? argv.slice(dashdash + 1) : ["node", "tests/run.js"];

/**
 * One row per line the child printed, with `dt` the gap since the line before
 * it. `text` keeps the line as it was printed so that a reader can find the
 * check in the log, and `t` is kept as well as `dt` because "which minute of
 * the run was this" is how a reader locates a slow block.
 */
const rows = [];
const t0 = process.hrtime.bigint();
let last = 0;
let buffered = "";

const takeLine = (line) => {
  const t = Number(process.hrtime.bigint() - t0) / 1e6;
  rows.push({ t, dt: t - last, text: line });
  last = t;
};

const onData = (data) => {
  buffered += data;
  let i;
  while ((i = buffered.indexOf("\n")) >= 0) {
    takeLine(buffered.slice(0, i));
    buffered = buffered.slice(i + 1);
  }
};

/**
 * A heartbeat on stderr, because the tables below cannot be printed until the
 * child has exited and `npm test` takes eleven minutes. It goes to stderr so
 * that `--json` on stdout stays machine-readable, and it names the last check
 * seen rather than only a count: that is what says whether a long silence is
 * the oracles working or the run wedged.
 */
const heartbeat = setInterval(() => {
  const latest = rows.length > 0 ? rows[rows.length - 1].text.slice(0, 72) : "nothing printed yet";
  const elapsed = (Number(process.hrtime.bigint() - t0) / 1e9).toFixed(0);
  process.stderr.write(`[ci-profile] ${elapsed}s, ${rows.length} lines: ${latest}\n`);
}, 30_000);
heartbeat.unref();

const child = spawn(command[0], command.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", onData);
child.stderr.on("data", onData);

const status = await new Promise((resolve) => {
  child.on("close", (code) => resolve(code ?? 1));
  child.on("error", (err) => {
    console.error(`could not run ${command.join(" ")}: ${err.message}`);
    resolve(1);
  });
});
clearInterval(heartbeat);
if (buffered.length > 0) takeLine(buffered);

/**
 * A check's name up to its first colon, which is how this suite names a family:
 * `link/argv_import: llvm-as accepts args.ll` and its six siblings are one
 * fixture compiled once, and the family is what a reader can act on. A line
 * with no colon is grouped under its first forty characters, which is enough to
 * keep the oracles — each of which prints one long line — apart.
 */
const familyOf = (text) => {
  const body = text.replace(/^(PASS|FAIL|SKIP)\s+/, "");
  const colon = body.indexOf(":");
  return colon > 0 ? body.slice(0, colon) : body.slice(0, 40);
};

const families = new Map();
for (const row of rows) {
  const key = familyOf(row.text);
  const seen = families.get(key) ?? { ms: 0, lines: 0 };
  seen.ms += row.dt;
  seen.lines += 1;
  families.set(key, seen);
}

const total = rows.length > 0 ? rows[rows.length - 1].t : 0;
const byCost = [...rows].sort((a, b) => b.dt - a.dt).slice(0, TOP);
const byFamily = [...families].sort((a, b) => b[1].ms - a[1].ms).slice(0, TOP);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        command,
        status,
        totalMs: Math.round(total),
        lines: rows.length,
        checks: byCost.map((r) => ({ ms: Math.round(r.dt), atMs: Math.round(r.t), text: r.text })),
        families: byFamily.map(([name, f]) => ({ name, ms: Math.round(f.ms), lines: f.lines })),
      },
      null,
      2
    )
  );
  process.exit(status);
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`.padStart(8);

console.log(`\n${command.join(" ")}`);
console.log(`exit ${status} — ${secs(total).trim()} of wall clock over ${rows.length} printed lines\n`);

/**
 * The run's own verdict, echoed verbatim.
 *
 * A profile that swallowed this would be worse than useless here, because exit
 * 0 is not the whole answer: `tests/run.js` reports a *skip count* beside the
 * passes, and a green run with more skips than the last one proved less while
 * looking the same (`.claude/orientation.md` calls reading the count rather than
 * the exit status the thing to do). So the summary is printed before the
 * timings, where it cannot be missed.
 */
const verdict = rows.filter((r) => r.text.trim().length > 0).slice(-3);
if (verdict.length > 0) {
  console.log("=== what the run itself reported ===");
  for (const row of verdict) console.log(`  ${row.text}`);
  console.log("");
}

console.log(`=== the ${byCost.length} most expensive checks (cost = the gap before the line was printed) ===`);
for (const row of byCost) console.log(`${secs(row.dt)}  at ${secs(row.t)}  ${row.text.slice(0, 104)}`);

console.log(`\n=== the ${byFamily.length} most expensive families (cumulative) ===`);
for (const [name, f] of byFamily) console.log(`${secs(f.ms)}  ${String(f.lines).padStart(5)} line(s)  ${name.slice(0, 84)}`);

/**
 * The share the expensive tail accounts for, because "the top ten are 70% of
 * the run" is the sentence that decides whether to optimise a check or the
 * shape of the job around it.
 */
const topTen = [...rows].sort((a, b) => b.dt - a.dt).slice(0, 10).reduce((sum, r) => sum + r.dt, 0);
console.log(`\nthe ten most expensive checks are ${((topTen / total) * 100).toFixed(0)}% of the run.`);

process.exit(status);
