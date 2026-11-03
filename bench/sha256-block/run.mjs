#!/usr/bin/env node
// SHA-256's block function in ns and TSC cycles a block: the Nish body
// (`NISH_SHA256=soft`), the SHA-NI kernel the compiler puts in front of it (the
// default), and OpenSSL's sha256_block_data_order under OPENSSL_ia32cap masks
// that pick its scalar, AVX2 and SHA-NI bodies; then HMAC-SHA256, HS256 and
// PBKDF2 under both NISH_SHA256 settings, which is the dispatch's timing proof.
// bench/sha256-block/main.ts and openssl.c say what each case times.
//
//   node bench/sha256-block/run.mjs [options] [--compiler <nish>]
//     --rounds N         timed rounds a case runs at least (default 11)
//     --binary [name=]<path>
//                        another build of main.ts as a column (repeatable),
//                        run under NISH_SHA256=soft: the old Nish body, such
//                        as main.ts built from `main`'s std/ (README.md)
//     --variant <spec>   main.ts against a rewrite of sha256Compress as a
//                        column (repeatable), under NISH_SHA256=soft: parts
//                        from variants.mjs joined by `+`, as locals+maj+nested
//
// The compiler reads `std/` from beside its own binary, so the columns time
// that compiler's library: the seed's bundled std/ under
// `--compiler build/seed/bin/nish`, the tree's under build/nish. A variant is
// built by a copy of the compiler in build/bench/sha256-block/variant-<spec>/,
// whose package root links to the compiler's for every file but
// std/crypto/sha256.ts, which is variants.mjs's rewrite of the compiler's own.
//
// Before timing, it prints sha256Compress's code in each Nish build (the
// module's .ll through `clang -O3 -c`, then `objdump -d`; README.md says what
// is counted) and `openssl speed -evp sha256` at 64 B and 8 KiB under each
// OPENSSL_ia32cap mask, as ns a block, beside which the bench's own OpenSSL
// columns are a cross-check.
//
// It builds main.ts with `--profile speed` and openssl.c and tsc.c with
// `clang -O2` into build/bench/sha256-block/, copies the Nish build byte for
// byte as the noise band's column, and measures the TSC's rate with tsc.c.
// Each case calibrates one iteration count on its slowest Nish column so a run
// takes about 200 ms; every column runs that count, and each round runs every
// column once in bench/json-compare/rounds.mjs's balanced order. Before
// timing, every column runs each case once and must print its `known`
// checksum, and every timed run must print the same checksum again.
//
// A block case's per-block figure is a run's ns over iterations × blocks,
// blocks being size / 64 + 1 (the padding block of a whole-block message).
// TSC cycles are that over the TSC's rate: a fixed clock, not the core's own
// under turbo. Spread is (max - min) / median of the rounds.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compilerFrom } from "../compiler.mjs"
import { roundOrder, roundsFor } from "../json-compare/rounds.mjs"
import { variantOf } from "./variants.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const outDir = path.join(root, "build", "bench", "sha256-block")
const nishc = compilerFrom(process.argv)

/** The variable OpenSSL reads its capability mask from. */
const IA32CAP = "OPENSSL_ia32cap"
/** OPENSSL_ia32cap masks (OpenSSL 3's `~` clears bits of the CPUID words). */
const MASK = {
  // Word 1 clears AVX (ECX 28) and SSSE3 (ECX 9); word 2 clears AVX2 (EBX 5),
  // BMI2 (EBX 8) and SHA (EBX 29): sha256_block_data_order's integer body.
  scalar: "~0x1000020000000000:~0x20000120",
  // Word 1 kept whole, word 2 loses only SHA: the AVX2 + BMI body.
  avx2: "~0x0:~0x20000000",
}

/**
 * Each case as `main <kernel> <size> <iterations>` takes it, `known` the
 * checksum of one iteration, `blocks` the compressions an iteration runs
 * (null: report ns an operation), and `openssl` whether openssl.c has it.
 */
