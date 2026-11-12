#!/usr/bin/env node
// Reproduces the figures in bench/wp28-s6/README.md: three programs with a
// `try`/`catch` in them, each lowered two ways (README.md has both), timed
// against each other and measured for size.
//
//   npm run build && node bench/wp28-s6/run.mjs [--rounds 9]
//
// Every hand-written .ll goes through llvm-as first. The `Result` side is
// main.ts compiled by build/nish to one module of IR a source file; the
// landing-pad side is that same main.ll linked with the hand-written kernels,
// throw.ll and unwind.c. Both go through scripts/build.sh at the release
// profile (`--profile speed`), twice:
//
//   inlined   as the optimiser leaves them. LTO inlines most of these small
//             callees, and an inlined `throw` under its own `catch` is still a
//             throw while an inlined `Err` is a branch.
//   outlined  every function that can fail marked `noinline` on both sides
//             (a rewrite of the IR's `define` lines; Nish has no spelling for
//             it), so each failure crosses the calls its source shows.
//
// Every binary first runs every row once with its stdout kept, and all must
// print the same checksum, or the run fails. Then each round runs every
// binary on every row once, in an order shuffled afresh for the round (a
// seeded shuffle, so a rerun repeats it), each in a fresh process that times
// its own kernel call and reports nanoseconds on stderr. A figure is the
// median over the rounds. A row's noise band is the median over the rounds of
// the gap between the `Result` binary and a byte-identical copy of it timed in
// the same rounds: a difference inside it is no difference.
//
// x86-64 Linux only (ELF section names, the unwinder in libgcc_s), run from
// the repository root.
import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const at = args.indexOf("--rounds")
const rounds = Number(at >= 0 ? args[at + 1] : "9")
const here = "bench/wp28-s6"
const out = "build/wp28-s6"

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
const run = (cmd, argv) => execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })

// The kernels, and in each the functions that can fail: the ones `outlined` pins.
const kernels = { hot: ["step"], parse: ["parseDigit", "parseField", "parseRecord"], deep: ["descend"] }
const shapes = Object.keys(kernels)
// `k` is main.ts's third argument: records to a bad one (0 for none), or frames.
const rows = [
  { shape: "hot", n: 200_000_000, k: 0, label: "hot loop, never throws" },
  { shape: "parse", n: 10_000_000, k: 0, label: "parser, never throws" },
  { shape: "parse", n: 10_000_000, k: 1000, label: "parser, throws 1 in 1000" },
  { shape: "parse", n: 10_000_000, k: 100, label: "parser, throws 1 in 100" },
  { shape: "parse", n: 10_000_000, k: 10, label: "parser, throws 1 in 10" },
  { shape: "deep", n: 200_000, k: 1, label: "call chain, unwinds 1 frame" },
  { shape: "deep", n: 200_000, k: 8, label: "call chain, unwinds 8 frames" },
  { shape: "deep", n: 200_000, k: 32, label: "call chain, unwinds 32 frames" },
]
const modes = ["inlined", "outlined"]
const variants = ["result", "result-copy", "pads"]

for (const f of [...shapes, "throw", "nounwind"]) {
  run("llvm-as", [`${here}/${f}.ll`, "-o", "/dev/null"])
}

mkdirSync(`${out}/result`, { recursive: true })
run("build/nish", [`${here}/main.ts`, "-o", `${out}/result/`])

// `noinline` on every named function of one kernel's IR, or a throw: a define
// line this misses would leave the two sides pinned differently.
const pinned = (path, names) => {
  let text = readFileSync(path, "utf8")
  for (const name of names) {
    const line = new RegExp(`^(define internal [^@]*@${name}\\(.*\\)) (#\\d+ \\{)$`, "m")
    if (!line.test(text)) {
      throw new Error(`${path}: no define line for ${name}`)
    }
    text = text.replace(line, "$1 noinline $2")
  }
  return text
}
const ir = { inlined: { result: `${out}/result`, pads: here } }
ir.outlined = { result: `${out}/outlined/result`, pads: `${out}/outlined/pads` }
for (const side of ["result", "pads"]) {
  mkdirSync(ir.outlined[side], { recursive: true })
  for (const s of shapes) {
    writeFileSync(`${ir.outlined[side]}/${s}.ll`, pinned(`${ir.inlined[side]}/${s}.ll`, kernels[s]))
  }
}
const link = (inputs, binary) =>
  run("bash", ["scripts/build.sh", ...inputs, "runtime/runtime.c", "-o", binary, "--profile", "speed"])
for (const mode of modes) {
  const kernel = (side) => shapes.map((s) => `${ir[mode][side]}/${s}.ll`)
  link([`${out}/result/main.ll`, ...kernel("result")], `${out}/${mode}-result`)
  link(
    [`${out}/result/main.ll`, ...kernel("pads"), `${here}/throw.ll`, `${here}/unwind.c`],
    `${out}/${mode}-pads`
  )
  copyFileSync(`${out}/${mode}-result`, `${out}/${mode}-result-copy`)
}

