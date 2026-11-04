#!/usr/bin/env node
// Drives a build of bench/http1-server.ts through one scenario of
// bench/http.mjs without wrk: one keep-alive connection, one request at a
// time, `requests` of them, after which the server returns from `main`. Run
// alone it times nothing; it exists so the server can run under callgrind or
// the copy-counting shim (copycount.c) with every request accounted for, the
// way README.md's "Attribution" measures it.
//
//   node bench/runtime-copies/server.mjs [options] <h1 build> <scenario> [requests]
//     --callgrind <file>  run the server under valgrind's callgrind, writing
//                         <file>, with NISH_SIMD=base and glibc's string
//                         functions pinned as bench/run.mjs pins them
//     --copycount <so>    run it with LD_PRELOAD=<so> (copycount.c, built) and
//                         print the memcpy and memmove calls that reached libc,
//                         by calling function, with their sizes
//
// The scenarios are bench/http.mjs's keep-alive ones: ping, query, body,
// plaintext, json, post-json, post-json-doc, deep-route. A request is the
// bytes wrk sends (bench/http-post-json.lua's for a POST); a response is
// read to its Content-Length before the next request goes. Every response
// must be a 200, or the run stops.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const bench = path.resolve(here, "..")

/** glibc's `memcpy` and `memset` pinned to the SSE2 baseline, as bench/run.mjs pins them. */
const PINNED_LIBC = [
  "glibc.cpu.hwcaps=-AVX_Fast_Unaligned_Load,-AVX2,-AVX512F,-AVX512VL,-ERMS,-FSRM,-SSSE3",
  "glibc.cpu.x86_non_temporal_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_movsb_threshold=0x0fffffffffffffff",
  "glibc.cpu.x86_rep_stosb_threshold=0x0fffffffffffffff",
].join(":")

/** The symbolizer, named once (knip reads a literal in a spawn as an unlisted binary). */
const ADDR2LINE = "addr2line"

const SCENARIOS = {
  ping: { path: "/" },
  query: { path: "/id/1?name=bun" },
  body: { path: "/json", file: "http-body.json" },
  plaintext: { path: "/plaintext" },
  json: { path: "/json" },
  "post-json": { path: "/json-echo", file: "http-payload.json" },
  "post-json-doc": { path: "/json-echo-doc", file: "http-payload.json" },
  "deep-route": { path: "/v1/orgs/acme/projects/api/builds/97/artifacts" },
}

/** The server, once spawned: killed on every way out, so no run leaves one listening. */
let child = null
process.on("exit", () => {
  if (child !== null && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL")
  }
})
process.on("SIGINT", () => process.exit(130))
process.on("SIGTERM", () => process.exit(143))

const fail = (msg) => {
  console.error(`bench/runtime-copies/server.mjs: ${msg}`)
  process.exit(2)
}

let callgrind = null
let copycount = null
const positional = []
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === "--callgrind") {
    callgrind = path.resolve(process.argv[++i] ?? "")
  } else if (a === "--copycount") {
    copycount = path.resolve(process.argv[++i] ?? "")
  } else {
    positional.push(a)
  }
}
const [bin, name, count = "2000"] = positional
const scenario = SCENARIOS[name]
const requests = Number(count)
if (bin === undefined || scenario === undefined || !(Number.isInteger(requests) && requests >= 1)) {
  fail(
    `usage: server.mjs [--callgrind <file>] [--copycount <so>] <h1 build> <${Object.keys(SCENARIOS).join("|")}> [requests]`
  )
}
const exe = path.resolve(bin)

const body = scenario.file === undefined ? null : fs.readFileSync(path.join(bench, scenario.file))
const request = (at) => {
  const head =
    `${body === null ? "GET" : "POST"} ${scenario.path} HTTP/1.1\r\nHost: 127.0.0.1:${at}\r\n` +
    (body === null ? "" : `Content-Type: application/json\r\nContent-Length: ${body.length}\r\n`) +
    "\r\n"
  return body === null ? Buffer.from(head) : Buffer.concat([Buffer.from(head), body])
}

