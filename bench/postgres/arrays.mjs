// Whether `nish/net/postgres` should send `int4[]` and `int8[]` parameters in
// binary: arrays.ts's cells against a throwaway PostgreSQL 18 cluster of its
// own, text against binary, and the verdict of the rule the plan fixed.
//
//   npm run build && node bench/postgres/arrays.mjs [--validate] [--runs N] [--compiler <nish>]
//     --validate  every cell once at a tiny count: both formats must fold to
//                 the same checksum with no failure, and `check` (the
//                 server's count and bit_xor of the array as sent) must agree
//                 for each type and length; nothing is timed
//     --runs N    timed runs of every cell (default 7, at least 7 for a
//                 verdict), text and binary alternating which goes first
//
// The cluster is made under $TMPDIR (/tmp without it) in $PG_BIN
// (/usr/lib/postgresql/18/bin), on a free port on 127.0.0.1 with `trust`
// over TCP, and removed on exit; run as root, the server runs as the
// postgres account. It holds `bench_pk`, 100,000 int8 ids with their primary
// key. A timed run refuses a server whose major version is not 18; --validate
// prints the version and runs on any.
//
// The cells are every mode, type (int4, int8) and length (10, 100, 1,000,
// 10,000) in both formats:
//
// - unnest and any: the server backend's CPU time per Bind/Execute, from its
//   /proc/<pid>/schedstat over the timed loop, divided by the loop's groups.
// - encode: the client's CPU time (getrusage) per array encoded.
// - decode: the client's CPU time per `array_agg` column decoded.
//
// Each cell's figure is the median over the runs, with its min and max; a cut
// is `1 - binary / text` of the medians. The rule, at length 1,000: build the
// binary parameters only if binary cuts the server's CPU per Bind/Execute by
// 10% or more on either statement for either type, or the client's encode or
// decode CPU by 30% or more, and in either case the two cells' ranges do not
// overlap (binary's max below text's min), so the cut is beyond the spread.
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

const MODES = ["unnest", "any", "encode", "decode"]
const TYPES = ["4", "8"]
const LENGTHS = [10, 100, 1000, 10000]
const FORMATS = ["text", "binary"]
/** The elements a timed run moves: unnest and any send this many, encode and decode handle ten times as many. */
const SERVER_ELEMENTS = 2_000_000
const CLIENT_ELEMENTS = 20_000_000

const fail = (msg) => {
  console.error(`bench/postgres/arrays.mjs: ${msg}`)
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
const exe = path.join(outDir, "arrays")
fs.rmSync(exe, { force: true })
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(here, "arrays.ts"),
    "-o",
    `${path.join(outDir, "arrays.ir")}${path.sep}`,
    "--link",
    exe,
  ],
  "the Nish build"
)

const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "nish-bench-arrays-"))
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
psql("create table bench_pk (id int8 primary key)")
psql("insert into bench_pk select g from generate_series(1, 100000) g")
psql("vacuum analyze bench_pk")
const version = psql("show server_version")
const major = Number(psql("show server_version_num")) / 10000
if (!validate && Math.floor(major) !== 18) {
  fail(`the server is PostgreSQL ${version}; every figure must come from PostgreSQL 18 (set $PG_BIN)`)
}

/** One run of a cell: its parsed line. */
const cell = (mode, type, length, format, count) => {
  const args = [
    mode,
    String(port),
    "postgres",
    "unused",
    "postgres",
    String(count),
    type,
    String(length),
    format,
  ]
  const r = spawnSync(exe, args, { encoding: "utf8" })
  const line = r.stdout.trim().split("\n").pop() ?? ""
  if (r.status !== 0 || !line.startsWith("rows ")) {
    fail(`arrays ${args.join(" ")} exited ${r.status}:\n${r.stdout}${r.stderr}`)
  }
  const words = line.split(" ")
  const out = {}
  for (let k = 0; k + 1 < words.length; k += 2) {
    out[words[k]] = Number(words[k + 1])
  }
  if (out.failed !== 0) {
    fail(`arrays ${args.join(" ")}: ${out.failed} failures:\n${r.stdout}`)
  }
  return out
}

