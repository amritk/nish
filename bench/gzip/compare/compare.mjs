#!/usr/bin/env node
// One-shot gzip and gunzip of the same JSON body across languages, on the
// same machine: Nish's nish/compress/gzip beside C's zlib and libdeflate, Go's
// compress/gzip and klauspost/compress, Rust's flate2 over miniz_oxide and
// over zlib-rs, Java's java.util.zip, Node's and Bun's node:zlib, Bun's own
// Bun.gzipSync, and Python's zlib.
//
//   npm run build && node bench/gzip/compare/compare.mjs [options]
//     --rounds N        interleaved rounds (default 9)
//     --calls N         calls per row per round (default 10000)
//     --body file       the body (default bench/gzip/feed.json)
//     --compiler <nish> the compiler under test (default build/nish)
//
// Every comparator compresses the body at level 1 and level 6 with state it
// reuses from call to call (where the library lets it), and decompresses the
// same two streams: the body gzipped by Node's zlib at level 1 and level 6,
// written into build/bench/gzip-compare/, so that every decoder does the same
// work whatever its own compressor writes. Each prints rows of
// `<library> <op> <level> <input bytes> <output bytes> <ns> <calls>`.
//
// The builds: Nish with `--link --profile speed` (main.ts beside this
// directory); C with `clang -O3` against the system zlib and libdeflate
// (gzip.c beside this directory); Go with `go build` (go.mod pins
// klauspost/compress); Rust with cargo's release profile plus LTO, once per
// flate2 backend (cargo.toml); Java with javac. Every build is for the
// machine's baseline instruction set; libdeflate and zlib-rs pick SIMD code
// at run time where the CPU has it (CRC-32 with PCLMULQDQ among it), which no
// build flag here can take away. A toolchain that is missing is skipped,
// loudly, and the report names it.
//
// Rounds are interleaved, every comparator once per round in an order that
// reverses each round, and each row reports the median of its rounds as
// microseconds per call, with the output size and the time over Nish's.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"

const here = path.dirname(fileURLToPath(import.meta.url))
const gzipDir = path.resolve(here, "..")
const root = path.resolve(here, "..", "..", "..")
const out = path.join(root, "build", "bench", "gzip-compare")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const rounds = Number(flag("--rounds", "9"))
const calls = flag("--calls", "10000")
const body = path.resolve(flag("--body", path.join(gzipDir, "feed.json")))
const compiler = flag("--compiler", path.join(root, "build", "nish"))

fs.mkdirSync(out, { recursive: true })
const bytes = fs.readFileSync(body)
const gz1 = path.join(out, "body-1.gz")
const gz6 = path.join(out, "body-6.gz")
fs.writeFileSync(gz1, zlib.gzipSync(bytes, { level: 1 }))
fs.writeFileSync(gz6, zlib.gzipSync(bytes, { level: 6 }))
const args = [body, calls, gz1, gz6]

const skipped = []
/** Runs a build step, answering whether it worked; a failure is reported and its comparator skipped. */
const build = (what, cmd, cmdArgs, cwd = root) => {
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: "utf8" })
  if (r.status !== 0) {
    skipped.push(`${what}: \`${cmd} ${cmdArgs.join(" ")}\` failed${r.error ? ` (${r.error.code})` : ""}`)
    process.stderr.write(`bench/gzip/compare: skipping ${what}\n${r.stdout ?? ""}${r.stderr ?? ""}\n`)
    return false
  }
  return true
}

