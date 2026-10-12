#!/usr/bin/env node
// JSON against other languages on the same machine: Nish's nish/json-tokenizer,
// nish/json-typed and nish/json beside simdjson, yyjson, RapidJSON, serde_json
// and Go's encoding/json, over nativejson-benchmark's twitter.json,
// citm_catalog.json and canada.json.
//
//   npm run build && node bench/json-compare/run.mjs [options]
//     --rounds N        interleaved rounds at least (default 9); each case runs
//                       the next multiple of twice its implementations
//     --mb N            megabytes of input each run parses (default 128), which
//                       sets each corpus's iteration count
//     --only a,b        implementations to run (default all): nish, simdjson,
//                       yyjson, rapidjson, serde, go; nish's copy runs with nish
//     --record          also write the tables into docs/BENCHMARKS.md, between
//                       its json-compare markers
//     --compiler <nish> the compiler under test (default build/nish)
//
// It needs the network the first time (fetch.mjs pins the corpora and the C
// and C++ sources into bench/json-compare/cache/, fetching only what the
// selected implementations need) and clang, clang++, cargo and go; a
// toolchain that does not answer --version (`go version` for Go) is skipped,
// loudly, and the report names it. It never runs in `npm test`: tests/run.js's
// "json-compare" checks build main.ts and hold it to sample.expected without a
// network.
//
// The builds: Nish with `--link --profile speed`; C and C++ with
// `-O3 -DNDEBUG` (RapidJSON asserts otherwise); serde_json with cargo's release
// profile plus LTO and one codegen unit (serde/cargo.toml); Go with `go build`.
//
// The workloads, each a program argument (`<program> <workload> <file>
// <iterations> <at>`), print a checksum line and then `ns <elapsed>`:
//
//   tokenize     every token of the document, on all three corpora; simdjson
//                On-Demand, yyjson's tree, RapidJSON's Reader (SAX), a serde
//                Visitor and Go's Decoder.Token
//   typed        citm_catalog's `performances` decoded into declared classes,
//                a fresh value every iteration in every language; serde
//                derive, Go structs and simdjson On-Demand into structs
//                (yyjson and RapidJSON have no typed layer)
//   typed-reuse  Nish only: the same decode into one value reused from one
//                iteration to the next, which nish/json-typed supports
//                (arrays, objects, a string equal to the one held); it must
//                print typed's checksum
//   serialize    those classes, decoded once, written back minified; the same
//                three comparators, every one held to the same fold of every
//                byte of every output (below). Only the writing is timed
//
// The checksum is the same fold in every program, `h = h * 31 + v` wrapping
// in 64 bits:
//
//   tokenize   per token its kind (1 `{`, 2 `}`, 3 `[`, 4 `]`, 5 key,
//              6 string, 7 number, 8 true, 9 false, 10 null), and for a key
//              or string then its decoded length in bytes and its last byte
//              (0 when empty); every number is added to an f64 sum. Each
//              iteration's h is folded into the run's, and its sum added to
//              the run's. After the clock stops, one more pass over the last
//              input folds every byte of every key and string after its
//              length instead of the last byte alone. Printed:
//              `tokenize <h> <tokens> <sum> <every-byte h>`.
//   typed      per performance, in declaration order, each integer field, a
//              string field as 0 for null or its length plus one and then
//              every byte, each array's length before its elements; each
//              iteration's h folded into the run's. `typed <h> <count>`.
//   serialize  every byte of each iteration's output, folded from 0 and then
//              into the run's h, outside the clock, and the last output's
//              length. `serialize <h> <last output's length>`.
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
// case, in rounds.mjs's order (rotated each round, reversed every other block
// of rounds), so a slow stretch of a shared machine falls on all of them, and
// each case runs a multiple of twice its implementations so that every one
// runs in every position equally often. Nish runs as two byte-identical
// binaries, the copy halfway down the list, and the gap between their minimums is the noise band (CLAUDE.md,
// `Measured:`): a ratio within it is marked as no difference. Each program
// times its own loop with a monotonic clock, so start-up and reading the file
// are not in the figure.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { CACHE, fetchAll } from "./fetch.mjs"
import { canonical, DEFAULT_ROUNDS, roundOrder, roundsFor } from "./rounds.mjs"

