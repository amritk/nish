// The multicore server challenge, locally: builds bench/multicore/conduit,
// runs the challenge's conformance suite against it, then drives it with the
// challenge's own load generator (bench/cmd/loadgen, run as it is from the
// clone setup.sh made) at fixed user counts, and measures what a request
// costs. bench/multicore/run.sh is the entry point; README.md beside the
// server records the figures.
//
//   bash bench/multicore/run.sh --conformance-only
//   bash bench/multicore/run.sh --users 4000,8000 --think-scale 0.1 --measure 60
//   bash bench/multicore/run.sh --idle 20000      memory per idle connection only
//
// Options: --alt <binary> (another build of the server, run in turn with this
// one, A then B at each repeat, so both meet the same machine: two sessions on
// one build differ by up to 4% here), --alt-env K=V,... (B's settings on top of
// the environment's; with no --alt, B is this build again), --users a,b,c (2000), --repeat n (1: each load runs n times, each
// on a fresh database, and the spread of the n is the noise band), --warmup s
// (30: before each measured run a quarter of its users browse the same fresh
// database for s seconds, as the challenge's scoring warms up first), --think-scale s (1; the loadgen's own
// testing knob, which multiplies think times and session lengths, so fewer
// users make the same request rate), --ramp s (20), --measure s (60),
// --tail s (10), --seed full|dev (full when setup.sh loaded it), --idle n
// (the idle-connection count, 10000; 0 skips it), --no-conformance,
// --compiler <nish>. The server's own variables (HTTP_WORKERS,
// DB_READ_CONNS, ...) pass through the environment.
//
// For each load it prints the loadgen's req/s, p95, p99 and error rate over
// the measured window, and from /proc the CPU every postgres process and
// every server process used over that same window, each divided by the
// requests completed in it: Postgres µs/request and app µs/request. The CPU
// is user plus system time from /proc/<pid>/stat, in clock ticks (100 Hz),
// read at the window's two ends. The app figure is split into the HTTP
// workers and the bcrypt service process, whose CPU is the logins' and
// sign-ups'. The memory figure is the server's summed
// VmRSS with `n` idle keep-alive connections open, each having made one
// request, less the same with none, over `n`: the process's own memory per
// connection, not the kernel's socket buffers.
//
// Every run starts the cluster setup.sh made on a free port and loads a
// fresh copy of the seed (CREATE DATABASE ... TEMPLATE), as the challenge's
// test/run.sh and its scoring do; the cluster is stopped at exit.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"
import { concurrencyCheck } from "./concurrency.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const here = import.meta.dirname
const { cmd, prefix, rest } = compilerFrom(process.argv.slice(2))
const pgBin = process.env.PG_BIN || "/usr/lib/postgresql/18/bin"
const dir = process.env.PG_BENCH_DIR || path.join(process.env.TMPDIR || "/tmp", "nish-bench-multicore")
const challenge = path.join(dir, "challenge")
const data = path.join(dir, "data")
const sock = path.join(dir, "sock")
const secret = "multicore-server-challenge"

const fail = (message) => {
  console.error(`run: ${message}`)
  process.exit(1)
}

const option = (name, fallback) => {
  const at = rest.indexOf(name)
  return at >= 0 && rest[at + 1] !== undefined ? rest[at + 1] : fallback
}
const flag = (name) => rest.includes(name)
const conformanceOnly = flag("--conformance-only")
const users = option("--users", "2000").split(",").map(Number)
const thinkScale = Number(option("--think-scale", "1"))
const ramp = Number(option("--ramp", "20"))
const measure = Number(option("--measure", "60"))
const tail = Number(option("--tail", "10"))
const idle = Number(option("--idle", "10000"))
const warmup = Number(option("--warmup", "30"))
const repeat = Number(option("--repeat", "1"))
const alt = option("--alt", "")
/** `K=V,K=V`: the environment B runs with on top of this one's, for a sweep of one build's settings. */
const altEnv = Object.fromEntries(
  option("--alt-env", "")
    .split(",")
    .filter((kv) => kv.includes("="))
    .map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)])
)
const idleOnly = flag("--idle") && !flag("--users")

