#!/usr/bin/env node
// Times nish/json-tokenizer against a byte-identical copy of its own binary,
// in interleaved rounds, so the noise band is measured on the same machine at
// the same time as the figure it bounds (CLAUDE.md, `Measured:`). Every run
// prints its checksum, and every binary must print the same one for a case.
//
// With `--before <nish>`, each program is built a second time by that
// compiler, whose own `std/` it links (a compiler built from `main`, say), and
// that build and its own byte-identical copy run in the same rounds: the change
// between the two compilers' tokenizers, each side with its own noise band.
//
// The cases are bench/json-tokenizer/main.ts, a 242-byte request body tokenized
// `--bodies` times, and with `--corpora` bench/json-compare/main.ts's tokenize
// workload over twitter.json, citm_catalog.json and canada.json and its typed
// workload over citm_catalog.json, `--mb` megabytes of input per run, read
// from bench/json-compare's cache (fetched on first use, so that needs the
// network once). The rounds are bench/json-compare/rounds.mjs's: rounded up
// to a multiple of twice the binaries, every binary in every position equally
// often.
//
//   node bench/json-tokenizer/measure.mjs [--rounds 15] [--bodies 200000] [--compiler build/nish]
//                                         [--before <nish>] [--corpora] [--mb 64]
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
const bodies = flag("--bodies", "200000")
const before = flag("--before", null)
const corpora = rest.includes("--corpora")
const mb = Number(flag("--mb", "64"))

const outDir = path.join(root, "build", "bench-json-tokenizer")
fs.rmSync(outDir, { recursive: true, force: true })

/** `program` built by `compiler` into `<outDir>/<name>/`, and a byte-identical copy beside it. */
const build = (compiler, program, name, extra) => {
  const dir = path.join(outDir, name)
  const app = path.join(dir, "app")
  execFileSync(compiler.cmd, [...compiler.prefix, program, "-o", `${dir}/`, "--link", app, ...extra], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  })
  const copy = path.join(dir, "app-copy")
  fs.copyFileSync(app, copy)
  fs.chmodSync(copy, 0o755)
  return { app, copy }
}

/** Every binary of one program: `after` and its copy, then `before` and its copy when asked for. */
const binaries = (program, name, extra) => {
  const out = []
  const a = build(after, program, `${name}-after`, extra)
  out.push({ label: "after", exe: a.app }, { label: "after-copy", exe: a.copy })
  if (before !== null) {
    const b = build(compilerFrom(["--compiler", before]), program, `${name}-before`, extra)
    out.push({ label: "before", exe: b.app }, { label: "before-copy", exe: b.copy })
  }
  return out
}

// The body bench prints its checksum, then ns per body.
const bodyRun = (exe) => {
  const [checksum, timing] = execFileSync(exe, [bodies], { encoding: "utf8" }).trim().split("\n")
  return { checksum, ns: Number.parseFloat(timing) }
}
const cases = [
  {
    name: "bench/json-tokenizer, the 242-byte body",
    unit: "ns/body",
    bytes: 0,
    impls: binaries("bench/json-tokenizer/main.ts", "body", []),
    run: bodyRun,
  },
]

if (corpora) {
  fetchAll([])
  const compare = binaries("bench/json-compare/main.ts", "compare", ["--profile", "speed"])
  const isDigit = (b) => b >= 0x30 && b <= 0x39
  // The digits each iteration rewrites, as run.mjs picks them, so no iteration reads the input the one before did.
  const tokenizeAt = (doc) => {
    for (let i = doc.length - 1; i > 0; i--) {
      if (isDigit(doc[i]) && isDigit(doc[i - 1])) {
        return i
      }
    }
    return -1
  }
  const startAt = (doc) => {
    const text = doc.toString("latin1")
    const from = Math.max(0, text.indexOf('"performances"'))
    const match = /"start"\s*:\s*\d+/.exec(text.slice(from))
    return match === null ? -1 : from + match.index + match[0].length - 1
  }
  for (const [workload, corpus] of [
    ["tokenize", "twitter.json"],
    ["tokenize", "citm_catalog.json"],
    ["tokenize", "canada.json"],
    ["typed", "citm_catalog.json"],
  ]) {
    const file = path.join(CACHE, "corpus", corpus)
    const doc = fs.readFileSync(file)
    const iterations = Math.max(1, Math.round((mb * 1024 * 1024) / doc.length))
    const at = workload === "typed" ? startAt(doc) : tokenizeAt(doc)
    cases.push({
      name: `${workload}, ${corpus}`,
      unit: "ns/doc",
      bytes: doc.length,
      impls: compare,
      // The program prints its checksum line, then `ns <elapsed>` for every iteration together.
      run: (exe) => {
        const [checksum, timing] = execFileSync(exe, [workload, file, String(iterations), String(at)], {
          encoding: "utf8",
        })
          .trim()
          .split("\n")
        return { checksum, ns: Number(/^ns (\d+)$/.exec(timing)[1]) / iterations }
      },
    })
  }
}

const n = cases[0].impls.length
const rounds = roundsFor(n, asked)
const times = cases.map((c) => new Map(c.impls.map((i) => [i.label, []])))
const sums = cases.map(() => new Set())
for (let r = 0; r < rounds; r++) {
  process.stderr.write(`round ${r + 1} of ${rounds}\n`)
  cases.forEach((c, k) => {
    for (const impl of roundOrder(c.impls, r)) {
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
const out = [`${rounds} interleaved rounds of ${n} binaries`]
cases.forEach((c, k) => {
  const t = times[k]
  out.push("", `${c.name}: checksum ${[...sums[k]].join(", ")}`)
  if (sums[k].size !== 1) {
    process.exitCode = 1
    out.push("  checksums disagree")
  }
  for (const [label, xs] of t) {
    const rate = c.bytes > 0 ? `, ${((c.bytes / min(xs)) * 1000).toFixed(0)} MB/s (min)` : ""
    out.push(
      `  ${label.padEnd(11)} min ${min(xs).toFixed(0)} ${c.unit}, median ${median(xs).toFixed(0)} ${c.unit}${rate}`
    )
  }
  const band = (label) =>
    `${label} against its byte-identical copy: min ${pct(min(t.get(label)), min(t.get(`${label}-copy`)))}, median ${pct(median(t.get(label)), median(t.get(`${label}-copy`)))}`
  out.push(`  noise band, ${band("after")}`)
  if (before !== null) {
    out.push(`  noise band, ${band("before")}`)
    const ratio = (f) => (f(t.get("before")) / f(t.get("after"))).toFixed(2)
    out.push(`  before / after: min ${ratio(min)}x, median ${ratio(median)}x`)
  }
})
process.stdout.write(`${out.join("\n")}\n`)
