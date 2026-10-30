#!/usr/bin/env node
// Small JSON bodies: `GzipFixedCompressor` (fixed Huffman, the HTTP small-body
// path) against `GzipCompressor` at `DEFLATE_FAST`, on feed-shaped JSON of
// about 1, 2, 4, 8 and 16 KB.
//
//   node bench/gzip/small.mjs [--rounds N] [--calls N] [--compiler path]
//
// Writes the bodies (feed.mjs's `feedJson`, the largest item count under each
// size) to build/bench/gzip/, builds small.ts with the compiler (default
// build/nish, `--profile speed`), runs it `--rounds` times (default 9),
// `--calls` calls a row (default 20000), and prints the median µs per call,
// the gzip size and ratio per encoder, and zlib -1's size for scale.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"
import { feedJson } from "./feed.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "gzip")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const rounds = Number(flag("--rounds", "9"))
const calls = flag("--calls", "20000")
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

fs.mkdirSync(out, { recursive: true })
const files = []
for (const kb of [1, 2, 4, 8, 16]) {
  let n = 1
  while (feedJson(n + 1).length <= kb * 1024) {
    n += 1
  }
  const file = path.join(out, `small-${kb}k.json`)
  fs.writeFileSync(file, feedJson(n))
  files.push(file)
}
run(compiler, [path.join(here, "small.ts"), "-o", `${out}/`, "--link", path.join(out, "gzip-small")])

// "encoder input" -> { size, ns: [] }
const rows = new Map()
for (let r = 0; r < rounds; r++) {
  for (const line of run(path.join(out, "gzip-small"), [calls, ...files])
    .trim()
    .split("\n")) {
    const [encoder, input, size, ns, n] = line.split(" ")
    const key = `${encoder} ${input}`
    const row = rows.get(key) ?? { size: Number(size), ns: [] }
    row.ns.push(Number(ns) / Number(n))
    rows.set(key, row)
  }
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
console.log(`${rounds} rounds of ${calls} calls; median\n`)
console.log("| body | DEFLATE_FAST µs | size | fixed µs | size | fixed time | fixed size | zlib -1 size |")
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |")
for (const file of files) {
  const text = fs.readFileSync(file)
  const fast = rows.get(`fast ${text.length}`)
  const fixed = rows.get(`fixed ${text.length}`)
  const tf = median(fast.ns) / 1000
  const tx = median(fixed.ns) / 1000
  console.log(
    `| ${text.length} | ${tf.toFixed(2)} | ${fast.size} (${((100 * fast.size) / text.length).toFixed(1)}%) | ` +
      `${tx.toFixed(2)} | ${fixed.size} (${((100 * fixed.size) / text.length).toFixed(1)}%) | ` +
      `${(tx / tf).toFixed(2)}x | ${(fixed.size / fast.size).toFixed(3)}x | ${zlib.gzipSync(text, { level: 1 }).length} |`
  )
}
