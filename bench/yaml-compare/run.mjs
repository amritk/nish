#!/usr/bin/env node
// YAML against JavaScript on the same machine: Nish's nish/yaml beside
// @amritk/yaml under Node, and under Bun when `bun --version` answers, over
// the five pinned streams of fetch.mjs.
//
//   npm run build && node bench/yaml-compare/run.mjs [options]
//     --rounds N        interleaved rounds at least (default 15); each case runs
//                       the next multiple of twice its implementations
//     --mb N            megabytes of input each run parses (default 32), which
//                       sets each fixture's iteration count
//     --only a,b        implementations to run (default all): nish, node, bun;
//                       nish's copy runs with nish
//     --record          also write the tables into bench/README.md, between
//                       its yaml-compare markers
//     --compiler <nish> the compiler under test (default build/nish)
//
// It needs the network the first time (fetch.mjs pins the fixtures and
// @amritk/yaml into bench/yaml-compare/cache/). It never runs in `npm test`:
// tests/run.js's "yaml-compare" check builds main.ts and holds it to
// sample.expected without a network.
//
// Nish builds with `--link --profile speed`. The workloads, `parse` and
// `walk`, and the checksum line both sides print are in main.ts's header; the
// JavaScript side is node-bench.mjs. Every implementation must print the same
// checksum for a case in every round, and a case where they differ fails the
// run (exit 1) rather than reporting a time.
//
// Rounds are interleaved: each round runs every implementation once per
// case, in json-compare's rounds.mjs order (rotated each round, reversed
// every other block of rounds), so a slow stretch of a shared machine falls
// on all of them, and each case runs a multiple of twice its implementations
// so that every one runs in every position equally often. Nish runs as two
// byte-identical binaries, the copy halfway down the list, and the gap between
// their medians is the noise band (CLAUDE.md, `Measured:`). Each program times
// its own loop with a monotonic clock, so start-up, reading the file and, for
// JavaScript, loading the parser are not in the figure; the JIT's warm-up is,
// spread over the run's iterations.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"
import { AMRITK_YAML_ENTRY, AMRITK_YAML_VERSION, FIXTURES, fetchAll, fixturePath } from "./fetch.mjs"

const here = import.meta.dirname
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "yaml-compare")
const nishc = compilerFrom(process.argv.slice(2))

const fail = (msg) => {
  console.error(`bench/yaml-compare/run.mjs: ${msg}`)
  process.exit(2)
}

const opts = { rounds: 15, mb: 32, only: null, record: false }
for (let i = 0; i < nishc.rest.length; i++) {
  const arg = nishc.rest[i]
  if (arg === "--rounds") {
    opts.rounds = Number(nishc.rest[++i])
  } else if (arg === "--mb") {
    opts.mb = Number(nishc.rest[++i])
  } else if (arg === "--only") {
    opts.only = String(nishc.rest[++i]).split(",")
  } else if (arg === "--record") {
    opts.record = true
  } else {
    fail(`unknown option ${arg}`)
  }
}
if (!(Number.isInteger(opts.rounds) && opts.rounds >= 1 && opts.mb > 0)) {
  fail("--rounds needs a positive integer and --mb a positive number")
}

const WORKLOADS = ["parse", "walk"]

/** The first line a command prints when it succeeds, or null. */
const versionOf = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" })
  return r.error === undefined && r.status === 0 ? r.stdout.split("\n")[0].trim() : null
}
const tools = {
  nish: versionOf(nishc.cmd, [...nishc.prefix, "--version"]),
  node: process.version,
  bun: versionOf("bun", ["--version"]),
}

const nodeBench = path.join(here, "node-bench.mjs")

/**
 * The implementations: how to build each, and the command a run starts, to
 * which the workload, the file and the iteration count are appended (the
 * JavaScript runner then takes @amritk/yaml's entry point).
 */
const IMPLS = [
  {
    name: "nish",
    label: "Nish (nish/yaml)",
    available: () => true,
    build: () => {
      fs.mkdirSync(outDir, { recursive: true })
      const exe = path.join(outDir, "main")
      const args = [
        ...nishc.prefix,
        path.join(here, "main.ts"),
        "-o",
        `${outDir}/`,
        "--link",
        exe,
        "--profile",
        "speed",
      ]
      const r = spawnSync(nishc.cmd, args, { encoding: "utf8" })
      if (r.error !== undefined || r.status !== 0) {
        fail(`building main.ts failed:\n${r.stdout}${r.stderr}`)
      }
      return (run) => [exe, ...run]
    },
  },
  {
    name: "node",
    label: `@amritk/yaml ${AMRITK_YAML_VERSION}, Node`,
    available: () => true,
    build: () => (run) => [process.execPath, nodeBench, ...run, AMRITK_YAML_ENTRY],
  },
  {
    name: "bun",
    label: `@amritk/yaml ${AMRITK_YAML_VERSION}, Bun`,
    available: () => tools.bun !== null,
    build: () => (run) => ["bun", nodeBench, ...run, AMRITK_YAML_ENTRY],
  },
]

