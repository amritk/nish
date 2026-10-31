#!/usr/bin/env node
// Reproduces the figures in docs/wp48-compressed-references.md: one AST-shaped
// tree built and walked five ways (README.md has the layouts), at three sizes.
//
//   npm run build && node bench/wp48-refs/run.mjs [--rounds 9] [--sizes 20000,400000,4000000]
//
// Every program first runs once per size with its stdout kept, and all five
// must print the same checksum, or the run fails. Then each round runs every
// variant once, in an order shuffled afresh for the round (a seeded shuffle,
// so a rerun repeats it), each in a fresh process under bench/rss.c, which
// prints the process's peak resident set while the program's timings arrive
// on stderr. A figure is the median over the rounds. The noise band is the
// median over the rounds of the gap between `class` and `class-copy`, a
// byte-identical copy of its binary timed in the same rounds: a difference
// inside it is no difference.
//
// Linux only (ru_maxrss in KB), run from the repository root.
import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync } from "node:fs"

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const rounds = Number(option("--rounds", "9"))
const sizes = option("--sizes", "20000,400000,4000000").split(",").map(Number)
const out = "build/wp48"
mkdirSync(out, { recursive: true })

// mulberry32: a fixed seed, so a rerun shuffles in the same orders
let seed = 0x6e697368
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const shuffled = (xs) => {
  const s = [...xs]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
const median = (xs) => {
  const s = [...xs].sort((p, q) => p - q)
  return s[s.length >> 1]
}

const programs = ["class", "sibling", "pool", "records", "columns"]
const variants = ["class", "class-copy", "sibling", "pool", "records", "columns"]
execFileSync(process.env.CC ?? "clang", ["-O2", "bench/rss.c", "-o", `${out}/rss`])
for (const p of programs) {
  execFileSync("build/nish", [`bench/wp48-refs/${p}.ts`, "--link", `${out}/${p}`], { stdio: "ignore" })
}
copyFileSync(`${out}/class`, `${out}/class-copy`)

// About 10 million node visits a kind of walk, whatever the size, so a small
// tree is walked often enough to time.
const roundsFor = (n) => Math.max(4, Math.round(1e7 / n))

// bench/rss.c sends the program's stdout to /dev/null and prints the peak on
// its own; the shell folds the program's stderr, the timings, in beside it.
const run = (v, argv) => {
  const text = execFileSync("sh", ["-c", '"$0" "$@" 2>&1', `${out}/rss`, `${out}/${v}`, ...argv], {
    encoding: "utf8",
  })
  const field = (name) => {
    const m = text.match(new RegExp(`${name} (\\d+)`))
    if (m === null) {
      throw new Error(`${v}: no ${name} in: ${text}`)
    }
    return Number(m[1])
  }
  const kb = Number(text.trim().split("\n").at(-1))
  return { build: field("build") / 1e6, visit: field("visit") / 1e6, climb: field("climb") / 1e6, kb }
}

for (const n of sizes) {
  const argv = [String(n), String(roundsFor(n))]
  const sums = new Set(
    programs.map((p) =>
      execFileSync(`${out}/${p}`, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    )
  )
  if (sums.size !== 1) {
    throw new Error(`${n} nodes: the programs disagree: ${[...sums].join(" / ")}`)
  }
  const kinds = ["build", "visit", "climb", "kb"]
  const data = Object.fromEntries(variants.map((v) => [v, Object.fromEntries(kinds.map((k) => [k, []]))]))
  for (let r = 0; r < rounds; r++) {
    for (const v of shuffled(variants)) {
      const t = run(v, argv)
      for (const k of kinds) {
        data[v][k].push(t[k])
      }
    }
  }
  for (const v of variants) {
    data[v].total = data[v].build.map((b, r) => b + data[v].visit[r] + data[v].climb[r])
  }
  const band = (k) => median(data.class[k].map((t, r) => Math.abs(t - data["class-copy"][k][r]) / t))
  const med = (v, k) => median(data[v][k])
  console.log(`## ${n.toLocaleString("en-US")} nodes, ${argv[1]} walks of each kind, ${rounds} rounds\n`)
  console.log(`${[...sums][0]}\n`)
  console.log("| layout | peak RSS | bytes/node | build ms | visit ms | climb ms | total vs class |")
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
  const base = med("class", "total")
  for (const v of variants) {
    const kb = med(v, "kb")
    const row = [
      v,
      `${(kb / 1024).toFixed(1)} MB`,
      // the empty program's resident set is a few hundred KB, which is noise at the large sizes only
      n >= 400000 ? ((kb * 1024) / n).toFixed(1) : "—",
      med(v, "build").toFixed(1),
      med(v, "visit").toFixed(1),
      med(v, "climb").toFixed(1),
      `${(med(v, "total") / base).toFixed(2)}x`,
    ]
    console.log(`| ${row.join(" | ")} |`)
  }
  const pct = (k) => `${(band(k) * 100).toFixed(1)}%`
  console.log(
    `\nnoise band (class against class-copy): build ${pct("build")}, visit ${pct("visit")}, climb ${pct("climb")}, total ${pct("total")}\n`
  )
}