const CASES = [
  { label: "block 16 KiB", kernel: "block", size: 16384, known: "34b8b4e9", blocks: 257, openssl: true },
  { label: "block 64 B", kernel: "block", size: 64, known: "3c7cc516", blocks: 2, openssl: true },
  { label: "hmac-sha256 64 B", kernel: "hmac", size: 64, known: "2c68bc93", blocks: null, openssl: true },
  { label: "hs256 sign+verify", kernel: "hs256", size: 0, known: "e1ecf09b", blocks: null, openssl: false },
  { label: "pbkdf2 1000", kernel: "pbkdf2", size: 1000, known: "8695dfb7", blocks: null, openssl: false },
]
/** The nanoseconds a calibrated run of the slowest Nish column aims at. */
const TARGET_NS = 200e6

const fail = (msg) => {
  console.error(`bench/sha256-block/run.mjs: ${msg}`)
  process.exit(2)
}

/** The setting that times the Nish body rather than the SHA-NI kernel. */
const soft = { NISH_SHA256: "soft" }
let rounds = 11
const binaries = []
const variants = []
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--binary") {
    const spec = argv[++i] ?? ""
    const eq = spec.indexOf("=")
    const file = path.resolve(eq > 0 ? spec.slice(eq + 1) : spec)
    binaries.push({
      id: eq > 0 ? spec.slice(0, eq) : path.relative(root, file),
      bin: file,
      env: soft,
      nish: true,
    })
  } else if (argv[i] === "--variant") {
    variants.push(argv[++i] ?? "")
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(Number.isInteger(rounds) && rounds >= 1)) {
  fail("--rounds needs a positive count")
}
for (const b of binaries) {
  if (!fs.existsSync(b.bin)) {
    fail(`--binary ${b.bin}: no such file`)
  }
}

