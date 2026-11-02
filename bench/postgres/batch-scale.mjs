// What one `PgBatcher` take costs per key from 1 request to the most,
// 65536: batch-scale.ts's cells against a throwaway PostgreSQL 18 cluster of
// its own.
//
//   npm run build && node bench/postgres/batch-scale.mjs [--validate] [--runs N] [--compiler <nish>]
//     --validate  every cell once, one timed round: every request must be
//                 answered as the statement says; nothing is reported
//     --runs N    timed runs of every cell (default 7)
//
// The cluster is made under $TMPDIR (/tmp without it) in $PG_BIN
// (/usr/lib/postgresql/18/bin), on a free port on 127.0.0.1 with `trust`
// over TCP, and removed on exit; run as root, the server runs as the
// postgres account. A timed run refuses a server whose major version is not
// 18; --validate prints the version and runs on any.
//
// The cells are both modes (spread keys, and keys that all collide in the
// batcher's table) at 1, 1024, 1025, 4096 and 65536 requests per take. A
// run of a cell takes enough rounds to answer at least 262,144 requests.
// Its figures:
//
// - wall: the timed rounds' wall time per request, from queueing it to its
//   answer routed (client, server and the loopback socket together).
// - cpu: the client's user + system CPU time per request (getrusage).
// - built: the peak resident set `new PgBatcher` added, in KiB.
// - peak: the process's peak resident set at the end, in KiB, less the same
//   cell's at 1 request, per request above the first: the memory a request
//   of the take costs, the batcher, its run, the connection's buffers and
//   the bench's own arrays together.
//
// Each figure is the median over the runs, with its min and max.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const here = path.join(root, "bench", "postgres")
const outDir = path.join(root, "build", "bench", "postgres")
const pgBin = process.env.PG_BIN || "/usr/lib/postgresql/18/bin"
const nishc = compilerFrom(process.argv)

const MODES = ["spread", "collide"]
const SIZES = [1, 1024, 1025, 4096, 65536]
/** The requests a timed run of a cell answers, at least. */
const REQUESTS = 262_144

const fail = (msg) => {
  console.error(`bench/postgres/batch-scale.mjs: ${msg}`)
  process.exit(2)
}

let runs = 7
let validate = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--validate") {
    validate = true
  } else if (argv[i] === "--runs") {
    runs = Number(argv[++i])
    if (!Number.isInteger(runs) || runs < 1) {
      fail("--runs needs a positive integer")
    }
  } else {
    fail(`unknown argument ${argv[i]}`)
  }
}

const asPostgres = (cmd, args) =>
  process.getuid() === 0 ? ["runuser", ["-u", "postgres", "--", cmd, ...args]] : [cmd, args]

