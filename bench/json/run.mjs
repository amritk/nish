// `std/json` against the JSON readers people actually use. Builds every
// reader in this directory, checks that each prints the same checksum over the
// same input, times them and prints (or, with --out, writes) a Markdown report.
//
//   node bench/json/run.mjs                        # 100 000 lines, 7 runs after 1 warm-up
//   node bench/json/run.mjs --lines 200000 --runs 15 --warmup 2
//   node bench/json/run.mjs --only nish,simdjson   # a subset, by column name
//   node bench/json/run.mjs --validate             # checksums only, one run each
//   node bench/json/run.mjs --out docs/BENCHMARKS-json.md
//
// Every program times its extraction loop itself (bench/json/README.md says
// what is and is not inside it) and prints the checksum and then the
// nanoseconds; the columns take turns, run by run, so that a machine that
// slows down part-way slows them all.
//
// A reader whose toolchain or library is missing is skipped with a note, never
// a failure: `clang`/`clang++` with libcjson-dev, libsimdjson-dev and
// nlohmann-json3-dev for the C and C++ columns, YYJSON_DIR naming a directory
// that holds yyjson.c and yyjson.h, `cargo` for serde_json and `go` for
// encoding/json and gjson (both fetch their crates and modules on first build).
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../..")
const outDir = path.join(root, "build/bench/json")

const opts = {
  lines: 100000,
  runs: 7,
  warmup: 1,
  only: null,
  validate: false,
  out: null,
  compiler: path.join(root, "build/nish"),
}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const value = () => argv[++i]
  if (a === "--lines") {
    opts.lines = Number(value())
  } else if (a === "--runs") {
    opts.runs = Number(value())
  } else if (a === "--warmup") {
    opts.warmup = Number(value())
  } else if (a === "--only") {
    opts.only = value().split(",")
  } else if (a === "--validate") {
    opts.validate = true
  } else if (a === "--out") {
    opts.out = path.resolve(value())
  } else if (a === "--compiler") {
    opts.compiler = path.resolve(value())
  } else {
    console.error(`unknown argument ${a}`)
    process.exit(2)
  }
}

const CC = process.env.CC ?? "clang"
const CXX = process.env.CXX ?? "clang++"
const GO = process.env.GO ?? (existsSync("/usr/local/go/bin/go") ? "/usr/local/go/bin/go" : "go")
const CARGO =
  process.env.CARGO ??
  (existsSync(path.join(os.homedir(), ".cargo/bin/cargo"))
    ? path.join(os.homedir(), ".cargo/bin/cargo")
    : "cargo")
const YYJSON_DIR = process.env.YYJSON_DIR ?? null

mkdirSync(outDir, { recursive: true })
const exe = (name) => path.join(outDir, name)

/** Run a build step; answers null on success and the reason otherwise. */
const build = (cmd, args, cwd = root, env = process.env) => {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" })
  if (r.error) {
    return `${cmd}: ${r.error.code ?? r.error.message}`
  }
  if (r.status !== 0) {
    return `${cmd} exited with ${r.status}: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" / ")}`
  }
  return null
}

const toolVersion = (cmd, args, pick = (s) => s.split("\n")[0]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" })
  return r.status === 0 ? pick(`${r.stdout}${r.stderr}`.trim()) : null
}

const C_FLAGS = ["-O3"]
const CXX_FLAGS = ["-O3", "-std=c++17"]

/**
 * The columns. `build` answers null or why it could not build; `cmd` is the
 * argv that runs it over the input. `kind` is what the reader does per line.
 */
