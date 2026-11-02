/**
 * The generator experiment: is `bcryptBodyN` faster with its 8 round pairs
 * written out (`gen-body.mjs --unroll`: literal P indexes, no counter to keep
 * in a register)? Three copies of `std/crypto/bcrypt.ts` are built at each
 * width in `--widths`: `copy`, written again by the generator unchanged and
 * so byte for byte the module (checked), `unrolled`, and the module itself
 * through `nish/crypto/bcrypt`. The module against its copy is the noise
 * band; `unrolled` is a change only where it beats the module by more than
 * that band. All programs must print the same hash. They run in interleaved
 * rounds (common.mjs); a row is the median and spread of `--rounds` and the
 * fastest round, and each ratio over the module is given on fastest rounds
 * (the one to read on a shared host) and on medians.
 *
 * Usage: node bench/crypto/bcrypt/unroll.mjs [--compiler <nish>] [--hashes N] [--rounds N] [--cost N] [--widths 4,5,6]
 * Build products go to build/bench/bcrypt/unroll/.
 */
import fs from "node:fs"
import path from "node:path"
import {
  argValue,
  band,
  buildNish,
  fastest,
  intArg,
  median,
  nishLoopN,
  root,
  run,
  timeRounds,
} from "./common.mjs"

const compiler = argValue("--compiler", path.join(root, "build", "nish"))
const hashes = intArg("--hashes", 6, 1, 1e6)
const rounds = intArg("--rounds", 5, 1, 1e3)
const cost = intArg("--cost", 10, 4, 31)
const widths = argValue("--widths", "4,5,6").split(",").map(Number)
if (!widths.every((w) => Number.isInteger(w) && w >= 2 && w <= 6)) {
  console.error("--widths takes a comma-separated list of widths from 2 to 6")
  process.exit(1)
}

const dir = path.join(root, "build", "bench", "bcrypt", "unroll")
fs.mkdirSync(dir, { recursive: true })
const gen = path.join(import.meta.dirname, "gen-body.mjs")
for (const [name, extra] of [
  ["copy", []],
  ["unrolled", ["--unroll"]],
]) {
  const made = run(process.execPath, [gen, "--module", path.join(dir, `bcrypt_${name}.ts`), ...extra])
  if (made.status !== 0) {
    console.error(`gen-body.mjs --module ${extra.join(" ")} failed:\n${made.stderr}`)
    process.exit(1)
  }
}
const module = fs.readFileSync(path.join(root, "std", "crypto", "bcrypt.ts"), "utf8")
if (fs.readFileSync(path.join(dir, "bcrypt_copy.ts"), "utf8") !== module) {
  console.error("the generator's copy is not the module byte for byte, so it is no noise band")
  process.exit(1)
}

const kinds = [
  ["module", "nish/crypto/bcrypt"],
  ["copy", "./bcrypt_copy"],
  ["unrolled", "./bcrypt_unrolled"],
]
const programs = widths.flatMap((w) =>
  kinds.map(([kind, from]) => ({
    name: kind,
    w,
    argv: [buildNish(compiler, dir, `${kind}${w}`, nishLoopN(w, hashes, cost, from))],
    scale: 1000 / (hashes * w),
  }))
)
const outputs = new Set()
const samples = timeRounds(programs, rounds, (p, stdout) => {
  const lines = stdout.trim().split("\n")
  if (lines.length !== p.w) {
    console.error(`${p.name} at ${p.w} lanes printed ${lines.length} hashes, not one a lane`)
    process.exit(1)
  }
  for (const line of lines) {
    outputs.add(line)
  }
})
if (outputs.size !== 1) {
  console.error(`the programs disagree on the hash: ${[...outputs].join(", ")}`)
  process.exit(1)
}

console.log(
  `CPU ms per cost-${cost} hash a lane (${hashes} hashes a round, ${rounds} rounds: median and spread, then fastest)\n`
)
console.log(
  "| Lanes | module | copy | unrolled | copy / module, fastest | unrolled / module, fastest | copy / module, median | unrolled / module, median |"
)
console.log("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
for (const w of widths) {
  const [m, c, u] = kinds.map(([kind]) => samples[programs.findIndex((p) => p.w === w && p.name === kind)])
  const quick = (xs) => (fastest(xs) / fastest(m)).toFixed(3)
  const mid = (xs) => (median(xs) / median(m)).toFixed(3)
  const row = (xs) => `${band(xs)}, ${fastest(xs).toFixed(1)}`
  console.log(
    `| ${w} | ${row(m)} | ${row(c)} | ${row(u)} | ${quick(c)} | ${quick(u)} | ${mid(c)} | ${mid(u)} |`
  )
}
