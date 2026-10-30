#!/usr/bin/env node
// Times bench/regex/main.ts's cases against a byte-identical copy of its own
// binary, in interleaved rounds, so the noise band is measured on the same
// machine at the same time as the figure it bounds (CLAUDE.md, `Measured:`).
// Every run prints its checksum, and every binary must print the same one for
// a case.
//
// With `--before <nish>`, the program is built a second time by that
// compiler, whose own `std/` it links (a compiler built from `main`, say), and
// that build and its own byte-identical copy run in the same rounds. With
// `--size`, it also prints the linked size of bench/regex/size.ts, a program
// that imports `nish/regex` and uses no property escape, from each compiler.
//
//   node bench/regex/measure.mjs [--rounds 12] [--iterations 200] [--only literal,class]
//                                [--compiler build/nish] [--before <nish>] [--size]
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const after = compilerFrom(process.argv.slice(2))
const rest = after.rest
const flag = (name, fallback) => {
  const at = rest.indexOf(name)
  return at >= 0 && at + 1 < rest.length ? rest[at + 1] : fallback
}
const asked = Number(flag("--rounds", "12"))
const iterations = flag("--iterations", "200")
const before = flag("--before", null)
const only = flag("--only", null)
const CASES = [
  "literal",
  "class",
  "alternation",
  "group",
  "anchored",
  "icase-ascii",
  "icase-class",
  "exec",
  "property",
  "script",
  "icase-unicode",
  "compile-class",
  "compile-icase-class",
  "compile-nonspace-icase",
  "compile-icase-literal",
  "compile-many",
]
const cases = only === null ? CASES : only.split(",")
// The cases a build from before the Unicode features cannot run: it refuses
// `\p{…}` and folds no non-ASCII letter, so they time `after` alone.
const UNICODE = new Set(["property", "script", "icase-unicode"])
const runs = (impl, name) => !(UNICODE.has(name) && impl.label.startsWith("before"))

const outDir = path.join(root, "build", "bench-regex")
fs.rmSync(outDir, { recursive: true, force: true })

/** `program` built by `compiler` into `<outDir>/<name>/`, and a byte-identical copy beside it. */
const build = (compiler, program, name) => {
  const dir = path.join(outDir, name)
  const app = path.join(dir, "app")
  execFileSync(compiler.cmd, [...compiler.prefix, program, "-o", `${dir}/`, "--link", app], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  })
  const copy = path.join(dir, "app-copy")
  fs.copyFileSync(app, copy)
  fs.chmodSync(copy, 0o755)
  return { app, copy }
}

const benchProgram = "bench/regex/main.ts"
const a = build(after, benchProgram, "after")
const impls = [
  { label: "after", exe: a.app },
  { label: "after-copy", exe: a.copy },
]
const beforeCompiler = before === null ? null : compilerFrom(["--compiler", before])
if (beforeCompiler !== null) {
  const b = build(beforeCompiler, benchProgram, "before")
  impls.push({ label: "before", exe: b.app }, { label: "before-copy", exe: b.copy })
}

// A `compile-` pass compiles a few patterns and takes microseconds, so it runs
// this many times more passes than a match case for a timer-worthy run.
const COMPILE_PASSES = 50
const passes = (name) =>
  name.startsWith("compile-") ? String(Number(iterations) * COMPILE_PASSES) : iterations

// The program prints its checksum, then ns per pass: over the 64 KB corpus, or
// for a `compile-` case, of compiling its patterns once.
const run = (exe, name) => {
  const [checksum, timing] = execFileSync(exe, [name, passes(name)], { encoding: "utf8" })
    .trim()
    .split("\n")
  return { checksum, ns: Number.parseFloat(timing) }
}

const rounds = roundsFor(impls.length, asked)
const times = cases.map(() => new Map(impls.map((i) => [i.label, []])))
const sums = cases.map(() => new Set())
for (let r = 0; r < rounds; r++) {
  process.stderr.write(`round ${r + 1} of ${rounds}\n`)
  cases.forEach((name, k) => {
    for (const impl of roundOrder(impls, r).filter((i) => runs(i, name))) {
      const got = run(impl.exe, name)
      sums[k].add(got.checksum)
      times[k].get(impl.label).push(got.ns)
    }
  })
}

const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y)
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const min = (xs) => Math.min(...xs)
const pct = (x, y) => `${((Math.abs(x - y) / y) * 100).toFixed(1)}%`
const us = (ns) => (ns / 1000).toFixed(1)
const out = [
  `${rounds} interleaved rounds of ${impls.length} binaries, ${iterations} passes over 64 KB per run (${passes("compile-")} compiles of a compile- case's patterns)`,
]
cases.forEach((name, k) => {
  const t = times[k]
  out.push("", `${name}: checksum ${[...sums[k]].join(", ")}`)
  if (sums[k].size !== 1) {
    process.exitCode = 1
    out.push("  checksums disagree")
  }
  for (const [label, xs] of [...t].filter(([, ran]) => ran.length > 0)) {
    out.push(`  ${label.padEnd(11)} min ${us(min(xs))} µs/pass, median ${us(median(xs))} µs/pass`)
  }
  const band = (label) =>
    `${label} against its byte-identical copy: min ${pct(min(t.get(label)), min(t.get(`${label}-copy`)))}, median ${pct(median(t.get(label)), median(t.get(`${label}-copy`)))}`
  out.push(`  noise band, ${band("after")}`)
  if (beforeCompiler !== null && t.get("before").length > 0) {
    out.push(`  noise band, ${band("before")}`)
    const ratio = (f) => (f(t.get("before")) / f(t.get("after"))).toFixed(3)
    out.push(`  before / after: min ${ratio(min)}x, median ${ratio(median)}x`)
  }
})

if (rest.includes("--size")) {
  out.push("", "bench/regex/size.ts, linked (bytes):")
  const sized = [["after", after]]
  if (beforeCompiler !== null) {
    sized.push(["before", beforeCompiler])
  }
  for (const [label, compiler] of sized) {
    const exe = build(compiler, "bench/regex/size.ts", `size-${label}`).app
    out.push(`  ${label.padEnd(6)} ${fs.statSync(exe).size}`)
  }
}
process.stdout.write(`${out.join("\n")}\n`)
