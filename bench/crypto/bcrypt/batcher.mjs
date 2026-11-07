/**
 * Logins a second and p50 / p99 latency of a login server at cost 10, at
 * several Poisson arrival rates from light traffic to a burst, on one core
 * (every process pinned to CPU 0 with `taskset`) and on all of them:
 *
 *   (a)  one `bcryptVerify` per login, on one thread;
 *   (b)  one `bcryptVerify` per login, one single-threaded process a core,
 *        logins dealt round-robin, as a prefork server runs (a scope's task
 *        cannot read the clock to wait for its login, so (b) is processes);
 *   (c)  `nish/crypto/bcrypt-batch` at `bcryptCalibrate()`'s width over every
 *        core, with no hold and with a `--hold-us` hold.
 *
 * Every mode is the program login.ts: each run is given the same seeded
 * schedule and a start a little in the future on CLOCK_MONOTONIC, and a
 * login's latency runs from its scheduled arrival to its answer, so a login
 * that waits behind a busy server is charged for the wait. Logins a second is
 * the count over the time from the first arrival to the last answer.
 *
 * The modes run in interleaved rounds; a cell is the median of `--rounds`
 * rounds with their spread, and the fastest round (the most logins a second,
 * the least latency), which a shared host's interference cannot improve. The
 * noise band is (b) timed against a byte-identical copy of its binary, (b′),
 * in the same rounds (on one core (b) is (a), so (a) is timed against (a′)).
 *
 * Usage: node bench/crypto/bcrypt/batcher.mjs [--compiler <nish>] [--rounds N] [--hold-us N] [--cores N] [--json <file>]
 * Build products go to build/bench/bcrypt-login/.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { argValue, buildNish, intArg, median, root, run } from "./common.mjs"

const dir = path.join(root, "build", "bench", "bcrypt-login")
const compiler = argValue("--compiler", path.join(root, "build", "nish"))
const rounds = intArg("--rounds", 5, 1, 1000)
const holdUs = intArg("--hold-us", 5000, 0, 1e6)
const allCores = intArg("--cores", os.availableParallelism(), 1, 1024)
const jsonOut = argValue("--json", "")

fs.mkdirSync(dir, { recursive: true })
const source = fs.readFileSync(path.join(import.meta.dirname, "login.ts"), "utf8")
const exe = buildNish(compiler, dir, "login", source)
const twin = path.join(dir, "login-twin")
fs.copyFileSync(exe, twin)
fs.chmodSync(twin, 0o755)
const hashed = run(exe, ["hash"])
const hash = hashed.stdout.trim()
if (hashed.status !== 0 || hash.length !== 60) {
  console.error(`login hash failed: ${hashed.stdout}${hashed.stderr}`)
  process.exit(1)
}
const hasTaskset = run("taskset", ["-c", "0", "true"]).status === 0
if (!hasTaskset) {
  console.error("taskset is not there: the one-core table needs it")
  process.exit(1)
}

/** One process's run to completion: its stdout, or exit 1 naming it. */
const runOne = (argv) =>
  new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "pipe", "inherit"] })
    let out = ""
    child.stdout.on("data", (d) => {
      out += d
    })
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`${argv.join(" ")} exited ${code}:\n${out.slice(0, 400)}`)
        process.exit(1)
      }
      resolve(out)
    })
  })

/**
 * One run of `mode` ("a", "b", "c") with `binary` over `cores` at `rate` a
 * second for `n` logins: its logins a second, p50 and p99 in milliseconds.
 */
const once = async (binary, mode, cores, pinned, rate, n, hold) => {
  const start = process.hrtime.bigint() + 400_000_000n
  const s = String(start / 1_000_000_000n)
  const ns = String(start % 1_000_000_000n)
  const seed = String(1000 + rate)
  const pin = pinned ? ["taskset", "-c", "0"] : []
  const argvOf = (kind, worker, workers, tasks = cores) => [
    ...pin,
    binary,
    kind,
    String(tasks),
    String(rate),
    String(n),
    seed,
    String(hold),
    s,
    ns,
    String(worker),
    String(workers),
    hash,
  ]
  // (c) is one process over every core; (b) and (d) one a core, logins dealt
  // round-robin, (d)'s each a one-core batcher.
  const procs =
    mode === "c"
      ? [argvOf("c", 0, 1)]
      : mode === "d"
        ? Array.from({ length: cores }, (_, k) => argvOf("c", k, cores, 1))
        : Array.from({ length: mode === "a" ? 1 : cores }, (_, k) => argvOf("a", k, mode === "a" ? 1 : cores))
  const outs = await Promise.all(procs.map(runOne))
  let last = start
  const lat = new Array(n).fill(-1)
  for (const out of outs) {
    for (const line of out.trim().split("\n")) {
      const [a, b] = line.split(" ")
      if (a === "done") {
        if (BigInt(b) > last) {
          last = BigInt(b)
        }
      } else {
        lat[Number(a)] = Number(b) / 1e6
      }
    }
  }
  if (lat.some((x) => x < 0)) {
    console.error(`${mode} at ${rate}/s left a login unanswered`)
    process.exit(1)
  }
  const sorted = [...lat].sort((x, y) => x - y)
  const pct = (p) => sorted[Math.min(n - 1, Math.ceil((p / 100) * n) - 1)]
  return { perSecond: n / (Number(last - start) / 1e9), p50: pct(50), p99: pct(99) }
}

