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
// A name (`hex`, `utf8`, ...) runs that bench alone. After each run a WARN
// line names every side whose ratio is no further from 1 than its twin's. The
// script exits 1 when a bench fails to build, fails to start, exits non-zero,
// or prints "checksums DIFFER".
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
const wanted = args.filter((_, i) => runsAt < 0 || (i !== runsAt && i !== runsAt + 1))

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

// Pinned only when `taskset -c 2` itself runs: a host without CPU 2, or
// without taskset, runs the benches unpinned and says so.
const pin = spawnSync("taskset", ["-c", "2", "true"]).status === 0 ? ["taskset", "-c", "2"] : []
if (pin.length === 0) {
  console.log("note: `taskset -c 2` does not run here, so the benches run unpinned")
}
/**
 * A WARN line for every side whose ratio is no further from 1 than its
 * case's twin (the second side): such a side is inside that run's noise band,
 * whatever the note calls it. The script cannot know which sides are claimed
 * as gains, so it warns for every side but the first two.
 */
const noiseWarnings = (stdout) => {
  const warnings = []
  let title = ""
  let sides = []
  const flush = () => {
    if (sides.length >= 2) {
      const band = Math.abs(sides[1].ratio - 1)
      for (const side of sides.slice(2)) {
        if (Math.abs(side.ratio - 1) <= band) {
          const where = title ? ` (${title})` : ""
          warnings.push(
            `WARN${where}: ${side.name} ${side.ratio.toFixed(3)}x is inside the twin band ${sides[1].ratio.toFixed(3)}x`
          )
        }
      }
    }
    sides = []
  }
  for (const line of stdout.split("\n")) {
    const m = /^(\w+): [\d.]+ us, ([\d.e+-]+)x of /.exec(line)
    if (m) {
      sides.push({ name: m[1], ratio: Number(m[2]) })
    } else if (line.startsWith("checksums ")) {
      flush()
      title = ""
    } else if (line.trim() !== "") {
      flush()
      title = line.trim()
    }
  }
  flush()
  return warnings
}

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
    const stdout = out.stdout ?? ""
    process.stdout.write(stdout)
    for (const line of noiseWarnings(stdout)) {
      console.log(line)
    }
    if (out.error || out.status !== 0 || stdout.includes("checksums DIFFER")) {
      const why = out.error ? `spawn failed: ${out.error.message}` : `exit ${out.status}`
      console.error(`${name}: ${why}${out.stderr ? `\n${out.stderr}` : ""}`)
      failed = true
    }
  }
}
process.exit(failed ? 1 : 0)
