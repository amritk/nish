#!/usr/bin/env node
// Load-tests `bench/http1-server.ts` builds against each other with wrk.
//
//   node bench/http.mjs build/bench/h1-a build/bench/h1-b      # compare builds
//   node bench/http.mjs --rounds 7 --duration 5 build/bench/h1-a
//   node bench/http.mjs --syscalls build/bench/h1-a            # strace -c per request
//   node bench/http.mjs --only post-json new=build/bench/h1 old=build/bench/h1-old
//   node bench/http.mjs --cores 1,2,4 build/bench/h1             # one table set per core count
//   node bench/http.mjs --only startup build/bench/h1 build/http-twins/bun/serve
//
// A server is `<path>`, labelled by its basename, or `<name>=<path>`, labelled
// `name`. Each is started as `<path> <port> <slots>` and timed once it prints
// `listening`. Before its first timed round in a scenario, one request checks
// its answer against the contract: /plaintext's body exactly, /json's by
// pattern, and /json-echo's and /json-echo-doc's exactly — the payload with
// its revision one higher. / must answer `Hi`, /id/1?name=bun `1 bun` with an
// `x-powered-by: benchmark` header, and POST /json bench/http-body.json
// re-serialized, and the deep route `acme api 97`. A server that answers 404
// is `n/a` in that scenario; any other wrong answer exits 1, naming the first
// differing byte.
//
// The post-json scenarios POST bench/http-payload.json (or the file
// NISH_HTTP_PAYLOAD names) through the wrk script bench/http-post-json.lua, and
// the body scenario bench/http-body.json through the same script.
//
// The startup scenario runs no wrk: it times how long each server takes from
// being spawned to its first answer to GET /, polling once a millisecond, and
// reads its resident set then. Interpreters count their own start-up, the Nish
// server the per-slot arrays and free stack its pool sizes from the slot count
// (a slot's connection is built on its first accept), and nginx's serve the shell script that writes its configuration. --syscalls
// skips it.
//
// The server is pinned to CPU 0 and wrk to the others, so the server has one
// core to itself, as the box in "max out a $12 server" did. `--cores 1,2,4`
// runs every scenario once per core count N instead: the server on CPUs
// 0..N-1 with BENCH_CORES=N in its environment (a server that reads it sizes
// itself to N; one that cannot use more than one core prints `single-core`
// and exits, and its cells read n/a), and wrk on the CPUs left. When none are
// left, wrk shares the server's cores and the header and every cell say so.
// The CPU, user and RSS figures sum over the server's whole process tree, so
// a pre-forked server's workers count. Rounds interleave
// the builds (a b a b ...) so that drift on a shared machine lands on all of
// them alike; each scenario reports the median of its rounds and the spread
// (min to max). Read a difference against the spread of two byte-identical
// builds (pass the same binary twice, or a copy of it): that is the noise band.
import { spawn, spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
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
let coreCounts = null
const bins = []
const usage =
  "usage: node bench/http.mjs [--rounds n] [--duration s] [--only a,b] [--cores 1,2,4] [--syscalls] [name=]<server>..."
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
  } else if (a === "--cores") {
    coreCounts = args[++k].split(",").map(Number)
  } else if (a === "--help" || a === "-h") {
    console.log(usage)
    process.exit(0)
  } else {
    bins.push(a)
  }
}
if (bins.length === 0) {
  console.error(usage)
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
const bodyFile = fileURLToPath(new URL("http-body.json", import.meta.url))
// A re-serialized body is compact; the twins that sort an object's keys agree
// with this one because the body's only object has one key.
const rewritten = JSON.stringify(JSON.parse(readFileSync(bodyFile, "utf8")))
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
if (coreCounts !== null) {
  const bad = coreCounts.find((n) => !Number.isInteger(n) || n < 1 || n > cpus)
  if (bad !== undefined) {
    console.error(`--cores: ${bad} is not a core count from 1 to ${cpus}`)
    process.exit(2)
  }
  if (syscalls) {
    console.error("--cores does not apply to --syscalls")
    process.exit(2)
  }
}

/**
 * Where the server and wrk run with the server on `n` cores: the server on
 * CPUs 0..n-1, wrk on the rest with as many threads (at most 4), or on the
 * server's own cores when none are left. `n` null is the layout without
 * `--cores`: the server on CPU 0 and no BENCH_CORES.
 */
const layout = (n) => {
  const serverCores = n ?? 1
  const free = cpus - serverCores
  let clientCpus = `${serverCores}-${cpus - 1}`
  if (free < 1) {
    clientCpus = cpus > 1 ? `0-${cpus - 1}` : "0"
  }
  return {
    cores: n,
    serverCpus: serverCores === 1 ? "0" : `0-${serverCores - 1}`,
    clientCpus,
    threads: String(Math.max(1, Math.min(free > 0 ? free : cpus, 4))),
    // Without --cores a one-CPU box overlaps as it always has, unannounced.
    shared: n !== null && free < 1,
  }
}

// Each scenario is one wrk invocation. `close` sends `Connection: close`, so
// every request is a fresh TCP connection and the accept path is what is timed.
const DEEP_PATH = "/v1/orgs/acme/projects/api/builds/97/artifacts"
const scenarios = [
  // The three routes of the Bun HTTP framework benchmark: a constant, a path
  // parameter and a query parameter with a response header, and a small JSON
  // body parsed and serialized again.
  { name: "ping keep-alive c=500", path: "/", conns: 500 },
  { name: "query keep-alive c=500", path: "/id/1?name=bun", conns: 500 },
  { name: "body keep-alive c=500", path: "/json", conns: 500, post: true, file: bodyFile },
  { name: "plaintext keep-alive c=256", path: "/plaintext", conns: 256 },
  { name: "json keep-alive c=256", path: "/json", conns: 256 },
  // A 545-byte JSON request body decoded into a class and encoded back, and
  // the same through a JSON document: the request body is what is timed.
  { name: "post-json keep-alive c=256", path: "/json-echo", conns: 256, post: true, file: payloadFile },
  {
    name: "post-json-doc keep-alive c=256",
    path: "/json-echo-doc",
    conns: 256,
    post: true,
    file: payloadFile,
  },
  // A route eight segments and three parameters deep in the Nish server's
  // 342-route table, its answer built from the three. The twins register no
  // such table and answer 404, so their cells read n/a.
  { name: "deep-route keep-alive c=256", path: DEEP_PATH, conns: 256 },
  { name: "plaintext keep-alive c=4096", path: "/plaintext", conns: 4096 },
  { name: "plaintext close c=64", path: "/plaintext", conns: 64, close: true },
  // The same churn while 8,000 idle connections hold the pool's first slots:
  // what finding a free slot costs once the pool is mostly full.
  { name: "plaintext close c=64 + 8000 idle", path: "/plaintext", conns: 64, close: true, idle: 8000 },
].filter((s) => only === null || only.some((o) => s.name.includes(o)))
const timeStartup = !syscalls && (only === null || only.some((o) => "startup".includes(o)))
if (scenarios.length > 0 && spawnSync("wrk", ["--version"]).error) {
  console.error("wrk is not installed (apt-get install wrk)")
  process.exit(2)
}

let nextPort = 20000 + (process.pid % 20000)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Starts `bin` on a fresh port, pinned to the layout's server CPUs; resolves
 * once it prints `listening`, or with `singleCore` once it exits having
 * printed `single-core` (it cannot use the BENCH_CORES it was given).
 */
const start = (bin, lay) =>
  new Promise((resolve, reject) => {
    nextPort += 1
    const port = nextPort
    const argv = ["-c", lay.serverCpus, bin, String(port), slots]
    // Without --cores an exported BENCH_CORES is dropped, so no server goes
    // multi-core on the one pinned CPU unannounced.
    const env = { ...process.env }
    if (lay.cores === null) {
      delete env.BENCH_CORES
    } else {
      env.BENCH_CORES = String(lay.cores)
    }
    const child = spawn("taskset", argv, { stdio: ["ignore", "pipe", "inherit"], env })
    let seen = ""
    child.stdout.on("data", (d) => {
      seen += d
      if (seen.includes("listening")) {
        resolve({ child, port })
      }
    })
    // `close`, not `exit`: it comes once stdout is drained, so `seen` is whole.
    child.on("close", (code) => {
      if (seen.includes("single-core")) {
        resolve({ child, port, singleCore: true })
      } else {
        reject(new Error(`${bin} exited ${code} before listening: ${seen}`))
      }
    })
  })

const stop = async (child) => {
  child.removeAllListeners("close")
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }
  const done = new Promise((resolve) => child.on("exit", resolve))
  child.kill("SIGINT")
  await done
}