const port = 20000 + (process.pid % 20000)
// One core and no tuning, as bench/http.mjs runs a server without --cores: an
// exported BENCH_CORES or BENCH_QUICKACK is dropped.
const env = { ...process.env }
delete env.BENCH_CORES
delete env.BENCH_QUICKACK
let cmd = exe
let args = [String(port), "64", String(requests)]
if (callgrind !== null) {
  Object.assign(env, { GLIBC_TUNABLES: PINNED_LIBC, NISH_SIMD: "base" })
  args = ["--tool=callgrind", `--callgrind-out-file=${callgrind}`, exe, ...args]
  cmd = "valgrind"
}
if (copycount !== null) {
  env.LD_PRELOAD = copycount
}
child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] })
let stderr = ""
child.stderr.on("data", (d) => {
  stderr += d
})
const exited = new Promise((resolve) => child.on("exit", (status) => resolve(status)))

await new Promise((resolve) => {
  const early = () => fail(`the server exited before listening\n${stderr}`)
  child.once("exit", early)
  let out = ""
  child.stdout.on("data", (d) => {
    out += d
    if (out.includes("listening")) {
      child.off("exit", early)
      resolve()
    }
  })
})

const socket = net.connect(port, "127.0.0.1")
socket.on("error", (e) => fail(`the connection: ${e.message}`))
await new Promise((resolve) => socket.once("connect", resolve))
const wire = request(port)
let pending = Buffer.alloc(0)
let answered = 0
await new Promise((resolve) => {
  socket.on("data", (d) => {
    pending = Buffer.concat([pending, d])
    for (;;) {
      const end = pending.indexOf("\r\n\r\n")
      if (end < 0) {
        return
      }
      const head = pending.subarray(0, end).toString("latin1")
      const length = Number(/\r\ncontent-length: *(\d+)/i.exec(head)?.[1] ?? "0")
      if (pending.length < end + 4 + length) {
        return
      }
      if (!head.startsWith("HTTP/1.1 200")) {
        fail(`request ${answered + 1}: ${head.split("\r\n")[0]}`)
      }
      pending = pending.subarray(end + 4 + length)
      answered++
      if (answered === requests) {
        resolve()
        return
      }
      socket.write(wire)
    }
  })
  socket.write(wire)
})
socket.end()
const code = await exited
if (code !== 0) {
  fail(`the server exited ${code}\n${stderr}`)
}
console.log(`${name}: ${answered} requests answered`)

if (copycount !== null) {
  // One line a call site: `copycount <fn> caller <hex> calls <n> bytes <b> sizes ...`.
  const sites = [
    ...stderr.matchAll(/^copycount (\w+) caller ([0-9a-f]+) calls (\d+) bytes (\d+) sizes (.*)$/gm),
  ]
  // Caller 0 is outside the executable, so it is not symbolized.
  const inside = sites.filter((m) => m[2] !== "0")
  const addrs = inside.map((m) => `0x${(Number.parseInt(m[2], 16) - 1).toString(16)}`)
  // `-a -f -i`: each address, then its inline chain innermost first, each a
  // name and a line; the outermost name is the function the call sits in (a
  // fortified `memcpy` inline from string.h would otherwise name itself).
  const symbolized =
    addrs.length === 0
      ? ""
      : spawnSync(ADDR2LINE, ["-a", "-f", "-i", "-C", "-e", exe, ...addrs], { encoding: "utf8" }).stdout
  const chains = symbolized
    .split(/^0x[0-9a-f]+\n/m)
    .slice(1)
    .map((chain) => {
      const lines = chain.trimEnd().split("\n")
      return lines[lines.length - 2] ?? "??"
    })
  const nameOf = new Map(inside.map((m, i) => [m, chains[i] ?? "??"]))
  const byCaller = new Map()
  for (const m of sites) {
    const caller = nameOf.get(m) ?? "??"
    const key = `${m[1]} from ${caller === "??" ? "outside the executable (libc, the loader)" : caller}`
    const s = byCaller.get(key) ?? { calls: 0, bytes: 0, sizes: new Map() }
    s.calls += Number(m[3])
    s.bytes += Number(m[4])
    for (const pair of m[5].trim().split(" ")) {
      const [k, v] = pair.split(":")
      s.sizes.set(k, (s.sizes.get(k) ?? 0) + Number(v))
    }
    byCaller.set(key, s)
  }
  const rows = [...byCaller].sort((a, b) => b[1].calls - a[1].calls)
  for (const [key, s] of rows) {
    const sizes = [...s.sizes].map(([k, v]) => `<=${k}:${v}`).join(" ")
    console.log(
      `${(s.calls / answered).toFixed(2).padStart(8)} a request, mean ${(s.bytes / s.calls).toFixed(0).padStart(5)} B  ${key}  [${sizes}]`
    )
  }
}
