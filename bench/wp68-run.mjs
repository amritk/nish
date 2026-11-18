#!/usr/bin/env node
// WP68 S1: builds every bench/wp68-*.ts with `--profile speed` and runs each
// one `--runs` times (default 2), pinned to one core where `taskset` exists,
// so the figures in docs/wp68-shared-libraries.md §4 come back from one
// command. Each bench prints its sides' minimum times, their ratio to the
// first side and whether the checksums agree; the second side is the first's
// byte-identical twin, so its ratio is that run's noise band.
//
//   node bench/wp68-run.mjs --compiler build/seed/bin/nish [--runs N] [name ...]
//
// A name (`hex`, `utf8`, ...) runs that bench alone. The script exits 1 when a
// bench fails to build, exits non-zero, or prints "checksums DIFFER".
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const outDir = path.join(root, "build", "bench", "wp68")
const nishc = compilerFrom(process.argv)

const args = nishc.rest.slice(2)
const runsAt = args.indexOf("--runs")
const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 2
if (!Number.isInteger(runs) || runs < 1) {
  console.error("bench/wp68-run.mjs: --runs needs a positive integer")
  process.exit(2)
}
const wanted = args.filter((a, i) => a !== "--runs" && i !== runsAt + 1)

const all = fs
  .readdirSync(here)
  .filter((f) => /^wp68-.*\.ts$/.test(f) && f !== "wp68-report.ts")
  .map((f) => f.slice("wp68-".length, -".ts".length))
  .sort()
const names = wanted.length > 0 ? wanted : all
for (const name of names) {
  if (!all.includes(name)) {
    console.error(`bench/wp68-run.mjs: no bench/wp68-${name}.ts; there are ${all.join(", ")}`)
    process.exit(2)
  }
}

const pin = spawnSync("taskset", ["--version"]).status === 0 ? ["taskset", "-c", "2"] : []
fs.mkdirSync(outDir, { recursive: true })
let failed = false
for (const name of names) {
  const exe = path.join(outDir, name)
  const build = spawnSync(
    nishc.cmd,
    [...nishc.prefix, path.join(here, `wp68-${name}.ts`), "--link", exe, "--profile", "speed"],
    { encoding: "utf8" }
  )
  if (build.status !== 0) {
    console.error(`${name}: build failed\n${build.stdout}${build.stderr}`)
    failed = true
    continue
  }
  for (let run = 1; run <= runs; run++) {
    console.log(`== ${name}, run ${run} of ${runs}`)
    const cmd = pin.length > 0 ? pin[0] : exe
    const rest = pin.length > 0 ? [...pin.slice(1), exe] : []
    const out = spawnSync(cmd, rest, { encoding: "utf8" })
    process.stdout.write(out.stdout)
    if (out.status !== 0 || out.stdout.includes("checksums DIFFER")) {
      console.error(`${name}: exit ${out.status}${out.stderr ? `\n${out.stderr}` : ""}`)
      failed = true
    }
  }
}
process.exit(failed ? 1 : 0)