/** The fields of /proc/<pid>/stat after the command name, or null once the process is gone. */
const statFields = (pid) => {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8")
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")
  } catch {
    return null
  }
}

/** `pid` and every process descended from it. */
const processTree = (pid) => {
  const children = new Map()
  for (const entry of readdirSync("/proc")) {
    const fields = /^\d+$/.test(entry) ? statFields(entry) : null
    if (fields !== null) {
      const parent = Number(fields[1])
      children.set(parent, [...(children.get(parent) ?? []), Number(entry)])
    }
  }
  const tree = [pid]
  for (let k = 0; k < tree.length; k++) {
    tree.push(...(children.get(tree[k]) ?? []))
  }
  return tree
}

/**
 * The server's user and system CPU time so far, in microseconds (from /proc,
 * at the kernel's tick), summed over its process tree: the live processes'
 * own time, and the time of the children they have reaped.
 */
const cpuTimes = (pid) => {
  const tick = 1e6 / 100
  let user = 0
  let sys = 0
  for (const p of processTree(pid)) {
    const fields = statFields(p)
    if (fields !== null) {
      user += (Number(fields[11]) + Number(fields[13])) * tick
      sys += (Number(fields[12]) + Number(fields[14])) * tick
    }
  }
  return { user, sys }
}

/** The server's peak resident set in MB, summed over its process tree. */
const peakRss = (pid) => {
  let kb = 0
  for (const p of processTree(pid)) {
    try {
      const m = readFileSync(`/proc/${p}/status`, "utf8").match(/VmHWM:\s+(\d+) kB/)
      if (m) {
        kb += Number(m[1])
      } else if (p === pid) {
        kb = Number.NaN
      }
    } catch {
      // Gone since the tree was read.
    }
  }
  return kb / 1024
}

