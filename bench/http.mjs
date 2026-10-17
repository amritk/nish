#!/usr/bin/env node
// Load-tests `bench/http1-server.ts` builds against each other with wrk.
//
//   node bench/http.mjs build/bench/h1-a build/bench/h1-b      # compare builds
//   node bench/http.mjs --rounds 7 --duration 5 build/bench/h1-a
//   node bench/http.mjs --syscalls build/bench/h1-a            # strace -c per request
//   node bench/http.mjs --only post-json new=build/bench/h1 old=build/bench/h1-old
//
// A server is `<path>`, labelled by its basename, or `<name>=<path>`, labelled
// `name`. Each is started as `<path> <port> <slots>` and timed once it prints
// `listening`. Before its first timed round in a scenario, one request checks
// its answer against the contract: /plaintext's body exactly, /json's by
// pattern, and /json-echo's and /json-echo-doc's exactly — the payload with
// its revision one higher. A server that answers 404 is `n/a` in that
// scenario; any other wrong answer exits 1, naming the first differing byte.
//
// The post-json scenarios POST bench/http-payload.json (or the file
// NISH_HTTP_PAYLOAD names) through the wrk script bench/http-post-json.lua.
//
// The server is pinned to CPU 0 and wrk to the others, so the server has one
// core to itself, as the box in "max out a $12 server" did. Rounds interleave
// the builds (a b a b ...) so that drift on a shared machine lands on all of
// them alike; each scenario reports the median of its rounds and the spread
// (min to max). Read a difference against the spread of two byte-identical
// builds (pass the same binary twice, or a copy of it): that is the noise band.
import { spawn, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { request } from "node:http"
import { connect } from "node:net"
import { availableParallelism } from "node:os"
import { basename, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"

const args = process.argv.slice(2)
let rounds = 5
let duration = 5
let syscalls = false
let only = null
let slots = "16384"
const bins = []
for (let k = 0; k < args.length; k++) {
  const a = args[k]
  if (a === "--rounds") {
    rounds = Number(args[++k])
  } else if (a === "--duration") {
    duration = Number(args[++k])
  } else if (a === "--syscalls") {
    syscalls = true
  } else if (a === "--only") {
    only = args[++k].split(",")
  } else if (a === "--slots") {
    slots = args[++k]
  } else {
    bins.push(a)
  }
}
if (bins.length === 0) {
  console.error(
    "usage: node bench/http.mjs [--rounds n] [--duration s] [--only a,b] [--syscalls] [name=]<server>..."
  )
  process.exit(2)
}
if (spawnSync("wrk", ["--version"]).error) {
  console.error("wrk is not installed (apt-get install wrk)")
  process.exit(2)
}

/** `name=path` is labelled `name`; a bare path keeps its basename. */
const servers = bins.map((arg) => {
  const eq = arg.indexOf("=")
  return eq > 0 && !arg.slice(0, eq).includes("/")
    ? { name: arg.slice(0, eq), path: arg.slice(eq + 1) }
    : { name: basename(arg), path: arg }
})

const luaScript = fileURLToPath(new URL("http-post-json.lua", import.meta.url))
const payloadFile = resolvePath(
  process.env.NISH_HTTP_PAYLOAD || fileURLToPath(new URL("http-payload.json", import.meta.url))
)
const payload = readFileSync(payloadFile, "latin1")
// The echo's answer is the payload with its revision one higher.
const echoed = payload.replace(/"revision":(\d+)/, (_, n) => `"revision":${Number(n) + 1}`)
if (echoed === payload) {
  // Else the pre-check would pass a server that echoes the body unchanged.
  console.error(`${payloadFile}: no "revision":<digits> to raise`)
  process.exit(2)
}

const cpus = availableParallelism()
const clientCpus = cpus > 1 ? `1-${cpus - 1}` : "0"
const threads = String(Math.max(1, Math.min(cpus - 1, 4)))

// Each scenario is one wrk invocation. `close` sends `Connection: close`, so
// every request is a fresh TCP connection and the accept path is what is timed.
const scenarios = [
  { name: "plaintext keep-alive c=256", path: "/plaintext", conns: 256 },
  { name: "json keep-alive c=256", path: "/json", conns: 256 },
  // A 545-byte JSON request body decoded into a class and encoded back, and
  // the same through a JSON document: the request body is what is timed.
  { name: "post-json keep-alive c=256", path: "/json-echo", conns: 256, post: true },
  { name: "post-json-doc keep-alive c=256", path: "/json-echo-doc", conns: 256, post: true },
  { name: "plaintext keep-alive c=4096", path: "/plaintext", conns: 4096 },
  { name: "plaintext close c=64", path: "/plaintext", conns: 64, close: true },
  // The same churn while 8,000 idle connections hold the pool's first slots:
  // what finding a free slot costs once the pool is mostly full.
  { name: "plaintext close c=64 + 8000 idle", path: "/plaintext", conns: 64, close: true, idle: 8000 },
].filter((s) => only === null || only.some((o) => s.name.includes(o)))

let nextPort = 20000 + (process.pid % 20000)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Starts `bin` on a fresh port, pinned to CPU 0; resolves once it prints `listening`. */
const start = (bin) =>
  new Promise((resolve, reject) => {
    nextPort += 1
    const port = nextPort
    const argv = ["-c", "0", bin, String(port), slots]
    const child = spawn("taskset", argv, { stdio: ["ignore", "pipe", "inherit"] })
    let seen = ""
    child.stdout.on("data", (d) => {
      seen += d
      if (seen.includes("listening")) {
        resolve({ child, port })
      }
    })
    child.on("exit", (code) => reject(new Error(`${bin} exited ${code} before listening: ${seen}`)))
  })

const stop = async (child) => {
  child.removeAllListeners("exit")
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }
  const done = new Promise((resolve) => child.on("exit", resolve))
  child.kill("SIGINT")
  await done
}

/** The server's user and system CPU time so far, in microseconds (from /proc, at the kernel's tick). */
const cpuTimes = (pid) => {
  const stat = readFileSync(`/proc/${pid}/stat`, "utf8")
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
  const tick = 1e6 / 100
  return { user: Number(fields[11]) * tick, sys: Number(fields[12]) * tick }
}

/** The server's peak resident set, in MB. */
const peakRss = (pid) => {
  const m = readFileSync(`/proc/${pid}/status`, "utf8").match(/VmHWM:\s+(\d+) kB/)
  return m ? Number(m[1]) / 1024 : Number.NaN
}

/** Opens `n` connections to `port` that send nothing, and resolves once all are connected. */
const holdIdle = (n, port) =>
  Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise((resolve, reject) => {
          const socket = connect(port, "127.0.0.1", () => resolve(socket))
          socket.on("error", reject)
        })
    )
  )

