// The `node:http` twin of bench/http1-server.ts: one process, one event loop,
// no cluster, so it gets the one core the Nish server gets.
//
//   node server.mjs <port> [ignored...]
import { createServer } from "node:http"

const port = Number(process.argv[2] ?? 8080)
const text = { "Content-Type": "text/plain" }
const json = { "Content-Type": "application/json" }
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

/** Answers 400 for a body that is not the order, as the Nish server does. */
const echo = (req, res) => {
  const chunks = []
  req.on("data", (chunk) => chunks.push(chunk))
  req.on("end", () => {
    const order = decode(Buffer.concat(chunks))
    if (order === null) {
      res.writeHead(400, text).end("bad request")
      return
    }
    order.revision += 1
    res.writeHead(200, json).end(JSON.stringify(order))
  })
}

const server = createServer((req, res) => {
  requests += 1
  const path = req.url.split("?", 1)[0]
  if (req.method === "GET" && path === "/plaintext") {
    res.writeHead(200, text).end("Hello, World!")
  } else if (req.method === "GET" && path === "/json") {
    res.writeHead(200, json).end(JSON.stringify({ message: "Hello, World!", n: requests }))
  } else if (req.method === "POST" && path === "/json-echo") {
    echo(req, res)
  } else {
    res.writeHead(404, text).end("not found")
  }
})
server.listen(port, "127.0.0.1", () => console.log(`listening ${port}`))