const here = import.meta.dirname
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "json-compare")
const nishc = compilerFrom(process.argv.slice(2))

const fail = (msg) => {
  console.error(`bench/json-compare/run.mjs: ${msg}`)
  process.exit(2)
}

const opts = { rounds: DEFAULT_ROUNDS, mb: 128, only: null, record: false }
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

/**
 * The workloads: the offset of the digit each iteration rewrites (-1 for
 * none), whether a document's bytes are what it writes rather than reads, and
 * the case whose checksum it must print, when not its own. Serialize is sized
 * by the length its checksum line reports, which one uncounted iteration of
 * the first implementation measures.
 */
const WORKLOADS = {
  tokenize: { at: (doc) => tokenizeAt(doc), written: false },
  typed: { at: (doc) => startAt(doc), written: false },
  "typed-reuse": { at: (doc) => startAt(doc), written: false, sameAs: "typed" },
  serialize: { at: () => -1, written: true },
}
const CASES = [
  { workload: "tokenize", corpus: "twitter.json" },
  { workload: "tokenize", corpus: "citm_catalog.json" },
  { workload: "tokenize", corpus: "canada.json" },
  { workload: "typed", corpus: "citm_catalog.json" },
  { workload: "typed-reuse", corpus: "citm_catalog.json" },
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
  // What cargo builds serde with: recorded beside cargo, not instead of it.
  rustc: tool("rustc", ["--version"]),
  // The go tool has no --version.
  go: tool("go", ["version"]),
}

const NATIVE_FLAGS = ["-O3", "-DNDEBUG"]

/**
 * A C or C++ comparator: the bench source beside this script compiled with
 * the cached library sources. Rebuilt only when the command line or the
 * compiler's version differs from the stamp the last build left, or a source
 * is newer than the program, since simdjson's single header alone takes ten
 * seconds at -O3.
 */