const run = (cmd, args, step, postgres = false) => {
  const [c, a] = postgres ? asPostgres(cmd, args) : [cmd, args]
  const r = spawnSync(c, a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 })
  if (r.status !== 0) {
    fail(`${step} failed:\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

if (!fs.existsSync(path.join(pgBin, "initdb"))) {
  fail(`no initdb in ${pgBin}: install PostgreSQL 18 or set $PG_BIN to its bin directory`)
}
fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "batch-scale")
fs.rmSync(exe, { force: true })
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(here, "batch-scale.ts"),
    "-o",
    `${path.join(outDir, "batch-scale.ir")}${path.sep}`,
    "--link",
    exe,
  ],
  "the Nish build"
)

const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "nish-bench-batch-scale-"))
const data = path.join(dir, "data")
if (process.getuid() === 0) {
  const id = (flag) => Number(run("id", [flag, "postgres"], "id").trim())
  fs.chownSync(dir, id("-u"), id("-g"))
}
const port = await freePort()
let started = false
const stop = () => {
  if (started) {
    spawnSync(...asPostgres(path.join(pgBin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]))
  }
  fs.rmSync(dir, { recursive: true, force: true })
}
process.on("exit", stop)
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(130))
}
run(
  path.join(pgBin, "initdb"),
  ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-locale"],
  "initdb",
  true
)
const opts = `-c listen_addresses=127.0.0.1 -c port=${port} -c unix_socket_directories=${dir} -c fsync=off`
run(
  path.join(pgBin, "pg_ctl"),
  ["-D", data, "-o", opts, "-l", path.join(dir, "log"), "-w", "start"],
  "pg_ctl start",
  true
)
started = true
const psql = (sql) =>
  run(
    path.join(pgBin, "psql"),
    ["-h", dir, "-p", String(port), "-U", "postgres", "-qAt", "-c", sql],
    `psql: ${sql}`,
    true
  ).trim()
const version = psql("show server_version")
const major = Number(psql("show server_version_num")) / 10000
if (!validate && Math.floor(major) !== 18) {
  fail(`the server is PostgreSQL ${version}; every figure must come from PostgreSQL 18 (set $PG_BIN)`)
}

/** One run of a cell: its parsed line. */
const cell = (mode, n, rounds) => {
  const args = [mode, String(port), "postgres", "unused", "postgres", String(n), String(rounds)]
  const r = spawnSync(exe, args, { encoding: "utf8" })
  const line = r.stdout.trim().split("\n").pop() ?? ""
  if (r.status !== 0 || !line.startsWith("keys ")) {
    fail(`batch-scale ${args.join(" ")} exited ${r.status}:\n${r.stdout}${r.stderr}`)
  }
  const words = line.split(" ")
  const out = {}
  for (let k = 0; k + 1 < words.length; k += 2) {
    out[words[k]] = Number(words[k + 1])
  }
  if (out.wrong !== 0 || out.keys !== n * rounds) {
    fail(`batch-scale ${args.join(" ")}: ${out.wrong} wrong of ${out.keys}:\n${r.stdout}`)
  }
  return out
}

console.log(
  `PostgreSQL ${version}, ${os.cpus()[0]?.model ?? "unknown CPU"}, ${os.cpus().length} CPUs, ${os.platform()} ${os.release()}`
)

if (validate) {
  for (const mode of MODES) {
    for (const n of SIZES) {
      cell(mode, n, 1)
    }
  }
  console.log(`validate: ${MODES.length * SIZES.length} cells, every request answered as the statement says`)
  process.exit(0)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const results = new Map()
for (let r = 0; r < runs; r++) {
  for (const mode of MODES) {
    for (const n of SIZES) {
      const rounds = Math.max(4, Math.ceil(REQUESTS / n))
      const out = cell(mode, n, rounds)
      const list = results.get(`${mode} ${n}`) ?? []
      list.push(out)
      results.set(`${mode} ${n}`, list)
    }
  }
  console.error(`run ${r + 1}/${runs} done`)
}

const show = (xs, digits) =>
  `${median(xs).toFixed(digits)} (${Math.min(...xs).toFixed(digits)}–${Math.max(...xs).toFixed(digits)})`
console.log(`\n${runs} runs per cell; median (min–max)\n`)
console.log("| keys | requests per take | wall ns/request | client CPU ns/request | built KiB | peak bytes/request above 1 |")
console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
for (const mode of MODES) {
  const base = median(results.get(`${mode} 1`).map((o) => o.peak))
  for (const n of SIZES) {
    const list = results.get(`${mode} ${n}`)
    const wall = list.map((o) => o.ns / o.keys)
    const cpu = list.map((o) => (o.cpu * 1000) / o.keys)
    const built = list.map((o) => o.built)
    const perKey = n === 1 ? "—" : show(list.map((o) => ((o.peak - base) * 1024) / (n - 1)), 0)
    console.log(`| ${mode} | ${n.toLocaleString("en")} | ${show(wall, 0)} | ${show(cpu, 0)} | ${show(built, 0)} | ${perKey} |`)
  }
}
