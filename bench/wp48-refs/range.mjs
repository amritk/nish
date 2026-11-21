#!/usr/bin/env node
// The gate of WP48 stage 1 (docs/wp48-ref32-classes.md §5.4): what the arena
// on a reserved range costs a program, with no IR change. The program,
// `sibling.ts` or with `--program tree` `bench/goose/tree.ts`, is
// compiled once to IR, and that one module is linked three ways at
// `--profile speed`: `ptr` on the default runtime, `ptr-copy` a byte-identical
// copy of it (the noise band), and `ptr-range` on the compact-class runtime
// (`scripts/build.sh --arena-range`).
//
//   NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --rounds 21 --sizes 400000,4000000
//   NISH=build/seed/bin/nish node bench/wp48-refs/range.mjs --program tree --rounds 21 --sizes 24
//
// The compiler is `build/nish`, or `$NISH` when it is set. Each variant first
// runs once per size, and all three must print the same checksum. Then each
// round runs every variant once in a shuffled order (a seeded shuffle, so a
// rerun repeats it), each in a fresh process under bench/rss.c for the peak
// resident set, with the timings on stderr. "wall" is build + visit + climb,
// the program's own timers, not the process's lifetime. `tree.ts` has no
// timers: its size is the depth on its `bench:n` line, and its "wall" is the
// process's lifetime under bench/rss.c. A figure is the median over the
// rounds. The band is the widest per-round gap between `ptr` and `ptr-copy`
// (the same binary), over every round, so it covers the spread of a round
// rather than its middle; the median band is the median of those per-round
// gaps, from the same runs. The verdict: `ptr-range`'s median wall is within
// the band of `ptr`'s; the median-band verdict, printed beside it, tests the
// same cost against the median band.
//
// Linux only (ru_maxrss in KB), run from the repository root.
import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { withAllowPanics } from "../../tests/allow-panics.js"

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const program = option("--program", "sibling")
if (program !== "sibling" && program !== "tree") {
  throw new Error(`--program is sibling or tree, not ${program}`)
}
const tree = program === "tree"
const rounds = Number(option("--rounds", "21"))
const sizes = option("--sizes", tree ? "24" : "400000,4000000")
  .split(",")
  .map(Number)
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
// tree.ts takes its depth from its `bench:n` line, so each size is its own
// module; sibling.ts takes its size on the command line, so one serves all
const compile = (n) => {
  if (!tree) {
    execFileSync(nish, withAllowPanics(nish, ["bench/wp48-refs/sibling.ts", "-o", `${out}/ir/`]), {
      stdio: "ignore",
    })
    return `${out}/ir/sibling.ll`
  }
  const lines = readFileSync("bench/goose/tree.ts", "utf8").split("\n")
  const at = lines.findIndex((line) => line.includes("bench:n"))
  lines[at] = lines[at].replace(/\b\d+\b/, String(n))
  mkdirSync(`${out}/src`, { recursive: true })
  writeFileSync(`${out}/src/tree.ts`, lines.join("\n"))
  execFileSync(nish, withAllowPanics(nish, [`${out}/src/tree.ts`, "-o", `${out}/ir/`]), { stdio: "ignore" })
  return `${out}/ir/tree.ll`
}
const link = (ll, exe, extra) =>
  execFileSync(
    "bash",
    ["scripts/build.sh", ll, "runtime/runtime.c", "-o", `${out}/${exe}`, "--profile", "speed", ...extra],
    { stdio: "ignore" }
  )
const variants = ["ptr", "ptr-copy", "ptr-range"]
const prepare = (n) => {
  const ll = compile(n)
  link(ll, "ptr", [])
  link(ll, "ptr-range", ["--arena-range"])
  copyFileSync(`${out}/ptr`, `${out}/ptr-copy`)
}
if (!tree) {
  prepare(0)
}

const roundsFor = (n) => Math.max(4, Math.round(1e7 / n))

