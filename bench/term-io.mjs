#!/usr/bin/env node
// What a frame of `nish/term-io` costs, for the `Measured:` line of a change
// to it. It builds bench/term-io.ts with `--profile speed`, runs its
// `present` mode under the fake terminal tests/term-io/relay.mjs plays (200×60
// cells, a 480×270 framebuffer) once per backend per round with
// `NISH_TERM_GRAPHICS` forcing it, and its `controller` mode once per round,
// and prints each row's median over the rounds and the spread of the rounds.
//
//   npm run build && node bench/term-io.mjs [--runs N] [--compiler <nish>]
//     --runs N   rounds (default 5)
//
// A `present` figure is the median of one run's 200 frames, the 90th
// percentile beside it; the round spread is the noise band to quote. The
// time is `present` alone, waiting for each frame's answer outside it: the
// drawing, the encoding and the one write into the pseudo-terminal.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { relay } from "../tests/term-io/relay.mjs"
import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "build", "bench", "term-io")
const nishc = compilerFrom(process.argv)
const runsAt = nishc.rest.indexOf("--runs")
const runs = runsAt >= 0 ? Number(nishc.rest[runsAt + 1]) : 5

const fail = (msg) => {
  console.error(`bench/term-io: ${msg}`)
  process.exit(1)
}

if (process.platform !== "linux") {
  fail("needs Linux: the relay finds the program through /proc")
}
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "app")
const built = spawnSync(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(root, "bench", "term-io.ts"),
    "-o",
    outDir + path.sep,
    "--link",
    exe,
    "--profile",
    "speed",
  ],
  { encoding: "utf8" }
)
if (built.status !== 0) {
  fail(`build failed:\n${built.stdout}${built.stderr}`)
}

const BACKENDS = ["kitty", "sixel", "halfblock", "ascii"]
// The `GRAPHICS_*` each name forces, which the program prints as `backend N`.
const GRAPHICS = { ascii: 0, halfblock: 1, sixel: 2, kitty: 3 }
const rows = new Map([...BACKENDS.map((b) => [b, []]), ["controller", []]])
for (let round = 0; round < runs; round++) {
  for (const backend of BACKENDS) {
    const r = await relay(exe, "present", {
      dir: path.join(outDir, "runs", backend),
      env: { NISH_TERM_GRAPHICS: backend },
      timeoutMs: 120000,
    })
    const m = /present (\S+) (\S+) backend (\d+) bytes (\S+)/.exec(r.out)
    if (r.status !== 0 || m === null) {
      fail(`${backend}: exit ${r.status}\n${r.err}${r.scriptErr}`)
    }
    if (Number(m[3]) !== GRAPHICS[backend]) {
      fail(
        `${backend}: drew with backend ${m[3]}, not ${GRAPHICS[backend]}, so its row would time another backend`
      )
    }
    rows.get(backend).push({ median: Number(m[1]), p90: Number(m[2]), bytes: Number(m[4]) })
  }
  const c = spawnSync(exe, ["controller"], { encoding: "utf8" })
  const m = /controller (\S+)/.exec(c.stdout)
  if (c.status !== 0 || m === null) {
    fail(`controller: exit ${c.status}\n${c.stderr}`)
  }
  rows.get("controller").push({ median: Number(m[1]), p90: Number.NaN, bytes: Number.NaN })
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}
const us = (ns) => (Number.isNaN(ns) ? "" : (ns / 1000).toFixed(ns < 1000 ? 3 : 1))
console.log(
  `${runs} rounds; µs a frame (median of the rounds, the rounds' range, the median p90), pixel bytes a frame`
)
for (const [name, xs] of rows) {
  const ms = xs.map((x) => x.median)
  const spread = `${us(Math.min(...ms))}–${us(Math.max(...ms))}`
  const bytes = Number.isNaN(xs[0].bytes) ? "" : Math.round(median(xs.map((x) => x.bytes)))
  console.log(
    [
      name.padEnd(11),
      us(median(ms)).padStart(9),
      spread.padStart(17),
      us(median(xs.map((x) => x.p90))).padStart(9),
      String(bytes).padStart(9),
    ].join(" ")
  )
}
