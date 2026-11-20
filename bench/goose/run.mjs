#!/usr/bin/env node
// Nish against Goose (https://github.com/aardappel/goose) on the programs of
// Goose's own benchmark suite, each ported to Nish beside this script. Builds
// both, checks that they print the same checksum, and reports wall time, peak
// resident set and stripped binary size. See bench/goose/README.md.
//
//   node bench/goose/run.mjs --goose <checkout> [options]
//     --goose <dir>     a Goose checkout with its compiler built at
//                       <dir>/build/goose (default build/goose-src)
//     --size s|m|l      Goose's small, medium or large size (default l)
//     --runs N          timed runs per binary, best kept (default 3), after
//     --warmup N        discarded runs (default 2): Goose's own protocol
//     --only a,b        programs to include (default: all)
//     --validate        build and compare checksums only: no timing
//     --out <file>      also write the report there (markdown)
//     --compiler <nish> the compiler under test (default build/nish)
//
// Goose is built the way its bench/run_bench.py builds it: `goose -O2
// --standalone` to one C file, then `clang -O2` with a 2 GiB data-stack
// reservation. Nish is built with `--link --profile speed`. Sizes are of the
// stripped executables (a copy of Goose's is stripped; a speed-profile Nish
// binary already is). Times are whole-process wall clock.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compileArgv, compilerFrom } from "../compiler.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "goose-bench")
const nishc = compilerFrom(process.argv)

/**
 * Each program: its Nish port (`<name>.ts`), the Goose source it was ported
 * from, and the size Goose's run_bench.py gives it at small, medium and large.
 * The size replaces the number on the `bench:n` line of the port and on the
 * `// BENCH_N` line of the Goose source.
 */
const PROGRAMS = [
  { name: "tree", goose: "tree.goose", sizes: [16, 20, 24] },
  { name: "bintrees", goose: "bintrees.goose", sizes: [15, 17, 19] },
  { name: "records", goose: "records_var.goose", sizes: [500000, 4000000, 16000000] },
  { name: "strlist", goose: "strlist.goose", sizes: [200000, 2000000, 8000000] },
  { name: "words", goose: "words.goose", sizes: [500000, 4000000, 16000000] },
]

const fail = (msg) => {
  console.error(msg)
  process.exit(2)
}

const opts = {
  goose: path.join(root, "build", "goose-src"),
  size: 2,
  runs: 3,
  warmup: 2,
  only: null,
  validate: false,
  out: null,
}
const argv = nishc.rest.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const next = () => argv[++i] ?? fail(`${a} needs a value`)
  if (a === "--goose") {
    opts.goose = path.resolve(next())
  } else if (a === "--size") {
    const s = "sml".indexOf(next()[0])
    opts.size = s >= 0 ? s : fail("--size is s, m or l")
  } else if (a === "--runs") {
    opts.runs = Number(next())
  } else if (a === "--warmup") {
    opts.warmup = Number(next())
  } else if (a === "--only") {
    opts.only = new Set(next().split(","))
  } else if (a === "--validate") {
    opts.validate = true
  } else if (a === "--out") {
    opts.out = path.resolve(next())
  } else {
    fail(`unknown option ${a}`)
  }
}

const GOOSE = path.join(opts.goose, "build", "goose")
const GOOSE_BENCH = path.join(opts.goose, "bench", "goose")
if (!fs.existsSync(GOOSE)) {
  fail(
    `no Goose compiler at ${GOOSE}: clone https://github.com/aardappel/goose and build it ` +
      "(cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build), then pass --goose <checkout>"
  )
}
const CC = process.env.CC || "clang"

