// WP34 N11: what `JsonWriter` costs to write the TechEmpower `/json` body,
// `{"message":"…"}`, into one reused buffer, minified and indented by two
// spaces (`setIndent(2)`), and an array of eight doubles (`f64`, the path
// `nish_json_put_f64` writes natively), and how much of a difference this
// machine can see at all.
//
//   npm run build && node bench/json-writer/run.mjs [--rounds N] [--count N] [--compiler <nish>] [--base <nish>]
//     --rounds N  timed rounds, rounded up to a multiple of the binaries so
//                 each goes first equally often (default 16), after one
//                 uncounted warm-up round
//     --count N   writes per run (default 2,000,000)
//     --base <nish>  also build `main.ts` with this compiler (another
//                 checkout's, say `main`'s) and time it in the same rounds,
//                 so a change is read against its base inside one band;
//                 its checksums must be the build's, byte for byte, and the
//                 band is then the base timed against its own copy
//
// `main.ts` beside this file is built once with `--link` (the speed profile)
// and copied byte for byte. The build and its copy run in alternating rounds,
// each going first in half of them, so a slow stretch of a shared machine
// falls on both. Each run times its own loop with `monotonicNanos` and prints
// it with a checksum of every byte written; every run of a mode must print the
// same checksum. The report is ns per write, min and median over the rounds,
// for the build and the copy in each mode, the modes interleaved within
// each round too. The copy is the noise band: two byte-identical
// binaries differ only by what the machine did to them, so a change to the
// writer is a gain or a loss only outside that band. With `--base` the copy
// is the base's, so the band is the baseline's, as `.claude/testing.md` asks,
// and the build is read against the base.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { resolveSeed } from "../../tests/self/seed.js"
import { compilerFrom } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const outDir = path.join(root, "build", "bench", "json-writer")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/json-writer/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 16
let count = 2000000
let baseSpec = null
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--count") {
    count = Number(argv[++i])
  } else if (argv[i] === "--base" && argv[i + 1] !== undefined) {
    baseSpec = path.resolve(argv[++i])
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(rounds >= 2 && count >= 1)) {
  fail("--rounds needs at least 2 and --count at least 1")
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "app")
const base = path.join(outDir, "app-base")
// The binary the band copies: the base with `--base`, else the build.
const banded = baseSpec === null ? exe : base
const copy = path.join(outDir, baseSpec === null ? "app-copy" : "app-base-copy")
/** Build `main.ts` with `compiler` (`{ cmd, prefix }`) into `bin`. */
const build = (compiler, bin, label) => {
  const dir = path.join(outDir, label)
  fs.mkdirSync(dir, { recursive: true })
  const built = spawnSync(
    compiler.cmd,
    [
      ...compiler.prefix,
      path.join(root, "bench", "json-writer", "main.ts"),
      "-o",
      `${dir}${path.sep}`,
      "--link",
      bin,
    ],
    { cwd: root, encoding: "utf8" }
  )
  if (built.status !== 0) {
    fail(`the ${label} build failed (exit ${built.status})\n${built.stderr}`)
  }
}
build(nishc, exe, "build")
if (baseSpec !== null) {
  const baseCompiler = resolveSeed(baseSpec)
  if (baseCompiler.error !== undefined) {
    fail(`--base: ${baseCompiler.error}`)
  }
  build(baseCompiler, base, "base")
}
fs.copyFileSync(banded, copy)
if (!fs.readFileSync(banded).equals(fs.readFileSync(copy))) {
  fail(`the copy is not byte-identical to ${banded}`)
}

const MODES = ["minified", "pretty", "f64"]

/** One run in `mode`: its checksum line without the time, and its ns per write. */
const runOnce = (bin, mode) => {
  const r = spawnSync(bin, [String(count), mode], { encoding: "utf8" })
  const m = /^checksum (\d+) failed (-?\d+) count (\d+) ns (\d+)$/.exec(r.stdout.trim())
  if (r.status !== 0 || m === null || m[2] !== "0") {
    fail(`${bin} exited ${r.status} printing ${JSON.stringify(r.stdout)}${r.stderr}`)
  }
  return { answer: `checksum ${m[1]} count ${m[3]}`, ns: Number(m[4]) / count }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Index 0 is the build; 1 and 2 are the banded binary and its copy (with no
// base the build is banded, so 1 is only the copy).
const bins = baseSpec === null ? [exe, copy] : [exe, base, copy]
const times = MODES.map(() => bins.map(() => []))
const answers = MODES.map(() => null)
// Round 0 warms every binary and is not counted. The order turns each round,
// and the timed rounds are a multiple of the binaries, so each goes first
// equally often.
const timed = Math.ceil(rounds / bins.length) * bins.length
for (let round = 0; round <= timed; round++) {
  for (let m = 0; m < MODES.length; m++) {
    for (const k of bins.map((_, j) => (j + round) % bins.length)) {
      const r = runOnce(bins[k], MODES[m])
      if (answers[m] !== null && r.answer !== answers[m]) {
        fail(`round ${round}: ${bins[k]} ${MODES[m]} printed ${r.answer}, not ${answers[m]}`)
      }
      answers[m] = r.answer
      if (round > 0) {
        times[m][k].push(r.ns)
      }
    }
  }
}

const row = (label, ts) =>
  `${label.padEnd(15)} min ${Math.min(...ts).toFixed(1)} ns/op, median ${median(ts).toFixed(1)} ns/op`
// The band: the banded binary against its copy, the last of `bins`.
const band = (ts, f) => {
  const a = baseSpec === null ? ts[0] : ts[1]
  const b = ts[bins.length - 1]
  return (Math.abs(f(a) - f(b)) / f(a)) * 100
}
const who = baseSpec === null ? "build" : "base"
console.log(`json-writer: ${count} writes a run, ${timed} rounds`)
for (let m = 0; m < MODES.length; m++) {
  const ts = times[m]
  console.log(`${MODES[m]}: ${answers[m]}`)
  console.log(row(`${MODES[m]} build`, ts[0]))
  if (baseSpec !== null) {
    console.log(row(`${MODES[m]} base`, ts[1]))
  }
  console.log(row(`${MODES[m]} ${who} copy`, ts[bins.length - 1]))
  console.log(
    `${MODES[m]} noise band (${who} against its byte-identical copy): min ${band(ts, (xs) => Math.min(...xs)).toFixed(1)}%, median ${band(ts, median).toFixed(1)}%`
  )
  if (baseSpec !== null) {
    const change = (f) => (((f(ts[1]) - f(ts[0])) / f(ts[1])) * 100).toFixed(1)
    console.log(
      `${MODES[m]} build against base: min ${change((xs) => Math.min(...xs))}% faster, median ${change(median)}% faster, x${(median(ts[1]) / median(ts[0])).toFixed(2)}`
    )
  }
}