const countFor = (mode, length) =>
  mode === "unnest" || mode === "any"
    ? Math.max(200, Math.round(SERVER_ELEMENTS / length))
    : Math.max(1000, Math.round(CLIENT_ELEMENTS / length))

/** A run's figure, nanoseconds per Bind/Execute, encode or decode. */
const figure = (mode, r) =>
  (mode === "unnest" || mode === "any" ? r.server_ns : (r.user + r.sys) * 1000) / r.count

console.log(
  `PostgreSQL ${version}, ${os.cpus()[0]?.model ?? "unknown CPU"}, ${os.cpus().length} CPUs, ${os.platform()} ${os.release()}`
)

if (validate) {
  let checked = 0
  for (const type of TYPES) {
    for (const length of [0, 1, ...LENGTHS]) {
      for (const format of FORMATS) {
        cell("check", type, length, format, 3)
        checked += 1
      }
    }
  }
  for (const mode of MODES) {
    for (const type of TYPES) {
      for (const length of LENGTHS) {
        const [text, binary] = FORMATS.map((format) => cell(mode, type, length, format, 3))
        if (text.checksum !== binary.checksum || text.rows !== binary.rows) {
          fail(
            `${mode} int${type}[${length}]: text folds to ${text.rows}/${text.checksum}, binary to ${binary.rows}/${binary.checksum}`
          )
        }
        checked += 2
      }
    }
  }
  console.log(
    `validate: ${checked} runs, text and binary agree, the server's count and bit_xor match every array sent`
  )
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
    for (const type of TYPES) {
      for (const length of LENGTHS) {
        const order = (r + length) % 2 === 0 ? FORMATS : [...FORMATS].reverse()
        for (const format of order) {
          const key = `${mode} ${type} ${length} ${format}`
          const list = results.get(key) ?? []
          list.push(figure(mode, cell(mode, type, length, format, countFor(mode, length))))
          results.set(key, list)
        }
      }
    }
  }
  console.error(`run ${r + 1}/${runs} done`)
}

const fmt = (ns) => {
  if (ns < 1000) {
    return `${ns.toFixed(0)} ns`
  }
  return `${(ns / 1000).toFixed(ns >= 10000 ? 1 : 2)} µs`
}
const what = {
  unnest: "server CPU per Bind/Execute, `unnest($1)`",
  any: "server CPU per Bind/Execute, `id = any($1)`",
  encode: "client CPU per array encoded",
  decode: "client CPU per `array_agg` column decoded",
}
const build = []
console.log(`\n${runs} runs per cell; median (min–max); cut = 1 − binary/text of the medians\n`)
console.log("| measure | type | length | text | binary | cut |")
console.log("| --- | --- | ---: | ---: | ---: | ---: |")
for (const mode of MODES) {
  for (const type of TYPES) {
    for (const length of LENGTHS) {
      const [t, b] = FORMATS.map((f) => results.get(`${mode} ${type} ${length} ${f}`))
      const cut = 1 - median(b) / median(t)
      const beyond = Math.max(...b) < Math.min(...t)
      const show = (xs) => `${fmt(median(xs))} (${fmt(Math.min(...xs))}–${fmt(Math.max(...xs))})`
      console.log(
        `| ${what[mode]} | int${type} | ${length.toLocaleString("en")} | ${show(t)} | ${show(b)} | ${(cut * 100).toFixed(1)}%${beyond ? "" : " (within spread)"} |`
      )
      const threshold = mode === "unnest" || mode === "any" ? 0.1 : 0.3
      if (length === 1000 && cut >= threshold && beyond) {
        build.push(`${what[mode]}, int${type}: ${(cut * 100).toFixed(1)}%`)
      }
    }
  }
}
if (runs < 7) {
  console.log("\nverdict: none; fewer than 7 runs")
} else if (build.length > 0) {
  console.log(`\nverdict: build — at length 1,000 binary clears the rule on ${build.join("; ")}`)
} else {
  console.log(
    "\nverdict: do not build — at length 1,000 no cut reaches 10% of server CPU or 30% of client encode or decode CPU beyond the spread"
  )
}
