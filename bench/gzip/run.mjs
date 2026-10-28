#!/usr/bin/env node
// One-shot gzip of a JSON body: Nish's `nish/compress/gzip` against zlib and
// libdeflate on the same machine, at level 1 and level 6, both directions.
//
//   node bench/gzip/run.mjs [--rounds N] [--calls N] [--body file] [--compiler path]
//
// Builds bench/gzip/main.ts with the compiler (default build/nish, `--profile
// speed`) and bench/gzip/gzip.c with clang -O3 against the system zlib and
// libdeflate, then runs the two binaries alternately, `--rounds` times each
// (default 9), every row `--calls` calls (default 20000) over `--body`
// (default bench/gzip/feed.json, written by feed.mjs). Each row reports the
// median of its rounds as µs per call and input MB/s, with the compressed
// size and Nish's time over libdeflate's at the same level and direction.
// The C twin needs libdeflate's shared object; without it the C build fails
// and so does the run.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "gzip")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const rounds = Number(flag("--rounds", "9"))
const calls = flag("--calls", "20000")
const body = flag("--body", path.join(here, "feed.json"))
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
  process.stderr.write("bench/gzip: libdeflate's shared object was not found\n")
  process.exit(1)
}
fs.mkdirSync(out, { recursive: true })
run(compiler, [path.join(here, "main.ts"), "-o", `${out}/`, "--link", path.join(out, "gzip-nish")])
run("clang", ["-O3", path.join(here, "gzip.c"), "-o", path.join(out, "gzip-c"), "-lz", libdeflate])

// row key -> { size, input, ns: [] }
const rows = new Map()
for (let r = 0; r < rounds; r++) {
  for (const exe of r % 2 === 0 ? ["gzip-nish", "gzip-c"] : ["gzip-c", "gzip-nish"]) {
    for (const line of run(path.join(out, exe), [body, calls]).trim().split("\n")) {
      const [lib, op, level, input, size, ns, n] = line.split(" ")
      const key = `${lib} ${op} ${level}`
      const row = rows.get(key) ?? { lib, op, level, input: Number(input), size: Number(size), ns: [] }
      row.ns.push(Number(ns) / Number(n))
      rows.set(key, row)
    }
  }
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
console.log(
  `body: ${path.relative(root, body)}, ${fs.statSync(body).size} bytes; ${rounds} rounds of ${calls} calls; median\n`
)
console.log("| op | level | library | size | µs/call | MB/s | vs libdeflate |")
console.log("| --- | --- | --- | --- | --- | --- | --- |")
for (const op of ["gzip", "gunzip"]) {
  for (const level of ["-1", "-6"]) {
    const base = rows.get(`libdeflate ${op} ${level}`)
    for (const lib of ["nish", "libdeflate", "zlib"]) {
      const row = rows.get(`${lib} ${op} ${level}`)
      const ns = median(row.ns)
      const mbs = row.input / (ns / 1e3)
      const ratio = ns / median(base.ns)
      console.log(
        `| ${op} | ${level} | ${lib} | ${row.size} | ${(ns / 1e3).toFixed(2)} | ${mbs.toFixed(0)} | ${ratio.toFixed(2)}x |`
      )
    }
  }
}
