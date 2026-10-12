#!/usr/bin/env node
// JSON against other languages on the same machine: Nish's nish/json-tokenizer,
// nish/json-typed and nish/json beside simdjson, yyjson, RapidJSON, serde_json
// and Go's encoding/json, over nativejson-benchmark's twitter.json,
// citm_catalog.json and canada.json.
//
//   npm run build && node bench/json-compare/run.mjs [options]
//     --rounds N        interleaved rounds (default 5)
//     --mb N            megabytes of input each run parses (default 64), which
//                       sets each corpus's iteration count
//     --only a,b        implementations to run (default all): nish, simdjson,
//                       yyjson, rapidjson, serde, go; nish's copy runs with nish
//     --record          also write the tables into docs/BENCHMARKS.md, between
//                       its json-compare markers
//     --compiler <nish> the compiler under test (default build/nish)
//
// It needs the network the first time (fetch.mjs pins the corpora and the C
// and C++ sources into bench/json-compare/cache/) and clang, clang++, cargo
// and go; a toolchain that does not answer --version (`go version` for Go)
// is skipped, loudly, and its rows say so. It never runs in `npm test`:
// tests/run.js's "json-compare" check builds main.ts and holds it to
// sample.expected without a network.
//
// The workloads, each a program argument (`<program> <workload> <file>
// <iterations> <at>`), print a checksum line and then `ns <elapsed>`:
//
//   tokenize   every token of the document, on all three corpora; simdjson
//              On-Demand, yyjson's tree, RapidJSON's Reader (SAX), a serde
//              Visitor and Go's Decoder.Token
//   typed      citm_catalog's `performances` decoded into declared classes;
//              serde derive, Go structs and simdjson On-Demand into structs
//              (yyjson and RapidJSON have no typed layer). Each decodes the
//              way its library is used: Nish into the same objects every
//              iteration, which nish/json-typed reuses (arrays, objects, a
//              string equal to the one held), the comparators into a fresh
//              value each time, so the figure compares those two uses
//   serialize  those classes, decoded once, written back minified; the same
//              three comparators, every one held to the same bytes
//
// The checksum is the same fold in every program, `h = h * 31 + v` wrapping
// in 64 bits:
//
//   tokenize   per token its kind (1 `{`, 2 `}`, 3 `[`, 4 `]`, 5 key,
//              6 string, 7 number, 8 true, 9 false, 10 null), and for a key
//              or string then its decoded length in bytes and its last byte
//              (0 when empty); every number is added to an f64 sum. Each
//              iteration's h is folded into the run's, and its sum added to
//              the run's. Printed: `tokenize <h> <tokens> <sum>`.
//   typed      per performance, in declaration order, each integer field, a
//              `string | null` as 0 or its length plus one, each array's
//              length before its elements, venueCode's length; each
//              iteration's h folded into the run's. `typed <h> <count>`.
//   serialize  per iteration the output's length, then its byte at
//              `iteration % length`; after the loop, every byte of the last
//              output. `serialize <h> <length> <bytes>`.
//
// Before each tokenize or typed iteration the byte at `at` is set to the
// digit `iteration % 10`, so no iteration parses the input the one before
// did: for tokenize the last digit of the document that follows a digit, for
// typed the last digit of the first performance's `start`. Before each
// serialize iteration, performance `iteration % count` has its `start` moved
// on by one. Every implementation must print the same checksum for a case in
// every round; the f64 sum is compared as the double it spells, since each
// language prints a round-tripping double its own way.
//
// Rounds are interleaved: each round runs every implementation once per
// case, starting one further along the list than the round before, so a
// slow stretch of a shared machine falls on all of them. Nish runs as two
// byte-identical binaries, and the gap between them is the noise band
// (CLAUDE.md, `Measured:`): a difference smaller than it is not a difference.
// Each program times its own loop with a monotonic clock, so start-up and
// reading the file are not in the figure.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { CACHE, fetchAll } from "./fetch.mjs"

const here = import.meta.dirname
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "json-compare")
const nishc = compilerFrom(process.argv.slice(2))

const fail = (msg) => {
  console.error(`bench/json-compare/run.mjs: ${msg}`)
  process.exit(2)
}

const opts = { rounds: 5, mb: 64, only: null, record: false }
for (let i = 0; i < nishc.rest.length; i++) {
  const arg = nishc.rest[i]
  if (arg === "--rounds") {
    opts.rounds = Number(nishc.rest[++i])
  } else if (arg === "--mb") {
    opts.mb = Number(nishc.rest[++i])
  } else if (arg === "--only") {
    opts.only = new Set(String(nishc.rest[++i]).split(","))
  } else if (arg === "--record") {
    opts.record = true
  } else {
    fail(`unknown option ${arg}`)
  }
}
if (!(Number.isInteger(opts.rounds) && opts.rounds >= 1 && opts.mb > 0)) {
  fail("--rounds needs a positive integer and --mb a positive number")
}