const parseLatency = (text) => {
  const m = text.match(/^\s+99%\s+([\d.]+)(us|ms|s)\s*$/m)
  if (!m) {
    return Number.NaN
  }
  const scale = { us: 0.001, ms: 1, s: 1000 }[m[2]]
  return Number(m[1]) * scale
}

/** One wrk run against `port`: requests per second, p99 in ms, and socket errors. */
const wrk = (scenario, port, seconds) => {
  const argv = [
    "-c",
    clientCpus,
    "wrk",
    "--latency",
    "-t",
    threads,
    "-c",
    String(scenario.conns),
    "-d",
    `${seconds}s`,
  ]
  if (scenario.close) {
    argv.push("-H", "Connection: close")
  }
  if (scenario.post) {
    argv.push("-s", luaScript)
  }
  argv.push(`http://127.0.0.1:${port}${scenario.path}`)
  const r = spawnSync("taskset", argv, {
    encoding: "utf8",
    env: { ...process.env, NISH_HTTP_PAYLOAD: payloadFile },
  })
  const out = r.stdout
  const rps = Number((out.match(/Requests\/sec:\s+([\d.]+)/) || [])[1])
  const total = Number((out.match(/(\d+) requests in/) || [])[1])
  const errors = out.match(/Socket errors:.*|Non-2xx.*/g) || []
  return { rps, total, p99: parseLatency(out), errors: errors.join("; "), raw: out }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const label = (k) =>
  servers.findIndex((s) => s.name === servers[k].name) === k ? servers[k].name : `${servers[k].name}#${k}`

/** How long the pre-check waits for an answer before it fails. */
const FETCH_TIMEOUT_MS = 5000

/** One request to `port` on the scenario's path: resolves to its status and body, or rejects after `FETCH_TIMEOUT_MS`. */
const fetchOnce = (scenario, port) =>
  new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path: scenario.path,
        method: scenario.post ? "POST" : "GET",
        agent: false,
        headers: scenario.post ? { "Content-Type": "application/json" } : {},
      },
      (res) => {
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("latin1") })
        )
        res.on("error", reject)
      }
    )
    req.setTimeout(FETCH_TIMEOUT_MS, () =>
      req.destroy(new Error(`no answer in ${FETCH_TIMEOUT_MS / 1000} s`))
    )
    req.on("error", reject)
    req.end(scenario.post ? Buffer.from(payload, "latin1") : undefined)
  })

