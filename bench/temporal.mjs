#!/usr/bin/env node
// WP64: nish/temporal's hot operations, one column per compiler (and so per
// copy of std/, which a compiler reads from beside its own binary). It builds
// bench/temporal.ts with each column's `nish`, runs them in interleaved
// rounds, and prints each workload's median ns/op with the spread over rounds.
//
//   node bench/temporal.mjs [options] --column name=<nish> [--column name=<nish> ...]
//     --runs N    timed rounds (default 7); each round runs every column once,
//                 the order rotating so each goes first equally often
//     --check     one short run per column; exit 0 when every checksum agrees
//
// A column is a compiler binary: to compare two versions of std/temporal.ts,
// put a copy of build/nish in each tree's build/ and name both. Every run must
// print the same checksum, or the bench stops: two columns that answer
// differently are not timing the same work. Two columns naming the same
// compiler give the noise band.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { withAllowPanics } from "../tests/allow-panics.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "temporal")

const fail = (msg) => {
  console.error(`bench/temporal.mjs: ${msg}`)
  process.exit(2)
}

const argv = process.argv.slice(2)
const columns = []
let runs = 7
let check = false
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--column") {
    const [name, nish] = (argv[++i] ?? "").split("=")
    if (!name || !nish) {
      fail("--column takes name=<path to nish>")
    }
    columns.push({ name, nish: path.resolve(nish) })
  } else if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--check") {
    check = true
  } else {
    fail(`unknown argument ${argv[i]}`)
  }
}
if (columns.length === 0) {
  columns.push({ name: "head", nish: path.join(root, "build", "nish") })
}

for (const c of columns) {
  const dir = path.join(outDir, c.name)
  fs.mkdirSync(dir, { recursive: true })
  c.exe = path.join(dir, "temporal")
  execFileSync(
    c.nish,
    withAllowPanics(c.nish, [
      path.join(root, "bench", "temporal.ts"),
      "-o",
      `${dir}/`,
      "--link",
      c.exe,
      "--profile",
      "speed",
      "--no-warn-performance",
    ]),
    { stdio: ["ignore", "ignore", "inherit"] }
  )
}

/** One run of `c`: its checksum line and each workload's ns/op. */
const runOnce = (c, scale) => {
  const r = spawnSync(c.exe, scale === 1 ? [] : [String(scale)], { encoding: "utf8" })
  if (r.status !== 0) {
    fail(`${c.name} exited ${r.status}: ${r.stderr}`)
  }
  const times = new Map()
  for (const line of r.stderr.split("\n")) {
    const [tag, name, ns, ops] = line.split(" ")
    if (tag === "time") {
      times.set(name, Number(ns) / Number(ops))
    }
  }
  return { checksum: r.stdout.trim(), times }
}

if (check) {
  const sums = columns.map((c) => runOnce(c, 100).checksum)
  const same = sums.every((s) => s === sums[0])
  console.log(same ? `ok: ${sums[0]}` : `checksums differ: ${sums.join(" / ")}`)
  process.exit(same ? 0 : 1)
}

const samples = columns.map(() => new Map())
let expected = null
for (let round = 0; round < runs; round++) {
  for (let k = 0; k < columns.length; k++) {
    const at = (k + round) % columns.length
    const got = runOnce(columns[at], 1)
    expected ??= got.checksum
    if (got.checksum !== expected) {
      fail(`${columns[at].name} printed ${got.checksum}, not ${expected}`)
    }
    for (const [name, v] of got.times) {
      samples[at].set(name, [...(samples[at].get(name) ?? []), v])
    }
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const cell = (xs) => `${median(xs).toFixed(1)} (${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)})`
console.log(`ns/op, median (min–max) of ${runs} interleaved rounds; ${expected}`)
console.log(["workload", ...columns.map((c) => c.name)].join(" | "))
for (const name of samples[0].keys()) {
  const row = [name, ...samples.map((s) => cell(s.get(name)))]
  if (columns.length === 2) {
    const ratio = median(samples[0].get(name)) / median(samples[1].get(name))
    row.push(`${columns[0].name}/${columns[1].name} ${ratio.toFixed(2)}x`)
  }
  console.log(row.join(" | "))
}