/**
 * The workloads: the offset of the digit each iteration rewrites (-1 for
 * none), and what a document's bytes are. Serialize is sized by what it
 * writes, the length its checksum line reports, so one uncounted iteration
 * of the first implementation measures it.
 */
const WORKLOADS = {
  tokenize: { at: (doc) => tokenizeAt(doc), written: false },
  typed: { at: (doc) => startAt(doc), written: false },
  serialize: { at: () => -1, written: true },
}
const ALL = Object.keys(WORKLOADS)
const CASES = [
  { workload: "tokenize", corpus: "twitter.json" },
  { workload: "tokenize", corpus: "citm_catalog.json" },
  { workload: "tokenize", corpus: "canada.json" },
  { workload: "typed", corpus: "citm_catalog.json" },
  { workload: "serialize", corpus: "citm_catalog.json" },
]

// ---- Toolchains and builds ---------------------------------------------------------

/** The first line a tool prints for `args`, or null when it cannot be run. */
const versionOf = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" })
  return r.error === undefined && r.status === 0 ? r.stdout.split("\n")[0].trim() : null
}

/** Runs a build step; exits on failure, since a comparator that will not build is a broken bench. */
const build = (what, cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" })
  if (r.error !== undefined || r.status !== 0) {
    fail(`building ${what} failed (exit ${r.status})\n${r.error?.message ?? ""}${r.stderr}`)
  }
}

/** Each toolchain's command and the version it answers, null when it is not installed. */
const tool = (cmd, args) => ({ cmd, version: versionOf(cmd, args) })
const tools = {
  nish: tool(nishc.cmd, [...nishc.prefix, "--version"]),
  cc: tool(process.env.CC ?? "clang", ["--version"]),
  cxx: tool(process.env.CXX ?? "clang++", ["--version"]),
  cargo: tool("cargo", ["--version"]),
  // The go tool has no --version.
  go: tool("go", ["version"]),
}

/**
 * A C or C++ comparator: the bench source beside this script compiled with
 * the cached library sources. Rebuilt only when the program is older than
 * one of its sources or than this script, since simdjson's single header
 * alone takes ten seconds at -O3.
 */
const native = (name, compiler, flags, include, sources) => () => {
  const exe = path.join(outDir, name)
  const inputs = [path.join(here, `${name}-bench.${compiler === "cc" ? "c" : "cpp"}`), ...sources]
  const stale =
    !fs.existsSync(exe) ||
    [import.meta.filename, ...inputs].some((f) => fs.statSync(f).mtimeMs > fs.statSync(exe).mtimeMs)
  if (stale) {
    build(name, tools[compiler].cmd, [...flags, "-O3", `-I${include}`, ...inputs, "-o", exe])
  }
  return exe
}

/** The serde_json version cargo.lock pins. */
const serdeJsonVersion = () => {
  const lock = fs.readFileSync(path.join(here, "serde", "cargo.lock"), "utf8")
  return /name = "serde_json"\nversion = "([^"]+)"/.exec(lock)?.[1] ?? "?"
}

/**
 * Every implementation: its name for --only, its label in the tables (and a
 * label per workload where that workload uses another API), the workloads it
 * has a program for, the toolchain it needs, and `build`, which answers the
 * program's path. Nish's entry also runs as a byte-identical copy, the noise
 * band.
 */
const IMPLS = [
  {
    name: "nish",
    label: "Nish",
    workloads: ALL,
    tool: "nish",
    build: () => {
      const exe = path.join(outDir, "nish", "main")
      build("Nish", nishc.cmd, [
        ...nishc.prefix,
        path.join(here, "main.ts"),
        "-o",
        `${path.dirname(exe)}${path.sep}`,
        "--link",
        exe,
      ])
      return exe
    },
  },
  {
    name: "simdjson",
    label: "simdjson 4.4.2 (On-Demand)",
    labels: { serialize: "simdjson 4.4.2 (builder::string_builder)" },
    workloads: ALL,
    tool: "cxx",
    build: native("simdjson", "cxx", ["-std=c++17"], path.join(CACHE, "simdjson"), [
      path.join(CACHE, "simdjson", "simdjson.cpp"),
    ]),
  },
  {
    name: "yyjson",
    label: "yyjson 0.12.0",
    workloads: ["tokenize"],
    tool: "cc",
    build: native("yyjson", "cc", [], path.join(CACHE, "yyjson"), [path.join(CACHE, "yyjson", "yyjson.c")]),
  },
  {
    name: "rapidjson",
    label: "RapidJSON (Reader, SAX)",
    workloads: ["tokenize"],
    tool: "cxx",
    build: native("rapidjson", "cxx", ["-std=c++17"], path.join(CACHE, "rapidjson", "include"), []),
  },
  {
    name: "serde",
    label: `serde_json ${serdeJsonVersion()}`,
    workloads: ALL,
    tool: "cargo",
    build: () => {
      // Cargo reads only Cargo.toml and Cargo.lock, names the repository's kebab-case rule refuses.
      const dir = path.join(outDir, "serde")
      fs.mkdirSync(dir, { recursive: true })
      fs.copyFileSync(path.join(here, "serde", "cargo.toml"), path.join(dir, "Cargo.toml"))
      fs.copyFileSync(path.join(here, "serde", "cargo.lock"), path.join(dir, "Cargo.lock"))
      fs.copyFileSync(path.join(here, "serde", "main.rs"), path.join(dir, "main.rs"))
      build("serde_json", "cargo", ["build", "--release", "--locked", "--quiet"], dir)
      return path.join(dir, "target", "release", "serde-bench")
    },
  },
  {
    name: "go",
    label: "Go encoding/json",
    workloads: ALL,
    tool: "go",
    build: () => {
      const exe = path.join(outDir, "go-bench")
      build("Go", "go", ["build", "-o", exe, path.join(here, "go-bench.go")])
      return exe
    },
  },
]

