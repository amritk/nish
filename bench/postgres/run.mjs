// What `nish/net/postgres` costs a client beside libpq in pipeline mode, on
// the multicore server challenge's schema, --dev seed and queries: the same
// loop through the module (main.ts) and through libpq (twin.c), against the
// same PostgreSQL 18, and how much of a difference this machine can see at all.
//
//   bash bench/postgres/setup.sh   # once: the cluster and its seed
//   npm run build && node bench/postgres/run.mjs [--unix] [--validate] [--rounds N] [--compiler <nish>]
//     --unix      the module over TCP against the module over the server's
//                 Unix socket, instead of the module against libpq (below)
//     --validate  one run of each side at small counts: rows, checksums and
//                 failures must agree, nothing is timed
//     --rounds N  timed rounds, rounded up to a multiple of the sides (3, or
//                 4 with --unix; default 12), after one uncounted warm-up round
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
//
// --unix runs two workloads with one query in flight, `one` (`SELECT 1`) and
// `rows` (100 users from a random id), on the build and its copy, each over
// TCP to 127.0.0.1 (TCP_NODELAY) and over `unixConnect` to the cluster's
// `sock/.s.PGSQL.<port>`, the same rotation over the four sides. It needs the
// cluster's `local all all scram-sha-256` line, which setup.sh writes. Each
// run also reports the server backend's CPU over its timed loop, from
// `/proc/<pid>/schedstat` (time on a CPU, in nanoseconds) for the pid
// `pg_backend_pid()` answers, checked against `/proc/<pid>/stat`'s utime +
// stime, whose 10 ms ticks are too coarse to report. The report is µs per
// query (wall), client CPU and server CPU per query, min, median and IQR; the
// noise band is the build against its copy on the same transport, the larger
// of the two; Unix against TCP is a difference this machine can see only
// outside it and both IQRs.
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
let unix = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--unix") {
    unix = true
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
const WORKLOADS = unix
  ? [
      { name: "one", count: validate ? 500 : 20000, rows: 1 },
      { name: "rows", count: validate ? 100 : 5000, rows: 100 },
    ]
  : [
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
        "-Wl,--build-id=sha1",
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

// The server, as setup.sh made it: as postgres when run as root.
const asPostgres = (cmd, args) =>
  process.getuid?.() === 0 ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args]

const pgConfig = (flag) => run("pg_config", [flag], `pg_config ${flag}`).trim()
const libpq = unix ? 0 : Number(/^PostgreSQL (\d+)/.exec(pgConfig("--version"))?.[1])
if (!unix && !(libpq >= 17)) {
  fail(`libpq ${libpq}: twin.c needs 17 or later (PQsendPipelineSync); run bench/postgres/setup.sh`)
}
const data = path.join(pgDir, "data")
if (!fs.existsSync(path.join(pgDir, "seeded"))) {
  fail(`no seeded cluster in ${pgDir}: run bash bench/postgres/setup.sh`)
}
const sock = path.join(pgDir, "sock")
if (unix) {
  // data/ is the postgres account's, mode 0700, when setup.sh ran as root.
  const hba =
    spawnSync(...asPostgres("cat", [path.join(data, "pg_hba.conf")]), {
      encoding: "utf8",
    }).stdout ?? ""
  if (!/^local\s+all\s+all\s+scram-sha-256\s*$/m.test(hba)) {
    fail(`${data}/pg_hba.conf lets conduit in over TCP only: re-run bash bench/postgres/setup.sh`)
  }
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
if (!unix) {
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
}

const pgCtl = (args, what) => run(...asPostgres(path.join(pgBin, "pg_ctl"), ["-D", data, ...args]), what)
const port = await new Promise((resolve) => {
  const s = createServer().listen(0, "127.0.0.1", () => {
    const free = s.address().port
    s.close(() => resolve(free))
  })
})
pgCtl(["-l", path.join(data, "bench.log"), "-o", `-c port=${port}`, "-w", "start"], "pg_ctl start")
const stop = () =>
  spawnSync(...asPostgres(path.join(pgBin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]))
process.on("exit", stop)
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(130))
}

const LINE =
  /^rows (\d+) checksum (\d+) failed (-?\d+) count (\d+) ns (\d+) user (\d+) sys (\d+)(?: server_ticks (\d+) server_ns (\d+))?$/

/**
 * One run of `bin` on workload `w`, over the socket in `dir` when there is
 * one: what it read, its client CPU µs per query (user and system, and the
 * system part alone), its queries per second, and with --unix its µs per query
 * and the server backend's CPU µs per query.
 */
