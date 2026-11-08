#!/usr/bin/env node
// Hardware counters per request of the stages shape, the old and new builds
// `run.mjs` left in build/bench/http1-conn/, under `perf stat`.
//
//   node bench/http1-conn/counters.mjs [--connections N] [--requests N] [--rounds N]
//
// Each round runs `conn stages-loop` (the stages shape without its timer
// calibration) with --requests requests over --connections connections and
// with 0, for old then new or new then old in turn, pinned to core 1 when
// there is one; the difference over the requests is one request's worth, the
// pool's setup and warm pass cancelled. Counts are user mode only: the
// recv and sendmsg system calls are the kernel's. A request's count includes
// the shape's eight clock reads and its drain of the socket pair, which both
// builds pay alike. Prints the median and min–max over --rounds (default 7)
// of cycles, instructions, L1 data load misses and a last-level miss event,
// the first of LLC-load-misses, ll_cache_miss_rd, l3d_cache_refill and
// ll_cache_rd the machine counts (bench/http1-e2e/perf-stat.sh picks it).
// `PERF_BIN` names the perf binary.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "http1-conn")
const perf = process.env.PERF_BIN ?? "perf"

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}
const connections = flag("connections", 10000)
const requests = flag("requests", 200000)
const rounds = flag("rounds", 7)

const builds = ["old", "new"].map((label) => ({ label, exe: path.join(out, label, "conn") }))
for (const { exe } of builds) {
  if (!fs.existsSync(exe)) {
    console.error(`counters: no ${exe}; run node bench/http1-conn/run.mjs --shape stages first`)
    process.exit(1)
  }
}
const base = fs.readFileSync(path.join(out, "old-package", "BASE"), "utf8").trim()

const picked = spawnSync("bash", [path.join(root, "bench", "http1-e2e", "perf-stat.sh"), "events"], {
  encoding: "utf8",
})
const ll = picked.stdout
  .trim()
  .split(",")
  .find((e) => e.endsWith(":u") && !e.startsWith("cycles") && !e.startsWith("instructions"))
const events = ["cycles:u", "instructions:u", "L1-dcache-load-misses:u", ...(ll ? [ll] : [])]
const pin = os.cpus().length > 1 && spawnSync("taskset", ["-c", "1", "true"]).status === 0

// One perf stat of `conn stages-loop <count>`: event -> count.
const counted = (exe, count) => {
  const command = [exe, "stages-loop", String(count), String(connections), "1"]
  const r = spawnSync(
    perf,
    ["stat", "-x,", "-e", events.join(","), "--", ...(pin ? ["taskset", "-c", "1"] : []), ...command],
    {
      encoding: "utf8",
    }
  )
  if (r.status !== 0) {
    console.error(`counters: ${command.join(" ")} failed\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  const counts = {}
  for (const line of r.stderr.split("\n")) {
    const f = line.split(",")
    if (events.includes(f[2])) {
      counts[f[2]] = Number(f[0])
    }
  }
  for (const e of events) {
    if (!Number.isFinite(counts[e])) {
      console.error(`counters: perf counted no ${e}\n${r.stderr}`)
      process.exit(3)
    }
  }
  return counts
}

const samples = new Map(builds.map((b) => [b.label, events.map(() => [])]))
for (let round = 0; round < rounds; round += 1) {
  const order = round % 2 === 0 ? builds : [...builds].reverse()
  for (const { label, exe } of order) {
    const full = counted(exe, requests)
    const zero = counted(exe, 0)
    events.forEach((e, i) => {
      samples.get(label)[i].push((full[e] - zero[e]) / requests)
    })
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const cell = (xs) => `${median(xs).toFixed(2)} (${Math.min(...xs).toFixed(2)}–${Math.max(...xs).toFixed(2)})`
console.log(
  `stages-loop, per request, user mode: ${requests} requests over ${connections} connections, ` +
    `${rounds} rounds, old = std/ at ${base}, ${pin ? "pinned to core 1" : "not pinned"}, ${os.cpus()[0]?.model ?? os.arch()}`
)
console.log(`| build | ${events.join(" | ")} |`)
console.log(`| --- |${events.map(() => " ---: |").join("")}`)
for (const { label } of builds) {
  console.log(`| ${label} | ${samples.get(label).map(cell).join(" | ")} |`)
}