const JSON_HELLO = '{"message":"Hello, World!"}'

/** The answer a scenario's path must give: the exact body, or a pattern and the body it is read against. */
const contract = (scenario) => {
  if (scenario.path === "/plaintext") {
    return { exact: "Hello, World!" }
  }
  if (scenario.path === "/json") {
    // The message, and an optional request count; any spacing JSON allows.
    return {
      pattern: /^\{\s*"message"\s*:\s*"Hello, World!"\s*(,\s*"n"\s*:\s*\d+\s*)?\}$/,
      exact: JSON_HELLO,
    }
  }
  return { exact: echoed }
}

const firstDifference = (got, want) => {
  let k = 0
  while (k < got.length && k < want.length && got[k] === want[k]) {
    k++
  }
  const show = (s) => (k < s.length ? JSON.stringify(s[k]) : "end of body")
  return `byte ${k}: got ${show(got)}, expected ${show(want)}`
}

/**
 * Checks one answer of the server at `port` against the scenario's contract:
 * `true` when it holds, `false` on a 404 (the server has no such route), and
 * an exit with status 1 on anything else.
 */
const verify = async (k, scenario, port, child) => {
  const fail = async (why) => {
    await stop(child)
    console.error(`${label(k)}: ${scenario.name}: ${why}`)
    process.exit(1)
  }
  let r
  try {
    r = await fetchOnce(scenario, port)
  } catch (e) {
    return fail(`request failed: ${e.message}`)
  }
  if (r.status === 404) {
    return false
  }
  if (r.status !== 200) {
    return fail(`status ${r.status}, expected 200`)
  }
  const want = contract(scenario)
  const ok = want.pattern ? want.pattern.test(r.body) : r.body === want.exact
  if (!ok) {
    return fail(firstDifference(r.body, want.exact))
  }
  return true
}

