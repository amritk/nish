#!/usr/bin/env node
// Http1Connection's per-request cost, an old std/net/ against the working tree's.
//
//   node bench/http1-conn/run.mjs [--shape hot|cold|idle|direct|idle-dram|direct-dram|stages|rss|all]
//                                 [--rounds N] [--requests N] [--connections N]
//                                 [--evict MiB] [--dram-requests N]
//                                 [--base <rev>] [--compiler path] [--rss N]
//
// Builds bench/http1-conn/main.ts twice at `--profile speed` with `--compiler`
// (default: build/nish, else the seed in build/seed): `old` against std/ as
// `--base` has it (default: 96a38347484f, the commit before the hot-field
// layout), `new` against the working tree's. It links a byte-identical copy of
// `old` as `old′`: the baseline timed against itself in the same interleaved
// rounds is the noise band. Each round runs every binary on each shape
// `--shape` names (a comma list, default all), rotating which goes first:
// `hot`, `--requests` requests on one connection (default 200000); `cold`, as
// many spread round-robin over `--connections` connections of one pool
// (default 50000); and `idle`, the same spread over an `Http1Server`-shaped
// pool with `Http1Config.idleInput` on, read through the server's scratch
// buffer, a GET and a POST with a JSON body in turn; `direct`, the idle shape
// reading into the lent input buffer instead of the scratch, a variant
// `Http1Server` does not have; and `idle-dram` and `direct-dram`, those two
// with an eviction ring of `--evict` MiB (default 1024) swept between
// requests so each finds its connection in DRAM, `--dram-requests` requests a
// batch (default 20000), timed per request. The idle shapes must report one
// input, one head and one output buffer made by the pools, or the run fails.
// It reports the median and
// the min–max of ns per request over `--rounds` rounds (default 15) and the
// CPU it ran on. Every run is pinned to core 1 with `taskset` when there is
// one, and the header says whether it was. A checksum that differs between
// binaries fails the run.
//
// With `--rss N` (default 5 when the idle shape runs or `--shape rss` asks
// for the memory alone, 0 to skip) it also runs
// the idle pool's `rss` and `rss-default` modes N times per build, at
// `--connections` and at 0 connections, each printing its own peak RSS
// (VmHWM), and reports the difference divided by the connections: the peak
// memory one idle keep-alive connection costs, with `idleInput` and on the
// default config, after one request a slot and after `--passes` (default 4),
// when each slot has kept its response head.
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
const evict = flag("--evict", "1024")
// main.ts sizes the ring in an i32 of bytes.
if (!(Number(evict) >= 0 && Number(evict) <= 2047)) {
  process.stderr.write(`--evict ${evict}: the eviction ring must be 0 to 2047 MiB\n`)
  process.exit(1)
}
const dramRequests = flag("--dram-requests", "20000")
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
const shapeFlag = flag("--shape", "all")
// Two std/ trees cannot share one program, so `old` is built by a copy of the
// compiler inside a package directory holding the base's std/, scripts/ and
// runtime/: the compiler reads `nish/<module>` from the package it sits in.
const oldPackage = path.join(out, "old-package")
fs.rmSync(oldPackage, { recursive: true, force: true })
fs.mkdirSync(path.join(oldPackage, "bin"), { recursive: true })
const archive = spawnSync("git", ["archive", base, "std", "scripts", "runtime"], {
  cwd: root,
  maxBuffer: 1 << 30,
})
if (archive.status !== 0) {
  process.stderr.write(`git archive ${base}\n${archive.stderr}`)
  process.exit(1)
}
const untar = spawnSync("tar", ["-x", "-C", oldPackage], {
  input: archive.stdout,
})
if (untar.status !== 0) {
  process.stderr.write(`tar -x\n${untar.stderr}`)
  process.exit(1)
}
const oldCompiler = path.join(oldPackage, "bin", "nish")
fs.copyFileSync(compiler, oldCompiler)
fs.chmodSync(oldCompiler, 0o755)
// misses.sh reads which base the package holds.
fs.writeFileSync(path.join(oldPackage, "BASE"), `${base}\n`)
const compilers = { old: oldCompiler, new: compiler }
const binaries = []
// A base before `Http1Connection.sendBody` (0.34.1) answers the stages shape
// with `write`, the copy its `Http1Server` made: the lines main.ts marks
// `// sendBody only` go, and `VIA_SEND_BODY` turns false.
const withSendBody = (std) =>
  fs.readFileSync(path.join(std, "std", "net", "http1-server.ts"), "utf8").includes("  sendBody(")