const readers = [
  {
    name: "nish",
    label: "Nish `std/json` (`jsonField` ×3)",
    kind: "field reader: one scan per field; each key it passes and the value cut out as arena strings",
    build: () =>
      build(opts.compiler, ["bench/json/json.ts", "--link", exe("json-nish"), "--profile", "speed"]),
    cmd: (file) => [exe("json-nish"), file],
  },
  {
    name: "simdjson",
    label: "simdjson On-Demand (C++)",
    kind: "lazy: SIMD structural index, then walks to each field",
    build: () =>
      build(CXX, [...CXX_FLAGS, "bench/json/json-simdjson.cpp", "-lsimdjson", "-o", exe("json-simdjson")]),
    cmd: (file) => [exe("json-simdjson"), file],
  },
  {
    name: "yyjson",
    label: "yyjson (C)",
    kind: "DOM: immutable tree per line",
    build: () =>
      YYJSON_DIR === null
        ? "YYJSON_DIR is not set"
        : build(CC, [
            ...C_FLAGS,
            `-I${YYJSON_DIR}`,
            "bench/json/json-yyjson.c",
            path.join(YYJSON_DIR, "yyjson.c"),
            "-o",
            exe("json-yyjson"),
          ]),
    cmd: (file) => [exe("json-yyjson"), file],
  },
  {
    name: "serde-typed",
    label: "serde_json, `#[derive(Deserialize)]` (Rust)",
    kind: "typed: three fields into a struct, the rest skipped",
    build: () => buildRust(),
    cmd: (file) => [exe("json-serde"), file, "typed"],
  },
  {
    name: "serde-value",
    label: "serde_json, `Value` (Rust)",
    kind: "DOM: `Value` tree per line",
    build: () => buildRust(),
    cmd: (file) => [exe("json-serde"), file, "value"],
  },
  {
    name: "gjson",
    label: "gjson (Go)",
    kind: "field reader: one scan per path, nothing built",
    build: () => buildGo(),
    cmd: (file) => [exe("json-go"), file, "gjson"],
  },
  {
    name: "cjson",
    label: "cJSON (C)",
    kind: "DOM: malloc'd tree per line",
    build: () => build(CC, [...C_FLAGS, "bench/json/json-cjson.c", "-lcjson", "-o", exe("json-cjson")]),
    cmd: (file) => [exe("json-cjson"), file],
  },
  {
    name: "node",
    label: "`JSON.parse` (Node / V8)",
    kind: "DOM: a JS object per line",
    build: () => null,
    cmd: (file) => [process.execPath, path.join(here, "json-node.mjs"), file],
  },
  {
    name: "go-std",
    label: "encoding/json, struct (Go)",
    kind: "typed: three fields into a struct, the rest skipped",
    build: () => buildGo(),
    cmd: (file) => [exe("json-go"), file, "std"],
  },
  {
    name: "nlohmann",
    label: "nlohmann/json (C++)",
    kind: "DOM: `json` tree per line",
    build: () => build(CXX, [...CXX_FLAGS, "bench/json/json-nlohmann.cpp", "-o", exe("json-nlohmann")]),
    cmd: (file) => [exe("json-nlohmann"), file],
  },
]

let rustBuilt
const buildRust = () => {
  rustBuilt ??= (() => {
    const env = { ...process.env, CARGO_TARGET_DIR: path.join(outDir, "rust-target") }
    const why = build(CARGO, ["build", "--release", "--quiet"], path.join(here, "rust"), env)
    if (why !== null) {
      return why
    }
    return build("cp", [path.join(outDir, "rust-target/release/json-serde"), exe("json-serde")])
  })()
  return rustBuilt
}

let goBuilt
const buildGo = () => {
  goBuilt ??= build(GO, ["build", "-trimpath", "-o", exe("json-go"), "."], path.join(here, "go"))
  return goBuilt
}

// ---- Input ----------------------------------------------------------------------

const input = path.join(outDir, `input-${opts.lines}.jsonl`)
if (!existsSync(input)) {
  const why = build(process.execPath, [path.join(here, "gen.mjs"), String(opts.lines), file])
  if (why !== null) {
    console.error(why)
    process.exit(1)
  }
}
const inputBytes = statSync(input).size

// ---- Build ----------------------------------------------------------------------

const columns = []
for (const r of readers) {
  if (opts.only && !opts.only.includes(r.name)) {
    continue
  }
  const why = r.build()
  if (why !== null) {
    console.error(`note: ${r.name} skipped (${why})`)
    continue
  }
  columns.push({ ...r, times: [], checksum: null })
}
if (columns.length === 0) {
  console.error("nothing to run")
  process.exit(1)
}

// ---- Run ------------------------------------------------------------------------

const runOnce = (column) => {
  const [cmd, ...args] = column.cmd(input)
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 20 })
  if (r.status !== 0) {
    console.error(`${column.name} exited with ${r.status}\n${r.stderr}`)
    process.exit(1)
  }
  const [checksum, nanos] = r.stdout.trim().split("\n")
  if (column.checksum !== null && column.checksum !== checksum) {
    console.error(`${column.name} printed ${checksum}, then ${column.checksum}`)
    process.exit(1)
  }
  column.checksum = checksum
  return Number(nanos) / 1e6
}