// One run: the checksum the kernel printed and the nanoseconds it took.
const once = (mode, variant, row) => {
  const r = spawnSync(`${out}/${mode}-${variant}`, [row.shape, `${row.n}`, "7", `${row.k}`], {
    encoding: "utf8",
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr)
  if (r.status !== 0 || !ns) {
    throw new Error(`${mode}-${variant} ${row.label}: exit ${r.status} ${r.signal ?? ""} ${r.stderr}`)
  }
  return { sum: r.stdout.trim(), ns: Number(ns[1]) }
}
const cells = modes.flatMap((mode) =>
  variants.flatMap((variant) => rows.map((row) => ({ mode, variant, row })))
)
for (const row of rows) {
  const sums = new Set(cells.filter((c) => c.row === row).map((c) => once(c.mode, c.variant, row).sum))
  if (sums.size !== 1) {
    throw new Error(`${row.label}: the binaries disagree: ${[...sums].join(" ")}`)
  }
}
const data = new Map(cells.map((c) => [c, []]))
for (let r = 0; r < rounds; r++) {
  for (const c of shuffled(cells)) {
    data.get(c).push(once(c.mode, c.variant, c.row).ns)
  }
}
const times = (mode, variant, row) =>
  data.get(cells.find((c) => c.mode === mode && c.variant === variant && c.row === row))
const med = (mode, variant, row) => median(times(mode, variant, row))
const band = (mode, row) => {
  const copy = times(mode, "result-copy", row)
  return median(times(mode, "result", row).map((t, r) => Math.abs(t - copy[r]) / t))
}
const ms = (ns) => (ns / 1e6).toFixed(ns < 1e7 ? 2 : 1)
const pct = (x) => `${(100 * x).toFixed(1)}%`

console.log(`rounds ${rounds}, median; ${run("clang", ["--version"]).split("\n")[0]}`)
for (const mode of modes) {
  console.log(`\n### Time, ${mode}\n`)
  console.log("| program | `Result` ms | landing pads ms | pads / `Result` | noise band |")
  console.log("| --- | ---: | ---: | ---: | ---: |")
  for (const row of rows) {
    const a = med(mode, "result", row)
    const b = med(mode, "pads", row)
    const noise = band(mode, row)
    const verdict = Math.abs(b - a) / a <= noise ? " (inside the band)" : ""
    console.log(`| ${row.label} | ${ms(a)} | ${ms(b)} | ${(b / a).toFixed(2)}x${verdict} | ±${pct(noise)} |`)
  }
}

// What one failure costs. For the call chain every iteration fails, so it is
// the row's time an iteration. For the parser it is what a row adds over the
// row that never throws, a failure, and it is a figure only where that
// difference is outside both rows' noise bands.
console.log("\n### One failure, in nanoseconds\n")
console.log("| program | mode | `Result` | landing pads |")
console.log("| --- | --- | ---: | ---: |")
const never = rows.find((r) => r.shape === "parse" && r.k === 0)
const each = (mode, variant, row) =>
  row.shape === "deep"
    ? med(mode, variant, row) / row.n
    : (med(mode, variant, row) - med(mode, variant, never)) / Math.floor(row.n / row.k)
const shown = (mode, variant, row) => {
  const base = med(mode, variant, never)
  const lost =
    row.shape === "parse" &&
    Math.abs(med(mode, variant, row) - base) / base <= Math.max(band(mode, row), band(mode, never))
  return lost ? "inside the band" : each(mode, variant, row).toFixed(1)
}
for (const row of rows.filter((r) => r.k > 0)) {
  for (const mode of modes) {
    console.log(`| ${row.label} | ${mode} | ${shown(mode, "result", row)} | ${shown(mode, "pads", row)} |`)
  }
}
// A frame unwound, from the two ends of the call chain.
const [shallow, deepest] = [1, 32].map((k) => rows.find((r) => r.shape === "deep" && r.k === k))
for (const mode of modes) {
  const frame = (variant) =>
    ((each(mode, variant, deepest) - each(mode, variant, shallow)) / (deepest.k - shallow.k)).toFixed(1)
  console.log(
    `\n- ${mode}: each frame more costs ${frame("result")} ns by \`Result\`, ${frame("pads")} ns by landing pads`
  )
}

// The rate of failure at which the two lowerings of the parser cost the same:
// what a record that parses saves on landing pads, over what a throw costs
// more than an `Err` (taken from the 1 in 10 row, which has the most throws).
console.log("\n### Break-even, the parser\n")
const dense = rows.find((r) => r.shape === "parse" && r.k === 10)
for (const mode of modes) {
  const a = med(mode, "result", never)
  const b = med(mode, "pads", never)
  const saved = (a - b) / never.n
  const extra = each(mode, "pads", dense) - each(mode, "result", dense)
  const line =
    (a - b) / a <= band(mode, never)
      ? "landing pads save nothing outside the noise band on a record that parses, so there is no rate at which they win"
      : `landing pads save ${saved.toFixed(2)} ns a record that parses and cost ${extra.toFixed(0)} ns more a failure: they win below one failure in ${Math.round(extra / saved)} records`
  console.log(`- ${mode}: ${line}`)
}

// Sizes: each kernel compiled alone with the release profile's flags (no LTO,
// so a kernel's sections are its own), then the linked binaries.
const flags = ["-O3", "-c", "-ffunction-sections", "-fdata-sections", "-fomit-frame-pointer"]
flags.push(
  "-fno-asynchronous-unwind-tables",
  "-fno-unwind-tables",
  "-fcf-protection=full",
  "-Wno-override-module"
)
const sections = (path) => {
  const size = { text: 0, frames: 0, tables: 0 }
  for (const line of run("llvm-size", ["-A", path]).split("\n")) {
    const [name, bytes] = line.split(/\s+/)
    if (name.startsWith(".text")) {
      size.text += Number(bytes)
    } else if (name.startsWith(".eh_frame")) {
      size.frames += Number(bytes)
    } else if (name.startsWith(".gcc_except_table")) {
      size.tables += Number(bytes)
    }
  }
  return size
}
const object = (source, name) => {
  run("clang", [...flags, source, "-o", `${out}/${name}.o`])
  return sections(`${out}/${name}.o`)
}
// A kernel's `Result` IR with `nounwind` taken off every function and declaration.
const unwinding = (s) => {
  const path = `${out}/result/${s}-unwinding.ll`
  writeFileSync(path, readFileSync(`${out}/result/${s}.ll`, "utf8").replaceAll(" nounwind ", " "))
  return path
}
console.log("\n### Size, bytes, each kernel compiled alone\n")
console.log("| kernel | lowering | `.text` | `.eh_frame` | `.gcc_except_table` | total |")
console.log("| --- | --- | ---: | ---: | ---: | ---: |")
const sizeRow = (kernel, lowering, s) =>
  console.log(
    `| ${kernel} | ${lowering} | ${s.text} | ${s.frames} | ${s.tables} | ${s.text + s.frames + s.tables} |`
  )
for (const s of shapes) {
  sizeRow(s, "`Result`", object(`${out}/result/${s}.ll`, `result-${s}`))
  sizeRow(s, "`Result`, no `nounwind`", object(unwinding(s), `unwinding-${s}`))
  sizeRow(s, "landing pads", object(`${here}/${s}.ll`, `pads-${s}`))
}
sizeRow("throw.ll", "landing pads, once a program", object(`${here}/throw.ll`, "throw"))
sizeRow("unwind.c", "landing pads, once a program", object(`${here}/unwind.c`, "unwind"))

console.log("\n### Size, bytes, the linked binaries\n")
console.log(
  "| binary | file | `.text` | `.eh_frame` + `.eh_frame_hdr` | `.gcc_except_table` | shared libraries |"
)
console.log("| --- | ---: | ---: | ---: | ---: | --- |")
for (const mode of modes) {
  for (const variant of ["result", "pads"]) {
    const path = `${out}/${mode}-${variant}`
    const s = sections(path)
    const needed = [...run("llvm-readelf", ["-d", path]).matchAll(/\(NEEDED\).*\[(.*)\]/g)].map((m) => m[1])
    const file = readFileSync(path).length
    console.log(
      `| ${mode}-${variant} | ${file} | ${s.text} | ${s.frames} | ${s.tables} | ${needed.join(" ")} |`
    )
  }
}

// What `nounwind` buys today: `opt -O2` on each kernel's `Result` IR with and
// without it (the IR compared with comments and attribute groups aside), and on
// nounwind.ll, where it decides whether a store is dead.
console.log("\n### `nounwind`, with and without, under `opt -O2`\n")
const bodies = (path) =>
  run("opt", ["-O2", "-S", path])
    .split("\n")
    .filter((l) => !/^(attributes|;|source_filename)/.test(l))
    .map((l) => l.replace(/ #\d+/g, ""))
    .join("\n")
for (const s of shapes) {
  const same = bodies(`${out}/result/${s}.ll`) === bodies(unwinding(s))
  console.log(`- ${s}: optimised IR ${same ? "identical" : "differs"}`)
}
const stores = (path) =>
  run("opt", ["-O2", "-S", path])
    .split("\n")
    .filter((l) => /^\s*store /.test(l)).length
const bare = `${out}/nounwind-off.ll`
writeFileSync(bare, readFileSync(`${here}/nounwind.ll`, "utf8").replace("{ nounwind ", "{ "))
console.log(
  `- nounwind.ll: ${stores(`${here}/nounwind.ll`)} store left with \`nounwind\`, ${stores(bare)} without`
)
