#!/usr/bin/env node
// Checks that every built twin answers what the Nish server answers, byte for
// byte, before bench/http.mjs times them against each other.
//
//   node bench/http-twins/check.mjs                         every built twin
//   node bench/http-twins/check.mjs --payload file uws bun  only these, another payload
//
// Each server is started on a fresh port and sent, over one keep-alive
// connection, GET /plaintext, GET /json, POST /json-echo with the payload, and
// POST /json-echo-doc. Bodies and Content-Type are compared with what the Nish
// server answers: `Hello, World!`, `{"message":"Hello, World!","n":2}` (the
// second request), and the payload with `"revision":7` made `"revision":8`.
// The Nish server answers /json-echo-doc with the same echo; from a twin it must
// be a 404, and so must /json-echo from nginx, which has no echo.
//
// Then the ping, query and body routes: GET / answers `Hi`; GET /id/1?name=bun
// answers `1 bun` with `x-powered-by: benchmark`, and so does a query whose
// `name` is not first; POST /json with bench/http-body.json answers it
// re-serialized, `{"hello":"world"}`, and a body that is not JSON a 400. nginx
// has no JSON, so its POST /json is a 404. Last, every route in
// extra-routes.mjs, a sample path for each GET pattern and a POST to it with
// `/submit`, must answer `ok`. Only the media type of Content-Type is compared,
// so a twin that adds `; charset=utf-8` still passes.
//
// The Nish server, build/bench/h1, is checked first when it is built. Exit 1
// names the server, the request and the first byte that differs; with no names
// given, a twin that is not built fails too.
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { Agent, request } from "node:http"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { extraRoutes, sampleOf } from "./extra-routes.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const twins = [
  "node-http",
  "uws",
  "bun",
  "bun-elysia",
  "bun-hono",
  "go-nethttp",
  "go-fasthttp",
  "rust-hyper",
  "rust-actix",
  "nginx",
]
const noEcho = new Set(["nginx"])
const body = readFileSync(join(root, "bench", "http-body.json"))
const rewritten = Buffer.from('{"hello":"world"}')
const powered = { "x-powered-by": "benchmark" }

const args = process.argv.slice(2)
let payloadFile = join(root, "bench", "http-payload.json")
const names = []
for (let k = 0; k < args.length; k++) {
  if (args[k] === "--payload") {
    if (k + 1 === args.length) {
      console.error("usage: check.mjs [--payload file] [name...]")
      process.exit(2)
    }
    payloadFile = args[++k]
  } else {
    names.push(args[k])
  }
}

const payload = readFileSync(payloadFile)
const revision = '"revision":7'
if (payload.toString("latin1").split(revision).length !== 2) {
  console.error(`check.mjs: ${payloadFile} must hold ${revision} exactly once`)
  process.exit(2)
}
const echoed = Buffer.from(payload.toString("latin1").replace(revision, '"revision":8'), "latin1")

const servers = []
const missing = []
const nish = join(root, "build", "bench", "h1")
if (existsSync(nish)) {
  servers.push({ name: "nish", argv: [nish, "PORT", "1024"] })
}
for (const name of names.length > 0 ? names : twins) {
  if (!twins.includes(name)) {
    console.error(`check.mjs: no twin named ${name} (one of: ${twins.join(" ")})`)
    process.exit(2)
  }
  const serve = join(root, "build", "http-twins", name, "serve")
  if (existsSync(serve)) {
    servers.push({ name, argv: [serve, "PORT"] })
  } else if (names.length > 0) {
    console.error(`check.mjs: ${serve} is not built (bash bench/http-twins/build.sh ${name})`)
    process.exit(2)
  } else {
    missing.push(name)
  }
}

/** A port nothing is listening on, from the kernel. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.on("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })

/** Starts `argv` with its port filled in; resolves once it prints `listening`. */
const start = (argv, port) =>
  new Promise((resolve, reject) => {
    const [bin, ...rest] = argv.map((a) => (a === "PORT" ? String(port) : a))
    const child = spawn(bin, rest, { stdio: ["ignore", "pipe", "inherit"] })
    let seen = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new Error(`no "listening" within 30s: ${seen}`))
    }, 30000)
    child.stdout.on("data", (chunk) => {
      seen += chunk
      if (seen.includes("listening")) {
        clearTimeout(timer)
        resolve(child)
      }
    })
    child.on("error", reject)
    child.on("exit", (code) => reject(new Error(`exited ${code} before listening: ${seen}`)))
  })