const rel = (p) => path.relative(root, p)
const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (r.status !== 0) {
    console.error(`${what} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}
fs.mkdirSync(outDir, { recursive: true })
/** Builds main.ts with `cmd`, its IR in `irDir`, into `out`. */
const buildMain = (cmd, prefix, irDir, out, flags, what) =>
  run(
    cmd,
    [
      ...prefix,
      "bench/sha256-block/main.ts",
      "-o",
      `${rel(irDir)}/`,
      "--link",
      rel(out),
      "--profile",
      "speed",
      ...flags,
    ],
    what
  )
const exe = path.join(outDir, "sha256-block")
buildMain(nishc.cmd, nishc.prefix, outDir, exe, [], "building bench/sha256-block/main.ts")

/**
 * Makes `dst` a copy of the tree at `src` in which every entry is a link to
 * `src`'s, but for the paths `own` names (relative, `/`-separated), which are
 * written from `own`'s value: a `{ copy }` file or a `{ text }`.
 */
const mirror = (src, dst, own) => {
  fs.mkdirSync(dst, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const to = path.join(dst, name)
    const mine = [...own.keys()].filter((k) => k === name || k.startsWith(`${name}/`))
    fs.rmSync(to, { recursive: true, force: true })
    if (mine.length === 0) {
      fs.symlinkSync(path.join(src, name), to)
    } else if (mine.length === 1 && mine[0] === name) {
      const o = own.get(name)
      if (o.copy !== undefined) {
        fs.copyFileSync(o.copy, to)
        fs.chmodSync(to, 0o755)
      } else {
        fs.writeFileSync(to, o.text)
      }
    } else {
      mirror(path.join(src, name), to, new Map(mine.map((k) => [k.slice(name.length + 1), own.get(k)])))
    }
  }
}

/**
 * The compiler binary behind `file`: an install's `bin/nish` is a shell shim
 * that execs `libexec/nish` by absolute path (install.sh writes it), and that
 * binary finds std/ beside itself, so it is the one a mirror must copy.
 */
const realCompiler = (file) => {
  const head = fs.readFileSync(file).subarray(0, 512).toString("latin1")
  const shim = head.startsWith("#!") ? /^exec '([^']+)' "\$@"$/m.exec(head) : null
  return shim === null ? file : fs.realpathSync(shim[1])
}

/** Each variant as `{ name, exe, irDir }`, built against its own sha256.ts. */
const built = variants.map((spec) => {
  if (nishc.prefix.length > 0) {
    fail("--variant needs a native compiler, which finds std/ beside its binary")
  }
  const compiler = realCompiler(fs.realpathSync(nishc.cmd))
  const pkg = path.resolve(path.dirname(compiler), "..")
  let v
  try {
    v = variantOf(spec, fs.readFileSync(path.join(pkg, "std", "crypto", "sha256.ts"), "utf8"))
  } catch (e) {
    fail(e.message)
  }
  const dir = path.join(outDir, `variant-${spec}`)
  const bin = path.relative(pkg, compiler)
  mirror(
    pkg,
    path.join(dir, "pkg"),
    new Map([
      [bin.split(path.sep).join("/"), { copy: compiler }],
      ["std/crypto/sha256.ts", { text: v.source }],
    ])
  )
  const irDir = path.join(dir, "ir")
  const out = path.join(dir, "sha256-block")
  buildMain(path.join(dir, "pkg", bin), [], irDir, out, v.flags, `building main.ts against variant ${spec}`)
  return { name: spec, exe: out, irDir, flags: v.flags }
})

/**
 * sha256Compress's code in a build's IR: the module compiled alone with
 * `clang -O3 -c` (no LTO, so the function stays whole), disassembled by
 * `objdump -d`. Stack stores and loads are instructions with an
 * `rsp`-relative operand as destination and as source; moves are
 * register-to-register `mov`s.
 */
const codeOf = (irDir, flags) => {
  const obj = path.join(irDir, "sha256.o")
  // The IR names no CPU, so a `--cpu` build's level is passed to clang again.
  const cpu = flags.includes("--cpu") ? [`-march=${flags[flags.indexOf("--cpu") + 1]}`] : []
  run(
    "clang",
    ["-O3", ...cpu, "-c", path.join(irDir, "sha256.ll"), "-o", obj],
    `clang -O3 ${cpu.join(" ")} -c ${rel(irDir)}/sha256.ll`
  )
  const dis = run(
    "objdump",
    ["-d", "--no-show-raw-insn", "--disassemble=nish.sha256Compress", obj],
    `objdump ${rel(obj)}`
  )
  const insns = dis
    .split("\n")
    .map((l) => /^\s+[0-9a-f]+:\s+(\S+)\s*(.*)$/.exec(l))
    .filter((m) => m !== null)
    .map((m) => ({ op: m[1], args: m[2] }))
  const rsp = /\(%rsp\)/
  return {
    insns: insns.length,
    stores: insns.filter((i) => rsp.test(i.args) && rsp.test(i.args.split(",").at(-1))).length,
    loads: insns.filter((i) => rsp.test(i.args) && !rsp.test(i.args.split(",").at(-1))).length,
    moves: insns.filter((i) => /^mov[lq]?$/.test(i.op) && /^%\w+,%\w+$/.test(i.args)).length,
  }
}
console.log("sha256Compress, clang -O3 -c of each build's sha256.ll:")
console.log(
  `${"build".padEnd(28)} ${"insns".padStart(6)} ${"st rsp".padStart(6)} ${"ld rsp".padStart(6)} ${"reg mov".padStart(7)}`
)
for (const b of [{ name: "base", irDir: outDir, flags: [] }, ...built]) {
  const c = codeOf(b.irDir, b.flags)
  console.log(
    `${b.name.padEnd(28)} ${String(c.insns).padStart(6)} ${String(c.stores).padStart(6)} ${String(c.loads).padStart(6)} ${String(c.moves).padStart(7)}`
  )
}
// A copy rather than the same path twice, as bench/crypto/run.mjs makes one:
// each column is its own file, mapped on its own.
fs.copyFileSync(exe, `${exe}-copy`)
const ossl = path.join(outDir, "openssl")
run(
  "clang",
  ["-O2", "-I", "bench/crypto/lib", "bench/sha256-block/openssl.c", "-lcrypto", "-o", rel(ossl)],
  "building openssl.c"
)
const tsc = path.join(outDir, "tsc")
run("clang", ["-O2", "bench/sha256-block/tsc.c", "-o", rel(tsc)], "building tsc.c")
const tscHz = Number(/^tsc_hz (\d+)$/m.exec(run(tsc, [], "tsc"))?.[1])
if (!(tscHz > 0)) {
  fail("tsc printed no rate")
}

/**
 * The columns, each `{ id, bin, env, nish }`: the Nish body and its copy
 * first, then the SHA-NI default, the old builds, and OpenSSL's three bodies.
 */
const columns = [
  { id: "nish-soft", bin: exe, env: soft, nish: true },
  { id: "nish-soft-copy", bin: `${exe}-copy`, env: soft, nish: true },
  { id: "nish (sha-ni)", bin: exe, env: {}, nish: true },
  ...binaries,
  ...built.map((b) => ({ id: `variant ${b.name}`, bin: b.exe, env: soft, nish: true })),
  { id: "openssl scalar", bin: ossl, env: { [IA32CAP]: MASK.scalar }, nish: false },
  { id: "openssl avx2", bin: ossl, env: { [IA32CAP]: MASK.avx2 }, nish: false },
  { id: "openssl (sha-ni)", bin: ossl, env: {}, nish: false },
]

/** One run under bench/crypto/README.md's contract: `{ checksum, ns }`. */
const runOnce = (column, c, iterations) => {
  // Neither variable leaks in from the caller: a column sets what it times.
  const env = { ...process.env }
  delete env.NISH_SHA256
  delete env[IA32CAP]
  Object.assign(env, column.env)
  const r = spawnSync(column.bin, [c.kernel, String(c.size), String(iterations)], {
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  const ns = /^ns (\d+)$/m.exec(r.stderr ?? "")
  const sum = /^checksum ([0-9a-f]{8})\n$/.exec(r.stdout ?? "")
  if (r.error !== undefined || r.status !== 0 || ns === null || sum === null) {
    fail(
      `${column.id} ${c.kernel} ${c.size} ${iterations}: ${r.error?.message ?? `exit ${r.status}`}\n${r.stdout}${r.stderr}`
    )
  }
  return { checksum: sum[1], ns: Number(ns[1]) }
}

/** An iteration count that makes the Nish body take about TARGET_NS on `c`. */
const calibrate = (c) => {
  let iterations = 1
  for (;;) {
    const r = runOnce(columns[0], c, iterations)
    if (r.ns >= TARGET_NS / 10 || iterations >= 1 << 30) {
      return Math.max(1, Math.round((iterations * TARGET_NS) / Math.max(r.ns, 1)))
    }
    iterations *= Math.min(100, Math.max(2, Math.ceil(TARGET_NS / 10 / Math.max(r.ns, 1))))
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** `to` against `from` as a percentage of `from`: + is slower. */
const pct = (from, to) => `${to >= from ? "+" : ""}${((100 * (to - from)) / from).toFixed(1)}%`

const cpu =
  /^model name\s*:\s*(.*)$/m.exec(fs.readFileSync("/proc/cpuinfo", "utf8"))?.[1] ?? os.cpus()[0]?.model
console.log(
  `CPU: ${cpu}; TSC ${(tscHz / 1e9).toFixed(3)} GHz; ${os.cpus().length} cores; ${run("openssl", ["version"], "openssl version").trim()}`
)

/**
 * `openssl speed -evp sha256 -bytes <size> -seconds 1 -mr` under each mask, as
 * ns a block: the run's seconds over its count, over size / 64 + 1 blocks.
 * Each operation is a whole EVP digest, so short messages carry its setup.
 */
console.log("\nopenssl speed -evp sha256, ns a block (one 1 s run each):")
console.log(`${"mask".padEnd(18)} ${"64 B".padStart(10)} ${"8 KiB".padStart(10)}`)
for (const [id, mask] of [
  ["openssl scalar", MASK.scalar],
  ["openssl avx2", MASK.avx2],
  ["openssl (sha-ni)", null],
]) {
  const cells = [64, 8192].map((size) => {
    const env = { ...process.env }
    delete env[IA32CAP]
    if (mask !== null) {
      env[IA32CAP] = mask
    }
    const r = spawnSync(
      "openssl",
      ["speed", "-evp", "sha256", "-bytes", String(size), "-seconds", "1", "-mr"],
      {
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    const m = /^\+R:(\d+):sha256:([\d.]+)$/m.exec(`${r.stdout}${r.stderr}`)
    if (r.status !== 0 || m === null) {
      fail(`openssl speed under ${id}: exit ${r.status}\n${r.stdout}${r.stderr}`)
    }
    return ((Number(m[2]) * 1e9) / Number(m[1]) / (size / 64 + 1)).toFixed(1)
  })
  console.log(`${id.padEnd(18)} ${cells[0].padStart(10)} ${cells[1].padStart(10)}`)
}
console.log("")

const WIDTHS = [18, 36, 10, 10, 8, 10, 10, 10]
const line = (cells) => cells.map((c, i) => (i < 2 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join(" ")
console.log(line(["case", "column", "min ns", "median ns", "spread", "min cyc", "median cyc", "vs soft"]))

const columnsOf = (c) => columns.filter((col) => col.nish || c.openssl)
for (const c of CASES) {
  for (const col of columnsOf(c)) {
    const r = runOnce(col, c, 1)
    if (r.checksum !== c.known) {
      fail(`${col.id} ${c.label} printed checksum ${r.checksum} for one iteration, not the known ${c.known}`)
    }
  }
}

for (const c of CASES) {
  const cols = columnsOf(c)
  const n = roundsFor(cols.length, rounds)
  const iterations = calibrate(c)
  const per = iterations * (c.blocks ?? 1)
  const times = new Map(cols.map((col) => [col.id, []]))
  let checksum = null
  for (let round = 0; round < n; round++) {
    for (const col of roundOrder(cols, round)) {
      const r = runOnce(col, c, iterations)
      if (checksum !== null && r.checksum !== checksum) {
        fail(`${col.id} ${c.label} printed checksum ${r.checksum}, not ${checksum}`)
      }
      checksum = r.checksum
      times.get(col.id).push(r.ns / per)
    }
  }
  const base = median(times.get("nish-soft"))
  const cyc = (ns) => ((ns * tscHz) / 1e9).toFixed(0)
  for (const col of cols) {
    const ts = times.get(col.id)
    const m = median(ts)
    const lo = Math.min(...ts)
    const spread = `${((100 * (Math.max(...ts) - lo)) / m).toFixed(1)}%`
    console.log(
      line([
        c.label,
        col.id,
        lo.toFixed(1),
        m.toFixed(1),
        spread,
        cyc(lo),
        cyc(m),
        col.id === "nish-soft" ? "" : pct(base, m),
      ])
    )
  }
  console.log(
    `${"".padEnd(WIDTHS[0])} ${c.blocks === null ? "ns an operation" : `ns a block (${c.blocks} a message)`}; ` +
      `${iterations} iterations a run, ${n} rounds; checksum ${checksum}; band ±${(
        Math.abs(median(times.get("nish-soft-copy")) / base - 1) * 100
      ).toFixed(1)}%`
  )
}
console.log(
  `\nspread is (max - min) / median over the rounds; the band is nish-soft-copy's median against nish-soft's,` +
    " the same bytes, and a difference inside it is noise. cyc are TSC cycles."
)