const native = (name, compiler, flags, include, sources) => () => {
  const exe = path.join(outDir, name)
  const inputs = [path.join(here, `${name}-bench.${compiler === "cc" ? "c" : "cpp"}`), ...sources]
  const args = [...flags, ...NATIVE_FLAGS, `-I${include}`, ...inputs, "-o", exe]
  const stamp = JSON.stringify([tools[compiler].cmd, tools[compiler].version, args])
  const stampFile = `${exe}.stamp`
  const fresh =
    fs.existsSync(exe) &&
    fs.existsSync(stampFile) &&
    fs.readFileSync(stampFile, "utf8") === stamp &&
    inputs.every((f) => fs.statSync(f).mtimeMs <= fs.statSync(exe).mtimeMs)
  if (!fresh) {
    build(name, tools[compiler].cmd, args)
    fs.writeFileSync(stampFile, stamp)
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
 * has a program for, the toolchain it needs, the cached sources it needs
 * (fetch.mjs's directories), and `build`, which answers the program's path.
 * Nish's entry also runs as a byte-identical copy, the noise band.
 */
const IMPLS = [
  {
    name: "nish",
    label: "Nish",
    labels: { "typed-reuse": "Nish, decoding into the same objects" },
    workloads: Object.keys(WORKLOADS),
    tool: "nish",
    sources: [],
    build: () => {
      const exe = path.join(outDir, "nish", "main")
      build("Nish", nishc.cmd, [
        ...nishc.prefix,
        path.join(here, "main.ts"),
        "-o",
        `${path.dirname(exe)}${path.sep}`,
        "--link",
        exe,
        "--profile",
        "speed",
      ])
      return exe
    },
  },
  {
    name: "simdjson",
    label: "simdjson 4.4.2 (On-Demand)",
    labels: {
      typed: "simdjson 4.4.2 (On-Demand; reads only `performances`, MB/s over the whole document)",
      serialize: "simdjson 4.4.2 (builder::string_builder, written by hand field by field)",
    },
    workloads: ["tokenize", "typed", "serialize"],
    tool: "cxx",
    sources: ["simdjson"],
    build: native("simdjson", "cxx", ["-std=c++17"], path.join(CACHE, "simdjson"), [
      path.join(CACHE, "simdjson", "simdjson.cpp"),
    ]),
  },
  {
    name: "yyjson",
    label: "yyjson 0.12.0",
    workloads: ["tokenize"],
    tool: "cc",
    sources: ["yyjson"],
    build: native("yyjson", "cc", [], path.join(CACHE, "yyjson"), [path.join(CACHE, "yyjson", "yyjson.c")]),
  },
  {
    name: "rapidjson",
    label: "RapidJSON (Reader, SAX)",
    workloads: ["tokenize"],
    tool: "cxx",
    sources: ["rapidjson"],
    build: native("rapidjson", "cxx", ["-std=c++17"], path.join(CACHE, "rapidjson", "include"), []),
  },
  {
    name: "serde",
    label: `serde_json ${serdeJsonVersion()}`,
    workloads: ["tokenize", "typed", "serialize"],
    tool: "cargo",
    sources: [],
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
    workloads: ["tokenize", "typed", "serialize"],
    tool: "go",
    sources: [],
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
  return { ...nish, name: "nish-copy", label: "Nish (byte-identical copy)", labels: {}, exe: copy }
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

/** `impls` with Nish's copy put halfway down, so it does not always run straight after Nish. */
const withCopy = (impls) => {
  const nish = impls.find((i) => i.name === "nish")
  if (nish === undefined) {
    return impls
  }
  const at = Math.ceil(impls.length / 2)
  return [...impls.slice(0, at), copyOf(nish), ...impls.slice(at)]
}

const main = () => {
  const unknown = (opts.only ?? []).filter((n) => !IMPLS.some((i) => i.name === n))
  if (unknown.length > 0) {
    fail(
      `--only names no implementation: ${unknown.join(", ")} (known: ${IMPLS.map((i) => i.name).join(", ")})`
    )
  }
  const selected = IMPLS.filter((i) => opts.only === null || opts.only.includes(i.name))
  try {
    fetchAll(selected.flatMap((i) => i.sources))
  } catch (e) {
    fail(e.message)
  }
  fs.mkdirSync(outDir, { recursive: true })

  const skipped = []
  const built = []
  for (const impl of selected) {
    if (tools[impl.tool].version === null) {
      process.stderr.write(
        `SKIP ${impl.label}: ${tools[impl.tool].cmd} is not installed (it did not answer its version)\n`
      )
      skipped.push(impl.label)
      continue
    }
    process.stderr.write(`building ${impl.label}\n`)
    built.push({ ...impl, exe: impl.build() })
  }
  const ready = withCopy(built)

  const cases = CASES.map((c) => {
    const file = path.join(CACHE, "corpus", c.corpus)
    const doc = fs.readFileSync(file)
    const impls = ready.filter((impl) => impl.workloads.includes(c.workload))
    const at = WORKLOADS[c.workload].at(doc)
    if (at < 0 && c.workload !== "serialize") {
      fail(
        `${c.corpus} has no digit for ${c.workload} to rewrite, so every iteration would parse the same input`
      )
    }
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
      rounds: roundsFor(impls.length, opts.rounds),
      impls,
      runs: new Map(impls.map((impl) => [impl.name, []])),
    }
  }).filter((c) => c.impls.length > 0)

  const rounds = Math.max(...cases.map((c) => c.rounds))
  for (let round = 0; round < rounds; round++) {
    process.stderr.write(`round ${round + 1} of ${rounds}\n`)
    for (const c of cases.filter((x) => round < x.rounds)) {
      for (const impl of roundOrder(c.impls, round)) {
        c.runs.get(impl.name).push(runOnce(impl.exe, [c.workload, c.file, c.iterations, c.at]))
      }
    }
  }

  // A case's checksums, with those of every case that must print the same.
  const group = (c) => WORKLOADS[c.workload].sameAs ?? c.workload
  for (const c of cases) {
    const peers = cases.filter((x) => group(x) === group(c) && x.corpus === c.corpus)
    const seen = new Set(peers.flatMap((x) => [...x.runs.values()].flat().map((r) => canonical(r.checksum))))
    if (seen.size > 1) {
      c.disagreement = [...c.runs]
        .map(([name, runs]) => `${name}: ${[...new Set(runs.map((r) => r.checksum))].join(" | ")}`)
        .join("; ")
      process.stderr.write(`checksums disagree on ${c.workload} ${c.corpus}: ${c.disagreement}\n`)
    }
  }
  const disagreed = cases.some((c) => c.disagreement !== undefined)

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
const pct = (x) => `${(x * 100).toFixed(1)}%`

/** The CPU's name as bench/run.mjs reads it for the table at the head of docs/BENCHMARKS.md: /proc/cpuinfo first. */
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
 * docs/BENCHMARKS.md, so that committing the recorded section afterwards does
 * not make it name a commit it was not measured at, with a note when the
 * working tree has other changes.
 */
const commit = () => {
  const outside = ["--", ".", ":(exclude)docs/BENCHMARKS.md"]
  const at = versionOf("git", ["-C", root, "log", "-1", "--format=%h", "--abbrev=8", ...outside]) ?? "unknown"
  const dirty = versionOf("git", ["-C", root, "status", "--porcelain", ...outside])
  return dirty === null || dirty === "" ? at : `${at} with uncommitted changes`
}

/** The command that reproduces this run, without a local --compiler path. */
const command = () =>
  [
    "node bench/json-compare/run.mjs",
    `--rounds ${opts.rounds}`,
    `--mb ${opts.mb}`,
    ...(opts.only === null ? [] : [`--only ${opts.only.join(",")}`]),
    ...(opts.record ? ["--record"] : []),
  ].join(" ")

const tables = (cases, skipped) => {
  // The toolchains the run used, not every one installed.
  const used = new Set(cases.flatMap((c) => c.impls.map((impl) => impl.tool)))
  const names = { nish: "Nish", cc: "C", cxx: "C++", cargo: "Rust", go: "Go" }
  const toolchain = (t) => {
    if (t === "cargo") {
      return `Rust: ${tools.cargo.version}, ${tools.rustc.version}`
    }
    // Nish's command is a local path (--compiler or build/nish); its version names it.
    return t === "nish"
      ? `Nish: ${tools.nish.version}`
      : `${names[t]}: \`${tools[t].cmd}\` ${tools[t].version}`
  }
  const toolchains = [...used].map(toolchain)
  const lines = [
    "| | |",
    "| --- | --- |",
    `| Date | ${new Date().toISOString().slice(0, 10)} |`,
    `| nish | ${tools.nish.version} (commit ${commit()}) |`,
    `| CPU | ${cpuModel()}, ${os.cpus().length} logical cores |`,
    `| OS | ${os.type().toLowerCase()} ${os.release()} (${os.arch()}) |`,
    `| Toolchains | ${toolchains.join("; ")} |`,
    `| Command | \`npm run build && ${command()}\` |`,
    `| Runs | interleaved rounds, at least ${opts.rounds} and for each case the next multiple of twice its implementations (the round count is in each heading), ${opts.mb} MB of input per run; ns per document, min and median over the rounds |`,
  ]
  if (skipped.length > 0) {
    lines.push(`| Skipped | ${skipped.join(", ")}: toolchain missing |`)
  }
  for (const c of cases) {
    const per = (name) => (c.runs.get(name) ?? []).map((r) => r.ns / c.iterations)
    const nishMin = Math.min(...per("nish"))
    const copy = per("nish-copy")
    const band = copy.length > 0 ? Math.abs(nishMin - Math.min(...copy)) / Math.min(...copy) : Number.NaN
    const what = `${fmt(c.bytes)} bytes${WORKLOADS[c.workload].written ? " written" : ""}`
    lines.push(
      "",
      `### ${c.workload}, ${c.corpus} (${what}, ${c.iterations} per run, ${c.rounds} rounds)`,
      "",
      c.disagreement === undefined
        ? `Checksum \`${[...c.runs.values()][0][0].checksum}\`, the same from every implementation.`
        : `**Checksums disagree**: ${c.disagreement}.`,
      "",
      "| Implementation | ns/doc min | ns/doc median | MB/s (min) | Nish min / its min |",
      "| --- | ---: | ---: | ---: | ---: |"
    )
    for (const impl of c.impls) {
      const xs = per(impl.name)
      const min = Math.min(...xs)
      const ratio = nishMin / min
      let cell = "-"
      if (impl.name === "nish") {
        cell = "1.00x"
      } else if (impl.name === "nish-copy") {
        cell = `${ratio.toFixed(2)}x, the noise band`
      } else if (Number.isFinite(ratio)) {
        cell = Math.abs(ratio - 1) <= band ? `${ratio.toFixed(2)}x, within noise` : `${ratio.toFixed(2)}x`
      }
      lines.push(
        `| ${impl.labels?.[c.workload] ?? impl.label} | ${fmt(min)} | ${fmt(median(xs))} | ${((c.bytes / min) * 1000).toFixed(0)} | ${cell} |`
      )
    }
    if (Number.isFinite(band)) {
      lines.push(
        "",
        `Noise band, Nish against its byte-identical copy: ${pct(band)} on the minimums (${pct(Math.abs(median(per("nish")) - median(copy)) / median(copy))} on the medians). A ratio within it is no difference.`
      )
    }
  }
  return lines.join("\n")
}

const BEGIN = "<!-- json-compare:begin -->"
const END = "<!-- json-compare:end -->"

/** What every recorded section says about the comparison before its tables. */
const preamble = () => [
  "## JSON against other languages",
  "",
  "Written by `node bench/json-compare/run.mjs --record`, not by `bench/run.mjs`, which carries this section over when it rewrites the file. The run is its own, so the host below may not be the one in the table at the head of this file. The workloads, the checksums and the measurement rules are in [that script's header](../bench/json-compare/run.mjs), and the Nish program is [main.ts](../bench/json-compare/main.ts).",
  "",
  "The ratio column divides the Nish minimum by that implementation's minimum, as the tables above do: above 1.00x it is faster than Nish. A ratio within the noise band, the gap between Nish and a byte-identical copy of its binary, is marked as no difference.",
  "",
  `Builds: Nish \`--link --profile speed\`; C \`${tools.cc.cmd} -O3 -DNDEBUG\` and C++ \`${tools.cxx.cmd} -O3 -DNDEBUG\`; serde_json cargo \`--release\` with LTO and one codegen unit; Go \`go build\`.`,
  "",
  "What differs between the rows:",
  "",
  "- **Tokenize** is each library's own way of visiting every value. Nish's tokenizer copies every key and string out with `stringInto`; yyjson builds a whole tree, reading a copy of the input rather than in place; RapidJSON's Reader (SAX) calls back per value; serde_json drives a Visitor; Go's `Decoder.Token` makes an `interface{}` per token. simdjson On-Demand materialises every value as it is visited. What must agree: in the timed loop, each token's kind and each key's and string's length and last byte, folded, and the sum of the numbers as a double; in an untimed pass over the last iteration's input, every byte of every key and string.",
  "- **Typed decode** has no yyjson or RapidJSON row: neither has a typed layer. Every row decodes into a fresh value each iteration. simdjson On-Demand reads `performances` and nothing after it, while serde_json, Go and Nish scan the whole document, so simdjson's MB/s divides the whole document's bytes by a time that did not read all of them. The extra Nish row decodes into one value reused across iterations, which nish/json-typed supports and the others' APIs do not. What must agree: every decoded field of every performance, each string byte by byte, folded each iteration.",
  "- **Serialize** times the writing alone, from the same decoded values. Nish (`jsonEncode`) and serde_json (derive) write from the type, Go by reflection (its encoder's trailing newline is trimmed), and simdjson's row is builder calls written by hand, field by field, since simdjson has no type-driven writer without C++26 reflection. What must agree is a 64-bit `h * 31 + v` fold of every byte of every iteration's output, and the last output's length.",
  "",
]

/**
 * Writes the report into docs/BENCHMARKS.md between the markers, or after the
 * file when they are missing. bench/run.mjs writes the rest of that file and
 * carries this section over when it does.
 */
const record = (report) => {
  const file = path.join(root, "docs", "BENCHMARKS.md")
  const text = fs.readFileSync(file, "utf8")
  const section = [BEGIN, ...preamble(), report, END].join("\n")
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
