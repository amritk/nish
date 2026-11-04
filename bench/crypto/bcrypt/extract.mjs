/**
 * The extraction experiment: is `bcryptBodyN` faster when each lane takes its
 * word's bytes as two low-and-second-byte pairs (`gen-body.mjs --lohi`: one
 * opaque copy gives bytes 0 and 1, the copy moved down by 16 bytes 2 and 3)?
 * It issues about 9% fewer instructions a lane half-round at three to five
 * lanes and 6% fewer at six, which can only show on a core that issue width
 * bounds (a 4-wide one, such as Skylake and Cascade Lake Xeons); a 6-wide
 * Emerald Rapids core runs both alike.
 *
 * Three copies of `std/crypto/bcrypt.ts` are built at each width in
 * `--widths`: the module itself through `nish/crypto/bcrypt`, `copy`, written
 * again by the generator unchanged and so byte for byte the module (checked),
 * and `lohi`. The module against its copy is the noise band. All programs
 * must print the same hash. They run in interleaved rounds (common.mjs).
 *
 * It prints two tables. The first counts, without running anything, each
 * width's round loop in the assembly `clang -O3` makes of the module's IR:
 * instructions, stack references (spills and reloads) and instructions a lane
 * half-round. The second is CPU ms per hash a lane: median and spread, the
 * fastest round, and `lohi` over the module three ways: on fastest rounds, on
 * medians, and the median of the rounds' own ratios (each round runs both,
 * so a slow stretch of the host slows both sides of its ratio).
 *
 * Usage: node bench/crypto/bcrypt/extract.mjs [--compiler <nish>] [--hashes N] [--rounds N] [--cost N] [--widths 3,4,5,6]
 * Build products go to build/bench/bcrypt/extract/.
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
const hashes = intArg("--hashes", 2, 1, 1e6)
const rounds = intArg("--rounds", 15, 1, 1e3)
const cost = intArg("--cost", 10, 4, 31)
const widths = argValue("--widths", "3,4,5,6").split(",").map(Number)
if (!widths.every((w) => Number.isInteger(w) && w >= 2 && w <= 6)) {
  console.error("--widths takes a comma-separated list of widths from 2 to 6")
  process.exit(1)
}

const dir = path.join(root, "build", "bench", "bcrypt", "extract")
fs.mkdirSync(dir, { recursive: true })
const gen = path.join(import.meta.dirname, "gen-body.mjs")
for (const [name, extra] of [
  ["copy", []],
  ["lohi", ["--lohi"]],
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
  ["module", "nish/crypto/bcrypt", "bcrypt.ll"],
  ["copy", "./bcrypt_copy", "bcrypt_copy.ll"],
  ["lohi", "./bcrypt_lohi", "bcrypt_lohi.ll"],
]
const programs = widths.flatMap((w) =>
  kinds.map(([kind, from]) => ({
    name: kind,
    w,
    argv: [buildNish(compiler, dir, `${kind}${w}`, nishLoopN(w, hashes, cost, from))],
    scale: 1000 / (hashes * w),
  }))
)

/**
 * Each round loop of `bcryptBodyN` in `asm` (Intel syntax), by its lane count:
 * a lane's round loads 8 S-box words and 2 `P` words, each from the state's
 * base plus an index register, which no stack reference is.
 */
const roundLoops = (asm) => {
  const lines = asm.split("\n")
  const from = lines.findIndex((l) => /^[\w.]*bcryptBodyN:/.test(l))
  const to = lines.findIndex((l, i) => i > from && l.includes("-- End function"))
  const loops = new Map()
  for (let i = from; from >= 0 && i < to; i++) {
    const label = lines[i].match(/^(\.LBB\w+):/)
    if (!label || !/Inner Loop Header/.test(lines[i + 1] + lines[i + 2])) {
      continue
    }
    let count = 0
    let stack = 0
    let words = 0
    for (let j = i + 1; j < to; j++) {
      const line = lines[j]
      if (!/^\s+[a-z]/.test(line)) {
        continue
      }
      count++
      if (line.includes("rsp")) {
        stack++
      } else if (/ptr \[r\w+ \+ (4\*)?r\w+ \+ \d+\]/.test(line)) {
        words++
      }
      if (new RegExp(`^j\\w+\\s+\\${label[1]}$`).test(line.trim())) {
        break
      }
    }
    loops.set(Math.round(words / 10), { count, stack })
  }
  return loops
}

const clang = process.env.CC || "clang"
const counted = new Map()
for (const [kind, , ll] of kinds.filter(([name]) => name !== "copy")) {
  const at = path.join(dir, `${kind}${widths[0]}-out`, ll)
  const asm = path.join(dir, `${kind}.s`)
  const made = run(clang, ["-O3", "-Wno-override-module", "-S", "-masm=intel", at, "-o", asm])
  if (made.status !== 0) {
    console.error(`${clang} -S ${at} failed:\n${made.stderr}`)
    process.exit(1)
  }
  counted.set(kind, roundLoops(fs.readFileSync(asm, "utf8")))
}
console.log("Round loop of `bcryptBodyN` (`clang -O3` of the module's IR): instructions, stack references\n")
console.log("| Lanes | module | lohi | module a lane half-round | lohi a lane half-round | lohi / module |")
console.log("| ---: | ---: | ---: | ---: | ---: | ---: |")
for (const w of [2, 3, 4, 5, 6]) {
  const m = counted.get("module").get(w)
  const l = counted.get("lohi").get(w)
  if (!m || !l) {
    console.log(`| ${w} | not found | | | | |`)
    continue
  }
  const half = (x) => (x.count / (2 * w)).toFixed(2)
  console.log(
    `| ${w} | ${m.count}, ${m.stack} | ${l.count}, ${l.stack} | ${half(m)} | ${half(l)} | ${(l.count / m.count).toFixed(3)} |`
  )
}

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
  `\nCPU ms per cost-${cost} hash a lane (${hashes} hashes a round, ${rounds} rounds: median and spread, then fastest)\n`
)
console.log(
  "| Lanes | module | copy | lohi | copy / module, paired | lohi / module, fastest | lohi / module, median | lohi / module, paired |"
)
console.log("| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
for (const w of widths) {
  const [m, c, l] = kinds.map(([kind]) => samples[programs.findIndex((p) => p.w === w && p.name === kind)])
  const paired = (xs) => median(xs.map((x, i) => x / m[i])).toFixed(3)
  const row = (xs) => `${band(xs)}, ${fastest(xs).toFixed(1)}`
  console.log(
    `| ${w} | ${row(m)} | ${row(c)} | ${row(l)} | ${paired(c)} | ${(fastest(l) / fastest(m)).toFixed(3)} | ${(median(l) / median(m)).toFixed(3)} | ${paired(l)} |`
  )
}
console.log(`\nhash: ${[...outputs][0]}`)
