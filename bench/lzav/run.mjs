#!/usr/bin/env node
// One-shot block compression: Nish's `nish/compress/lzav` against upstream
// LZAV in C, with raw DEFLATE level 1 from `nish/compress/deflate` and from
// libdeflate as the yardstick, both directions.
//
//   node bench/lzav/run.mjs [--rounds N] [--calls N] [--body file] [--compiler path] [--lzav-h path]
//
// Builds bench/lzav/main.ts with the compiler (default build/nish, `--profile
// speed`) and bench/lzav/lzav.c with clang -O3 against upstream `lzav.h`
// (`--lzav-h`, or fetched once at LZAV_COMMIT into build/bench/lzav/) and
// libdeflate, checks that both compressors wrote the same number of bytes
// (the port writes LZAV's stream byte for byte), then runs the two binaries
// alternately, `--rounds` times each (default 9), every row `--calls` calls
// (default 20000) over `--body` (default bench/gzip/feed.json). Each row
// reports the median of its rounds as µs per call and input MB/s, with the
// compressed size and the time over C LZAV's in the same direction.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/** The upstream commit the C twin builds against: LZAV 7.1. */
const LZAV_COMMIT = "ff1a1419da7eb104db973927d7bb7c75f6ff31b2"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "lzav")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const rounds = Number(flag("--rounds", "9"))
const calls = flag("--calls", "20000")
const body = flag("--body", path.join(root, "bench", "gzip", "feed.json"))
const compiler = flag("--compiler", path.join(root, "build", "nish"))

/** Runs a command, failing the bench with its output when it fails. */
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" })
  if (r.status !== 0) {
    process.stderr.write(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

const libdeflate = [
  "/usr/lib/x86_64-linux-gnu/libdeflate.so.0",
  "/usr/lib/libdeflate.so.0",
  "/usr/local/lib/libdeflate.so",
].find((p) => fs.existsSync(p))
if (libdeflate === undefined) {
  process.stderr.write("bench/lzav: libdeflate's shared object was not found\n")
  process.exit(1)
}
fs.mkdirSync(out, { recursive: true })
let header = flag("--lzav-h", path.join(out, "lzav.h"))
if (!fs.existsSync(header)) {
  run("curl", ["-sSfL", "-o", header, `https://raw.githubusercontent.com/avaneev/lzav/${LZAV_COMMIT}/lzav.h`])
}
run(compiler, [path.join(here, "main.ts"), "-o", `${out}/`, "--link", path.join(out, "lzav-nish")])
run("clang", ["-O3", "-I", path.dirname(header), path.join(here, "lzav.c"), "-o", path.join(out, "lzav-c"), libdeflate])

// row key -> { lib, codec, op, input, size, ns: [] }
const rows = new Map()
for (let r = 0; r < rounds; r++) {
  for (const exe of r % 2 === 0 ? ["lzav-nish", "lzav-c"] : ["lzav-c", "lzav-nish"]) {
    for (const line of run(path.join(out, exe), [body, calls]).trim().split("\n")) {
      const [lib, codec, op, input, size, ns, n] = line.split(" ")
      const key = `${lib} ${codec} ${op}`
      const row = rows.get(key) ?? { lib, codec, op, input: Number(input), size: Number(size), ns: [] }
      row.ns.push(Number(ns) / Number(n))
      rows.set(key, row)
    }
  }
}
if (rows.get("nish lzav compress").size !== rows.get("c lzav compress").size) {
  process.stderr.write("bench/lzav: the port and upstream LZAV wrote different sizes\n")
  process.exit(1)
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
console.log(
  `body: ${path.relative(root, body)}, ${fs.statSync(body).size} bytes; ${rounds} rounds of ${calls} calls; median\n`
)
console.log("| op | codec | library | size | µs/call | MB/s | vs C LZAV |")
console.log("| --- | --- | --- | --- | --- | --- | --- |")
for (const op of ["compress", "decompress"]) {
  const base = rows.get(`c lzav ${op}`)
  for (const [lib, codec] of [
    ["nish", "lzav"],
    ["c", "lzav"],
    ["nish", "deflate-1"],
    ["libdeflate", "deflate-1"],
  ]) {
    const row = rows.get(`${lib} ${codec} ${op}`)
    const ns = median(row.ns)
    const mbs = row.input / (ns / 1e3)
    console.log(
      `| ${op} | ${codec} | ${lib === "c" ? "C (upstream)" : lib} | ${row.size} | ${(ns / 1e3).toFixed(2)} | ${mbs.toFixed(0)} | ${(ns / median(base.ns)).toFixed(2)}x |`
    )
  }
}
