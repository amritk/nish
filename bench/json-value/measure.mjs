#!/usr/bin/env node
// Times `JsonDocument.parse` with ranges off and with ranges on, each against a
// byte-identical copy of its own binary, in interleaved rounds, so the noise
// band is measured on the same machine at the same time as the figure it
// bounds (CLAUDE.md, `Measured:`). Every run prints its checksum, and every
// binary must print the same one for a document.
//
// With `--before <nish>`, the ranges-off program is built a second time by that
// compiler, whose own `std/` it links (a compiler built from `main`, say), and
// that build and its copy run in the same rounds: what the change costs a parse
// that keeps no ranges. The ranges-on program needs `keepRanges`, so only the
// compiler under test builds it.
//
// The documents are bench/json-compare's corpora, twitter.json,
// citm_catalog.json and canada.json (fetched into its cache on first use, so
// that needs the network once), `--mb` megabytes of input per run, and
// bench/json-compare/sample.json. The rounds are bench/json-compare/rounds.mjs's.
//
//   node bench/json-value/measure.mjs [--rounds 15] [--mb 64] [--compiler build/nish] [--before <nish>]
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { CACHE, fetchAll } from "../json-compare/fetch.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const after = compilerFrom(process.argv.slice(2))
const rest = after.rest
const flag = (name, fallback) => {
  const at = rest.indexOf(name)
  return at >= 0 && at + 1 < rest.length ? rest[at + 1] : fallback
}
const asked = Number(flag("--rounds", "15"))
const before = flag("--before", null)
const mb = Number(flag("--mb", "64"))

const outDir = path.join(root, "build", "bench-json-value")
fs.rmSync(outDir, { recursive: true, force: true })

/** `program` built by `compiler` into `<outDir>/<name>/`, as `label` and a byte-identical copy beside it. */
const build = (compiler, program, name, label) => {
  const dir = path.join(outDir, name)
  const app = path.join(dir, "app")
  execFileSync(
    compiler.cmd,
    [...compiler.prefix, program, "-o", `${dir}/`, "--link", app, "--profile", "speed"],
    {
      cwd: root,
      stdio: ["ignore", "ignore", "inherit"],
    }
  )
  const copy = path.join(dir, "app-copy")
  fs.copyFileSync(app, copy)
  fs.chmodSync(copy, 0o755)
  return [
    { label, exe: app },
    { label: `${label}-copy`, exe: copy },
  ]
}

const impls = [
  ...build(after, "bench/json-value/main.ts", "off-after", "off"),
  ...build(after, "bench/json-value/ranged.ts", "on-after", "on"),
]
if (before !== null) {
  impls.push(
    ...build(compilerFrom(["--compiler", before]), "bench/json-value/main.ts", "off-before", "before")
  )
}

fetchAll([])
const isDigit = (b) => b >= 0x30 && b <= 0x39
// The last digit that follows another, as bench/json-compare/run.mjs picks the one it rewrites.
const digitAt = (doc) => {
  for (let i = doc.length - 1; i > 0; i--) {
    if (isDigit(doc[i]) && isDigit(doc[i - 1])) {
      return i
    }
  }
  return -1
}
const files = [
  ...["twitter.json", "citm_catalog.json", "canada.json"].map((f) => path.join(CACHE, "corpus", f)),
  path.join(root, "bench", "json-compare", "sample.json"),
]
const cases = files.map((file) => {
  const doc = fs.readFileSync(file)
  const iterations = Math.max(1, Math.round((mb * 1024 * 1024) / doc.length))
  const at = digitAt(doc)
  return {
    name: path.basename(file),
    bytes: doc.length,
    // The program prints its checksum line, then `ns <elapsed>` for every iteration together.
    run: (exe) => {
      const [checksum, timing] = execFileSync(exe, [file, String(iterations), String(at)], {
        encoding: "utf8",
      })
        .trim()
        .split("\n")
      return { checksum, ns: Number(/^ns (\d+)$/.exec(timing)[1]) / iterations }
    },
  }
})

const rounds = roundsFor(impls.length, asked)
const times = cases.map(() => new Map(impls.map((i) => [i.label, []])))
const sums = cases.map(() => new Set())
for (let r = 0; r < rounds; r++) {
  process.stderr.write(`round ${r + 1} of ${rounds}\n`)
  cases.forEach((c, k) => {
    for (const impl of roundOrder(impls, r)) {
      const got = c.run(impl.exe)
      sums[k].add(got.checksum)
      times[k].get(impl.label).push(got.ns)
    }
  })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const min = (xs) => Math.min(...xs)
const pct = (a, b) => `${((Math.abs(a - b) / b) * 100).toFixed(1)}%`
const out = [`${rounds} interleaved rounds of ${impls.length} binaries`]
cases.forEach((c, k) => {
  const t = times[k]
  out.push("", `${c.name}, ${c.bytes} bytes: checksum ${[...sums[k]].join(", ")}`)
  if (sums[k].size !== 1) {
    process.exitCode = 1
    out.push("  checksums disagree")
  }
  for (const [label, xs] of t) {
    const rate = ((c.bytes / min(xs)) * 1000).toFixed(0)
    out.push(
      `  ${label.padEnd(11)} min ${min(xs).toFixed(0)} ns/doc, median ${median(xs).toFixed(0)} ns/doc, ${rate} MB/s (min)`
    )
  }
  for (const label of before === null ? ["off", "on"] : ["off", "on", "before"]) {
    out.push(
      `  noise band, ${label} against its byte-identical copy: min ${pct(min(t.get(label)), min(t.get(`${label}-copy`)))}, median ${pct(median(t.get(label)), median(t.get(`${label}-copy`)))}`
    )
  }
  const ratio = (a, b, f) => (f(t.get(a)) / f(t.get(b))).toFixed(3)
  out.push(`  on / off: min ${ratio("on", "off", min)}x, median ${ratio("on", "off", median)}x`)
  if (before !== null) {
    out.push(`  off / before: min ${ratio("off", "before", min)}x, median ${ratio("off", "before", median)}x`)
  }
})
process.stdout.write(`${out.join("\n")}\n`)