/** Runs one implementation once: its checksum line and the ns it reports. */
const runOnce = (impl, run) => {
  const [cmd, ...args] = impl.command(run.map(String))
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 20 })
  const lines = (r.stdout ?? "").trim().split("\n")
  const ns = /^ns (\d+)$/.exec(lines[1] ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null) {
    fail(`${impl.name} ${run.join(" ")} exited ${r.status}:\n${r.stdout}${r.stderr}`)
  }
  return { checksum: lines[0], ns: Number(ns[1]) }
}

/** A byte-identical copy of Nish's binary, run beside it: the gap between them is the noise band. */
const copyOf = (nish) => {
  const exe = nish.command([])[0]
  const copy = `${exe}-copy`
  fs.copyFileSync(exe, copy)
  if (!fs.readFileSync(exe).equals(fs.readFileSync(copy))) {
    fail("the copy is not byte-identical to the build")
  }
  return { ...nish, name: "nish-copy", label: "Nish (byte-identical copy)", command: (run) => [copy, ...run] }
}

const main = () => {
  const wanted = IMPLS.filter((impl) => opts.only === null || opts.only.includes(impl.name))
  if (wanted.length === 0) {
    fail(`--only names none of ${IMPLS.map((impl) => impl.name).join(", ")}`)
  }
  const skipped = wanted.filter((impl) => !impl.available()).map((impl) => impl.name)
  for (const name of skipped) {
    process.stderr.write(`skipping ${name}: \`${name} --version\` does not answer\n`)
  }
  fetchAll()
  const ready = wanted.filter((impl) => impl.available()).map((impl) => ({ ...impl, command: impl.build() }))
  const nish = ready.find((impl) => impl.name === "nish")
  const impls = nish === undefined ? ready : [nish, copyOf(nish), ...ready.filter((impl) => impl !== nish)]
  const rounds = roundsFor(impls.length, opts.rounds)

  const cases = FIXTURES.flatMap((f) => {
    const file = fixturePath(f.file)
    const bytes = fs.statSync(file).size
    const iterations = Math.max(1, Math.round((opts.mb * 1024 * 1024) / bytes))
    return WORKLOADS.map((workload) => ({
      workload,
      fixture: f.file,
      file,
      bytes,
      iterations,
      runs: new Map(impls.map((impl) => [impl.name, []])),
    }))
  })

  for (let round = 0; round < rounds; round++) {
    process.stderr.write(`round ${round + 1} of ${rounds}\n`)
    for (const c of cases) {
      for (const impl of roundOrder(impls, round)) {
        c.runs.get(impl.name).push(runOnce(impl, [c.workload, c.file, c.iterations]))
      }
    }
  }

  for (const c of cases) {
    const seen = new Set([...c.runs.values()].flat().map((r) => r.checksum))
    if (seen.size > 1) {
      c.disagreement = [...c.runs]
        .map(([name, runs]) => `${name}: ${[...new Set(runs.map((r) => r.checksum))].join(" | ")}`)
        .join("; ")
      process.stderr.write(`checksums disagree on ${c.workload} ${c.fixture}: ${c.disagreement}\n`)
    }
  }
  const disagreed = cases.some((c) => c.disagreement !== undefined)

  const report = tables(cases, impls, rounds, skipped)
  process.stdout.write(`${report}\n`)
  if (opts.record && !disagreed) {
    record(report)
  }
  if (disagreed) {
    process.exitCode = 1
  }
}

// ---- Reporting ------------------------------------------------------------------------

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const ms = (ns) => (ns / 1e6).toFixed(ns < 1e7 ? 3 : 1)
const pct = (x) => `${(x * 100).toFixed(1)}%`

/** The CPU's name, /proc/cpuinfo first, as bench/json-compare/run.mjs reads it. */
const cpuModel = () => {
  try {
    const m = /^model name\s*:\s*(.+)$/m.exec(fs.readFileSync("/proc/cpuinfo", "utf8"))
    if (m !== null) {
      return m[1].trim()
    }
  } catch {
    // Not Linux: os.cpus() below.
  }
  return os.cpus()[0]?.model ?? "unknown CPU"
}

/**
 * The commit the measured code is at: the last one that changes anything but
 * bench/README.md, so that committing the recorded section afterwards does not
 * make it name a commit it was not measured at, with a note when the working
 * tree has other changes.
 */
const commit = () => {
  const outside = ["--", ".", ":(exclude)bench/README.md"]
  const at = versionOf("git", ["-C", root, "log", "-1", "--format=%h", "--abbrev=8", ...outside]) ?? "unknown"
  const dirty = versionOf("git", ["-C", root, "status", "--porcelain", ...outside])
  return dirty === null || dirty === "" ? at : `${at} with uncommitted changes`
}