/** One request on `agent`'s connection; resolves to its status, headers and body. */
const send = (agent, port, method, path, sent) =>
  new Promise((resolve, reject) => {
    const headers = sent ? { "Content-Type": "application/json", "Content-Length": sent.length } : {}
    const req = request({ agent, host: "127.0.0.1", port, method, path, headers }, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      )
    })
    req.on("error", reject)
    req.end(sent)
  })

/** The media type of a Content-Type, without its parameters, in lower case. */
const mediaType = (type) => (type ?? "").split(";", 1)[0].trim().toLowerCase()

/** The first difference between `got` and `want`, or null when they are equal. */
const differ = (got, want) => {
  const length = Math.min(got.length, want.length)
  let at = 0
  while (at < length && got[at] === want[at]) {
    at++
  }
  if (at === got.length && at === want.length) {
    return null
  }
  const show = (bytes) => (at < bytes.length ? JSON.stringify(String.fromCharCode(bytes[at])) : "end of body")
  return `differs at byte ${at}: expected ${show(want)}, got ${show(got)}`
}

const check = async (server) => {
  const port = await freePort()
  const child = await start(server.argv, port)
  const agent = new Agent({ keepAlive: true, maxSockets: 1 })
  const expect = [
    ["GET", "/plaintext", null, 200, "text/plain", Buffer.from("Hello, World!")],
    ["GET", "/json", null, 200, "application/json", Buffer.from('{"message":"Hello, World!","n":2}')],
    noEcho.has(server.name)
      ? ["POST", "/json-echo", payload, 404]
      : ["POST", "/json-echo", payload, 200, "application/json", echoed],
    server.name === "nish"
      ? ["POST", "/json-echo-doc", payload, 200, "application/json", echoed]
      : ["POST", "/json-echo-doc", payload, 404],
    ["GET", "/", null, 200, "text/plain", Buffer.from("Hi")],
    ["GET", "/id/1?name=bun", null, 200, "text/plain", Buffer.from("1 bun"), powered],
    ["GET", "/id/1?x=1&name=hina", null, 200, "text/plain", Buffer.from("1 hina"), powered],
    ["GET", "/id/1/2?name=bun", null, 404],
    noEcho.has(server.name)
      ? ["POST", "/json", body, 404]
      : ["POST", "/json", body, 200, "application/json", rewritten],
    noEcho.has(server.name)
      ? ["POST", "/json", Buffer.from("{"), 404]
      : ["POST", "/json", Buffer.from("{"), 400],
    ...extraRoutes.flatMap((pattern) => [
      ["GET", sampleOf(pattern), null, 200, "text/plain", Buffer.from("ok")],
      ["POST", `${sampleOf(pattern)}/submit`, null, 200, "text/plain", Buffer.from("ok")],
    ]),
    ["GET", "/orders/", null, 404],
    ["POST", "/orders/42", null, 404],
  ]
  const faults = []
  try {
    for (const [method, path, sent, status, type, want, headers = {}] of expect) {
      const got = await send(agent, port, method, path, sent)
      const where = `${server.name}: ${method} ${path}`
      const header = Object.keys(headers).find((name) => got.headers[name] !== headers[name])
      if (got.status !== status) {
        faults.push(`${where}: status ${got.status}, expected ${status}`)
      } else if (want && mediaType(got.headers["content-type"]) !== type) {
        const seen = JSON.stringify(got.headers["content-type"])
        faults.push(`${where}: Content-Type ${seen}, expected ${JSON.stringify(type)}`)
      } else if (want && differ(got.body, want)) {
        faults.push(`${where}: body ${differ(got.body, want)}`)
      } else if (header) {
        faults.push(`${where}: ${header} ${JSON.stringify(got.headers[header])}, expected ${headers[header]}`)
      }
    }
  } finally {
    agent.destroy()
    child.kill("SIGINT")
  }
  return faults
}

let failed = 0
for (const server of servers) {
  let faults
  try {
    faults = await check(server)
  } catch (e) {
    faults = [`${server.name}: ${e.message}`]
  }
  if (faults.length === 0) {
    console.log(`ok   ${server.name}`)
  } else {
    failed++
    for (const fault of faults) {
      console.log(`FAIL ${fault}`)
    }
  }
}
for (const name of missing) {
  console.log(`FAIL ${name}: not built (bash bench/http-twins/build.sh ${name}, or name the twins to check)`)
}
process.exitCode = failed === 0 && missing.length === 0 && servers.length > 0 ? 0 : 1