// A base whose `Http1Connection` constructor takes no `Date` (before the
// idle trims) gets the shared one put on each built connection instead.
const withSharedDate = (std) =>
  fs
    .readFileSync(path.join(std, "std", "net", "http1-server.ts"), "utf8")
    .includes("date: HttpDate | null = null")
const dated = (std, text) =>
  withSharedDate(std)
    ? text
    : text.replace(
        "new Http1Connection(config, this.date) // shared date",
        "new Http1Connection(config)\n      conn.date = this.date"
      )
const source = fs.readFileSync(path.join(here, "main.ts"), "utf8")
const sourceFor = (std) =>
  withSendBody(std)
    ? dated(std, source)
    : dated(std, source)
        .split("\n")
        .filter((line) => !line.includes("// sendBody only"))
        .join("\n")
        .replace("const VIA_SEND_BODY: boolean = true", "const VIA_SEND_BODY: boolean = false")
        .replaceAll(".sendBody(", ".write(")
const trees = { old: oldPackage, new: root }
for (const [label, nish] of Object.entries(compilers)) {
  const dir = path.join(out, label)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "main.ts"), sourceFor(trees[label]))
  const exe = path.join(dir, "conn")
  run(nish, [path.join(dir, "main.ts"), "-o", `${dir}/`, "--profile", "speed", "--link", exe])
  binaries.push({ label, exe })
}
const copy = path.join(out, "old-copy")
fs.copyFileSync(binaries[0].exe, copy)
fs.chmodSync(copy, 0o755)
binaries.splice(1, 0, { label: "old′", exe: copy })