const run = (v, argv) => {
  if (tree) {
    const t0 = process.hrtime.bigint()
    const text = execFileSync(`${out}/rss`, [`${out}/${v}`], { encoding: "utf8" })
    return { total: Number(process.hrtime.bigint() - t0) / 1e6, kb: Number(text.trim()) }
  }
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
  return {
    build: field("build") / 1e6,
    visit: field("visit") / 1e6,
    climb: field("climb") / 1e6,
    kb,
  }
}

for (const n of sizes) {
  if (tree) {
    prepare(n)
  }
  const argv = tree ? [] : [String(n), String(roundsFor(n))]
  const sums = new Set(
    variants.map((v) =>
      execFileSync(`${out}/${v}`, argv, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    )
  )
  if (sums.size !== 1) {
    throw new Error(`${n} nodes: the variants disagree: ${[...sums].join(" / ")}`)
  }
  const kinds = tree ? ["total", "kb"] : ["build", "visit", "climb", "kb"]
  const data = Object.fromEntries(variants.map((v) => [v, Object.fromEntries(kinds.map((k) => [k, []]))]))
  for (let r = 0; r < rounds; r++) {
    for (const v of shuffled(variants)) {
      const t = run(v, argv)
      for (const k of kinds) {
        data[v][k].push(t[k])
      }
    }
  }
  if (!tree) {
    for (const v of variants) {
      data[v].total = data[v].build.map((b, r) => b + data[v].visit[r] + data[v].climb[r])
    }
  }
  const gaps = (k) => data.ptr[k].map((t, r) => Math.abs(t - data["ptr-copy"][k][r]) / t)
  const band = (k) => Math.max(...gaps(k))
  const medianBand = (k) => median(gaps(k))
  const med = (v, k) => median(data[v][k])
  const pct = (k) => `${(band(k) * 100).toFixed(1)}%`
  const base = med("ptr", "total")
  const cost = med("ptr-range", "total") / base - 1
  const verdict = (width, name) =>
    `${Math.abs(cost) <= width ? "within" : "outside"} the ${(width * 100).toFixed(1)}% ${name}`
  const costText = `${cost >= 0 ? "+" : ""}${(cost * 100).toFixed(1)}%`
  if (tree) {
    console.log(`## tree.ts, depth ${n}, ${rounds} rounds\n`)
    console.log(`${[...sums][0]}\n`)
    console.log("| variant | peak RSS | wall ms | wall vs ptr |")
    console.log("| --- | ---: | ---: | ---: |")
    for (const v of variants) {
      const row = [
        v,
        `${(med(v, "kb") / 1024).toFixed(1)} MB`,
        med(v, "total").toFixed(1),
        `${(med(v, "total") / base).toFixed(2)}x`,
      ]
      console.log(`| ${row.join(" | ")} |`)
    }
    console.log(
      `\nnoise band (ptr against ptr-copy): widest per-round gap ${pct("total")}, median per-round gap ${(medianBand("total") * 100).toFixed(1)}%\n`
    )
    console.log(
      `verdict: ptr-range wall ${costText} against ptr, ${verdict(band("total"), "wall band")}; ${verdict(medianBand("total"), "median band")}\n`
    )
    continue
  }
  console.log(`## ${n.toLocaleString("en-US")} nodes, ${argv[1]} walks of each kind, ${rounds} rounds\n`)
  console.log(`${[...sums][0]}\n`)
  console.log("| variant | peak RSS | build ms | visit ms | climb ms | wall vs ptr |")
  console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
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
  console.log(
    `\nnoise band (ptr against ptr-copy, the widest per-round gap): build ${pct("build")}, visit ${pct("visit")}, climb ${pct("climb")}, wall ${pct("total")}; median per-round wall gap ${(medianBand("total") * 100).toFixed(1)}%\n`
  )
  console.log(
    `verdict: ptr-range wall ${costText} against ptr, ${verdict(band("total"), "wall band")}; ${verdict(medianBand("total"), "median band")}\n`
  )
}
