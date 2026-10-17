#!/usr/bin/env node
// HTTP/3 latency harness. Drives tests/link/net_interop_server's `serve` mode,
// a byte-identical copy of the same binary, and nginx with h2load over HTTP/3,
// in interleaved rounds, and prints latency p50/p99, req/s and server CPU per
// target and scenario. The copy is the noise band: nish and nish-copy are the
// same bytes, so whatever separates them is the machine, not the code. See
// bench/README.md ("HTTP/3 latency") and docs/h3-latency.md.
//
//   bash bench/h3-latency/build-tools.sh && node bench/h3-latency.mjs [options]
//     --runs N            rounds; every target runs every scenario once per round (default 5)
//     --duration S        measured seconds per run, after a 1 s warm-up (default 5)
//     --scenario NAME     single, c96, c96m10 or all (default all)
//     --baseline REV      also time the server built from REV, in a worktree under build/
//     --nginx / --no-nginx  time nginx too (default: when build-tools.sh installed it)
//     --tools DIR         where build-tools.sh installed (default ~/.cache/nish-h3-bench)
//     --size BYTES        the body of the one file served (default 100)
//     --json FILE         also write every run's figures to FILE
//
// The server is pinned to CPU 0 and h2load to CPUs 1-3, so the server's busy
// share is one core's: 100% means it never waited.
import { spawn, spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const build = join(root, "build")
// util-linux's taskset pins the server to CPU 0 and h2load to CPUs 1-3.
const taskset = "taskset"

/** h2load's shape per scenario: connections and requests in flight on each. */
const SCENARIOS = {
  single: { connections: 1, streams: 1 },
  c96: { connections: 96, streams: 1 },
  c96m10: { connections: 96, streams: 10 },
}

const parseArgs = (argv) => {
  const opts = {
    runs: 5,
    duration: 5,
    scenarios: Object.keys(SCENARIOS),
    baseline: "",
    nginx: null,
    tools: join(homedir(), ".cache", "nish-h3-bench"),
    size: 100,
    json: "",
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = () => {
      i++
      if (i >= argv.length) {
        throw new Error(`${a} wants a value`)
      }
      return argv[i]
    }
    if (a === "--runs") {
      opts.runs = Number(value())
    } else if (a === "--duration") {
      opts.duration = Number(value())
    } else if (a === "--scenario") {
      const s = value()
      opts.scenarios = s === "all" ? Object.keys(SCENARIOS) : s.split(",")
    } else if (a === "--baseline") {
      opts.baseline = value()
    } else if (a === "--nginx") {
      opts.nginx = true
    } else if (a === "--no-nginx") {
      opts.nginx = false
    } else if (a === "--tools") {
      opts.tools = resolve(value())
    } else if (a === "--size") {
      opts.size = Number(value())
    } else if (a === "--json") {
      opts.json = resolve(value())
    } else if (a === "-h" || a === "--help") {
      process.stdout.write(
        `${readFileSync(import.meta.filename, "utf8")
          .split("\n")
          .slice(1, 20)
          .join("\n")}\n`
      )
      process.exit(0)
    } else {
      throw new Error(`unknown argument ${a}`)
    }
  }
  for (const s of opts.scenarios) {
    if (!(s in SCENARIOS)) {
      throw new Error(`unknown scenario ${s}`)
    }
  }
  if (!(opts.runs >= 1 && opts.duration >= 1 && opts.size > 0)) {
    throw new Error("--runs, --duration and --size take a positive number")
  }
  return opts
}

const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

/**
 * Builds the interop server of the checkout at `dir` into `out`. Each checkout
 * builds its own compiler, because the compiler reads `nish/` modules from the
 * `std/` beside it: a baseline built by this checkout's compiler would be this
 * checkout's std.
 */
const buildServer = (dir, out) => {
  const nish = join(dir, "build", "nish")
  if (!existsSync(nish)) {
    const seed = process.env.NISH_BOOTSTRAP || join(root, "build", "seed", "bin", "nish")
    if (!existsSync(seed)) {
      throw new Error("no seed: run bash scripts/fetch-seed.sh --force, or set NISH_BOOTSTRAP")
    }
    console.error(`building ${nish}`)
    mkdirSync(join(dir, "build"), { recursive: true })
    run(seed, ["src/compile.ts", "--link", nish], dir)
  }
  console.error(`building ${out}`)
  run(
    nish,
    ["tests/link/net_interop_server/main.ts", "-o", join(dir, "build", "interop") + "/", "--link", out],
    dir
  )
}

/** A git worktree of `rev` under build/, made once and reused while it still names `rev`. */
const baselineTree = (rev) => {
  const sha = run("git", ["rev-parse", `${rev}^{commit}`]).trim()
  const dir = join(build, `h3-baseline-${sha.slice(0, 12)}`)
  if (!existsSync(dir)) {
    run("git", ["worktree", "add", "--detach", dir, sha])
  }
  return { sha, dir }
}

/** A P-256 leaf for `localhost` in the layout `serve --certs` reads: priv.key and cert.pem. */
const makeCerts = (dir, openssl) => {
  run(openssl, [
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:prime256v1",
    "-nodes",
    "-keyout",
    join(dir, "priv.key"),
    "-out",
    join(dir, "cert.pem"),
    "-days",
    "7",
    "-subj",
    "/CN=localhost",
  ])
}

/** A free UDP port, from the kernel: bind 0, read the port, close. */
const freePort = () => {
  const out = run(process.execPath, [
    "-e",
    "const s=require('node:dgram').createSocket('udp4');s.bind(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})",
  ])
  return Number(out.trim())
}

/**
 * One nginx with one worker, HTTP/3 on `port`, and nothing logged per request.
 * keepalive_requests defaults to 1000, after which nginx closes the connection
 * and h2load's timed mode does not reconnect: raised so a run never meets it.
 */
const nginxConfig = (dir, port, www, certs) => `daemon off;
master_process off;
worker_processes 1;
error_log ${join(dir, "error.log")} warn;
pid ${join(dir, "nginx.pid")};
events { worker_connections 1024; }
http {
  access_log off;
  keepalive_requests 100000000;
  client_body_temp_path ${dir};
  proxy_temp_path ${dir};
  fastcgi_temp_path ${dir};
  uwsgi_temp_path ${dir};
  scgi_temp_path ${dir};
  server {
    listen 127.0.0.1:${port} quic reuseport;
    http3 on;
    ssl_certificate ${join(certs, "cert.pem")};
    ssl_certificate_key ${join(certs, "priv.key")};
    ssl_protocols TLSv1.3;
    root ${www};
  }
}
`

/** utime + stime of `pid`, in clock ticks (fields 14 and 15 of /proc/<pid>/stat). */
const cpuTicks = (pid) => {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8")
  // The command name is in parentheses and may hold spaces: count from after it.
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
  return Number(fields[11]) + Number(fields[12])
}

const ticksPerSecond = Number(run("getconf", ["CLK_TCK"]).trim())

/** Starts a server pinned to CPU 0 and resolves once it answers on its port. */
const startServer = async (target, port, ctx) => {
  let args
  if (target.kind === "nginx") {
    const dir = mkdtempSync(join(ctx.tmp, "nginx-"))
    writeFileSync(join(dir, "nginx.conf"), nginxConfig(dir, port, ctx.www, ctx.certs))
    args = [target.bin, "-p", dir, "-c", join(dir, "nginx.conf")]
  } else {
    args = [
      target.bin,
      "serve",
      "--www",
      ctx.www,
      "--certs",
      ctx.certs,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ]
  }
  const child = spawn(taskset, ["-c", "0", ...args], { stdio: ["ignore", "pipe", "pipe"] })
  let output = ""
  child.stdout.on("data", (d) => {
    output += d
  })
  child.stderr.on("data", (d) => {
    output += d
  })
  // taskset execs the server, so the child's pid is the server's.
  for (let i = 0; i < 100; i++) {
    const probe = spawnSync(ctx.h2load, ["--alpn-list=h3", "-n", "1", "-c", "1", ctx.url(port)], {
      encoding: "utf8",
    })
    if (/1 succeeded/.test(probe.stdout)) {
      return child
    }
    if (child.exitCode !== null) {
      break
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  child.kill("SIGKILL")
  throw new Error(`${target.name} did not answer on ${port}:\n${output}`)
}

const stopServer = (child) =>
  new Promise((done) => {
    if (child.exitCode !== null) {
      done()
      return
    }
    child.on("exit", () => done())
    child.kill("SIGTERM")
    setTimeout(() => child.kill("SIGKILL"), 3000)
  })

const percentile = (sorted, p) => {
  if (sorted.length === 0) {
    return Number.NaN
  }
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

/**
 * One measured run: h2load pinned to CPUs 1-3 for `duration` seconds after a
 * 1 s warm-up. Latency comes from h2load's per-request log (its summary row
 * gives min, max, mean and sd, not percentiles); the `request :` row is kept
 * beside it as a cross-check. Server CPU is the utime+stime the server spent
 * over h2load's whole run, warm-up and handshakes included, over the same
 * wall time.
 */
const measure = async (target, scenario, ctx) => {
  const { connections, streams } = SCENARIOS[scenario]
  const port = freePort()
  const server = await startServer(target, port, ctx)
  const log = join(ctx.tmp, "requests.log")
  rmSync(log, { force: true })
  const threads = Math.min(3, connections)
  const args = [
    "-c",
    "1-3",
    ctx.h2load,
    "--alpn-list=h3",
    "-t",
    String(threads),
    "-c",
    String(connections),
    "-m",
    String(streams),
    "--warm-up-time=1",
    "-D",
    String(ctx.duration),
    "--log-file",
    log,
    ctx.url(port),
  ]
  const cpu0 = cpuTicks(server.pid)
  const t0 = process.hrtime.bigint()
  const h2 = await new Promise((finish) => {
    const c = spawn(taskset, args, { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    c.stdout.on("data", (d) => {
      out += d
    })
    c.stderr.on("data", (d) => {
      out += d
    })
    c.on("exit", (code) => finish({ code, out }))
  })
  const wall = Number(process.hrtime.bigint() - t0) / 1e9
  const cpu = (cpuTicks(server.pid) - cpu0) / ticksPerSecond
  await stopServer(server)
  const done = /requests: \d+ total, \d+ started, (\d+) done, (\d+) succeeded/.exec(h2.out)
  const rate = /finished in [\d.]+\w+, ([\d.]+) req\/s/.exec(h2.out)
  const row = /time for request:\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/.exec(h2.out)
  if (h2.code !== 0 || done === null || rate === null) {
    throw new Error(`h2load against ${target.name} failed (${h2.code}):\n${h2.out}`)
  }
  // Each log line is: start time (µs since the epoch), status, latency (µs).
  const latencies = readFileSync(log, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => Number(l.split("\t")[2]))
    .sort((a, b) => a - b)
  const requests = Number(done[2])
  return {
    target: target.name,
    scenario,
    succeeded: requests,
    failed: Number(done[1]) - requests,
    reqPerSec: Number(rate[1]),
    p50: percentile(latencies, 50),
    p99: percentile(latencies, 99),
    max: latencies.length > 0 ? latencies[latencies.length - 1] : Number.NaN,
    h2loadRow: row === null ? "" : row.slice(1).join(" "),
    serverBusy: cpu / wall,
    // The CPU window also covers warm-up and the handshakes, so the cost of a
    // request is the busy fraction over the measured rate, not cpu / requests.
    cpuPerRequest: (cpu / wall / Number(rate[1])) * 1e6,
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

const fmtUs = (us) => (us >= 1000 ? `${(us / 1000).toFixed(2)} ms` : `${Math.round(us)} µs`)

/** The metrics in the table, and how each prints. */
const METRICS = [
  { key: "p50", head: "p50", fmt: fmtUs },
  { key: "p99", head: "p99", fmt: fmtUs },
  { key: "reqPerSec", head: "req/s", fmt: (v) => `${(v / 1000).toFixed(1)}k` },
  { key: "serverBusy", head: "server busy", fmt: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "cpuPerRequest", head: "CPU/req", fmt: (v) => `${v.toFixed(2)} µs` },
]

/**
 * The table: per scenario and target, the median of each metric over the
 * rounds and, after a slash, its minimum. The noise row is nish against
 * nish-copy, the spread between two identical binaries timed in the same
 * rounds: |median(nish) - median(copy)| / median(copy). A difference between
 * targets means something only when it is outside that band.
 */
const report = (results, opts, targets) => {
  const lines = []
  lines.push(
    `${opts.runs} rounds × ${opts.duration} s (+1 s warm-up), body ${opts.size} B; median / min per cell`,
    ""
  )
  lines.push(`| scenario | target | ${METRICS.map((m) => m.head).join(" | ")} |`)
  lines.push(`| --- | --- | ${METRICS.map(() => "---").join(" | ")} |`)
  for (const scenario of opts.scenarios) {
    const by = (name) => results.filter((r) => r.scenario === scenario && r.target === name)
    for (const t of targets) {
      const rs = by(t.name)
      const cells = METRICS.map((m) => {
        const xs = rs.map((r) => r[m.key])
        return `${m.fmt(median(xs))} / ${m.fmt(Math.min(...xs))}`
      })
      lines.push(`| ${scenario} | ${t.name} | ${cells.join(" | ")} |`)
    }
    const a = by("nish")
    const b = by("nish-copy")
    if (a.length > 0 && b.length > 0) {
      const cells = METRICS.map((m) => {
        const x = median(a.map((r) => r[m.key]))
        const y = median(b.map((r) => r[m.key]))
        return `±${((Math.abs(x - y) / y) * 100).toFixed(1)}%`
      })
      lines.push(`| ${scenario} | noise (nish vs copy) | ${cells.join(" | ")} |`)
    }
  }
  return lines.join("\n")
}

const main = async () => {
  const opts = parseArgs(process.argv.slice(2))
  const h2load = join(opts.tools, "bin", "h2load")
  const nginx = join(opts.tools, "nginx", "sbin", "nginx")
  const openssl = join(opts.tools, "bin", "openssl")
  if (!existsSync(h2load)) {
    throw new Error(`no ${h2load}: run bash bench/h3-latency/build-tools.sh first`)
  }
  if (opts.nginx === null) {
    opts.nginx = existsSync(nginx)
  }
  if (spawnSync(taskset, ["-c", "0", "true"]).status !== 0) {
    throw new Error("taskset -c 0 failed: the harness pins the server to CPU 0 and h2load to 1-3")
  }

  const server = join(build, "interop-server")
  buildServer(root, server)
  const copy = join(build, "interop-server-copy")
  copyFileSync(server, copy)
  if (!readFileSync(server).equals(readFileSync(copy))) {
    throw new Error(`${copy} differs from ${server}`)
  }
  const targets = [
    { name: "nish", kind: "nish", bin: server },
    { name: "nish-copy", kind: "nish", bin: copy },
  ]
  if (opts.baseline !== "") {
    const { sha, dir } = baselineTree(opts.baseline)
    const bin = join(build, `interop-server-${sha.slice(0, 12)}`)
    buildServer(dir, bin)
    targets.push({ name: `base ${sha.slice(0, 7)}`, kind: "nish", bin })
  }
  if (opts.nginx) {
    targets.push({ name: "nginx", kind: "nginx", bin: nginx })
  }

  const tmp = mkdtempSync(join(tmpdir(), "nish-h3-"))
  const www = join(tmp, "www")
  const certs = join(tmp, "certs")
  mkdirSync(www)
  mkdirSync(certs)
  writeFileSync(join(www, "index.html"), "x".repeat(opts.size))
  makeCerts(certs, openssl)
  const ctx = {
    tmp,
    www,
    certs,
    h2load,
    duration: opts.duration,
    url: (port) => `https://127.0.0.1:${port}/index.html`,
  }

  const results = []
  try {
    for (let round = 1; round <= opts.runs; round++) {
      for (const scenario of opts.scenarios) {
        // Rotated each round, so no target always runs first or last.
        for (let k = 0; k < targets.length; k++) {
          const t = targets[(k + round - 1) % targets.length]
          const r = await measure(t, scenario, ctx)
          r.round = round
          results.push(r)
          console.error(
            `round ${round} ${scenario} ${t.name}: p50 ${fmtUs(r.p50)} p99 ${fmtUs(r.p99)} ` +
              `${Math.round(r.reqPerSec)} req/s busy ${(r.serverBusy * 100).toFixed(0)}%` +
              (r.failed > 0 ? ` (${r.failed} failed)` : "")
          )
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  if (opts.json !== "") {
    writeFileSync(opts.json, `${JSON.stringify(results, null, 2)}\n`)
  }
  console.log(report(results, opts, targets))
}

main().catch((e) => {
  console.error(`h3-latency: ${e.message}`)
  process.exit(1)
})