const run = (cmd, args, what, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    fail(`${what}: ${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
  }
  return r
}

/** `src` with the number on its first line matching `marker` set to `n`, written to `dst`. */
const sized = (src, dst, n, marker) => {
  const lines = fs.readFileSync(src, "utf8").split("\n")
  const at = lines.findIndex((l) => marker.test(l))
  if (at < 0) {
    fail(`${src} has no size line to rewrite`)
  }
  lines[at] = lines[at].replace(/\b\d+\b/, String(n))
  fs.writeFileSync(dst, lines.join("\n"))
}

fs.mkdirSync(outDir, { recursive: true })
// Goose resolves `import rng;` next to the root file.
fs.copyFileSync(path.join(GOOSE_BENCH, "rng.goose"), path.join(outDir, "rng.goose"))

const RSS = path.join(outDir, "rss")
run(CC, ["-O2", path.join(root, "bench", "rss.c"), "-o", RSS], "rss helper")

const build = (prog) => {
  const n = prog.sizes[opts.size]
  const ts = path.join(outDir, `${prog.name}.ts`)
  sized(path.join(here, `${prog.name}.ts`), ts, n, /bench:n/)
  const nish = path.join(outDir, `${prog.name}-nish`)
  run(nishc.cmd, compileArgv(nishc, [ts, "--link", nish, "--profile", "speed"]), `${prog.name}/nish`)

  const gsrc = path.join(outDir, `${prog.name}.goose`)
  sized(path.join(GOOSE_BENCH, prog.goose), gsrc, n, /^\s*let\s+\w+\s*=\s*\d+\s*;.*\/\/\s*BENCH_N/)
  const gc = path.join(outDir, `${prog.name}-goose.c`)
  run(GOOSE, ["-O2", "--standalone", "-o", gc, gsrc], `${prog.name}/goose`)
  const goose = path.join(outDir, `${prog.name}-goose`)
  run(
    CC,
    ["-O2", "-DGS_STACK_RESERVE=2147483648ull", gc, "-pthread", "-lm", "-ldl", "-o", goose],
    `${prog.name}/cc`
  )
  const stripped = `${goose}.stripped`
  run("strip", ["-s", "-o", stripped, goose], `${prog.name}/strip`)
  return { n, nish, goose, sizes: { nish: fs.statSync(nish).size, goose: fs.statSync(stripped).size } }
}

const once = (exe) => {
  const t0 = process.hrtime.bigint()
  const r = spawnSync(exe, [], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  if (r.status !== 0) {
    fail(`${exe} exited with ${r.status}\n${r.stderr}`)
  }
  return { ms, stdout: r.stdout }
}

/** Goose prints numbers right-aligned; compare the tokens. */
const tokens = (s) => s.trim().split(/\s+/).join(" ")

const measure = (exe) => {
  const total = opts.validate ? 1 : opts.warmup + opts.runs
  let best = Number.POSITIVE_INFINITY
  let stdout = ""
  for (let i = 0; i < total; i++) {
    const r = once(exe)
    stdout = r.stdout
    if (opts.validate || i >= opts.warmup) {
      best = Math.min(best, r.ms)
    }
  }
  let rss = null
  if (!opts.validate) {
    const r = spawnSync(RSS, [exe], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    rss = r.status === 0 ? Number(r.stdout.trim()) : null
  }
  return { ms: best, rss, out: tokens(stdout) }
}

const rows = []
let failed = false
for (const prog of PROGRAMS) {
  if (opts.only !== null && !opts.only.has(prog.name)) {
    continue
  }
  const b = build(prog)
  const nish = measure(b.nish)
  const goose = measure(b.goose)
  const same = nish.out === goose.out
  failed ||= !same
  rows.push({ prog, b, nish, goose, same })
  console.error(
    `${prog.name} n=${b.n}: ${same ? "same checksum" : `DIFFERENT: nish ${nish.out} goose ${goose.out}`}`
  )
}

const ratio = (a, b) => (a / b).toFixed(2)
const geomean = (xs) => Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length)
const fmtMs = (ms) => (ms >= 100 ? ms.toFixed(0) : ms.toFixed(1))
const fmtKb = (kb) => (kb === null ? "-" : kb.toLocaleString("en-US"))
const sizeName = "sml"[opts.size]

const lines = [
  "| Program | n | Nish ms | Goose ms | Goose/Nish | Nish RSS KB | Goose RSS KB | Nish bytes | Goose bytes |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
]
for (const r of rows) {
  lines.push(
    `| ${r.prog.name} | ${r.b.n} | ${fmtMs(r.nish.ms)} | ${fmtMs(r.goose.ms)} | ${ratio(r.goose.ms, r.nish.ms)} | ` +
      `${fmtKb(r.nish.rss)} | ${fmtKb(r.goose.rss)} | ${r.b.sizes.nish.toLocaleString("en-US")} | ` +
      `${r.b.sizes.goose.toLocaleString("en-US")} |`
  )
}
if (!opts.validate && rows.length > 0) {
  const time = geomean(rows.map((r) => r.goose.ms / r.nish.ms))
  const rss = rows.every((r) => r.nish.rss !== null && r.goose.rss !== null)
    ? geomean(rows.map((r) => r.goose.rss / r.nish.rss))
    : null
  const size = geomean(rows.map((r) => r.b.sizes.goose / r.b.sizes.nish))
  lines.push(
    "",
    `Geometric mean, Goose over Nish (above 1 is Nish ahead): time ${time.toFixed(2)}, ` +
      `peak RSS ${rss === null ? "-" : rss.toFixed(2)}, binary size ${size.toFixed(2)}. ` +
      `Size ${sizeName}; best of ${opts.runs} after ${opts.warmup} warm-ups.`
  )
}
const report = `${lines.join("\n")}\n`
process.stdout.write(report)
if (opts.out !== null) {
  fs.writeFileSync(opts.out, report)
}
process.exit(failed ? 1 : 0)
