// WP34 N11: what `JsonWriter` costs to write the TechEmpower `/json` body,
// `{"message":"…"}`, into one reused buffer, minified and indented by two
// spaces (`setIndent(2)`), and how much of a difference this machine can see
// at all.
//
//   npm run build && node bench/json-writer/run.mjs [--rounds N] [--count N] [--compiler <nish>]
//     --rounds N  timed rounds, rounded up to an even count so each binary
//                 goes first in half of them (default 16), after one
//                 uncounted warm-up round
//     --count N   writes per run (default 2,000,000)
//
// `main.ts` beside this file is built once with `--link` (the speed profile)
// and copied byte for byte. The build and its copy run in alternating rounds,
// each going first in half of them, so a slow stretch of a shared machine
// falls on both. Each run times its own loop with `monotonicNanos` and prints
// it with a checksum of every byte written; every run of a mode must print the
// same checksum. The report is ns per write, min and median over the rounds,
// for the build and the copy in each mode, the two modes interleaved within
// each round too. The copy is the noise band: two byte-identical
// binaries differ only by what the machine did to them, so a change to the
// writer is a gain or a loss only outside that band.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

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
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--count") {
    count = Number(argv[++i])
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
const copy = path.join(outDir, "app-copy")
const built = spawnSync(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(root, "bench", "json-writer", "main.ts"),
    "-o",
    `${outDir}${path.sep}`,
    "--link",
    exe,
  ],
  { cwd: root, encoding: "utf8" }
)
if (built.status !== 0) {
  fail(`the build failed (exit ${built.status})\n${built.stderr}`)
}
fs.copyFileSync(exe, copy)
if (!fs.readFileSync(exe).equals(fs.readFileSync(copy))) {
  fail("the copy is not byte-identical to the build")
}

const MODES = ["minified", "pretty"]

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

const bins = [exe, copy]
const times = MODES.map(() => [[], []])
const answers = MODES.map(() => null)
// Round 0 warms both and is not counted. An even count of timed rounds, so
// each binary goes first equally often.
const timed = rounds + (rounds % 2)
for (let round = 0; round <= timed; round++) {
  for (let m = 0; m < MODES.length; m++) {
    for (const k of round % 2 === 0 ? [0, 1] : [1, 0]) {
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
const band = (ts, f) => (Math.abs(f(ts[0]) - f(ts[1])) / f(ts[0])) * 100
console.log(`json-writer: ${count} writes a run, ${timed} rounds`)
for (let m = 0; m < MODES.length; m++) {
  const ts = times[m]
  console.log(`${MODES[m]}: ${answers[m]}`)
  console.log(row(`${MODES[m]} build`, ts[0]))
  console.log(row(`${MODES[m]} copy`, ts[1]))
  console.log(
    `${MODES[m]} noise band (build against its byte-identical copy): min ${band(ts, (xs) => Math.min(...xs)).toFixed(1)}%, median ${band(ts, median).toFixed(1)}%`
  )
}
