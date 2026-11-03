#!/usr/bin/env node
// Http1Connection's per-request cost, an old std/net/http1-server.ts against
// the working tree's.
//
//   node bench/http1-conn/run.mjs [--rounds N] [--requests N] [--connections N]
//                                 [--base <rev>] [--compiler path]
//
// Builds bench/http1-conn/main.ts twice at `--profile speed` with `--compiler`
// (default: build/nish, else the seed in build/seed): `old` beside
// http1-server.ts as `--base` has it (default: 96a38347484f, the commit
// before the hot-field layout), `new` beside the working tree's. It links a
// byte-identical copy of `old` as `old′`: the baseline timed against itself in
// the same interleaved rounds is the noise band. Each round runs every binary on both
// shapes, rotating which goes first: `hot`, `--requests` requests on one
// connection (default 200000), and `cold`, as many spread round-robin over
// `--connections` connections of one pool (default 50000). It reports the
// median and the min–max of ns per request over `--rounds` rounds (default
// 15) and the CPU it ran on. Every run is pinned to core 1 with `taskset`
// when there is one, and the header says whether it was. A checksum that
// differs between binaries fails the run.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "http1-conn")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const rounds = Number(flag("--rounds", "15"))
const requests = flag("--requests", "200000")
const connections = flag("--connections", "50000")
const batches = flag("--batches", "5")
const built = path.join(root, "build", "nish")
const compiler = path.resolve(
  flag("--compiler", fs.existsSync(built) ? built : path.join(root, "build", "seed", "bin", "nish"))
)

/** Runs a command, failing the bench with its output when it fails. */
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" })
  if (r.status !== 0) {
    process.stderr.write(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

// The baseline is a fixed commit, not the merge base with origin/main: on main
// that is HEAD, and the bench would time the module against itself.
const base = flag("--base", "96a38347484f")
const server = "std/net/http1-server.ts"
const sources = {
  old: run("git", ["show", `${base}:${server}`]),
  new: fs.readFileSync(path.join(root, server), "utf8"),
}
// Two copies of the module cannot share one program, so each build gets its
// own directory with main.ts importing the copy beside it.
const main = fs
  .readFileSync(path.join(here, "main.ts"), "utf8")
  .replace('from "nish/net/http1-server"', 'from "./http1-server"')
const binaries = []
for (const [label, source] of Object.entries(sources)) {
  const dir = path.join(out, label)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "main.ts"), main)
  fs.writeFileSync(path.join(dir, "http1-server.ts"), source)
  const exe = path.join(dir, "conn")
  run(compiler, [path.join(dir, "main.ts"), "-o", `${dir}/`, "--profile", "speed", "--link", exe])
  binaries.push({ label, exe })
}
const copy = path.join(out, "old-copy")
fs.copyFileSync(binaries[0].exe, copy)
fs.chmodSync(copy, 0o755)
binaries.splice(1, 0, { label: "old′", exe: copy })

const shapes = [
  ["hot", [requests, "1", batches]],
  ["cold", [requests, connections, batches]],
]
const pin = spawnSync("taskset", ["-c", "1", "true"]).status === 0
/** Runs one bench binary, under `taskset -c 1` when it is there. */
const bench = (exe, args) => (pin ? run("taskset", ["-c", "1", exe, ...args]) : run(exe, args))
// label -> shape -> ns per request, one per round
const times = new Map(binaries.map((b) => [b.label, new Map(shapes.map(([s]) => [s, []]))]))
const sums = new Map()
for (let r = 0; r < rounds; r++) {
  for (const [shape, args] of shapes) {
    for (let k = 0; k < binaries.length; k++) {
      const { label, exe } = binaries[(r + k) % binaries.length]
      const [, ns, count, sum] = bench(exe, [shape, ...args])
        .trim()
        .split(" ")
      if (sums.has(shape) && sums.get(shape) !== sum) {
        process.stderr.write(
          `bench/http1-conn: ${label} ${shape} checksum ${sum}, expected ${sums.get(shape)}\n`
        )
        process.exit(1)
      }
      sums.set(shape, sum)
      times
        .get(label)
        .get(shape)
        .push(Number(ns) / Number(count))
    }
  }
}

const sorted = (xs) => [...xs].sort((a, b) => a - b)
const median = (xs) => sorted(xs)[Math.floor(xs.length / 2)]
const cpu = (fs.existsSync("/proc/cpuinfo") ? fs.readFileSync("/proc/cpuinfo", "utf8") : "")
  .split("\n")
  .find((line) => line.startsWith("model name"))
console.log(
  `CPU: ${cpu ? cpu.split(":")[1].trim() : (os.cpus()[0]?.model ?? "unknown")}, ${os.cpus().length} cores`
)
console.log(`old: ${server} at ${base.slice(0, 12)}; new: the working tree`)
console.log(
  `${rounds} rounds, each the fastest of ${batches} batches of ${requests} requests` +
    `${pin ? " pinned to core 1" : " unpinned (no taskset)"}; cold spreads them over ${connections} connections`
)
console.log("ns per request: median (min–max), ratio of medians to old\n")
console.log(`| shape | ${binaries.map((b) => b.label).join(" | ")} |`)
console.log(`| --- |${binaries.map(() => " --- |").join("")}`)
for (const [shape] of shapes) {
  const first = median(times.get(binaries[0].label).get(shape))
  const cells = binaries.map((b) => {
    const xs = sorted(times.get(b.label).get(shape))
    const m = median(xs)
    return `${m.toFixed(1)} (${xs[0].toFixed(1)}–${xs[xs.length - 1].toFixed(1)}) ${(m / first).toFixed(3)}`
  })
  console.log(`| ${shape} | ${cells.join(" | ")} |`)
}