// [name, command, arguments]: each prints its rows.
const programs = []
if (
  build("nish", compiler, [
    path.join(gzipDir, "main.ts"),
    "-o",
    `${out}/nish/`,
    "--link",
    path.join(out, "nish-gzip"),
  ])
) {
  programs.push(["nish", path.join(out, "nish-gzip"), args])
}
const libdeflate = [
  "/usr/lib/x86_64-linux-gnu/libdeflate.so.0",
  "/usr/lib/aarch64-linux-gnu/libdeflate.so.0",
  "/usr/lib/libdeflate.so.0",
  "/usr/local/lib/libdeflate.so",
].find((p) => fs.existsSync(p))
if (libdeflate === undefined) {
  skipped.push("zlib and libdeflate: libdeflate's shared object was not found")
} else if (
  build("C", "clang", [
    "-O3",
    path.join(gzipDir, "gzip.c"),
    "-o",
    path.join(out, "c-gzip"),
    "-lz",
    libdeflate,
  ])
) {
  programs.push(["C", path.join(out, "c-gzip"), args])
}
if (build("Go", "go", ["build", "-o", path.join(out, "go-gzip"), "."], here)) {
  programs.push(["Go", path.join(out, "go-gzip"), args])
}
for (const feature of ["miniz", "zlib-rs"]) {
  const dir = path.join(out, `rust-${feature}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(path.join(here, "cargo.toml"), path.join(dir, "Cargo.toml"))
  fs.copyFileSync(path.join(here, "cargo.lock"), path.join(dir, "Cargo.lock"))
  fs.copyFileSync(path.join(here, "rust-gzip.rs"), path.join(dir, "main.rs"))
  if (
    build(
      `Rust (${feature})`,
      "cargo",
      ["build", "--release", "--locked", "--quiet", "--features", feature],
      dir
    )
  ) {
    programs.push([`Rust (${feature})`, path.join(dir, "target", "release", "gzip-bench"), args])
  }
}
if (build("Java", "javac", ["-d", path.join(out, "java"), path.join(here, "java-gzip.java")])) {
  programs.push(["Java", "java", ["-cp", path.join(out, "java"), "JavaGzip", ...args]])
}
for (const runtime of ["node", "bun"]) {
  if (build(runtime, runtime, ["--version"])) {
    programs.push([runtime, runtime, [path.join(here, "js-gzip.mjs"), ...args]])
  }
}
if (build("Python", "python3", ["--version"])) {
  programs.push(["Python", "python3", [path.join(here, "python-gzip.py"), ...args]])
}

// "<op> <level> <library>" -> { lib, op, level, size, us: [] }
const rows = new Map()
for (let r = 0; r < rounds; r++) {
  const order = r % 2 === 0 ? programs : [...programs].reverse()
  for (const [name, cmd, cmdArgs] of order) {
    const run = spawnSync(cmd, cmdArgs, { cwd: root, encoding: "utf8" })
    if (run.status !== 0) {
      process.stderr.write(`bench/gzip/compare: ${name} failed\n${run.stdout}${run.stderr}`)
      process.exit(1)
    }
    for (const line of run.stdout.trim().split("\n")) {
      const [lib, op, level, , size, ns, n] = line.split(" ")
      const key = `${op} ${level} ${lib}`
      const row = rows.get(key) ?? { lib, op, level, size: Number(size), us: [] }
      row.us.push(Number(ns) / Number(n) / 1e3)
      rows.set(key, row)
    }
  }
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
console.log(
  `body: ${path.relative(root, body)}, ${bytes.length} bytes; ${rounds} rounds of ${calls} calls; median`
)
console.log(
  `gunzip streams: Node's zlib ${process.versions.zlib}, level 1 ${fs.statSync(gz1).size} bytes, level 6 ${fs.statSync(gz6).size} bytes`
)
for (const op of ["gzip", "gunzip"]) {
  for (const level of ["-1", "-6"]) {
    const list = [...rows.values()]
      .filter((row) => row.op === op && row.level === level)
      .map((row) => ({ ...row, m: median(row.us) }))
      .sort((a, b) => a.m - b.m)
    const nish = list.find((row) => row.lib === "nish")
    console.log(`\n### ${op} ${level}\n`)
    console.log(`| rank | library | ${op === "gzip" ? "output" : "input"} bytes | µs/call | MB/s | vs nish |`)
    console.log("| --- | --- | --- | --- | --- | --- |")
    list.forEach((row, i) => {
      const lib = row.lib === "nish" ? "**nish**" : row.lib
      const vs = nish === undefined ? "" : `${(row.m / nish.m).toFixed(2)}x`
      console.log(
        `| ${i + 1} | ${lib} | ${row.size} | ${row.m.toFixed(2)} | ${(bytes.length / row.m).toFixed(0)} | ${vs} |`
      )
    })
  }
}
if (skipped.length > 0) {
  console.log(`\nskipped:\n${skipped.map((s) => `- ${s}`).join("\n")}`)
}