const runOnce = (bin, w, dir) => {
  const out = run(
    bin,
    [w.name, String(port), "conduit", "conduit", "conduit_dev", String(w.count), ...(dir ? [dir] : [])],
    `${path.basename(bin)} ${w.name}`
  )
  const m = LINE.exec(out.trim())
  if (m === null || m[3] !== "0" || Number(m[1]) !== w.rows * w.count) {
    fail(`${bin} ${w.name} printed ${JSON.stringify(out)}, not ${w.rows * w.count} rows`)
  }
  // The two clocks of the backend's CPU: stat's utime + stime in ticks of
  // 1/CLK_TCK (100 on Linux) and schedstat's nanoseconds must agree to a tick
  // or two, or one of them is not the backend's.
  if (m[8] !== undefined && Math.abs(Number(m[8]) * 1e7 - Number(m[9])) > 2e7 + Number(m[9]) / 10) {
    fail(`${bin} ${w.name}: the backend's stat says ${m[8]} ticks, its schedstat ${m[9]} ns`)
  }
  return {
    answer: `rows ${m[1]} checksum ${m[2]} count ${m[4]}`,
    cpu: (Number(m[6]) + Number(m[7])) / w.count,
    sys: Number(m[7]) / w.count,
    qps: (w.count * 1e9) / Number(m[5]),
    wall: Number(m[5]) / 1000 / w.count,
    server: Number(m[9]) / 1000 / w.count,
  }
}

// --unix: the build and its copy, over TCP and over the socket.
const bins = unix ? [exe, copy, exe, copy] : [exe, copy, twin]
const dirs = unix ? [null, null, sock, sock] : [null, null, null]
const labels = unix ? ["nish tcp", "copy tcp", "nish unix", "copy unix"] : ["nish", "nish copy", "C"]

if (validate) {
  for (const w of WORKLOADS) {
    const answers = bins.map((b, k) => runOnce(b, w, dirs[k]).answer)
    if (answers.some((a) => a !== answers[0])) {
      fail(`${w.name}: the sides disagree\n${answers.map((a, k) => `  ${labels[k]}: ${a}`).join("\n")}`)
    }
    console.log(`${w.name}: ${answers[0]}, the same on every side`)
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
const walls = WORKLOADS.map(() => bins.map(() => []))
const servers = WORKLOADS.map(() => bins.map(() => []))
const syss = WORKLOADS.map(() => bins.map(() => []))
const qpss = WORKLOADS.map(() => bins.map(() => []))
const answers = WORKLOADS.map(() => null)
// Round 0 warms the binaries, libpq and the server's caches and is not counted.
const timed = Math.ceil(rounds / bins.length) * bins.length
for (let round = 0; round <= timed; round++) {
  for (let w = 0; w < WORKLOADS.length; w++) {
    for (let j = 0; j < bins.length; j++) {
      const k = (j + round) % bins.length
      const r = runOnce(bins[k], WORKLOADS[w], dirs[k])
      if (answers[w] !== null && r.answer !== answers[w]) {
        fail(`round ${round}: ${labels[k]} ${WORKLOADS[w].name} printed ${r.answer}, not ${answers[w]}`)
      }
      answers[w] = r.answer
      if (round > 0) {
        cpus[w][k].push(r.cpu)
        syss[w][k].push(r.sys)
        qpss[w][k].push(r.qps)
        walls[w][k].push(r.wall)
        servers[w][k].push(r.server)
      }
    }
  }
}

const us = (v) => `${v.toFixed(2)} µs`
const signed = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} µs`
const whole = (v) => v.toFixed(0)
const server = run(path.join(pgBin, "postgres"), ["--version"], "postgres --version")
  .trim()
  .replace(/^postgres \(PostgreSQL\) /, "")
if (unix) {
  console.log(
    `postgres --unix: ${timed} rounds; PostgreSQL ${server}, one query in flight;` +
      ` ${os.cpus()[0]?.model.trim()}, ${os.cpus().length} CPUs, ${os.type()} ${os.release()}`
  )
  const FIGURES = [
    { what: "wall", of: walls },
    { what: "client cpu", of: cpus },
    { what: "server cpu", of: servers },
  ]
  for (let w = 0; w < WORKLOADS.length; w++) {
    console.log(`${WORKLOADS[w].name}: ${answers[w]}`)
    // A transport's samples are its build's and its copy's runs together.
    const both = (f, t) => [...f.of[w][2 * t], ...f.of[w][2 * t + 1]]
    for (const [t, name] of ["tcp", "unix"].entries()) {
      console.log(
        `  ${name.padEnd(5)}` +
          FIGURES.map((f) => {
            const x = both(f, t)
            return ` ${f.what} min ${us(min(x))}, median ${us(median(x))}, IQR ${us(iqr(x))}`
          }).join(";") +
          "/query"
      )
    }
    const band = (f) =>
      Math.max(...[0, 1].map((t) => Math.abs(median(f.of[w][2 * t]) - median(f.of[w][2 * t + 1]))))
    console.log(
      `  noise band (build against its copy):${FIGURES.map((f) => ` ${f.what} ${us(band(f))}`).join(";")}`
    )
    console.log(
      "  unix - tcp:" +
        FIGURES.map((f) => {
          const x = both(f, 1)
          const y = both(f, 0)
          const diff = median(x) - median(y)
          const seen = Math.abs(diff) > band(f) && Math.abs(diff) > iqr(x) && Math.abs(diff) > iqr(y)
          return ` ${f.what} ${signed(diff)} (${((diff / median(y)) * 100).toFixed(1)}%, ${seen ? "outside the noise" : "inside the noise"})`
        }).join(";")
    )
  }
  process.exit(0)
}
console.log(
  `postgres: ${timed} rounds; PostgreSQL ${server},` +
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