if (!fs.existsSync(path.join(dir, "seeded"))) {
  fail(`no seeded cluster in ${dir}: run bash bench/multicore/setup.sh first`)
}

const run = (command, args, what, opts = {}) => {
  const r = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1 << 28, ...opts })
  if (r.status !== 0) {
    fail(`${what} failed (${r.status ?? r.signal}):\n${r.stdout ?? ""}${r.stderr ?? ""}`)
  }
  return r.stdout
}

// ---- Build ----------------------------------------------------------------------

const out = path.join(root, "build", "multicore")
fs.mkdirSync(out, { recursive: true })
const exe = path.join(out, "conduit")
run(
  cmd,
  [
    ...prefix,
    path.join(here, "conduit", "main.ts"),
    "--deny-retention",
    "-o",
    `${path.join(out, "ir")}/`,
    "--link",
    exe,
  ],
  "nish conduit"
)
const tools = path.join(dir, "bin")
fs.mkdirSync(tools, { recursive: true })
for (const tool of ["conformance", "loadgen"]) {
  run("go", ["build", "-o", path.join(tools, tool), `./cmd/${tool}`], `go build ${tool}`, {
    cwd: path.join(challenge, "bench"),
    env: { ...process.env, GOTOOLCHAIN: "auto" },
  })
}

// ---- The cluster ----------------------------------------------------------------

const as = (command, args) =>
  process.getuid?.() === 0 ? ["runuser", ["-u", "postgres", "--", command, ...args]] : [command, args]
const pgPort = await new Promise((resolve) => {
  const s = net.createServer().listen(0, "127.0.0.1", () => {
    const free = s.address().port
    s.close(() => resolve(free))
  })
})
run(
  ...as(path.join(pgBin, "pg_ctl"), [
    "-D",
    data,
    "-l",
    path.join(data, "multicore.log"),
    "-o",
    `-c port=${pgPort}`,
    "-w",
    "start",
  ]),
  "pg_ctl start"
)
let server = null
/** The run's database while a server runs on it, and the load generators running; a failed run drops and stops them. */
let liveDb = null
const loads = new Set()
const stopAll = () => {
  for (const child of [server, ...loads]) {
    if (child !== null) {
      try {
        process.kill(child.pid, "SIGTERM")
      } catch {
        // It has already exited.
      }
    }
  }
  if (liveDb !== null) {
    spawnSync(
      ...as(path.join(pgBin, "psql"), [
        "-X",
        "-q",
        "-h",
        sock,
        "-p",
        String(pgPort),
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-c",
        `DROP DATABASE IF EXISTS ${liveDb} WITH (FORCE)`,
      ])
    )
  }
  spawnSync(...as(path.join(pgBin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]))
}
process.on("exit", stopAll)
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => process.exit(130))
}
const psql = (sql) =>
  run(
    ...as(path.join(pgBin, "psql"), [
      "-X",
      "-q",
      "-At",
      "-h",
      sock,
      "-p",
      String(pgPort),
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      sql,
    ]),
    "psql"
  )
const hasFull = psql("SELECT count(*) FROM pg_database WHERE datname = 'conduit_seed'").trim() === "1"
const seed = option("--seed", hasFull ? "full" : "dev")
if (seed === "full" && !hasFull) {
  fail("no conduit_seed: run bash bench/multicore/setup.sh without --dev")
}

// ---- The server -----------------------------------------------------------------

const httpPort = Number(process.env.CONDUIT_PORT || "3000")
const base = `http://127.0.0.1:${httpPort}`
let dbCount = 0

