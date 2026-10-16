#!/usr/bin/env node
// WP38 S3a: S3's bar kernels measured without a surface (docs/wp38-simd.md
// §2.3, §3.2.1). Nothing here is built into the compiler: it asks whether a
// portable 128-bit vector kernel beats a fair scalar Nish kernel by the 1.5x
// S3's bar names, on a numeric kernel and on a byte scan, before any nish:simd
// surface is designed.
//
//   npm run build && node bench/simd-s3a.mjs [--runs N] [--only a,b] [--self] [--compiler <nish>]
//     --runs N    timed rounds per row after one warm-up (default 7, the note's minimum),
//                 rounded up to a multiple of the row's columns so each form leads equally
//     --only a,b  rows to run: mat-vec, depth (default: both)
//     --self      time a byte-identical copy of the Nish checked binary as a fifth column
//
// Each kernel is written four ways in bench/simd-s3a/:
//
//   1 C vector     *-vector.c: C's generic vectors (vector_size(16)), which lower
//                  to the LLVM vector IR a nish:simd kernel would; the file is
//                  refused untimed if its IR calls an llvm.x86 or llvm.aarch64
//                  intrinsic or its source names an intrinsic header, and that
//                  refusal is itself tested on an x86-64 and an AArch64 probe
//                  that do, so the check cannot pass by matching nothing
//   2 C scalar     *-scalar.c: the same work one element at a time
//   3 Nish checked *-checked.ts: §3.2.1's fair comparator, checked indexing
//   4 Nish unchecked *-unchecked.ts: the same through uncheckedGet
//
// The C forms are built with `clang -O3 -ffp-contract=off` and no -march, so
// they target the default CPU as `nish --link` does and no form contracts a
// multiply and an add into an FMA the others do not; the Nish forms with
// `nish --link --profile speed`. All forms of a row run in rotating rounds and
// must print the same checksum. The depth rows scan two documents (a dense
// one, S0's, and a sparse log), each one row; their setup-only run, which
// builds the document and scans it no times, is timed too, so the row can say
// how much of a process is the scan.
//
// After the table, a ratio of each form against Nish checked on the minimum
// and the median, the copy's ratio as the noise band with --self, and which
// loops clang's loop and SLP vectorizers turned into vector code in each
// scalar form at -O3: a scalar form the optimiser already vectorised is part of
// what a hand-written kernel has to beat.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "./compiler.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const srcDir = path.join(root, "bench", "simd-s3a")
const outDir = path.join(root, "build", "bench", "simd-s3a")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/simd-s3a.mjs: ${msg}`)
  process.exit(2)
}

const KERNELS = ["mat-vec", "depth"]
/** The arguments each kernel's rows run with: one row per entry. */
const ROWS = { "mat-vec": [[]], depth: [["s0"], ["log"]] }
const FORMS = ["vector", "scalar", "checked", "unchecked"]
const LABEL = {
  vector: "1 C vector",
  scalar: "2 C scalar",
  checked: "3 Nish checked",
  unchecked: "4 Nish unchecked",
}
const CC = process.env.CC || "clang"
const CFLAGS = ["-O3", "-ffp-contract=off"]

let runs = 7
let only = new Set(KERNELS)
let self = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--runs") {
    runs = Number(argv[++i])
  } else if (argv[i] === "--only") {
    only = new Set((argv[++i] ?? "").split(",").filter(Boolean))
  } else if (argv[i] === "--self") {
    self = true
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(runs >= 1)) {
  fail("--runs needs a positive count")
}
if (only.size === 0) {
  fail(`--only needs at least one kernel (kernels: ${KERNELS.join(", ")})`)
}
for (const name of only) {
  if (!KERNELS.includes(name)) {
    fail(`unknown kernel ${name} (kernels: ${KERNELS.join(", ")})`)
  }
}

/** Read before anything is timed, so a commit made during a long run is not the one reported. */
const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
})()

fs.mkdirSync(outDir, { recursive: true })
const rel = (p) => path.relative(root, p)

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    fail(`${what}: ${cmd} ${args.join(" ")} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
  }
  return r
}

// ---- Portability -----------------------------------------------------------------------------

/** The target intrinsics a portable kernel may not reach, by the name LLVM gives their calls. */
const TARGET_INTRINSIC = /@llvm\.(x86|aarch64)\./
/** The ways C source reaches them by name, which a host-target IR check would miss on the other target's branch of an #ifdef. */
const TARGET_SOURCE =
  /#\s*include\s*[<"](\w*intrin|arm_neon|arm_sve|wasm_simd128|altivec)\.h[>"]|__builtin_(ia32|neon|aarch64)_|__attribute__\s*\(\(\s*target\s*\(/