// [table row, main.ts shape, its arguments]
const shapes = [
  ["hot", "hot", [requests, "1", batches]],
  ["cold", "cold", [requests, connections, batches]],
  ["idle", "idle", [requests, connections, batches]],
  ["direct", "direct", [requests, connections, batches]],
  ["idle-dram", "idle", [dramRequests, connections, batches, evict]],
  ["direct-dram", "direct", [dramRequests, connections, batches, evict]],
  ["stages", "stages", [requests, connections, batches]],
].filter(([s]) => shapeFlag === "all" || shapeFlag.split(",").includes(s))
if (shapes.length === 0 && shapeFlag !== "rss") {
  process.stderr.write(`bench/http1-conn: no shape called ${shapeFlag}\n`)
  process.exit(1)
}
const pin = spawnSync("taskset", ["-c", "1", "true"]).status === 0
/** Runs one bench binary, under `taskset -c 1` when it is there. */
const bench = (exe, args) => (pin ? run("taskset", ["-c", "1", exe, ...args]) : run(exe, args))
// label -> shape -> ns per request, one per round
const times = new Map(binaries.map((b) => [b.label, new Map(shapes.map(([s]) => [s, []]))]))
const sums = new Map()
// The stages shape's spans less what calibration says the clock read each
// holds (one, two for `dispatch`) and, for `sendBody`, less the bare
// `netWrite2` span, which holds a clock read of its own: ns per request.
const stageNames = ["recv", "parse", "dispatch", "respond", "sendBody", "park"]
// label -> stage -> ns per request, one per round
const stageTimes = new Map(binaries.map((b) => [b.label, new Map()]))
const record = (label, count, spans) => {
  const words = spans.split(" ")
  const f = {}
  for (let i = 0; i + 1 < words.length; i += 2) {
    f[words[i]] = Number(words[i + 1])
  }
  const per = (x) => x / Number(count)
  const less = {
    recv: f.clock,
    parse: f.clock,
    dispatch: 2 * f.clock,
    respond: f.clock,
    sendBody: f.writev > 0 ? f.writev : f.clock,
    park: f.clock,
  }
  const cells = Object.fromEntries(stageNames.map((s) => [s, per(f[s] - less[s])]))
  cells.total = stageNames.reduce((a, s) => a + cells[s], 0)
  cells["clock read"] = per(f.clock)
  // A base without `sendBody` makes no system call there.
  if (f.writev > 0) {
    cells.sendmsg = per(f.writev - f.clock)
  }
  const m = stageTimes.get(label)
  for (const [s, v] of Object.entries(cells)) {
    m.set(s, [...(m.get(s) ?? []), v])
  }
}
for (let r = 0; r < rounds; r++) {
  for (const [shape, mode, args] of shapes) {
    for (let k = 0; k < binaries.length; k++) {
      const { label, exe } = binaries[(r + k) % binaries.length]
      const [line, spans] = bench(exe, [mode, ...args])
        .trim()
        .split("\n")
      const [, ns, count, sum, ...made] = line.split(" ")
      if (mode === "stages") {
        record(label, count, spans)
      }
      // The lending pools are LIFO: one connection at a time borrows, so
      // each makes one buffer however many connections there are.
      if (mode !== "hot" && mode !== "cold" && made.join(" ") !== "1 1 1") {
        process.stderr.write(
          `bench/http1-conn: ${label} ${shape} made ${made.join(" ")} input, head and output buffers, expected 1 1 1\n`
        )
        process.exit(1)
      }
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

// The peak RSS of one rss-shape run in KiB, which it prints where a time goes.
const peak = (exe, shape, passes, count) =>
  Number(
    bench(exe, [shape, String(passes), String(count), "0"])
      .trim()
      .split(" ")[1]
  )
const rssRuns = Number(
  flag("--rss", shapeFlag === "rss" || shapes.some(([, m]) => m === "idle" || m === "direct") ? "5" : "0")
)
const passes = Number(flag("--passes", "4"))
// [table row, main.ts shape, passes]
const rssRows = [
  ["idleInput, 1 request", "rss", 1],
  [`idleInput, ${passes} requests`, "rss", passes],
  ["default, 1 request", "rss-default", 1],
  [`default, ${passes} requests`, "rss-default", passes],
]
// row -> label -> bytes per idle connection, one per run
const rss = new Map(rssRows.map(([row]) => [row, new Map()]))
for (let r = 0; r < rssRuns; r++) {
  for (const [row, shape, n] of rssRows) {
    for (const { label, exe } of binaries) {
      const per =
        ((peak(exe, shape, n, Number(connections)) - peak(exe, shape, n, 0)) * 1024) / Number(connections)
      rss.get(row).set(label, [...(rss.get(row).get(label) ?? []), per])
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
console.log(`old: std/ at ${base.slice(0, 12)}; new: the working tree`)
console.log(
  `${rounds} rounds, each the fastest of ${batches} batches of ${requests} requests` +
    `${pin ? " pinned to core 1" : " unpinned (no taskset)"}; cold and idle spread them over ${connections} connections` +
    `; the dram shapes run ${dramRequests} a batch with a ${evict} MiB eviction ring`
)
const timed = shapes.filter(([, m]) => m !== "stages")
if (timed.length > 0) {
  console.log("ns per request: median (min–max), ratio of medians to old\n")
  console.log(`| shape | ${binaries.map((b) => b.label).join(" | ")} |`)
  console.log(`| --- |${binaries.map(() => " --- |").join("")}`)
}
for (const [shape] of timed) {
  const first = median(times.get(binaries[0].label).get(shape))
  const cells = binaries.map((b) => {
    const xs = sorted(times.get(b.label).get(shape))
    const m = median(xs)
    return `${m.toFixed(1)} (${xs[0].toFixed(1)}–${xs[xs.length - 1].toFixed(1)}) ${(m / first).toFixed(3)}`
  })
  console.log(`| ${shape} | ${cells.join(" | ")} |`)
}
if (shapes.some(([, m]) => m === "stages")) {
  console.log(
    `\nstages: ns per request on ${connections} connections, the clock read and \`sendmsg\` taken out: median (min–max), ratio to old`
  )
  console.log(`| stage | ${binaries.map((b) => b.label).join(" | ")} |`)
  console.log(`| --- |${binaries.map(() => " --- |").join("")}`)
  const rows = new Set(binaries.flatMap((b) => [...stageTimes.get(b.label).keys()]))
  for (const s of rows) {
    const first = median(stageTimes.get(binaries[0].label).get(s) ?? [Number.NaN])
    const cells = binaries.map((b) => {
      if (!stageTimes.get(b.label).has(s)) {
        return "—"
      }
      const xs = sorted(stageTimes.get(b.label).get(s))
      const m = median(xs)
      const ratio = Number.isNaN(first) ? "" : ` ${(m / first).toFixed(3)}`
      return `${m.toFixed(1)} (${xs[0].toFixed(1)}–${xs[xs.length - 1].toFixed(1)})${ratio}`
    })
    console.log(`| ${s} | ${cells.join(" | ")} |`)
  }
}
if (rssRuns > 0) {
  console.log(
    `\npeak RSS per idle connection, bytes: median (min–max) of ${rssRuns} runs at ${connections} less 0`
  )
  console.log(`| | ${binaries.map((b) => b.label).join(" | ")} |`)
  console.log(`| --- |${binaries.map(() => " --- |").join("")}`)
  for (const [row] of rssRows) {
    const cells = binaries.map((b) => {
      const xs = sorted(rss.get(row).get(b.label))
      return `${median(xs).toFixed(0)} (${xs[0].toFixed(0)}–${xs[xs.length - 1].toFixed(0)})`
    })
    console.log(`| ${row} | ${cells.join(" | ")} |`)
  }
}
