// What `nish/net/postgres` costs a client beside libpq in pipeline mode, on
// the multicore server challenge's schema, --dev seed and queries: the same
// loop through the module (main.ts) and through libpq (twin.c), against the
// same PostgreSQL 18, and how much of a difference this machine can see at all.
//
//   bash bench/postgres/setup.sh   # once: the cluster and its seed
//   npm run build && node bench/postgres/run.mjs [--validate] [--rounds N] [--compiler <nish>]
//     --validate  one run of each side at small counts: rows, checksums and
//                 failures must agree, nothing is timed
//     --rounds N  timed rounds, rounded up to a multiple of 3 (default 12),
//                 after one uncounted warm-up round
//
// The cluster is setup.sh's, in $PG_BENCH_DIR (else $TMPDIR/nish-bench-postgres,
// /tmp without TMPDIR); run.mjs starts it on a free port on 127.0.0.1 and stops
// it on exit, and refuses one setup.sh did not finish (no `seeded`). Run as
// root, the server runs as the postgres account, as setup.sh made it. Both
// sides connect over TCP as the seed's role, conduit, with SCRAM.
//
// main.ts is built with `--link` (the speed profile) and copied byte for byte;
// twin.c is compiled with the speed profile's optimisation flags and linked
// with the link's flags on Linux, against the system's libpq (pg_config), 17
// or later. Both prepare the same statement with int8 parameters, send each
// query as its own group ending in Sync (Bind, Execute for the module; Bind,
// Describe Portal, Execute for libpq, whose PQsendQueryPrepared always
// describes), keep the same number in flight (16; 1 for insert) on one
// connection, and read every column of every row as text, decoding the
// timestamps and walking the tag array. Every run must read its workload's
// rows per query times its count.
//
// Each round runs every workload on the build, its copy and the C twin, in an
// order that rotates by round, so over a multiple of 3 rounds each goes first
// equally often. A run times its own loop and prints a checksum of every value
// it read; every run of a workload must print the same rows and checksum. The
// report is the client's CPU time per query (user and system, getrusage of the
// client process only; the system part's median beside it) and queries per second, min, median and interquartile
// range over the rounds. The module's cost is the build less the twin, and the
// copy less the twin beside it; the noise band is the build against its byte-identical copy. The verdict is the
// medians: a difference is one this machine can see only when it exceeds the
// noise band and both sides' IQRs.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const here = path.join(root, "bench", "postgres")
const outDir = path.join(root, "build", "bench", "postgres")
const pgDir = process.env.PG_BENCH_DIR || path.join(process.env.TMPDIR || "/tmp", "nish-bench-postgres")
const pgBin = process.env.PG_BIN || "/usr/lib/postgresql/18/bin"
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/postgres/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 12
let validate = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--validate") {
    validate = true
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(rounds >= 2)) {
  fail("--rounds needs at least 2")
}

// Queries a run: each timed run is one to a few seconds, most of the list's
// spent waiting on the server.
// `rows` is what one query answers, checked on every run, so a short seed
// cannot time empty results.
const WORKLOADS = [
  { name: "pk", count: validate ? 2000 : 50000, rows: 1 },
  { name: "list", count: validate ? 200 : 3000, rows: 20 },
  { name: "insert", count: validate ? 500 : 5000, rows: 1 },
]

// scripts/build.sh: the speed profile's `optimise` less -flto (twin.c calls
// nothing it could inline: libpq is a shared library) and `elf`.
const CFLAGS = [
  "-O3",
  "-DNDEBUG",
  "-ffunction-sections",
  "-fdata-sections",
  "-fomit-frame-pointer",
  "-fno-asynchronous-unwind-tables",
  "-fno-unwind-tables",
  "-fno-plt",
]
const cc = process.env.CC || "clang"
// scripts/build.sh's ELF link: gc, lld when there is one, stripped.
const LDFLAGS =
  process.platform === "linux"
    ? [
        "-Wl,--gc-sections",
        "-Wl,--as-needed",
        "-Wl,-O2",
        "-Wl,--build-id=none",
        "-s",
        ...(spawnSync("ld.lld", ["--version"]).status === 0 ? ["-fuse-ld=lld"] : []),
      ]
    : []