/** `file`'s LLVM IR at -O2, for `target` (the host's when omitted): the code clang generates, before the backend. */
const irOf = (file, target = []) =>
  run(CC, [...target, "-O2", "-S", "-emit-llvm", rel(file), "-o", "-"], `IR of ${rel(file)}`).stdout

/**
 * Probes that do call a target intrinsic, one for each architecture, compiled
 * for that architecture freestanding so either host tests both: the check has
 * to catch each, or a clean answer on a vector file means nothing. They use
 * intrinsics clang keeps as calls: clang 18 already lowers _mm_movemask_epi8
 * and vaddvq_u8 to generic IR, which is why those are not the probes.
 */
const PROBES = [
  [
    "x86_64-linux-gnu",
    "#include <emmintrin.h>\n__m128i probe(__m128i x, __m128i y) { return _mm_sad_epu8(x, y); }\n",
  ],
  [
    "aarch64-linux-gnu",
    "#include <arm_neon.h>\nuint8x16_t probe(uint8x16_t t, uint8x16_t i) { return vqtbl1q_u8(t, i); }\n",
  ],
]
for (const [target, source] of PROBES) {
  const probe = path.join(outDir, `probe-${target.split("-")[0]}.c`)
  fs.writeFileSync(probe, source)
  if (!TARGET_INTRINSIC.test(irOf(probe, [`--target=${target}`, "-ffreestanding"]))) {
    fail(`the portability check missed the target intrinsic in ${rel(probe)}`)
  }
  if (!TARGET_SOURCE.test(source)) {
    fail(`the portability check missed the intrinsic header in ${rel(probe)}`)
  }
}

for (const kernel of KERNELS.filter((k) => only.has(k))) {
  const file = path.join(srcDir, `${kernel}-vector.c`)
  const named = fs.readFileSync(file, "utf8").match(TARGET_SOURCE)
  if (named !== null) {
    fail(`${rel(file)} is not portable, refusing to time it: it names ${named[0]}`)
  }
  const hit = irOf(file)
    .split("\n")
    .find((line) => TARGET_INTRINSIC.test(line))
  if (hit !== undefined) {
    fail(`${rel(file)} is not portable, refusing to time it: its IR has\n  ${hit.trim()}`)
  }
}
console.log(
  "portability: no target intrinsic in any vector form's source or IR (the x86-64 and AArch64 probes are caught)"
)

// ---- Builds ----------------------------------------------------------------------------------

/** Each form of `kernel` built: { form: exe }. */
const build = (kernel) => {
  const exes = {}
  for (const form of FORMS) {
    const exe = path.join(outDir, `${kernel}-${form}`)
    if (form === "vector" || form === "scalar") {
      run(CC, [...CFLAGS, rel(path.join(srcDir, `${kernel}-${form}.c`)), "-o", rel(exe)], `${kernel} ${form}`)
    } else {
      const src = path.join(srcDir, `${kernel}-${form}.ts`)
      run(
        nishc.cmd,
        [...nishc.prefix, rel(src), "--link", rel(exe), "--profile", "speed"],
        `${kernel} ${form}`
      )
    }
    exes[form] = exe
  }
  return exes
}

/**
 * The loops clang's loop and SLP vectorizers turned into vector code in a
 * scalar form at -O3, as `file:line: text` with the source line beside it.
 * A Nish form is compiled to IR with -g so the remarks carry its lines.
 */
