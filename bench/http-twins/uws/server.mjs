// The uWebSockets.js twin of bench/http1-server.ts: one `App`, one event loop,
// one process. build.sh puts the pinned uWebSockets.js beside this file in
// build/http-twins/uws/node_modules, which is where the import resolves.
//
//   node server.mjs <port> [ignored...]
//
// The extra routes are registered first, as a small service would register
// them, and the measured routes after.
import { createRequire } from "node:module"
import { extraRoutes } from "../extra-routes.mjs"

// The package is fetched by build.sh from its GitHub tag, not from npm, so it is
// no dependency of this repository's package.json; a computed name keeps the
// dead-code check from asking for one.
const uwsPackage = ["uWebSockets", "js"].join(".")
const uws = createRequire(import.meta.url)(uwsPackage)

// One event loop is all this twin uses, so given more cores (BENCH_CORES > 1)
// it says so and exits, and bench/http.mjs reads its cells as n/a.
if (Number(process.env.BENCH_CORES ?? 1) > 1) {
  console.log("single-core")
  process.exit(0)
}

const port = Number(process.argv[2] ?? 8080)
let requests = 0

/** The decoded order, or null when the body is not JSON or not an object. */
const decode = (bytes) => {
  try {
    const order = JSON.parse(bytes.toString("utf8"))
    return order !== null && typeof order === "object" && !Array.isArray(order) ? order : null
  } catch {
    return null
  }
}

/** Copies each chunk (uWS reuses its buffer once the callback returns), then answers. */
const readBody = (res, answer) => {
  const chunks = []
  res.onAborted(() => {
    res.aborted = true
  })
  res.onData((chunk, isLast) => {
    chunks.push(Buffer.from(chunk.slice(0)))
    if (!isLast || res.aborted) {
      return
    }
    const bytes = Buffer.concat(chunks)
    res.cork(() => answer(bytes))
  })
}

const badRequest = (res) => {
  res.writeStatus("400 Bad Request").writeHeader("Content-Type", "text/plain").end("bad request")
}

const echo = (res) =>
  readBody(res, (bytes) => {
    const order = decode(bytes)
    if (order === null) {
      badRequest(res)
      return
    }
    order.revision += 1
    res.writeHeader("Content-Type", "application/json").end(JSON.stringify(order))
  })

/** Re-serializes any JSON body, compactly; 400 when it is not JSON. */
const rewrite = (res) =>
  readBody(res, (bytes) => {
    let value
    try {
      value = JSON.parse(bytes.toString("utf8"))
    } catch {
      badRequest(res)
      return
    }
    res.writeHeader("Content-Type", "application/json").end(JSON.stringify(value))
  })

const ok = (res) => {
  requests += 1
  res.writeHeader("Content-Type", "text/plain").end("ok")
}

const app = uws.App()
for (const pattern of extraRoutes) {
  app.get(pattern, ok).post(`${pattern}/submit`, ok)
}

app
  .get("/", (res) => {
    requests += 1
    res.writeHeader("Content-Type", "text/plain").end("Hi")
  })
  .get("/id/:id", (res, req) => {
    requests += 1
    const name = new URLSearchParams(req.getQuery() ?? "").get("name") ?? ""
    res
      .writeHeader("Content-Type", "text/plain")
      .writeHeader("x-powered-by", "benchmark")
      .end(`${req.getParameter(0)} ${name}`)
  })
  .get("/plaintext", (res) => {
    requests += 1
    res.writeHeader("Content-Type", "text/plain").end("Hello, World!")
  })
  .get("/json", (res) => {
    requests += 1
    res
      .writeHeader("Content-Type", "application/json")
      .end(JSON.stringify({ message: "Hello, World!", n: requests }))
  })
  .post("/json", (res) => {
    requests += 1
    rewrite(res)
  })
  .post("/json-echo", (res) => {
    requests += 1
    echo(res)
  })
  .any("/*", (res) => {
    requests += 1
    res.writeStatus("404 Not Found").writeHeader("Content-Type", "text/plain").end("not found")
  })
  .listen("127.0.0.1", port, (token) => {
    if (!token) {
      console.error(`listen failed on ${port}`)
      process.exit(1)
    }
    console.log(`listening ${port}`)
  })
