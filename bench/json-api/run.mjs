// What `jsonEncode` costs to write one page of an API-style user listing
// (`main.ts`: twenty users with a nested address, a role array, numbers,
// booleans and nulls) into one reused buffer, minified, and how much of a
// difference this machine can see at all. Before it times anything it prints
// the page once and checks it against `expected.json` byte for byte.
//
//   npm run build && node bench/json-api/run.mjs [--rounds N] [--count N] [--compiler <nish>] [--base <nish>]
//     --rounds N  timed rounds, rounded up to a multiple of the binaries so
//                 each goes first equally often (default 16), after one
//                 uncounted warm-up round
//     --count N   pages per run (default 200,000)
//     --base <nish>  also build `main.ts` with this compiler (another
//                 checkout's, say `main`'s) and time it in the same rounds,
//                 so a change is read against its base inside one band;
//                 its page and checksums must be the build's, byte for byte,
//                 and the band is then the base timed against its own copy
//
// The rounds are bench/json-writer/run.mjs's: the build and a byte-identical
// copy (with `--base`, the base and the base's copy) alternate, each going
// first equally often, and the copy is the noise band, so a change is a gain
// or a loss only outside it. The report is ns per page, min and median.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { resolveSeed } from "../../tests/self/seed.js"
import { compilerFrom } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const outDir = path.join(root, "build", "bench", "json-api")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/json-api/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 16
let count = 200000
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
      path.join(root, "bench", "json-api", "main.ts"),
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

const expected = fs.readFileSync(path.join(root, "bench", "json-api", "expected.json"))
const bins = baseSpec === null ? [exe, copy] : [exe, base, copy]
for (const bin of bins) {
  const r = spawnSync(bin, ["0", "print"])
  if (r.status !== 0 || !r.stdout.equals(expected)) {
    fail(`${bin} exited ${r.status} and did not print expected.json byte for byte`)
  }
}

/** One run: its checksum line without the time, and its ns per page. */
const runOnce = (bin) => {
  const r = spawnSync(bin, [String(count)], { encoding: "utf8" })
  const m = /^checksum (\d+) bytes (\d+) ns (\d+)$/.exec(r.stdout.trim())
  if (r.status !== 0 || m === null) {
    fail(`${bin} exited ${r.status} printing ${JSON.stringify(r.stdout)}${r.stderr}`)
  }
  return { answer: `checksum ${m[1]} bytes ${m[2]}`, ns: Number(m[3]) / count }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Index 0 is the build; the last is the banded binary's copy, and with a base
// index 1 is the base. Round 0 warms every binary and is not counted.
const times = bins.map(() => [])
let answer = null
const timed = Math.ceil(rounds / bins.length) * bins.length
for (let round = 0; round <= timed; round++) {
  for (const k of bins.map((_, j) => (j + round) % bins.length)) {
    const r = runOnce(bins[k])
    if (answer !== null && r.answer !== answer) {
      fail(`round ${round}: ${bins[k]} printed ${r.answer}, not ${answer}`)
    }
    answer = r.answer
    if (round > 0) {
      times[k].push(r.ns)
    }
  }
}

const row = (label, ts) =>
  `${label.padEnd(15)} min ${Math.min(...ts).toFixed(1)} ns/page, median ${median(ts).toFixed(1)} ns/page`
const band = (f) => {
  const a = baseSpec === null ? times[0] : times[1]
  const b = times[bins.length - 1]
  return (Math.abs(f(a) - f(b)) / f(a)) * 100
}
const who = baseSpec === null ? "build" : "base"
console.log(`json-api: ${count} pages a run, ${timed} rounds, ${answer}`)
console.log(row("build", times[0]))
if (baseSpec !== null) {
  console.log(row("base", times[1]))
}
console.log(row(`${who} copy`, times[bins.length - 1]))
console.log(
  `noise band (${who} against its byte-identical copy): min ${band((xs) => Math.min(...xs)).toFixed(1)}%, median ${band(median).toFixed(1)}%`
)
if (baseSpec !== null) {
  const change = (f) => (((f(times[1]) - f(times[0])) / f(times[1])) * 100).toFixed(1)
  console.log(
    `build against base: min ${change((xs) => Math.min(...xs))}% faster, median ${change(median)}% faster, x${(median(times[1]) / median(times[0])).toFixed(2)}`
  )
}
