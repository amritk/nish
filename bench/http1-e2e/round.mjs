// One measured round of the challenge submission under loadgen, sampling
// only the HTTP workers. run.sh calls it; README.md says what each figure is.
//
//   node round.mjs --arm B --round 1 --dir <built submission> --loadgen <bin>
//                  --nish <version> --out <results/....json> [--cachegrind <dir>]
//
// The window is fixed in loadgen's clock: the ramp starts at --start-at, the
// measure window is [RAMP, RAMP + MEASURE) seconds after it, and the sample is
// [RAMP + SKIP, RAMP + MEASURE - SKIP). Requests are the ones loadgen's
// per-second timeline counts as completed in those seconds.
//
// With --cachegrind the round runs one HTTP worker (HTTP_WORKERS=1, half the
// users, so the worker holds the connections each of two holds) under
// valgrind's cachegrind, every other process outside it, then a second start
// that serves nothing, whose counts are subtracted: what is left is the cost of
// the requests loadgen counted over the whole run.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { parseCachegrind } from "./cachegrind.mjs"

const HERE = path.dirname(new URL(import.meta.url).pathname)
const args = {}
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1]
}
const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k])
const cg = args.cachegrind
const USERS = Number(env("USERS", cg ? 7500 : 15000))
const THINK = env("THINK", "0.25")
const RAMP = Number(env("RAMP", 60))
const MEASURE = Number(env("MEASURE", cg ? 60 : 120))
const TAIL = Number(env("TAIL", 5))
const SKIP = Number(env("SKIP", 10))
const PERF = env("PERF", "") === "1"
const PERF_RECORD = Number(env("PERF_RECORD", 0))
const TRACE = Number(env("TRACE", 0))
const PORT = 8080
const SECRET = "http1-e2e-not-a-secret"
const HTTP_WORKERS = cg
  ? 1
  : Number(env("HTTP_WORKERS", Math.max(2, Math.floor(os.availableParallelism() / 4))))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sleepUntil = (t) => sleep(Math.max(0, t - Date.now()))
const read = (f) => {
  try {
    return fs.readFileSync(f, "utf8")
  } catch {
    return ""
  }
}

const portOpen = () =>
  new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1")
    s.on("connect", () => {
      s.destroy()
      resolve(true)
    })
    s.on("error", () => resolve(false))
  })

/** Every process under `root`, with its prefork index when it has one. */
const descendants = (root) => {
  const kids = new Map()
  for (const d of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue
    const st = read(`/proc/${d}/stat`)
    const ppid = Number(st.slice(st.lastIndexOf(")") + 2).split(" ")[1])
    if (!kids.has(ppid)) kids.set(ppid, [])
    kids.get(ppid).push(Number(d))
  }
  const out = []
  const walk = (p) => {
    for (const c of kids.get(p) ?? []) {
      const m = read(`/proc/${c}/cmdline`).match(/--nish-prefork-worker=(\d+)/)
      out.push({ pid: c, index: m ? Number(m[1]) : -1 })
      walk(c)
    }
  }
  walk(root)
  return out
}

/** On-CPU ns (schedstat, every thread), utime and stime ticks, context switches. */
const snapshot = (pid) => {
  let oncpu = 0
  let vcsw = 0
  let ivcsw = 0
  for (const t of fs.readdirSync(`/proc/${pid}/task`)) {
    oncpu += Number(read(`/proc/${pid}/task/${t}/schedstat`).split(" ")[0])
    const st = read(`/proc/${pid}/task/${t}/status`)
    vcsw += Number(st.match(/^voluntary_ctxt_switches:\s+(\d+)/m)?.[1] ?? 0)
    ivcsw += Number(st.match(/^nonvoluntary_ctxt_switches:\s+(\d+)/m)?.[1] ?? 0)
  }
  const st = read(`/proc/${pid}/stat`)
  const f = st.slice(st.lastIndexOf(")") + 2).split(" ")
  return { oncpu, utime: Number(f[11]), stime: Number(f[12]), vcsw, ivcsw }
}
const diff = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, b[k] - a[k]]))

const machine = () => ({
  label: env("MACHINE", os.arch()),
  cpu: os.cpus()[0]?.model ?? "",
  cpus: os.availableParallelism(),
  kernel: os.release(),
  postgres: spawnSync("psql", ["-XAtc", "SHOW server_version", "-d", "postgres"], {
    encoding: "utf8",
  }).stdout.trim(),
  clk_tck: Number(spawnSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).stdout.trim()),
})

