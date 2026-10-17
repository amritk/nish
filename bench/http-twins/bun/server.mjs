// The `Bun.serve` twin of bench/http1-server.ts: one process, no `reusePort`
// workers, so it gets the one core the Nish server gets.
//
//   bun server.mjs <port> [ignored...]
const port = Number(process.argv[2] ?? 8080)
const text = { "Content-Type": "text/plain" }
const json = { "Content-Type": "application/json" }
let requests = 0

const echo = async (req) => {
  let order
  try {
    order = await req.json()
  } catch {
    order = null
  }
  if (order === null || typeof order !== "object" || Array.isArray(order)) {
    return new Response("bad request", { status: 400, headers: text })
  }
  order.revision += 1
  return new Response(JSON.stringify(order), { headers: json })
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  routes: {
    "/plaintext": {
      GET: () => {
        requests += 1
        return new Response("Hello, World!", { headers: text })
      },
    },
    "/json": {
      GET: () => {
        requests += 1
        return new Response(JSON.stringify({ message: "Hello, World!", n: requests }), { headers: json })
      },
    },
    "/json-echo": {
      POST: (req) => {
        requests += 1
        return echo(req)
      },
    },
  },
  fetch: () => {
    requests += 1
    return new Response("not found", { status: 404, headers: text })
  },
})
console.log(`listening ${port}`)
