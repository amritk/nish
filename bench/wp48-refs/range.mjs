#!/usr/bin/env node
// The gate of WP48 stage 1 (docs/wp48-ref32-classes.md §5.4): what the arena
// on a reserved range costs a program, with no IR change. `sibling.ts` is
// compiled once to IR, and that one module is linked three ways at
// `--profile speed`: `ptr` on the default runtime, `ptr-copy` a byte-identical
// copy of it (the noise band), and `ptr-range` on the compact-class runtime
// (`scripts/build.sh --arena-range`).
//
//   node bench/wp48-refs/range.mjs [--rounds 9] [--sizes 400000,4000000]
//
// The compiler is `build/nish`, or `$NISH` when it is set. Each variant first
// runs once per size, and all three must print the same checksum. Then each
// round runs every variant once in a shuffled order (a seeded shuffle, so a
// rerun repeats it), each in a fresh process under bench/rss.c for the peak
// resident set, with the timings on stderr. A figure is the median over the
// rounds; the band is the median gap between `ptr` and `ptr-copy`.
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
const sizes = option("--sizes", "400000,4000000").split(",").map(Number)
const nish = process.env.NISH ?? "build/nish"
const out = "build/wp48-range"
mkdirSync(`${out}/ir`, { recursive: true })

// mulberry32, as run.mjs: a fixed seed, so a rerun shuffles in the same orders
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

execFileSync(process.env.CC ?? "clang", ["-O2", "bench/rss.c", "-o", `${out}/rss`])
execFileSync(nish, ["bench/wp48-refs/sibling.ts", "-o", `${out}/ir/`], { stdio: "ignore" })
const link = (exe, extra) =>
  execFileSync(
    "bash",
    [
      "scripts/build.sh",
      `${out}/ir/sibling.ll`,
      "runtime/runtime.c",
      "-o",
      `${out}/${exe}`,
      "--profile",
      "speed",
      ...extra,
    ],
    { stdio: "ignore" }
  )
link("ptr", [])
link("ptr-range", ["--arena-range"])
copyFileSync(`${out}/ptr`, `${out}/ptr-copy`)
const variants = ["ptr", "ptr-copy", "ptr-range"]

const roundsFor = (n) => Math.max(4, Math.round(1e7 / n))

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
    variants.map((v) =>
      execFileSync(`${out}/${v}`, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    )
  )
  if (sums.size !== 1) {
    throw new Error(`${n} nodes: the variants disagree: ${[...sums].join(" / ")}`)
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
  const band = (k) => median(data.ptr[k].map((t, r) => Math.abs(t - data["ptr-copy"][k][r]) / t))
  const med = (v, k) => median(data[v][k])
  console.log(`## ${n.toLocaleString("en-US")} nodes, ${argv[1]} walks of each kind, ${rounds} rounds\n`)
  console.log(`${[...sums][0]}\n`)
  console.log("| variant | peak RSS | build ms | visit ms | climb ms | wall vs ptr |")
  console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
  const base = med("ptr", "total")
  for (const v of variants) {
    const row = [
      v,
      `${(med(v, "kb") / 1024).toFixed(1)} MB`,
      med(v, "build").toFixed(1),
      med(v, "visit").toFixed(1),
      med(v, "climb").toFixed(1),
      `${(med(v, "total") / base).toFixed(2)}x`,
    ]
    console.log(`| ${row.join(" | ")} |`)
  }
  const pct = (k) => `${(band(k) * 100).toFixed(1)}%`
  console.log(
    `\nnoise band (ptr against ptr-copy): build ${pct("build")}, visit ${pct("visit")}, climb ${pct("climb")}, wall ${pct("total")}\n`
  )
}