/** The server's resident set now, in MB. */
const residentRss = (pid) => {
  const m = readFileSync(`/proc/${pid}/status`, "utf8").match(/VmRSS:\s+(\d+) kB/)
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
const wrk = (scenario, port, seconds, lay) => {
  const argv = [
    "-c",
    lay.clientCpus,
    "wrk",
    "--latency",
    "-t",
    lay.threads,
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
    env: { ...process.env, NISH_HTTP_PAYLOAD: scenario.file ?? payloadFile },
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

/**
 * One request to `port` on the scenario's path: resolves to its status, headers
 * and body, or rejects after `FETCH_TIMEOUT_MS`.
 */
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("latin1"),
          })
        )
        res.on("error", reject)
      }
    )
    req.setTimeout(FETCH_TIMEOUT_MS, () =>
      req.destroy(new Error(`no answer in ${FETCH_TIMEOUT_MS / 1000} s`))
    )
    req.on("error", reject)
    req.end(scenario.post ? readFileSync(scenario.file) : undefined)
  })

const JSON_HELLO = '{"message":"Hello, World!"}'

/**
 * The answer a scenario must give: the exact body, or a pattern and the body it
 * is read against, and the headers it must carry.
 */
const contract = (scenario) => {
  if (scenario.file === bodyFile) {
    return { exact: rewritten }
  }
  if (scenario.path === "/") {
    return { exact: "Hi" }
  }
  if (scenario.path.startsWith("/id/")) {
    return { exact: "1 bun", headers: { "x-powered-by": "benchmark" } }
  }
  if (scenario.path === DEEP_PATH) {
    return { exact: "acme api 97" }
  }
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
  for (const [name, value] of Object.entries(want.headers ?? {})) {
    if (r.headers[name] !== value) {
      return fail(`header ${name} is ${JSON.stringify(r.headers[name])}, expected ${JSON.stringify(value)}`)
    }
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
      const { child, port: p } = await start(server.path, layout(null))
      if (!(await verify(k, scenario, p, child))) {
        await stop(child)
        console.log(`${scenario.name} | ${label(k)} | n/a`)
        continue
      }
      const tracer = spawn("strace", ["-c", "-f", "-o", file, "-p", String(child.pid)], { stdio: "ignore" })
      await sleep(500)
      const r = wrk(scenario, p, 2, layout(null))
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

/** How long a server may take to give its first answer before the startup scenario fails. */
const STARTUP_TIMEOUT_MS = 30000

/**
 * Spawns `bin` on a fresh port, pinned to CPU 0, and polls GET / once a
 * millisecond: resolves to the milliseconds until the first 200 and the
 * server's resident set then, in MB.
 */
const startup = async (bin) => {
  nextPort += 1
  const port = nextPort
  const began = performance.now()
  // One core, as without --cores: an exported BENCH_CORES is dropped here too.
  const env = { ...process.env }
  delete env.BENCH_CORES
  const child = spawn("taskset", ["-c", "0", bin, String(port), slots], {
    stdio: ["ignore", "ignore", "inherit"],
    env,
  })
  let exited = null
  child.on("exit", (code) => {
    exited = code
  })
  for (;;) {
    if (exited !== null) {
      throw new Error(`${bin} exited ${exited} before it answered`)
    }
    if (performance.now() - began > STARTUP_TIMEOUT_MS) {
      await stop(child)
      throw new Error(`${bin} did not answer GET / in ${STARTUP_TIMEOUT_MS / 1000} s`)
    }
    let r = null
    try {
      r = await fetchOnce({ path: "/" }, port)
    } catch {
      await sleep(1)
      continue
    }
    if (r.status !== 200) {
      await stop(child)
      throw new Error(`${bin} answered GET / with ${r.status}`)
    }
    break
  }
  const ms = performance.now() - began
  const rss = residentRss(child.pid)
  await stop(child)
  return { ms, rss }
}

/** Each round starts every server this many times, in the round's order. */
const STARTS_PER_ROUND = 4

/** Times every scenario with the server and wrk placed as `lay` says, and prints a table per scenario. */
const runLayout = async (lay) => {
  const cores = lay.cores === null ? "" : `${lay.cores} ${lay.cores === 1 ? "core" : "cores"}`
  const cpu = lay.serverCpus.includes("-") ? "CPUs" : "CPU"
  const where = `server on ${cores ? `${cores}, ` : ""}${cpu} ${lay.serverCpus}, wrk -t${lay.threads} on CPUs ${lay.clientCpus}`
  console.log(
    `# ${new Date().toISOString()}  ${where}${lay.shared ? " (client shares server cores)" : ""}, ${rounds} rounds x ${duration}s`
  )
  for (const scenario of scenarios) {
    const results = servers.map(() => ({
      rps: [],
      p99: [],
      user: [],
      sys: [],
      rss: [],
      errors: new Set(),
      na: null,
    }))
    for (let round = 0; round < rounds; round++) {
      // Alternate the order each round so neither build always runs first.
      const order = servers.map((_, k) => k).filter((k) => results[k].na === null)
      if (round % 2 === 1) {
        order.reverse()
      }
      for (const k of order) {
        const { child, port: p, singleCore } = await start(servers[k].path, lay)
        if (singleCore) {
          results[k].na = "single-core"
          continue
        }
        if (round === 0 && !(await verify(k, scenario, p, child))) {
          results[k].na = "no route (404)"
          await stop(child)
          continue
        }
        const idle = scenario.idle ? await holdIdle(scenario.idle, p) : []
        await sleep(200)
        wrk(scenario, p, 1, lay) // warm-up: fills the slots, faults in the pages
        const before = cpuTimes(child.pid)
        const r = wrk(scenario, p, duration, lay)
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
    console.log(`\n## ${scenario.name}${cores ? `, ${cores}` : ""}`)
    console.log(
      "| build | req/s (median) | spread | p99 ms | user µs/req | sys µs/req | peak RSS MB | notes |"
    )
    console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    const baseIndex = results.findIndex((r) => r.na === null)
    const base = baseIndex < 0 ? Number.NaN : median(results[baseIndex].rps)
    for (const k of servers.keys()) {
      const r = results[k]
      if (r.na === "single-core") {
        console.log(`| ${label(k)} | n/a (single-core) | n/a | n/a | n/a | n/a | n/a | uses one core only |`)
        continue
      }
      if (r.na !== null) {
        console.log(`| ${label(k)} | n/a | n/a | n/a | n/a | n/a | n/a | ${r.na} |`)
        continue
      }
      const m = median(r.rps)
      const lo = Math.min(...r.rps)
      const hi = Math.max(...r.rps)
      const delta =
        k === baseIndex ? "" : ` (${m >= base ? "+" : ""}${(((m - base) / base) * 100).toFixed(1)}%)`
      const notes = [...(lay.shared ? ["client shares server cores"] : []), ...r.errors].join(" ")
      console.log(
        `| ${label(k)} | ${Math.round(m).toLocaleString("en-US")}${delta} | ${Math.round(lo).toLocaleString("en-US")}–${Math.round(hi).toLocaleString("en-US")} | ${median(r.p99).toFixed(2)} | ${median(r.user).toFixed(2)} | ${median(r.sys).toFixed(2)} | ${Math.round(median(r.rss))} | ${notes} |`
      )
    }
  }
}

if (coreCounts === null) {
  await runLayout(layout(null))
} else {
  for (const [j, n] of coreCounts.entries()) {
    if (j > 0) {
      console.log("")
    }
    await runLayout(layout(n))
  }
}

if (timeStartup) {
  const results = servers.map(() => ({ ms: [], rss: [] }))
  for (let round = 0; round < rounds; round++) {
    const order = servers.map((_, k) => k)
    if (round % 2 === 1) {
      order.reverse()
    }
    for (let attempt = 0; attempt < STARTS_PER_ROUND; attempt++) {
      for (const k of order) {
        let r
        try {
          r = await startup(servers[k].path)
        } catch (e) {
          console.error(`${label(k)}: startup: ${e.message}`)
          process.exit(1)
        }
        results[k].ms.push(r.ms)
        results[k].rss.push(r.rss)
      }
    }
  }
  console.log(`\n## startup, spawn to first answer, ${rounds * STARTS_PER_ROUND} starts each`)
  console.log("| build | ms (median) | spread | RSS MB then |")
  console.log("| --- | ---: | ---: | ---: |")
  const base = servers.length > 0 ? median(results[0].ms) : Number.NaN
  for (const k of servers.keys()) {
    const r = results[k]
    const m = median(r.ms)
    const delta = k === 0 ? "" : ` (${m >= base ? "+" : ""}${(((m - base) / base) * 100).toFixed(1)}%)`
    console.log(
      `| ${label(k)} | ${m.toFixed(1)}${delta} | ${Math.min(...r.ms).toFixed(1)}–${Math.max(...r.ms).toFixed(1)} | ${median(r.rss).toFixed(1)} |`
    )
  }
}
