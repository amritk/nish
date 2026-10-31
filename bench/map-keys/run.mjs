#!/usr/bin/env node
// Map operations by integer, enum and string key, one binary per compiler.
//
//   node bench/map-keys/run.mjs [--rounds N] [--scale N] [--rustc path] [--compiler label=path]...
//
// Builds bench/map-keys/main.ts with each `--compiler` (default: `head` =
// build/nish and `0.28.0` = build/rel028/bin/nish, which `scripts/fetch-seed.sh
// 0.28.0` and a copy of build/seed give) at `--profile speed`, and links a
// byte-identical copy of the first one's binary as `<label>-copy`: the
// baseline timed against itself in the same interleaved rounds is the noise
// band. It builds fx.rs with `--rustc` (default: `rustc`, then
// ~/.cargo/bin/rustc) as `rust-fx`, Rust's `HashMap` under `FxHasher`, and
// leaves that column out when there is no rustc. It runs the binaries in turn,
// rotating which goes first, `--rounds` times (default 9), each run 2^23 times
// `--scale` operations per row (default 1), and reports each row's median ns
// per operation and its ratio to the first compiler; `-` is a row a binary
// does not have. A checksum that differs between binaries fails the run.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "map-keys")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const rounds = Number(flag("--rounds", "9"))
const scale = flag("--scale", "1")
const given = process.argv.flatMap((a, i) => (a === "--compiler" ? [process.argv[i + 1]] : []))
const compilers = (
  given.length > 0
    ? given
    : [
        `head=${path.join(root, "build", "nish")}`,
        `0.28.0=${path.join(root, "build", "rel028", "bin", "nish")}`,
      ]
).map((spec) => {
  const at = spec.indexOf("=")
  return { label: spec.slice(0, at), compiler: path.resolve(spec.slice(at + 1)) }
})

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
const binaries = []
for (const { label, compiler } of compilers) {
  const dir = path.join(out, label)
  fs.mkdirSync(dir, { recursive: true })
  const exe = path.join(dir, "map-keys")
  run(compiler, [path.join(here, "main.ts"), "-o", `${dir}/`, "--profile", "speed", "--link", exe])
  binaries.push({ label, exe })
}
const copy = path.join(out, `${binaries[0].label}-copy`)
fs.copyFileSync(binaries[0].exe, copy)
fs.chmodSync(copy, 0o755)
binaries.splice(1, 0, { label: `${binaries[0].label}-copy`, exe: copy })
const rustc = [flag("--rustc", "rustc"), path.join(os.homedir(), ".cargo", "bin", "rustc")].find(
  (cmd) => spawnSync(cmd, ["--version"]).status === 0
)
if (rustc) {
  const exe = path.join(out, "rust-fx")
  run(rustc, [
    "-C",
    "opt-level=3",
    "-C",
    "codegen-units=1",
    "-C",
    "panic=abort",
    path.join(here, "fx.rs"),
    "-o",
    exe,
  ])
  binaries.push({ label: "rust-fx", exe })
} else {
  process.stderr.write("bench/map-keys: no rustc, so no rust-fx column\n")
}

// label -> row -> ns per op, one per round
const times = new Map(binaries.map((b) => [b.label, new Map()]))
const sums = new Map()
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < binaries.length; k++) {
    const { label, exe } = binaries[(r + k) % binaries.length]
    for (const line of run(exe, [scale]).trim().split("\n")) {
      const [row, ns, ops, sum] = line.split(" ")
      if (sums.has(row) && sums.get(row) !== sum) {
        process.stderr.write(`bench/map-keys: ${label} ${row} checksum ${sum}, expected ${sums.get(row)}\n`)
        process.exit(1)
      }
      sums.set(row, sum)
      const rows = times.get(label)
      rows.set(row, [...(rows.get(row) ?? []), Number(ns) / Number(ops)])
    }
  }
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const rows = [...times.get(binaries[0].label).keys()]
console.log(`${rounds} rounds at scale ${scale}; median ns per operation (ratio to ${binaries[0].label})\n`)
console.log(`| row | ${binaries.map((b) => b.label).join(" | ")} |`)
console.log(`| --- |${binaries.map(() => " --- |").join("")}`)
for (const row of rows) {
  const base = median(times.get(binaries[0].label).get(row))
  const cells = binaries.map((b) => {
    if (!times.get(b.label).has(row)) {
      return "-"
    }
    const m = median(times.get(b.label).get(row))
    return `${m.toFixed(2)} (${(m / base).toFixed(3)})`
  })
  console.log(`| ${row} | ${cells.join(" | ")} |`)
}
