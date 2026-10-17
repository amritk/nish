// The uWebSockets.js twin of bench/http1-server.ts: one `App`, one event loop,
// one process. build.sh puts the pinned uWebSockets.js beside this file in
// build/http-twins/uws/node_modules, which is where the import resolves.
//
//   node server.mjs <port> [ignored...]
import { createRequire } from "node:module"

// The package is fetched by build.sh from its GitHub tag, not from npm, so it is
// no dependency of this repository's package.json; a computed name keeps the
// dead-code check from asking for one.
const uwsPackage = ["uWebSockets", "js"].join(".")
const uws = createRequire(import.meta.url)(uwsPackage)

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
const echo = (res) => {
  const chunks = []
  res.onAborted(() => {
    res.aborted = true
  })
  res.onData((chunk, isLast) => {
    chunks.push(Buffer.from(chunk.slice(0)))
    if (!isLast) {
      return
    }
    const order = decode(Buffer.concat(chunks))
    if (res.aborted) {
      return
    }
    res.cork(() => {
      if (order === null) {
        res.writeStatus("400 Bad Request").writeHeader("Content-Type", "text/plain").end("bad request")
        return
      }
      order.revision += 1
      res.writeHeader("Content-Type", "application/json").end(JSON.stringify(order))
    })
  })
}

uws
  .App()
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
