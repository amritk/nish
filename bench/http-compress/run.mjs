#!/usr/bin/env node
// Compression that pays for itself: an HTTP/1.1 server (server.ts) answering
// a mix of 0.5 to 8 KB JSON bodies to a client that sends
// `Accept-Encoding: gzip` (client.py), under each setting of `HttpCompressor`.
//
//   node bench/http-compress/run.mjs [--requests N] [--rounds N] [--compiler path]
//
// Writes 16 bodies (feed.mjs's `feedJson`, the largest item count under each
// size from 512 to 8192 bytes, in even steps of the logarithm) to
// build/bench/http-compress/, builds the server, and for each setting starts
// it, warms it with a tenth of the requests, then sends `--requests` (default
// 50000) on one keep-alive connection. Per response it reports the server's
// CPU time (user and system, from /proc), the bytes on the wire (head and
// body), the TCP segments that carried them and the client's pure ACKs (the
// client's TCP_INFO, its MSS clamped to an Ethernet peer's), and the share
// sent gzip. CPU is the median of `--rounds` (default 3); the counts do not
// vary between rounds. Linux only: it reads /proc and TCP_INFO.
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { feedJson } from "../gzip/feed.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const out = path.join(root, "build", "bench", "http-compress")
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}
const requests = Number(flag("--requests", "50000"))
const rounds = Number(flag("--rounds", "3"))
const compiler = flag("--compiler", path.join(root, "build", "nish"))
const settings = ["none", "level", "always", "threshold", "segment"]
const decisionNames = [
  "sent",
  "not accepted",
  "too small",
  "too large",
  "too little saved",
  "no fewer segments",
]

/** Runs a command, failing the bench with its output when it fails. */
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" })
  if (r.status !== 0) {
    process.stderr.write(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

const ticksPerSecond = Number(run("getconf", ["CLK_TCK"]).trim())

/** A process's user and system CPU time so far, in seconds. */
const cpuOf = (pid) => {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8")
  // Fields after the command name, which ends at the last ')': utime is the 14th field, stime the 15th.
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
  return (Number(fields[11]) + Number(fields[12])) / ticksPerSecond
}

/** The body of `GET path` from the server on `port`. */
const fetchText = (port, target) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path: target }, (res) => {
        let text = ""
        res.on("data", (chunk) => (text += chunk))
        res.on("end", () => resolve(text))
      })
      .on("error", reject)
  })

/** Starts the server under `setting` and resolves once it listens. */
const startServer = (port, setting, files) =>
  new Promise((resolve, reject) => {
    const child = spawn(path.join(out, "server"), [String(port), setting, ...files], {
      stdio: ["ignore", "pipe", "inherit"],
    })
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("listening")) {
        resolve(child)
      }
    })
    child.on("exit", (code) => reject(new Error(`server exited with ${code}`)))
  })

const client = (port, n, seed, files) =>
  JSON.parse(run("python3", [path.join(here, "client.py"), String(port), String(n), String(seed), ...files]))

fs.mkdirSync(out, { recursive: true })
const bodyFiles = []
for (let i = 0; i < 16; i++) {
  const target = Math.round(512 * 16 ** (i / 15))
  let n = 1
  while (feedJson(n + 1).length <= target) {
    n += 1
  }
  const file = path.join(out, `body-${i}.json`)
  fs.writeFileSync(file, feedJson(n))
  bodyFiles.push(file)
}
run(compiler, [path.join(here, "server.ts"), "-o", `${out}/`, "--link", path.join(out, "server")])

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const results = new Map()
let nextPort = 18500 + Math.floor(Math.random() * 1000)
for (let r = 0; r < rounds; r++) {
  for (const setting of settings) {
    nextPort += 1
    const port = nextPort
    const server = await startServer(port, setting, bodyFiles)
    client(port, Math.ceil(requests / 10), 2, bodyFiles)
    const warm = (await fetchText(port, "/stats")).trim().split(" ").map(Number)
    const before = cpuOf(server.pid)
    const counts = client(port, requests, 1, bodyFiles)
    const cpu = cpuOf(server.pid) - before
    const stats = (await fetchText(port, "/stats"))
      .trim()
      .split(" ")
      .map((n, i) => Number(n) - warm[i])
    server.removeAllListeners("exit")
    server.kill()
    const row = results.get(setting) ?? { cpu: [], counts, stats }
    row.cpu.push(cpu)
    results.set(setting, row)
  }
}

const sizes = bodyFiles.map((f) => fs.statSync(f).size)
console.log(
  `${requests} requests a setting over one connection, bodies of ${sizes[0]} to ${sizes[sizes.length - 1]} bytes ` +
    `(mean ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)}), MSS ${results.get("none").counts.rcv_mss}; ` +
    `CPU the median of ${rounds} rounds\n`
)
console.log(
  "| setting | server CPU µs/response | bytes/response | segments/response | client ACKs/response | sent gzip |"
)
console.log("| --- | --- | --- | --- | --- | --- |")
for (const setting of settings) {
  const { cpu, counts, stats } = results.get(setting)
  const per = (x) => (x / counts.requests).toFixed(2)
  const decided = stats
    .map((n, i) =>
      n > 0 && setting !== "none" ? `${decisionNames[i]} ${((100 * n) / counts.requests).toFixed(0)}%` : ""
    )
    .filter((s) => s.length > 0)
  console.log(
    `| ${setting} | ${((1e6 * median(cpu)) / counts.requests).toFixed(2)} | ${Math.round(counts.bytes_received / counts.requests)} | ` +
      `${per(counts.data_segs_in)} | ${per(counts.segs_out - counts.data_segs_out)} | ` +
      `${((100 * counts.gzipped) / counts.requests).toFixed(0)}%${decided.length > 0 ? ` (${decided.join(", ")})` : ""} |`
  )
}
