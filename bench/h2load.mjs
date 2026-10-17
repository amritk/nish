#!/usr/bin/env node
// Throughput of the interop server's TLS carriers, one build against another:
// HTTPS/1.1 and HTTP/2 driven by h2load, HTTP/3 by the server's own scripted
// client.
//
//   node bench/h2load.mjs --bin build/interop                       # the noise band
//   node bench/h2load.mjs --bin build/interop-a --against build/interop-b
//   node bench/h2load.mjs --bin build/interop --rounds 7 --requests 50000
//
// Each build serves from one process (`main serve`, see
// `tests/link/net_interop_server/main.ts`) pinned to CPU 0, and h2load runs
// on the others. A round runs every scenario against both builds, in the
// order a b and then b a in the next round, so drift on a shared machine
// lands on both alike. Each scenario reports each build's median requests per
// second and the median of the per-round ratios b / a, with their spread (min
// to max). With no `--against` the build is measured against itself: its
// spread is the noise band a difference between two builds is read against.
//
// HTTP/3: h2load speaks it only when built with ngtcp2 and nghttp3, which
// Ubuntu's nghttp2-client is not. The script asks it for one request first;
// when that fails, it says so on stderr and runs `main h3-load <requests>`
// instead, the server and `client.ts`'s QUIC client in one process on CPU 0,
// one connection with the requests one after another. That figure is the
// server's and the client's work together, so it compares builds; it is not
// h2load's number. Its rate falls as the one connection's streams pile up
// (some 13,000 requests a second over 2,000 requests, 1,900 over 20,000), so
// it runs `--h3-requests` (2,000) rather than `--requests`.
import { spawn, spawnSync } from "node:child_process"
import { availableParallelism } from "node:os"

const args = process.argv.slice(2)
let a = null
let b = null
let rounds = 5
let requests = 20000
let clients = 16
let streams = 8
let slots = 64
let h3Requests = 2000
for (let k = 0; k < args.length; k++) {
  const arg = args[k]
  if (arg === "--bin") {
    a = args[++k]
  } else if (arg === "--against") {
    b = args[++k]
  } else if (arg === "--rounds") {
    rounds = Number(args[++k])
  } else if (arg === "--requests") {
    requests = Number(args[++k])
  } else if (arg === "--clients") {
    clients = Number(args[++k])
  } else if (arg === "--streams") {
    streams = Number(args[++k])
  } else if (arg === "--h3-requests") {
    h3Requests = Number(args[++k])
  } else if (arg === "--slots") {
    slots = Number(args[++k])
  } else {
    a = null
    break
  }
}
if (a === null) {
  console.error(
    "usage: node bench/h2load.mjs --bin <server> [--against <server>] [--rounds n] [--requests n] [--clients n] [--streams n] [--h3-requests n] [--slots n]"
  )
  process.exit(2)
}
b = b ?? a
if (spawnSync("h2load", ["--version"]).error) {
  console.error("h2load is not installed (apt-get install nghttp2-client)")
  process.exit(2)
}

const cpus = availableParallelism()
const clientCpus = cpus > 1 ? `1-${cpus - 1}` : "0"
const threads = String(Math.max(1, Math.min(cpus - 1, 4)))
const www = "tests/link/net_interop_server/www"

/** Starts `bin` serving on CPU 0; resolves with the process and its ports once it prints them. */
const start = (bin) =>
  new Promise((resolve, reject) => {
    const argv = ["-c", "0", bin, "serve", "--host", "127.0.0.1", "--www", www, "--slots", String(slots)]
    const child = spawn("taskset", argv, { stdio: ["ignore", "pipe", "inherit"] })
    let seen = ""
    child.stdout.on("data", (d) => {
      seen += d
      const m = /ports quic (\d+) h1 (\d+) h1s (\d+) h2 (\d+)/.exec(seen)
      if (m !== null) {
        child.stdout.removeAllListeners("data")
        child.stdout.resume()
        resolve({ child, quic: Number(m[1]), h1s: Number(m[3]), h2: Number(m[4]) })
      }
    })
    child.on("exit", (code) => reject(new Error(`${bin} exited ${code} before listening: ${seen}`)))
  })

/**
 * Runs a command to its exit and resolves with its stdout. Asynchronous, not
 * `spawnSync`, so the event loop keeps draining the servers' stdout pipes
 * meanwhile: each closed HTTP/2 connection prints a line, and a full pipe
 * would block the server mid-run.
 */