const startServer = (logFile, valgrindDir) => {
  const serverEnv = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(PORT),
    BCRYPT_WIDTH: "5",
    HTTP_WORKERS: String(HTTP_WORKERS),
    DATABASE_URL: "postgres://conduit:conduit@127.0.0.1:5432/conduit",
    JWT_SECRET: SECRET,
  }
  let argv = ["bash", path.join(args.dir, "start.sh")]
  if (valgrindDir) {
    // Workers 1 and up (the read service, the bcrypt services) run natively.
    const skip = Array.from({ length: 15 }, (_, i) => `*--nish-prefork-worker=${i + 1}`).join(",")
    fs.mkdirSync(valgrindDir, { recursive: true })
    argv = [
      "bash",
      "-c",
      'ulimit -n "$(ulimit -Hn)"; exec "$@"',
      "--",
      "valgrind",
      "--tool=cachegrind",
      "--cache-sim=yes",
      "--trace-children=yes",
      `--trace-children-skip-by-arg=${skip}`,
      `--cachegrind-out-file=${valgrindDir}/cg.%p`,
      path.join(args.dir, "bin/conduit"),
    ]
  }
  const log = fs.openSync(logFile, "w")
  const child = spawn(argv[0], argv.slice(1), { env: serverEnv, stdio: ["ignore", log, log], detached: true })
  return child
}

const stopServer = async (child) => {
  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {}
  const t = Date.now()
  while (child.exitCode === null && child.signalCode === null && Date.now() - t < 60000) await sleep(200)
  try {
    process.kill(-child.pid, "SIGKILL")
  } catch {}
  // valgrind writes its files as each process exits
  await sleep(1000)
}

const waitReady = async (child, limitMs) => {
  const t = Date.now()
  while (Date.now() - t < limitMs) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}`)
    if (await portOpen()) {
      const kids = descendants(child.pid).filter((k) => k.index >= 0)
      if (kids.length > HTTP_WORKERS) return kids
    }
    await sleep(500)
  }
  throw new Error("server not ready")
}

const runLoadgen = (startAt, outFile, users, measure) =>
  spawn(
    args.loadgen,
    [
      "run",
      "-target",
      `http://127.0.0.1:${PORT}`,
      "-users",
      String(users),
      "-think-scale",
      THINK,
      "-articles",
      "500000",
      "-ramp",
      `${RAMP}s`,
      "-measure",
      `${measure}s`,
      "-tail",
      `${TAIL}s`,
      "-secret",
      SECRET,
      "-start-at",
      String(startAt),
      "-run-id",
      `e2e-${args.arm}-${args.round}-${startAt}`,
      "-q",
      "-out",
      outFile,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  )

const exited = (child) =>
  new Promise((resolve) => {
    if (child.exitCode !== null) resolve(child.exitCode)
    else child.on("exit", (code) => resolve(code))
  })

/** Requests (and errors) loadgen counted as completed in seconds [from, to). */
const countWindow = (lg, from, to) => {
  let completed = 0
  let errors = 0
  for (const s of lg.timeline ?? []) {
    if (s.t >= from && s.t < to) {
      completed += s.completed
      errors += s.errors
    }
  }
  return { completed, errors }
}

const work = path.join(path.dirname(args.out), ".work")
fs.mkdirSync(work, { recursive: true })
const tag = `${args.arm}-${args.round}`

const measuredRound = async () => {
  const server = startServer(path.join(work, `${tag}.server.log`))
  const kids = await waitReady(server, 120000)
  const http = kids.filter((k) => k.index < HTTP_WORKERS).map((k) => k.pid)
  const others = kids.filter((k) => k.index >= HTTP_WORKERS).map((k) => k.pid)
  const startAt = Date.now() + 3000
  const lgOut = path.join(work, `${tag}.loadgen.json`)
  const lg = runLoadgen(startAt, lgOut, USERS, MEASURE)
  const from = RAMP + SKIP
  const to = RAMP + MEASURE - SKIP
  await sleepUntil(startAt + from * 1000)
  const a = Object.fromEntries([...http, ...others].map((p) => [p, snapshot(p)]))
  const side = []
  if (PERF) {
    side.push(
      spawnPromise(
        "bash",
        [path.join(HERE, "perf-stat.sh"), "stat", String(to - from), http.join(",")],
        "perf"
      )
    )
  }
  if (PERF_RECORD > 0) {
    side.push(
      spawnPromise(
        "bash",
        [
          path.join(HERE, "perf-stat.sh"),
          "record",
          String(PERF_RECORD),
          http.join(","),
          path.join(work, `${tag}.perf.data`),
        ],
        "perf_record"
      )
    )
  }
  if (TRACE > 0) {
    side.push(
      spawnPromise(
        "node",
        [path.join(HERE, "trace.mjs"), String(TRACE), http.join(","), path.join(work, `${tag}.trace`)],
        "trace"
      )
    )
  }
  await sleepUntil(startAt + to * 1000)
  const b = Object.fromEntries([...http, ...others].map((p) => [p, snapshot(p)]))
  const sideOut = Object.assign({}, ...(await Promise.all(side)))
  const code = await exited(lg)
  await stopServer(server)
  if (code !== 0) throw new Error(`loadgen exited ${code}`)
  const lgJson = JSON.parse(fs.readFileSync(lgOut, "utf8"))
  const win = countWindow(lgJson, from, to)
  const zero = { oncpu: 0, utime: 0, stime: 0, vcsw: 0, ivcsw: 0 }
  const sum = (pids) => pids.map((p) => diff(a[p], b[p])).reduce(add, zero)
  const w = sum(http)
  const ticks = w.utime + w.stime
  const per = (x) => x / win.completed
  const result = {
    kind: "round",
    arm: args.arm,
    round: args.round,
    nish: args.nish,
    machine: machine(),
    load: { users: USERS, think: THINK, ramp: RAMP, measure: MEASURE, tail: TAIL, window: [from, to] },
    http_workers: http.length,
    window_s: to - from,
    requests: win.completed,
    errors: win.errors,
    rps: win.completed / (to - from),
    workers: w,
    others: sum(others),
    per_request: {
      oncpu_ns: per(w.oncpu),
      user_ns: per(ticks ? (w.oncpu * w.utime) / ticks : 0),
      kernel_ns: per(ticks ? (w.oncpu * w.stime) / ticks : 0),
      vcsw: per(w.vcsw),
      ivcsw: per(w.ivcsw),
    },
    ...sideOut,
  }
  if (sideOut.perf?.counts) {
    result.perf.per_request = Object.fromEntries(
      Object.entries(sideOut.perf.counts).map(([k, v]) => [k, per(v)])
    )
  }
  if (sideOut.trace?.calls) {
    const tw = countWindow(lgJson, from, from + sideOut.trace.seconds)
    result.trace.requests = tw.completed
  }
  return result
}