/** The logins a run is given at `rate`: about six seconds of arrivals, 48 to 240; a burst gets 16 a core, at least 96. */
const loginsAt = (rate, cores) =>
  rate === 0 ? Math.max(96, 16 * cores) : Math.min(240, Math.max(48, Math.round(rate * 6)))

const tables = [
  { cores: 1, pinned: true, rates: [5, 10, 15, 30, 0] },
  { cores: allCores, pinned: false, rates: [10, 30, 60, 120, 240, 0] },
]

const modesOf = (cores) =>
  cores === 1
    ? [
        { name: "(a) = (b)", binary: exe, mode: "a", hold: 0 },
        { name: "(a′) twin", binary: twin, mode: "a", hold: 0 },
        { name: "(c) hold 0", binary: exe, mode: "c", hold: 0 },
        { name: `(c) hold ${holdUs / 1000} ms`, binary: exe, mode: "c", hold: holdUs },
      ]
    : [
        { name: "(a)", binary: exe, mode: "a", hold: 0 },
        { name: "(b)", binary: exe, mode: "b", hold: 0 },
        { name: "(b′) twin", binary: twin, mode: "b", hold: 0 },
        { name: "(c) hold 0", binary: exe, mode: "c", hold: 0 },
        { name: `(c) hold ${holdUs / 1000} ms`, binary: exe, mode: "c", hold: holdUs },
        { name: "(d) hold 0", binary: exe, mode: "d", hold: 0 },
      ]

const samples = new Map()
const key = (t, rate, m) => `${t.cores}|${rate}|${m.name}`
for (let round = 0; round <= rounds; round++) {
  for (const t of tables) {
    for (const rate of t.rates) {
      for (const m of modesOf(t.cores)) {
        const r = await once(m.binary, m.mode, t.cores, t.pinned, rate, loginsAt(rate, t.cores), m.hold)
        if (round > 0) {
          const k = key(t, rate, m)
          if (!samples.has(k)) {
            samples.set(k, [])
          }
          samples.get(k).push(r)
        }
      }
    }
  }
  console.error(round === 0 ? "warm-up round done" : `round ${round} of ${rounds} done`)
}

const cpu =
  (fs.readFileSync("/proc/cpuinfo", "utf8").match(/model name\s*:\s*(.*)/) ?? [])[1] ?? "unknown CPU"
console.log(
  `${cpu}, ${os.availableParallelism()} CPUs; cost 10; ${rounds} rounds after a warm-up; hold ${holdUs} µs`
)
console.log("each cell: median (min–max) over the rounds, then [fastest round]\n")
const f0 = (x) => x.toFixed(0)
const f1 = (x) => x.toFixed(1)
const cell = (xs, digits, best) => {
  const fmt = digits === 0 ? f0 : f1
  return `${fmt(median(xs))} (${fmt(Math.min(...xs))}–${fmt(Math.max(...xs))}) [${fmt(best(xs))}]`
}
const record = []
for (const t of tables) {
  console.log(`### ${t.cores === 1 ? "One core" : `${t.cores} cores`}\n`)
  console.log("| arrivals/s | logins | mode | logins/s | p50 ms | p99 ms |")
  console.log("| ---: | ---: | --- | ---: | ---: | ---: |")
  for (const rate of t.rates) {
    for (const m of modesOf(t.cores)) {
      const rs = samples.get(key(t, rate, m))
      const per = rs.map((r) => r.perSecond)
      const p50 = rs.map((r) => r.p50)
      const p99 = rs.map((r) => r.p99)
      record.push({ cores: t.cores, rate, mode: m.name, per, p50, p99 })
      console.log(
        `| ${rate === 0 ? "burst" : rate} | ${loginsAt(rate, t.cores)} | ${m.name} | ${cell(per, 1, (xs) => Math.max(...xs))} | ${cell(p50, 1, (xs) => Math.min(...xs))} | ${cell(p99, 1, (xs) => Math.min(...xs))} |`
      )
    }
  }
  console.log("")
}
if (jsonOut !== "") {
  fs.writeFileSync(
    jsonOut,
    JSON.stringify({ cpu, cpus: os.availableParallelism(), rounds, holdUs, record }, null, 2)
  )
}