const output = (command, argv) =>
  new Promise((resolve) => {
    const child = spawn(command, argv, { stdio: ["ignore", "pipe", "ignore"] })
    let out = ""
    child.stdout.on("data", (d) => {
      out += d
    })
    child.on("close", () => resolve(out))
  })

/** One h2load run; requests per second, or NaN with the reason when any request did not succeed. */
const h2load = async (extra, url, n) => {
  const argv = [
    "-c",
    clientCpus,
    "h2load",
    "-t",
    threads,
    "-c",
    String(clients),
    "-n",
    String(n),
    ...extra,
    url,
  ]
  const stdout = await output("taskset", argv)
  const rps = Number(/finished in [\d.]+\w+, ([\d.]+) req\/s/.exec(stdout)?.[1] ?? Number.NaN)
  const ok = Number(/(\d+) succeeded/.exec(stdout)?.[1] ?? 0)
  return ok === n ? { rps } : { rps: Number.NaN, why: `${ok} of ${n} succeeded` }
}

/** `bin h3-load`, on CPU 0; requests per second. */
const h3Load = async (bin) => {
  const stdout = await output("taskset", ["-c", "0", bin, "h3-load", String(h3Requests)])
  const m = /h3 (\d+) requests in (\d+) ms, (\d+) failed/.exec(stdout)
  if (m === null || m[3] !== "0") {
    return { rps: Number.NaN, why: stdout.trim() }
  }
  return { rps: (Number(m[1]) * 1000) / Math.max(1, Number(m[2])) }
}

// Two processes even for one build, so the noise band includes a second server's.
const servers = { a: await start(a), b: await start(b) }
const h3Native = !Number.isNaN(
  (await h2load(["--alpn-list=h3"], `https://127.0.0.1:${servers.a.quic}/hello.txt`, clients)).rps
)
if (!h3Native) {
  console.error(
    "h2load: no HTTP/3 (built without ngtcp2/nghttp3); HTTP/3 is `main h3-load`, the server and its scripted client in one process"
  )
}

const scenarios = [
  {
    name: `HTTPS/1.1 h2load --h1 c=${clients}`,
    run: (s) => h2load(["--h1"], `https://127.0.0.1:${s.h1s}/hello`, requests),
  },
  {
    name: `HTTP/2 h2load c=${clients} m=${streams}`,
    run: (s) => h2load(["-m", String(streams)], `https://127.0.0.1:${s.h2}/hello.txt`, requests),
  },
  h3Native
    ? {
        name: `HTTP/3 h2load c=${clients}`,
        run: (s) => h2load(["--alpn-list=h3"], `https://127.0.0.1:${s.quic}/hello.txt`, requests),
      }
    : { name: `HTTP/3 main h3-load c=1, ${h3Requests} requests, in process`, run: (_s, bin) => h3Load(bin) },
]

const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const results = scenarios.map(() => ({ a: [], b: [], ratio: [], failed: "" }))
for (let r = 0; r < rounds; r++) {
  for (const [k, scenario] of scenarios.entries()) {
    const order = r % 2 === 0 ? ["a", "b"] : ["b", "a"]
    const got = {}
    for (const side of order) {
      got[side] = await scenario.run(servers[side], side === "a" ? a : b)
      if (Number.isNaN(got[side].rps)) {
        results[k].failed = `${side}: ${got[side].why}`
      }
    }
    results[k].a.push(got.a.rps)
    results[k].b.push(got.b.rps)
    results[k].ratio.push(got.b.rps / got.a.rps)
  }
}
for (const s of [servers.a.child, servers.b.child]) {
  s.removeAllListeners("exit")
  s.kill("SIGINT")
}

console.log(`a ${a}, b ${b}: ${rounds} rounds, ${requests} requests each, ${slots} slots`)
console.log("| scenario | a req/s | b req/s | b / a (min–max) |")
console.log("| --- | ---: | ---: | ---: |")
for (const [k, scenario] of scenarios.entries()) {
  const x = results[k]
  if (x.failed !== "") {
    console.log(`| ${scenario.name} | failed: ${x.failed} | | |`)
    continue
  }
  const band = `${median(x.ratio).toFixed(3)} (${Math.min(...x.ratio).toFixed(3)}–${Math.max(...x.ratio).toFixed(3)})`
  console.log(`| ${scenario.name} | ${median(x.a).toFixed(0)} | ${median(x.b).toFixed(0)} | ${band} |`)
}