const vectorised = (kernel, form) => {
  let input
  let flags = ["-O3", "-g", "-c", "-Rpass=loop-vectorize|slp-vectorizer", "-o", "/dev/null"]
  if (form === "scalar") {
    input = path.join(srcDir, `${kernel}-scalar.c`)
    flags = [...flags, "-ffp-contract=off"]
  } else {
    input = path.join(outDir, `${kernel}-${form}.ll`)
    const src = path.join(srcDir, `${kernel}-${form}.ts`)
    run(nishc.cmd, [...nishc.prefix, rel(src), "-g", "-o", rel(input)], `${kernel} ${form} -g`)
  }
  const r = run(CC, [...flags, rel(input)], `vectorizer remarks for ${kernel} ${form}`)
  const remarks = []
  for (const m of r.stderr.matchAll(
    /([\w./-]+):(\d+):\d+: (?:remark: )?(vectorized loop[^[]*|SLP vectorized[^[]*)/g
  )) {
    const lines = fs.readFileSync(path.join(root, m[1]), "utf8").split("\n")
    remarks.push(`${path.basename(m[1])}:${m[2]}: ${m[3].trim()}: ${lines[Number(m[2]) - 1].trim()}`)
  }
  return remarks
}

// ---- Timing ----------------------------------------------------------------------------------

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** One process, timed from spawn to exit; its stdout is the answer. */
const timeProcess = (cmd, args) => () => {
  const t0 = process.hrtime.bigint()
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  if (r.status !== 0) {
    fail(`${cmd} ${args.join(" ")} exited with ${r.status}\n${r.stdout}${r.stderr}`)
  }
  return { ms, answer: r.stdout.trim() }
}

/**
 * Builds timed against each other in rotating rounds, as bench/simd-s0.mjs
 * does, so a slow stretch of a shared machine falls on every column rather
 * than on whichever ran last. One warm-up of each, then `runs` rounds (rounded
 * up to a multiple of the count), each running all of them and rotating which
 * goes first. All must print the same answer: [{ min, median, answer }, ...].
 */
const timeAlternating = (what, builds) => {
  const n = builds.length
  const times = builds.map(() => [])
  let answer = null
  const rounds = Math.ceil(runs / n) * n
  for (let i = 0; i <= rounds; i++) {
    const order = builds.map((_, j) => (i + 1 + j) % n)
    for (const k of order) {
      const r = builds[k]()
      if (answer !== null && r.answer !== answer) {
        fail(
          `${what}: round ${i}, column ${k + 1} printed ${JSON.stringify(r.answer)}, not ${JSON.stringify(answer)}`
        )
      }
      answer = r.answer
      if (i > 0) {
        times[k].push(r.ms)
      }
    }
  }
  return times.map((t) => ({ min: Math.min(...t), median: median(t), answer }))
}

const fmt = (ms) => `${ms.toFixed(1).padStart(8)} ms`
/** How many times faster `to` is than `from`, on the minimum and the median. */
const ratio = (from, to) =>
  `${(from.min / to.min).toFixed(2)}x min, ${(from.median / to.median).toFixed(2)}x median`

const summary = []
for (const kernel of KERNELS.filter((k) => only.has(k))) {
  const exes = build(kernel)
  const columns = [...FORMS]
  const copies = { ...exes }
  if (self) {
    copies.copy = path.join(outDir, `${kernel}-checked-copy`)
    fs.copyFileSync(exes.checked, copies.copy)
    columns.push("copy")
  }
  for (const args of ROWS[kernel]) {
    const name = [kernel, ...args].join(" ")
    const r = timeAlternating(
      name,
      columns.map((c) => timeProcess(copies[c], args))
    )
    console.log(`\n${name}: checksum ${r[0].answer}, ${r.length} columns`)
    const byForm = Object.fromEntries(columns.map((c, i) => [c, r[i]]))
    for (const c of columns) {
      const label = c === "copy" ? "3 Nish checked (copy)" : LABEL[c]
      console.log(`  ${label.padEnd(22)} min ${fmt(byForm[c].min)}  median ${fmt(byForm[c].median)}`)
    }
    if (kernel === "depth") {
      const setup = (c) => {
        const t = timeAlternating(`${name} setup`, [timeProcess(exes[c], [...args, "setup"])])
        return t[0].min
      }
      console.log(
        `  setup only (document built, no scans): C vector ${fmt(setup("vector"))}, Nish checked ${fmt(setup("checked"))}`
      )
    }
    const lines = [
      `${name}: C vector over Nish checked ${ratio(byForm.checked, byForm.vector)}`,
      `${name}: C vector over Nish unchecked ${ratio(byForm.unchecked, byForm.vector)}`,
      `${name}: C vector over C scalar ${ratio(byForm.scalar, byForm.vector)}`,
    ]
    if (self) {
      lines.push(`${name}: Nish checked over its copy (the noise band) ${ratio(byForm.copy, byForm.checked)}`)
    }
    summary.push(...lines)
  }
  for (const form of ["scalar", "checked", "unchecked"]) {
    const remarks = vectorised(kernel, form)
    summary.push(`${kernel} ${LABEL[form]} at -O3:${remarks.length === 0 ? " no loop vectorised" : ""}`)
    summary.push(...remarks.map((r) => `  ${r}`))
  }
}

// ---- Summary ---------------------------------------------------------------------------------

const cpu = (() => {
  try {
    const m = fs.readFileSync("/proc/cpuinfo", "utf8").match(/^model name\s*:\s*(.+)$/m)
    return m ? m[1].trim() : "unknown"
  } catch {
    return "unknown"
  }
})()
const clang = run(CC, ["--version"], "clang --version").stdout.split("\n")[0]
const columns = FORMS.length + (self ? 1 : 0)
console.log(
  `\n${Math.ceil(runs / columns) * columns} rotating rounds of ${columns} after one warm-up, at ${commit}, on ${cpu} (${process.arch}), ${clang}`
)
for (const line of summary) {
  console.log(line)
}
