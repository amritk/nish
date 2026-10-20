// The `Bun.serve` twin of bench/http1-server.ts. With BENCH_CORES unset or 1,
// one process, no `reusePort` workers, so it gets the one core the Nish server
// gets; with BENCH_CORES=N, N processes on the one port (bun-cores.mjs). It
// prints `listening` once all N are bound.
//
//   bun server.mjs <port> [ignored...]
//
// The extra routes go into `routes` first, as a small service would register
// them, and the measured routes after.
import { reusePort, spawnWorkers } from "../bun-cores.mjs"
import { extraRoutes } from "../extra-routes.mjs"

const port = Number(process.argv[2] ?? 8080)
const text = { "Content-Type": "text/plain" }
const json = { "Content-Type": "application/json" }
const query = { "Content-Type": "text/plain", "x-powered-by": "benchmark" }
let requests = 0

const ok = () => {
  requests += 1
  return new Response("ok", { headers: text })
}
const extras = {}
for (const pattern of extraRoutes) {
  extras[pattern] = { GET: ok }
  extras[`${pattern}/submit`] = { POST: ok }
}

/** Re-serializes any JSON body, compactly; 400 when it is not JSON. */
const rewrite = async (req) => {
  let value
  try {
    value = JSON.parse(await req.text())
  } catch {
    return new Response("bad request", { status: 400, headers: text })
  }
  return new Response(JSON.stringify(value), { headers: json })
}

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
  reusePort,
  routes: {
    ...extras,
    "/": {
      GET: () => {
        requests += 1
        return new Response("Hi", { headers: text })
      },
    },
    "/id/:id": {
      GET: (req) => {
        requests += 1
        const name = new URL(req.url).searchParams.get("name") ?? ""
        return new Response(`${req.params.id} ${name}`, { headers: query })
      },
    },
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
      POST: (req) => {
        requests += 1
        return rewrite(req)
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
await spawnWorkers(import.meta.path, port)
console.log(`listening ${port}`)