const total = opts.validate ? 1 : opts.warmup + opts.runs
for (let round = 0; round < total; round++) {
  for (const column of columns) {
    const ms = runOnce(column)
    if (opts.validate || round >= opts.warmup) {
      column.times.push(ms)
    }
  }
}

const reference = columns[0].checksum
const wrong = columns.filter((c) => c.checksum !== reference)
for (const c of wrong) {
  console.error(`${c.name} printed checksum ${c.checksum}, ${columns[0].name} printed ${reference}`)
}
if (wrong.length > 0) {
  process.exit(1)
}
if (opts.validate) {
  console.log(`checksums agree (${reference}) across ${columns.map((c) => c.name).join(", ")}`)
  process.exit(0)
}

// ---- Peak memory ----------------------------------------------------------------

const rssHelper = exe("rss")
const haveRss = build(CC, ["-O2", "bench/rss.c", "-o", rssHelper]) === null
const peakRssKb = (column) => {
  if (!haveRss) {
    return null
  }
  const r = spawnSync(rssHelper, column.cmd(input), { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  return r.status === 0 ? Number(r.stdout.trim()) : null
}

// ---- Report ---------------------------------------------------------------------

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const nish = columns.find((c) => c.name === "nish")
for (const c of columns) {
  c.min = Math.min(...c.times)
  c.median = median(c.times)
  c.rss = peakRssKb(c)
}
columns.sort((a, b) => a.min - b.min)

const fmt = (x, digits = 1) =>
  x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
const versions = [
  ["node", process.version],
  ["clang", toolVersion(CC, ["--version"])],
  [
    "rustc",
    toolVersion("rustc", ["--version"]) ??
      toolVersion(path.join(os.homedir(), ".cargo/bin/rustc"), ["--version"]),
  ],
  ["go", toolVersion(GO, ["version"])],
  ["nish", toolVersion(opts.compiler, ["--version"])],
]
  .filter(([, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)

const lines = [
  "# JSON readers",
  "",
  `Generated by \`node bench/json/run.mjs\` on ${new Date().toISOString().slice(0, 10)}, ${os.cpus()[0]?.model ?? "unknown CPU"} (${os.cpus().length} threads), ${os.platform()} ${os.release()}.`,
  "",
  versions.map((v) => `- ${v}`).join("\n"),
  "",
  `Input: ${opts.lines.toLocaleString("en-US")} lines, ${fmt(inputBytes / 1e6)} MB (\`bench/json/gen.mjs\`). Task per line: the string \`code\`, the number \`line\` and the string \`message\` (the last field, after a nested object and an array, about one in ten tokens an escape). Checksum \`${reference}\`, the same from every column. ${opts.runs} timed runs after ${opts.warmup} warm-up, the columns taking turns; the time is the extraction loop alone, measured by the program.`,
  "",
  `| Reader | What it does per line | min ms | median ms | MB/s | ns/line | ${nish ? "vs Nish | " : ""}peak RSS |`,
  `| --- | --- | ---: | ---: | ---: | ---: | ${nish ? "---: | " : ""}---: |`,
  ...columns.map((c) => {
    const ratio = nish ? `${fmt(c.min / nish.min, 2)}× | ` : ""
    const rss = c.rss === null ? "–" : `${fmt(c.rss / 1024, 0)} MB`
    const label = c === nish ? `**${c.label}**` : c.label
    return `| ${label} | ${c.kind} | ${fmt(c.min)} | ${fmt(c.median)} | ${fmt(inputBytes / 1e6 / (c.min / 1e3), 0)} | ${fmt((c.min * 1e6) / opts.lines, 0)} | ${ratio}${rss} |`
  }),
  "",
  "`vs Nish` divides each minimum by Nish's: below 1 is faster than Nish, above 1 slower. Peak RSS is the whole process (input buffer and line table included) from one more run under `bench/rss.c`.",
  "",
]
const report = lines.join("\n")
if (opts.out) {
  writeFileSync(opts.out, report)
  console.error(`wrote ${path.relative(process.cwd(), opts.out)}`)
}
console.log(report)