// scripts/build.sh's hardening, read from the script rather than copied: its
// block runs here with this compiler, so the target's control-flow flag and
// the ELF-only stack-clash and relro flags come out as the build picks them.
// Less the stack protector and _FORTIFY_SOURCE, which build.sh's own comment
// says reach its C runtime alone (Nish's module is IR, where neither applies),
// so the twin's C takes what the Nish binary's generated code does.
const HARDEN = (() => {
  const script = fs.readFileSync(path.join(root, "scripts", "build.sh"), "utf8")
  const block = /^# Hardening, on every native profile[\s\S]*?^tls=\(\)$/m.exec(script)?.[0]
  if (block === undefined) {
    fail("scripts/build.sh has no hardening block ending at `tls=()` to read")
  }
  const r = spawnSync(
    "bash",
    ["-c", 'CC=$1; profile=speed; common=(); eval "$2"; printf "%s\\n" "${common[@]}"', "_", cc, block],
    { encoding: "utf8" }
  )
  if (r.status !== 0) {
    fail(`reading scripts/build.sh's hardening failed\n${r.stderr}`)
  }
  return r.stdout
    .split("\n")
    .filter((f) => f !== "" && f !== "-fstack-protector-strong" && !/^-[UD]_FORTIFY_SOURCE/.test(f))
})()

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 })
  if (r.status !== 0) {
    fail(`${what} failed (exit ${r.status})\n${r.stdout ?? ""}${r.stderr ?? ""}${r.error ?? ""}`)
  }
  return r.stdout
}

const pgConfig = (flag) => run("pg_config", [flag], `pg_config ${flag}`).trim()
const libpq = Number(/^PostgreSQL (\d+)/.exec(pgConfig("--version"))?.[1])
if (!(libpq >= 17)) {
  fail(`libpq ${libpq}: twin.c needs 17 or later (PQsendPipelineSync); run bench/postgres/setup.sh`)
}
const data = path.join(pgDir, "data")
if (!fs.existsSync(path.join(pgDir, "seeded"))) {
  fail(`no seeded cluster in ${pgDir}: run bash bench/postgres/setup.sh`)
}

fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "nish")
const copy = path.join(outDir, "nish-copy")
const twin = path.join(outDir, "twin")
for (const f of [exe, copy, twin]) {
  fs.rmSync(f, { force: true })
}
fs.rmSync(path.join(outDir, "nish.ir"), { recursive: true, force: true })
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(here, "main.ts"),
    "-o",
    `${path.join(outDir, "nish.ir")}${path.sep}`,
    "--link",
    exe,
  ],
  "the Nish build"
)
fs.copyFileSync(exe, copy)
if (!fs.readFileSync(exe).equals(fs.readFileSync(copy))) {
  fail("the copy is not byte-identical to the build")
}
run(
  cc,
  [
    ...CFLAGS,
    ...HARDEN,
    ...LDFLAGS,
    "-I",
    pgConfig("--includedir"),
    path.join(here, "twin.c"),
    "-L",
    pgConfig("--libdir"),
    "-lpq",
    "-o",
    twin,
  ],
  `${cc} twin`
)

// The server, as setup.sh made it: as postgres when run as root.
const as = (cmd, args) =>
  process.getuid?.() === 0 ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args]
const pgCtl = (args, what) => run(...as(path.join(pgBin, "pg_ctl"), ["-D", data, ...args]), what)
const port = await new Promise((resolve) => {
  const s = createServer().listen(0, "127.0.0.1", () => {
    const free = s.address().port
    s.close(() => resolve(free))
  })
})
pgCtl(["-l", path.join(data, "bench.log"), "-o", `-c port=${port}`, "-w", "start"], "pg_ctl start")
const stop = () => spawnSync(...as(path.join(pgBin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]))
process.on("exit", stop)
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(130))
}

const LINE = /^rows (\d+) checksum (\d+) failed (-?\d+) count (\d+) ns (\d+) user (\d+) sys (\d+)$/

/**
 * One run of `bin` on workload `w`: what it read, its client CPU µs per query
 * (user and system, and the system part alone) and its queries per second.
 */
const runOnce = (bin, w) => {
  const out = run(
    bin,
    [w.name, String(port), "conduit", "conduit", "conduit_dev", String(w.count)],
    `${path.basename(bin)} ${w.name}`
  )
  const m = LINE.exec(out.trim())
  if (m === null || m[3] !== "0" || Number(m[1]) !== w.rows * w.count) {
    fail(`${bin} ${w.name} printed ${JSON.stringify(out)}, not ${w.rows * w.count} rows`)
  }
  return {
    answer: `rows ${m[1]} checksum ${m[2]} count ${m[4]}`,
    cpu: (Number(m[6]) + Number(m[7])) / w.count,
    sys: Number(m[7]) / w.count,
    qps: (w.count * 1e9) / Number(m[5]),
  }
}