/** The command that reproduces this run, without a local --compiler path. */
const command = () =>
  [
    "node bench/yaml-compare/run.mjs",
    `--rounds ${opts.rounds}`,
    `--mb ${opts.mb}`,
    ...(opts.only === null ? [] : [`--only ${opts.only.join(",")}`]),
    ...(opts.record ? ["--record"] : []),
  ].join(" ")

const tables = (cases, impls, rounds, skipped) => {
  const has = (name) => impls.some((impl) => impl.name === name)
  const toolchains = [
    ...(has("nish") ? [`Nish: ${tools.nish}`] : []),
    ...(has("node") ? [`Node ${tools.node}`] : []),
    ...(has("bun") ? [`Bun ${tools.bun}`] : []),
  ]
  const lines = [
    "| | |",
    "| --- | --- |",
    `| Date | ${new Date().toISOString().slice(0, 10)} |`,
    `| nish | ${tools.nish} (commit ${commit()}) |`,
    `| CPU | ${cpuModel()}, ${os.cpus().length} logical cores |`,
    `| OS | ${os.type().toLowerCase()} ${os.release()} (${os.arch()}) |`,
    `| Toolchains | ${toolchains.join("; ")} |`,
    `| Command | \`npm run build && ${command()}\` |`,
    `| Runs | ${rounds} interleaved rounds, ${opts.mb} MB of input per run; ms per stream, min and median over the rounds |`,
  ]
  if (skipped.length > 0) {
    lines.push(`| Skipped | ${skipped.join(", ")}: not installed |`)
  }

  const per = (c, name) => (c.runs.get(name) ?? []).map((r) => r.ns / c.iterations)
  const ratio = (c, name) => median(per(c, name)) / median(per(c, "nish"))
  const js = impls.filter((impl) => impl.name === "node" || impl.name === "bun")
  const showRatio = has("nish") && js.length > 0

  // One row per case: the figures the tune stage reads at a glance.
  lines.push(
    "",
    `| Fixture | Workload | Nish median | ${js.map((impl) => `${impl.name === "node" ? "Node" : "Bun"} median`).join(" | ")}${showRatio ? ` | ${js.map((impl) => `${impl.name === "node" ? "Node" : "Bun"} / Nish`).join(" | ")}` : ""} | Noise band |`,
    `| --- | --- | ---: | ${js.map(() => "---:").join(" | ")}${showRatio ? ` | ${js.map(() => "---:").join(" | ")}` : ""} | ---: |`
  )
  for (const c of cases) {
    const band = has("nish")
      ? Math.abs(median(per(c, "nish")) - median(per(c, "nish-copy"))) / median(per(c, "nish-copy"))
      : Number.NaN
    const mark = c.disagreement === undefined ? "" : " **(checksums disagree)**"
    lines.push(
      `| ${c.fixture}${mark} | ${c.workload} | ${has("nish") ? `${ms(median(per(c, "nish")))} ms` : "-"} | ${js.map((impl) => `${ms(median(per(c, impl.name)))} ms`).join(" | ")}${showRatio ? ` | ${js.map((impl) => `${ratio(c, impl.name).toFixed(2)}x`).join(" | ")}` : ""} | ${Number.isFinite(band) ? pct(band) : "-"} |`
    )
  }

  for (const c of cases) {
    lines.push(
      "",
      `### ${c.workload}, ${c.fixture} (${c.bytes.toLocaleString("en-US")} bytes, ${c.iterations} per run)`,
      "",
      c.disagreement === undefined
        ? `Checksum \`${[...c.runs.values()][0][0].checksum}\`, the same from every implementation.`
        : `**Checksums disagree**: ${c.disagreement}.`,
      "",
      "| Implementation | ms min | ms median | MB/s (median) |",
      "| --- | ---: | ---: | ---: |"
    )
    for (const impl of impls) {
      const xs = per(c, impl.name)
      lines.push(
        `| ${impl.label} | ${ms(Math.min(...xs))} | ${ms(median(xs))} | ${((c.bytes / median(xs)) * 1000).toFixed(0)} |`
      )
    }
  }
  return lines.join("\n")
}

const BEGIN = "<!-- yaml-compare:begin -->"
const END = "<!-- yaml-compare:end -->"

/** Writes the report into bench/README.md between the markers, which its YAML section holds. */
const record = (report) => {
  const file = path.join(root, "bench", "README.md")
  const text = fs.readFileSync(file, "utf8")
  const from = text.indexOf(BEGIN)
  const to = text.indexOf(END)
  if (from < 0 || to < from) {
    fail(`${path.relative(root, file)} has no ${BEGIN} ... ${END} section to record into`)
  }
  fs.writeFileSync(file, `${text.slice(0, from)}${BEGIN}\n${report}\n${text.slice(to)}`)
  process.stderr.write(`recorded in ${path.relative(root, file)}\n`)
}

main()