/** The noise band's binary: a byte-for-byte copy of Nish's, run as one more implementation. */
const copyOf = (nish) => {
  const copy = `${nish.exe}-copy`
  fs.copyFileSync(nish.exe, copy)
  if (!fs.readFileSync(nish.exe).equals(fs.readFileSync(copy))) {
    fail("the copy is not byte-identical to the build")
  }
  return { ...nish, name: "nish-copy", label: "Nish (byte-identical copy)", exe: copy }
}

// ---- Inputs ---------------------------------------------------------------------------

const isDigit = (b) => b >= 0x30 && b <= 0x39

/** The last digit of the document that follows a digit: changing it keeps the text JSON. */
const tokenizeAt = (doc) => {
  for (let i = doc.length - 1; i > 0; i--) {
    if (isDigit(doc[i]) && isDigit(doc[i - 1])) {
      return i
    }
  }
  return -1
}

/** The last digit of the first performance's `start`, or -1 when there is none. */
const startAt = (doc) => {
  const text = doc.toString("latin1")
  const from = Math.max(0, text.indexOf('"performances"'))
  const match = /"start"\s*:\s*\d+/.exec(text.slice(from))
  return match === null ? -1 : from + match.index + match[0].length - 1
}

// ---- Running --------------------------------------------------------------------------

/** One run: the checksum line and the loop's ns. */
const runOnce = (exe, args) => {
  const r = spawnSync(exe, args.map(String), { encoding: "utf8", maxBuffer: 1 << 20 })
  const lines = (r.stdout ?? "").trim().split("\n")
  const ns = /^ns (\d+)$/.exec(lines[1] ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null) {
    fail(`${path.relative(root, exe)} ${args.join(" ")} exited ${r.status}:\n${r.stdout}${r.stderr}`)
  }
  return { checksum: lines[0], ns: Number(ns[1]) }
}

/** A checksum line with each double written as JavaScript writes it, so that two spellings of one double compare equal. */
const canonical = (line) =>
  line
    .split(" ")
    .map((t) => (/^\d+$/.test(t) || !Number.isFinite(Number(t)) ? t : String(Number(t))))
    .join(" ")

