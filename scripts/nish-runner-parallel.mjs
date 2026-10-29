#!/usr/bin/env node
/**
 * The golden runner written in Nish (`tests/nish/run.ts`), several at once.
 *
 *   node scripts/nish-runner-parallel.mjs --runner build/nish-runner --compiler build/nish
 *   node scripts/nish-runner-parallel.mjs --runner <exe> --compiler <nish> --shard 2/2 --jobs 4 [filter]
 *
 * The runner checks one program at a time: compile, `llvm-as`, `opt`, link and
 * run, each a `spawnSyncTo` it waits on. On CI's four-core runners that left
 * three cores idle for the whole of the `runner` job. This starts `--jobs`
 * runners (one per core by default, `defaultJobs()`), each on a slice of its
 * own, and waits for them all.
 *
 * **Which programs a job runs does not change.** The runner deals one list of
 * cases and link programs round-robin (`--shard <i>/<n>` takes every `n`th),
 * so job `i` of `n` with `P` processes runs the global slices `i`, `i + n`,
 * ..., `i + n(P - 1)` of `n·P`: an item lands in one of those exactly when its
 * position is `i - 1` modulo `n`, which is the set `--shard i/n` names alone.
 *
 * **Each process has a working directory of its own**, because the runner
 * addresses everything relative to its own: `tests/cases`, the compiler, and
 * its work under `build/` (`build/nish-cases`, `build/nish-link`, and the
 * `build/test` several cases write into by literal path). Two of those cases,
 * `io_nish_import` and `io_nish_import_global`, write the same
 * `build/test/io_nish_import.txt` by design, and the language has no `chdir`
 * for the runner to keep them apart itself. So each process runs in
 * `build/nish-runner-parallel/<slice>-of-<total>/`: a symbolic link to every top-level
 * entry of the checkout but `build/` and `.git`, and a `build/` that is its
 * own. The runtime cache under `$XDG_CACHE_HOME` is shared, as it is between
 * the link programs `tests/run.js` runs at once.
 *
 * **The report reads as one run's.** Each process's output is printed whole,
 * in slice order, once it and every slice before it are done, and the last
 * line is the runner's own summary summed over them -- `golden cases: N
 * passed, N failed, N skipped` -- so CI's `tail -n 1` reads it as before. A
 * skip a runner makes once for a missing tool (no clang, no `opt`) is counted
 * once per runner, as each one did skip it. The exit status is 1 when any
 * runner answered non-zero or printed no summary.
 */
import fs from "node:fs"
import path from "node:path"
import { defaultJobs, jobsFrom, pool, run } from "../tests/pool.js"

const root = path.resolve(import.meta.dirname, "..")
const argv = process.argv.slice(2)

/** The value after `flag`, or `fallback` when the flag is absent. */
const flagValue = (flag, fallback) => {
  const at = argv.indexOf(flag)
  return at >= 0 ? argv[at + 1] : fallback
}

const usage = (why) => {
  console.error(`nish-runner-parallel: ${why}`)
  console.error(
    "usage: node scripts/nish-runner-parallel.mjs --runner <exe> --compiler <nish> [--shard <i>/<n>] [--jobs <P>] [filter]"
  )
  process.exit(2)
}

const runner = flagValue("--runner", undefined)
const compiler = flagValue("--compiler", undefined)
if (runner === undefined || compiler === undefined) {
  usage("--runner and --compiler are both required")
}
const shardSpec = flagValue("--shard", "1/1")
const shardMatch = /^(\d+)\/(\d+)$/.exec(shardSpec ?? "")
const [shard, shards] = shardMatch ? [Number(shardMatch[1]), Number(shardMatch[2])] : [0, 0]
if (shards < 1 || shard < 1 || shard > shards) {
  usage(`--shard wants <i>/<n> with 1 <= i <= n, not ${shardSpec}`)
}
const jobs = argv.includes("--jobs") ? jobsFrom(argv) : defaultJobs()
const valued = new Set(["--runner", "--compiler", "--shard", "--jobs"])
const filter = argv.find((arg, i) => !arg.startsWith("-") && !valued.has(argv[i - 1]))

const runnerExe = path.resolve(runner)
const compilerExe = path.resolve(compiler)
const slices = Array.from({ length: jobs }, (_, p) => shard + shards * p)
const total = shards * jobs
const farm = path.join(root, "build", "nish-runner-parallel")

/**
 * A working directory that is the checkout in every entry but `build/`, named
 * by slice and total so that the two halves of one corpus can run at once.
 */
const workdir = (slice) => {
  const dir = path.join(farm, `${slice}-of-${total}`)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(path.join(dir, "build"), { recursive: true })
  for (const entry of fs.readdirSync(root)) {
    if (entry !== "build" && entry !== ".git") {
      fs.symlinkSync(path.join(root, entry), path.join(dir, entry))
    }
  }
  return dir
}

const SUMMARY = /^golden cases: (\d+) passed, (\d+) failed, (\d+) skipped$/m
const reports = new Array(slices.length).fill(null)
let printed = 0
const flush = () => {
  while (printed < reports.length && reports[printed] !== null) {
    const { slice, r } = reports[printed]
    process.stdout.write(`--- slice ${slice}/${total}\n${r.stdout}`)
    if (r.stderr.length > 0) {
      process.stdout.write(r.stderr)
    }
    printed++
  }
}

const results = await pool(slices, jobs, async (slice, at) => {
  const args = ["--compiler", compilerExe, "--shard", `${slice}/${total}`]
  const r = await run(runnerExe, filter === undefined ? args : [filter, ...args], {
    cwd: workdir(slice),
    encoding: "utf8",
  })
  reports[at] = { slice, r }
  flush()
  return { slice, r, summary: SUMMARY.exec(r.stdout) }
})

const sum = [0, 0, 0]
const broken = []
for (const { slice, r, summary } of results) {
  if (summary === null) {
    broken.push(`slice ${slice}/${total} printed no summary (exit ${r.status ?? r.signal})`)
    continue
  }
  for (const k of [0, 1, 2]) {
    sum[k] += Number(summary[k + 1])
  }
  // A runner that failed a check exits 1 and its summary already counts it.
  if (r.status !== 0 && Number(summary[2]) === 0) {
    broken.push(`slice ${slice}/${total} exited ${r.status ?? r.signal} with no failed check`)
  }
}
for (const line of broken) {
  console.log(`FAIL  ${line}`)
}
console.log(`golden cases: ${sum[0]} passed, ${sum[1] + broken.length} failed, ${sum[2]} skipped`)
process.exitCode = broken.length > 0 ? 1 : 0