const add = (x, y) => Object.fromEntries(Object.keys(x).map((k) => [k, x[k] + y[k]]))

/** Runs a side measurement; its stdout is one JSON object, stored under `key`. */
const spawnPromise = (cmd, argv, key) =>
  new Promise((resolve) => {
    const c = spawn(cmd, argv, { stdio: ["ignore", "pipe", "inherit"] })
    let out = ""
    c.stdout.on("data", (d) => {
      out += d
    })
    c.on("exit", (code) => {
      // A side measurement that cannot run (no PMU, no tracefs) is recorded, not fatal.
      let v
      try {
        v = JSON.parse(out)
      } catch {
        v = { error: `${path.basename(argv[0])} exited ${code}` }
      }
      if (code !== 0 && !v.error) v.error = `exited ${code}`
      resolve({ [key]: v })
    })
  })

const cachegrindRound = async () => {
  const dir = path.resolve(cg)
  fs.rmSync(dir, { recursive: true, force: true })
  const loaded = path.join(dir, "loaded")
  const idle = path.join(dir, "idle")
  const server = startServer(path.join(work, `${tag}.server.log`), loaded)
  const kids = await waitReady(server, 300000)
  const httpPid = kids.find((k) => k.index === 0).pid
  const startAt = Date.now() + 3000
  const lgOut = path.join(work, `${tag}.loadgen.json`)
  const lg = runLoadgen(startAt, lgOut, USERS, MEASURE)
  const code = await exited(lg)
  await stopServer(server)
  if (code !== 0) throw new Error(`loadgen exited ${code}`)
  const lgJson = JSON.parse(fs.readFileSync(lgOut, "utf8"))
  const all = countWindow(lgJson, -1e9, 1e9)
  // The same start with no load, for the cost of starting and stopping.
  const server2 = startServer(path.join(work, `${tag}.idle.log`), idle)
  const kids2 = await waitReady(server2, 300000)
  const idlePid = kids2.find((k) => k.index === 0).pid
  await sleep(Number(env("CG_IDLE", 20)) * 1000)
  await stopServer(server2)
  const busy = parseCachegrind(path.join(loaded, `cg.${httpPid}`))
  const base = parseCachegrind(path.join(idle, `cg.${idlePid}`))
  const fns = {}
  for (const [fn, v] of Object.entries(busy.fns)) {
    const b = base.fns[fn] ?? v.map(() => 0)
    fns[fn] = v.map((x, i) => x - b[i])
  }
  return {
    kind: "cachegrind",
    arm: args.arm,
    nish: args.nish,
    machine: machine(),
    load: { users: USERS, think: THINK, ramp: RAMP, measure: MEASURE, tail: TAIL, http_workers: 1 },
    requests: all.completed,
    errors: all.errors,
    events: busy.events,
    caches: busy.desc,
    totals: busy.totals.map((x, i) => x - base.totals[i]),
    // Functions over 0.05% of instructions or misses: the rest is "other".
    fns: Object.fromEntries(
      Object.entries(fns).filter(([, v]) => v.some((x, i) => Math.abs(x) > 0.0005 * Math.abs(busy.totals[i])))
    ),
  }
}

const result = cg ? await cachegrindRound() : await measuredRound()
fs.mkdirSync(path.dirname(args.out), { recursive: true })
fs.writeFileSync(args.out, `${JSON.stringify(result, null, 1)}\n`)
const pr = result.per_request
console.log(
  pr
    ? `${tag}: ${result.requests} requests in ${result.window_s} s (${result.rps.toFixed(0)}/s), on-CPU ${pr.oncpu_ns.toFixed(0)} ns/request (user ${pr.user_ns.toFixed(0)}, kernel ${pr.kernel_ns.toFixed(0)})`
    : `${tag}: cachegrind, ${result.requests} requests, ${(result.totals[0] / result.requests).toFixed(0)} Ir/request`
)