/** A fresh database from `source`, and the server started on it; resolves once GET /api/tags answers. */
const startServer = async (source, binary = exe, extra = {}) => {
  dbCount += 1
  const db = `multicore_${process.pid}_${dbCount}`
  psql(`CREATE DATABASE ${db} TEMPLATE ${source} STRATEGY FILE_COPY`)
  liveDb = db
  const log = fs.openSync(path.join(out, "server.log"), "w")
  server = spawn(binary, [], {
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      DATABASE_URL: `postgres://conduit:conduit@127.0.0.1:${pgPort}/${db}`,
      JWT_SECRET: secret,
      HOST: "127.0.0.1",
      PORT: String(httpPort),
      ...extra,
    },
  })
  const started = Date.now()
  while (Date.now() - started < 60000) {
    const ok = await fetch(`${base}/api/tags`).then(
      (r) => r.status === 200,
      () => false
    )
    if (ok) {
      return db
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  fail(`GET /api/tags did not answer within 60 s:\n${fs.readFileSync(path.join(out, "server.log"), "utf8")}`)
}

const stopServer = async (db) => {
  if (server !== null) {
    const exited = new Promise((resolve) => server.once("exit", resolve))
    server.kill("SIGTERM")
    await exited
    server = null
  }
  psql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  liveDb = null
}

// ---- /proc ----------------------------------------------------------------------

const statOf = (pid) => {
  try {
    const text = fs.readFileSync(`/proc/${pid}/stat`, "utf8")
    const fields = text.slice(text.lastIndexOf(")") + 2).split(" ")
    return { ppid: Number(fields[1]), ticks: Number(fields[11]) + Number(fields[12]) }
  } catch {
    return null
  }
}
const allPids = () =>
  fs
    .readdirSync("/proc")
    .filter((n) => /^\d+$/.test(n))
    .map(Number)
const postmaster = () => Number(fs.readFileSync(path.join(data, "postmaster.pid"), "utf8").split("\n")[0])
/** The CPU ticks of `top` and of every process whose parent is `top`, by pid. */
const treeTicks = (top) => {
  const ticks = new Map()
  for (const pid of allPids()) {
    const s = statOf(pid)
    if (s !== null && (pid === top || s.ppid === top)) {
      ticks.set(pid, s.ticks)
    }
  }
  return ticks
}
/** Ticks used between two snapshots; a process that started in between counts from zero. */
const used = (before, after) => {
  let sum = 0
  for (const [pid, t] of after) {
    sum += t - (before.get(pid) ?? 0)
  }
  return sum
}
const hz = 100
const rssKiB = (top) => {
  let sum = 0
  for (const pid of allPids()) {
    const s = statOf(pid)
    if (s !== null && (pid === top || s.ppid === top)) {
      const m = /VmRSS:\s+(\d+) kB/.exec(fs.readFileSync(`/proc/${pid}/status`, "utf8"))
      sum += m === null ? 0 : Number(m[1])
    }
  }
  return sum
}

// ---- Conformance ----------------------------------------------------------------

if (!flag("--no-conformance") && !idleOnly) {
  const db = await startServer("conduit_dev")
  const r = spawnSync(path.join(tools, "conformance"), ["-base", base, "-secret", secret, "-q"], {
    encoding: "utf8",
  })
  await stopServer(db)
  const summary = /(\d+) steps, (\d+) passed, (\d+) failed/.exec(r.stdout + r.stderr)
  console.log(`conformance: ${summary === null ? "no summary" : `${summary[2]}/${summary[1]}`}`)
  if (r.status !== 0 || summary === null || summary[3] !== "0") {
    fail(`conformance failed:\n${r.stdout}${r.stderr}`)
  }
  // Reads made together answer as they do alone (concurrency.mjs), on a fresh copy.
  const fresh = await startServer("conduit_dev")
  const xacts = () =>
    Number(psql(`SELECT xact_commit FROM pg_stat_database WHERE datname = '${fresh}'`).trim())
  const c = await concurrencyCheck(base, xacts)
  await stopServer(fresh)
  console.log(
    `concurrency: ${c.requests - c.mismatches.length}/${c.requests} concurrent reads (${c.distinct} distinct) answered as alone, in ${c.transactions} transactions`
  )
  if (c.mismatches.length > 0) {
    fail(`concurrency check failed:\n${c.mismatches.slice(0, 20).join("\n")}`)
  }
}
if (conformanceOnly) {
  process.exit(0)
}

// ---- Load -----------------------------------------------------------------------

const template = seed === "full" ? "conduit_seed" : "conduit_dev"
const articles = seed === "full" ? 500000 : 10000
const results = []

/** The loadgen, run as the challenge's scoring runs it on one box. */
const spawnLoad = (n, startAt, rampS, measureS, tailS, outFile, tag) => {
  const child = spawn(
    path.join(tools, "loadgen"),
    [
      "run",
      "-target",
      base,
      "-users",
      String(n),
      "-ramp",
      `${rampS}s`,
      "-measure",
      `${measureS}s`,
      "-tail",
      `${tailS}s`,
      "-start-at",
      String(startAt),
      "-secret",
      secret,
      "-run-id",
      `r${process.pid}${tag}${dbCount}x${n}`,
      "-articles",
      String(articles),
      "-think-scale",
      String(thinkScale),
      "-out",
      outFile,
      "-q",
    ],
    { stdio: ["ignore", "inherit", "inherit"] }
  )
  loads.add(child)
  child.once("exit", () => loads.delete(child))
  return child
}

/** The server's bcrypt service: the worker whose prefork index is HTTP_WORKERS. */
const bcryptProcess = (top, workers) => {
  const worker = `--nish-prefork-worker=${workers}`
  for (const pid of allPids()) {
    const s = statOf(pid)
    if (s !== null && s.ppid === top) {
      try {
        if (fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").includes(worker)) {
          return pid
        }
      } catch {
        // The process exited between the listing and the read.
      }
    }
  }
  return -1
}

if (!idleOnly) {
  console.log(
    `load: seed ${seed}, think-scale ${thinkScale}, warm-up ${warmup} s, ramp ${ramp} s, measure ${measure} s, ${os.cpus().length} CPUs, ` +
      `HTTP_WORKERS=${process.env.HTTP_WORKERS ?? 2} DB_READ_CONNS=${process.env.DB_READ_CONNS ?? 3} DB_WRITE_CONNS=${process.env.DB_WRITE_CONNS ?? 1}` +
      (Object.keys(altEnv).length > 0
        ? `; B with ${Object.entries(altEnv)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ")}`
        : "")
  )
  console.log("users\treq/s\tp95 ms\tp99 ms\terrors\tpg µs/req\tapp µs/req\t(http + bcrypt)\tpass")
  const paired = alt !== "" || Object.keys(altEnv).length > 0
  const builds = paired
    ? [
        ["A", exe, {}],
        ["B", alt === "" ? exe : path.resolve(alt), altEnv],
      ]
    : [["", exe, {}]]
  const plan = []
  for (const u of users) {
    for (let k = 0; k < repeat; k++) {
      for (const [label, binary, env] of builds) {
        plan.push({ n: u, label, binary, env })
      }
    }
  }
  for (const { n, label, binary, env } of plan) {
    const db = await startServer(template, binary, env)
    if (warmup > 0) {
      const warm = spawnLoad(
        Math.max(1, Math.round(n / 4)),
        Date.now() + 1000,
        5,
        warmup,
        0,
        path.join(out, `warmup-${n}.json`),
        "w"
      )
      await new Promise((resolve) => warm.once("exit", resolve))
    }
    const startAt = Date.now() + 3000
    const outFile = path.join(out, `load-${n}.json`)
    const loadgen = spawnLoad(n, startAt, ramp, measure, tail, outFile, "m")
    const done = new Promise((resolve) => loadgen.once("exit", resolve))
    const windowStart = startAt + ramp * 1000
    await new Promise((resolve) => setTimeout(resolve, windowStart - Date.now()))
    const pg0 = treeTicks(postmaster())
    const app0 = treeTicks(server.pid)
    await new Promise((resolve) => setTimeout(resolve, measure * 1000))
    const pg1 = treeTicks(postmaster())
    const app1 = treeTicks(server.pid)
    const bcryptPid = bcryptProcess(server.pid, env.HTTP_WORKERS ?? process.env.HTTP_WORKERS ?? 2)
    const code = await done
    await stopServer(db)
    if (code !== 0) {
      fail(`loadgen exited ${code}`)
    }
    const merged = path.join(out, `merged-${n}.json`)
    // The merged file's name is shared by every run at `n`: a merge that failed
    // would leave the last run's figures to be read as this one's.
    fs.rmSync(merged, { force: true })
    const merging = spawnSync(path.join(tools, "loadgen"), ["merge", "-o", merged, outFile], {
      encoding: "utf8",
    })
    if (merging.status !== 0) {
      fail(`loadgen merge exited ${merging.status}: ${merging.stderr}`)
    }
    const m = JSON.parse(fs.readFileSync(merged, "utf8"))
    const requests = m.overall.count
    const perRequest = (ticks) => (ticks / hz / requests) * 1e6
    const pgUs = perRequest(used(pg0, pg1))
    const appUs = perRequest(used(app0, app1))
    const bcryptUs = bcryptPid < 0 ? 0 : perRequest((app1.get(bcryptPid) ?? 0) - (app0.get(bcryptPid) ?? 0))
    const row = {
      build: label,
      users: n,
      rps: m.overall.rps,
      p95: m.overall.p95_ms,
      p99: m.overall.p99_ms,
      errors: m.overall.error_rate,
      pgUs,
      appUs,
      bcryptUs,
      pass: m.verdict.pass,
      lgLimited: m.verdict.lg_limited,
    }
    results.push(row)
    console.log(
      `${label}${n}\t${row.rps.toFixed(0)}\t${row.p95.toFixed(1)}\t${row.p99.toFixed(1)}\t${(100 * row.errors).toFixed(2)}%\t` +
        `${pgUs.toFixed(1)}\t${appUs.toFixed(1)}\t(${(appUs - bcryptUs).toFixed(1)} + ${bcryptUs.toFixed(1)})\t` +
        `${row.pass ? "pass" : "FAIL"}${row.lgLimited ? " (load-generator limited)" : ""}`
    )
  }
}

// ---- Memory per idle connection --------------------------------------------------

if (idle > 0) {
  const db = await startServer(template)
  // Every connection makes one request, so its slot is built and warmed, then idles.
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const before = rssKiB(server.pid)
  const sockets = []
  const request = "GET /api/tags HTTP/1.1\r\nHost: x\r\n\r\n"
  let answered = 0
  await new Promise((resolve, reject) => {
    let opened = 0
    const open = () => {
      while (opened < idle && opened - answered < 256) {
        opened += 1
        const s = net.connect(httpPort, "127.0.0.1")
        s.on("error", reject)
        let seen = false
        s.on("data", (chunk) => {
          if (!seen && chunk.includes("HTTP/1.1 200")) {
            seen = true
            answered += 1
            if (answered === idle) {
              resolve()
            } else {
              open()
            }
          }
        })
        s.write(request)
        sockets.push(s)
      }
    }
    open()
  })
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const after = rssKiB(server.pid)
  for (const s of sockets) {
    s.destroy()
  }
  await stopServer(db)
  console.log(
    `idle: ${idle} keep-alive connections, server RSS ${before} -> ${after} KiB: ${((after - before) / idle).toFixed(2)} KiB per connection`
  )
  results.push({ idle, before, after, perConnection: (after - before) / idle })
}
fs.writeFileSync(path.join(out, "results.json"), `${JSON.stringify(results, null, 2)}\n`)
