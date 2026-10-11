// WP34 N11: what `JsonWriter` costs to write the TechEmpower `/json` body,
// `{"message":"…"}`, into one reused buffer, and how much of a difference this
// machine can see at all.
//
//   npm run build && node bench/json-writer/run.mjs [--rounds N] [--count N] [--compiler <nish>]
//     --rounds N  timed rounds after one warm-up round (default 15)
//     --count N   writes per run (default 2,000,000)
//
// `main.ts` beside this file is built once with `--link` (the speed profile)
// and copied byte for byte. The build and its copy run in alternating rounds,
// each going first in half of them, so a slow stretch of a shared machine
// falls on both. Each run times its own loop with `monotonicNanos` and prints
// it with a checksum of every byte written; every run must print the same
// checksum. The report is ns per write, min and median over the rounds, for
// the build and the copy. The copy is the noise band: two byte-identical
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

let rounds = 15
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

/** One run: its checksum line without the time, and its ns per write. */
const runOnce = (bin) => {
  const r = spawnSync(bin, [String(count)], { encoding: "utf8" })
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
const times = [[], []]
let answer = null
// Round 0 warms both and is not counted. An even count of timed rounds, so
// each binary goes first equally often.
const timed = rounds + (rounds % 2)
for (let round = 0; round <= timed; round++) {
  for (const k of round % 2 === 0 ? [0, 1] : [1, 0]) {
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
  `${label.padEnd(6)} min ${Math.min(...ts).toFixed(1)} ns/op, median ${median(ts).toFixed(1)} ns/op`
const band = (f) => (Math.abs(f(times[0]) - f(times[1])) / f(times[0])) * 100
console.log(`json-writer: ${count} writes a run, ${timed} rounds, ${answer}`)
console.log(row("build", times[0]))
console.log(row("copy", times[1]))
console.log(
  `noise band (build against its byte-identical copy): min ${band((ts) => Math.min(...ts)).toFixed(1)}%, median ${band(median).toFixed(1)}%`
)