const bins = [exe, copy, twin]
const labels = ["nish", "nish copy", "C"]

if (validate) {
  for (const w of WORKLOADS) {
    const answers = bins.map((b) => runOnce(b, w).answer)
    if (answers.some((a) => a !== answers[0])) {
      fail(`${w.name}: the sides disagree\n${answers.map((a, k) => `  ${labels[k]}: ${a}`).join("\n")}`)
    }
    console.log(`${w.name}: ${answers[0]}, the same on both sides`)
  }
  console.log("bench/postgres: valid")
  process.exit(0)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const min = (xs) => Math.min(...xs)
const max = (xs) => Math.max(...xs)
/** The interquartile range, quartiles by linear interpolation. */
const iqr = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (q) => {
    const i = q * (s.length - 1)
    const lo = Math.floor(i)
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
  }
  return at(0.75) - at(0.25)
}

const cpus = WORKLOADS.map(() => bins.map(() => []))
const syss = WORKLOADS.map(() => bins.map(() => []))
const qpss = WORKLOADS.map(() => bins.map(() => []))
const answers = WORKLOADS.map(() => null)
// Round 0 warms the binaries, libpq and the server's caches and is not counted.
const timed = Math.ceil(rounds / bins.length) * bins.length
for (let round = 0; round <= timed; round++) {
  for (let w = 0; w < WORKLOADS.length; w++) {
    for (let j = 0; j < bins.length; j++) {
      const k = (j + round) % bins.length
      const r = runOnce(bins[k], WORKLOADS[w])
      if (answers[w] !== null && r.answer !== answers[w]) {
        fail(`round ${round}: ${labels[k]} ${WORKLOADS[w].name} printed ${r.answer}, not ${answers[w]}`)
      }
      answers[w] = r.answer
      if (round > 0) {
        cpus[w][k].push(r.cpu)
        syss[w][k].push(r.sys)
        qpss[w][k].push(r.qps)
      }
    }
  }
}

const us = (v) => `${v.toFixed(2)} µs`
const signed = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} µs`
const whole = (v) => v.toFixed(0)
console.log(
  `postgres: ${timed} rounds; PostgreSQL ${run(
    path.join(pgBin, "postgres"),
    ["--version"],
    "postgres --version"
  )
    .trim()
    .replace(/^postgres \(PostgreSQL\) /, "")},` +
    ` libpq ${pgConfig("--version").replace(/^PostgreSQL /, "")}; ${os.cpus().length} cores`
)
for (let w = 0; w < WORKLOADS.length; w++) {
  const [n, c, t] = cpus[w]
  console.log(`${WORKLOADS[w].name}: ${answers[w]}`)
  for (let k = 0; k < bins.length; k++) {
    const x = cpus[w][k]
    const y = qpss[w][k]
    console.log(
      `  ${labels[k].padEnd(10)} cpu min ${us(min(x))}/query, median ${us(median(x))}/query, IQR ${us(iqr(x))}` +
        ` (median system ${us(median(syss[w][k]))});` +
        ` qps max ${whole(max(y))}, median ${whole(median(y))}, IQR ${whole(iqr(y))}`
    )
  }
  const band = Math.abs(median(n) - median(c))
  const diff = median(n) - median(t)
  const seen = Math.abs(diff) > band && Math.abs(diff) > iqr(n) && Math.abs(diff) > iqr(t)
  console.log(
    `  nish - C   cpu min ${signed(min(n) - min(t))}, median ${signed(diff)}` +
      ` (${((diff / median(t)) * 100).toFixed(1)}% of C's median; the copy's` +
      ` ${signed(median(c) - median(t))}, ${(((median(c) - median(t)) / median(t)) * 100).toFixed(1)}%); qps median` +
      ` ${(((median(qpss[w][0]) - median(qpss[w][2])) / median(qpss[w][2])) * 100).toFixed(1)}% of C's`
  )
  console.log(
    `  noise band (build against its copy): cpu median ${us(band)} (${((band / median(n)) * 100).toFixed(1)}%),` +
      ` qps median ${((Math.abs(median(qpss[w][0]) - median(qpss[w][1])) / median(qpss[w][0])) * 100).toFixed(1)}%;` +
      ` ${seen ? "the cpu difference is outside it and both IQRs" : "the cpu difference is inside the noise"}`
  )
}