if (syscalls) {
  // Deterministic, unlike throughput: system calls the server made per request.
  for (const scenario of scenarios) {
    for (const [k, server] of servers.entries()) {
      const file = `/tmp/nish-http-strace-${process.pid}-${k}.txt`
      // Attach once the pool is built: its start-up is thousands of brk calls
      // that are not per-request work and that strace makes slow.
      const { child, port: p } = await start(server.path)
      if (!(await verify(k, scenario, p, child))) {
        await stop(child)
        console.log(`${scenario.name} | ${label(k)} | n/a`)
        continue
      }
      const tracer = spawn("strace", ["-c", "-f", "-o", file, "-p", String(child.pid)], { stdio: "ignore" })
      await sleep(500)
      const r = wrk(scenario, p, 2)
      const traced = new Promise((resolve) => tracer.on("exit", resolve))
      tracer.kill("SIGINT")
      await traced
      await stop(child)
      const text = spawnSync("cat", [file], { encoding: "utf8" }).stdout
      const rows = []
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*[\d.]+\s+[\d.]+\s+\d+\s+(\d+)\s+(\d+)?\s*(\w+)\s*$/)
        if (m) {
          rows.push([m[3], Number(m[1])])
        }
      }
      const per = rows
        .filter(([name]) => name !== "total")
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `${name} ${(n / r.total).toFixed(2)}`)
      const sum = rows.filter(([name]) => name !== "total").reduce((acc, [, n]) => acc + n, 0)
      console.log(
        `${scenario.name} | ${label(k)} | ${(sum / r.total).toFixed(2)} syscalls/request | ${per.join(", ")}`
      )
    }
  }
  process.exit(0)
}

console.log(
  `# ${new Date().toISOString()}  server on CPU 0, wrk -t${threads} on CPUs ${clientCpus}, ${rounds} rounds x ${duration}s`
)
for (const scenario of scenarios) {
  const results = servers.map(() => ({
    rps: [],
    p99: [],
    user: [],
    sys: [],
    rss: [],
    errors: new Set(),
    na: false,
  }))
  for (let round = 0; round < rounds; round++) {
    // Alternate the order each round so neither build always runs first.
    const order = servers.map((_, k) => k).filter((k) => !results[k].na)
    if (round % 2 === 1) {
      order.reverse()
    }
    for (const k of order) {
      const { child, port: p } = await start(servers[k].path)
      if (round === 0 && !(await verify(k, scenario, p, child))) {
        results[k].na = true
        await stop(child)
        continue
      }
      const idle = scenario.idle ? await holdIdle(scenario.idle, p) : []
      await sleep(200)
      wrk(scenario, p, 1) // warm-up: fills the slots, faults in the pages
      const before = cpuTimes(child.pid)
      const r = wrk(scenario, p, duration)
      const after = cpuTimes(child.pid)
      results[k].rss.push(peakRss(child.pid))
      for (const socket of idle) {
        socket.destroy()
      }
      await stop(child)
      results[k].rps.push(r.rps)
      results[k].p99.push(r.p99)
      results[k].user.push((after.user - before.user) / r.total)
      results[k].sys.push((after.sys - before.sys) / r.total)
      if (r.errors) {
        results[k].errors.add(r.errors)
      }
    }
  }
  console.log(`\n## ${scenario.name}`)
  console.log("| build | req/s (median) | spread | p99 ms | user µs/req | sys µs/req | peak RSS MB | notes |")
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
  const baseIndex = results.findIndex((r) => !r.na)
  const base = baseIndex < 0 ? Number.NaN : median(results[baseIndex].rps)
  for (const k of servers.keys()) {
    const r = results[k]
    if (r.na) {
      console.log(`| ${label(k)} | n/a | n/a | n/a | n/a | n/a | n/a | no route (404) |`)
      continue
    }
    const m = median(r.rps)
    const lo = Math.min(...r.rps)
    const hi = Math.max(...r.rps)
    const delta =
      k === baseIndex ? "" : ` (${m >= base ? "+" : ""}${(((m - base) / base) * 100).toFixed(1)}%)`
    console.log(
      `| ${label(k)} | ${Math.round(m).toLocaleString("en-US")}${delta} | ${Math.round(lo).toLocaleString("en-US")}–${Math.round(hi).toLocaleString("en-US")} | ${median(r.p99).toFixed(2)} | ${median(r.user).toFixed(2)} | ${median(r.sys).toFixed(2)} | ${Math.round(median(r.rss))} | ${[...r.errors].join(" ")} |`
    )
  }
}