const main = () => {
  try {
    fetchAll()
  } catch (e) {
    fail(e.message)
  }
  fs.mkdirSync(outDir, { recursive: true })

  const skipped = []
  const ready = []
  for (const impl of IMPLS.filter((i) => opts.only === null || opts.only.has(i.name))) {
    if (tools[impl.tool].version === null) {
      process.stderr.write(
        `SKIP ${impl.label}: ${tools[impl.tool].cmd} is not installed (it did not answer its version)\n`
      )
      skipped.push(impl.label)
      continue
    }
    process.stderr.write(`building ${impl.label}\n`)
    const built = { ...impl, exe: impl.build() }
    ready.push(built, ...(impl.name === "nish" ? [copyOf(built)] : []))
  }

  const cases = CASES.map((c) => {
    const file = path.join(CACHE, "corpus", c.corpus)
    const doc = fs.readFileSync(file)
    const impls = ready.filter((impl) => impl.workloads.includes(c.workload))
    const at = WORKLOADS[c.workload].at(doc)
    const bytes =
      WORKLOADS[c.workload].written && impls.length > 0
        ? Number(runOnce(impls[0].exe, [c.workload, file, 1, at]).checksum.split(" ")[2])
        : doc.length
    return {
      ...c,
      file,
      bytes,
      at,
      iterations: Math.max(1, Math.round((opts.mb * 1024 * 1024) / bytes)),
      impls,
      runs: new Map(impls.map((impl) => [impl.name, []])),
    }
  })

  for (let round = 0; round < opts.rounds; round++) {
    process.stderr.write(`round ${round + 1} of ${opts.rounds}\n`)
    for (const c of cases) {
      const n = c.impls.length
      for (let k = 0; k < n; k++) {
        const impl = c.impls[(k + round) % n]
        c.runs.get(impl.name).push(runOnce(impl.exe, [c.workload, c.file, c.iterations, c.at]))
      }
    }
  }

  let disagreed = false
  for (const c of cases) {
    if (new Set([...c.runs.values()].flat().map((r) => canonical(r.checksum))).size > 1) {
      disagreed = true
      const lines = [...c.runs].map(
        ([name, runs]) => `  ${name}: ${[...new Set(runs.map((r) => r.checksum))].join(" | ")}`
      )
      process.stderr.write(`checksums disagree on ${c.workload} ${c.corpus}:\n${lines.join("\n")}\n`)
    }
  }

  const report = tables(cases, skipped)
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
const fmt = (x) => Math.round(x).toLocaleString("en-US")
const band = (a, b) => `${((Math.abs(a - b) / b) * 100).toFixed(1)}%`

/** The CPU's name as bench/run.mjs reads it for the table above this one: /proc/cpuinfo first. */
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

const tables = (cases, skipped) => {
  const versions = [tools.nish, tools.cc, tools.cxx, tools.cargo, tools.go].map((t) => t.version)
  const lines = [
    `Machine: ${cpuModel()}, ${os.cpus().length} logical cores, ${os.type()} ${os.release()} (${os.arch()}).`,
    `Toolchains: ${[...new Set(versions.filter((v) => v !== null))].join("; ")}.`,
    `${opts.rounds} interleaved rounds of ${opts.mb} MB of input per run; ns per document and MB/s, min and median over the rounds.`,
  ]
  if (skipped.length > 0) {
    lines.push(`Skipped, toolchain missing: ${skipped.join(", ")}.`)
  }
  for (const c of cases.filter((x) => x.impls.length > 0)) {
    const per = (name) => (c.runs.get(name) ?? []).map((r) => r.ns / c.iterations)
    const nishMedian = median(per("nish"))
    const what = `${fmt(c.bytes)} bytes${WORKLOADS[c.workload].written ? " written" : ""}`
    lines.push(
      "",
      `### ${c.workload}, ${c.corpus} (${what}, ${c.iterations} per run)`,
      "",
      `Checksum \`${[...c.runs.values()][0]?.[0]?.checksum}\`, the same from every implementation.`,
      "",
      "| Implementation | ns/doc min | ns/doc median | MB/s (median) | Speed against Nish (median) |",
      "| --- | ---: | ---: | ---: | ---: |"
    )
    for (const impl of c.impls) {
      const xs = per(impl.name)
      const med = median(xs)
      const speed = Number.isNaN(nishMedian) ? "-" : `${(nishMedian / med).toFixed(2)}x`
      lines.push(
        `| ${impl.labels?.[c.workload] ?? impl.label} | ${fmt(Math.min(...xs))} | ${fmt(med)} | ${((c.bytes / med) * 1000).toFixed(0)} | ${speed} |`
      )
    }
    const copy = per("nish-copy")
    if (copy.length > 0) {
      lines.push(
        "",
        `Noise band, Nish against its byte-identical copy: min ${band(Math.min(...per("nish")), Math.min(...copy))}, median ${band(nishMedian, median(copy))}.`
      )
    }
  }
  return lines.join("\n")
}

const BEGIN = "<!-- json-compare:begin -->"
const END = "<!-- json-compare:end -->"

/**
 * Writes the report into docs/BENCHMARKS.md between the markers, or after the
 * file when they are missing. bench/run.mjs writes the rest of that file, and
 * the whole of it: after it runs, this section comes back with the next
 * `--record`.
 */
const record = (report) => {
  const file = path.join(root, "docs", "BENCHMARKS.md")
  const text = fs.readFileSync(file, "utf8")
  const section = [
    BEGIN,
    "## JSON against other languages",
    "",
    `Written by \`${["node", "bench/json-compare/run.mjs", ...process.argv.slice(2)].join(" ")}\`, not by \`bench/run.mjs\`; the workloads, the checksums and the measurement rules are in [that script's header](../bench/json-compare/run.mjs), and the Nish program is [main.ts](../bench/json-compare/main.ts).`,
    "",
    report,
    END,
  ].join("\n")
  const from = text.indexOf(BEGIN)
  const to = text.indexOf(END)
  const next =
    from >= 0 && to > from
      ? `${text.slice(0, from)}${section}${text.slice(to + END.length)}`
      : `${text.trimEnd()}\n\n${section}\n`
  fs.writeFileSync(file, next)
  process.stderr.write(`recorded in ${path.relative(root, file)}\n`)
}

main()
