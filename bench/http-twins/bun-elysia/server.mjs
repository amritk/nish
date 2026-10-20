// The Elysia twin of bench/http1-server.ts, on Bun: one `Elysia` app. With
// BENCH_CORES unset or 1, one process, no `reusePort` workers; with
// BENCH_CORES=N, N processes on the one port (bun-cores.mjs). build.sh
// installs the pinned Elysia from bun.lock beside this file in
// build/http-twins/bun-elysia/node_modules.
//
//   bun server.mjs <port> [ignored...]
//
// The extra routes are registered first, as a small service would register
// them, and the measured routes after. Elysia parses the JSON bodies itself
// (`parse: "json"`), so a body that is not JSON reaches onError as PARSE.
import { Elysia } from "elysia"
import { reusePort, spawnWorkers } from "../bun-cores.mjs"
import { extraRoutes } from "../extra-routes.mjs"

const port = Number(process.argv[2] ?? 8080)
const text = { "Content-Type": "text/plain" }
const json = { "Content-Type": "application/json" }
let requests = 0

const badRequest = () => new Response("bad request", { status: 400, headers: text })
const ok = () => {
  requests += 1
  return new Response("ok", { headers: text })
}

const app = new Elysia().onError(({ code }) => {
  requests += 1
  if (code === "PARSE") {
    return badRequest()
  }
  return new Response("not found", { status: 404, headers: text })
})
for (const pattern of extraRoutes) {
  app.get(pattern, ok).post(`${pattern}/submit`, ok)
}

app
  .get("/", () => {
    requests += 1
    return new Response("Hi", { headers: text })
  })
  .get("/id/:id", ({ params, query, set }) => {
    requests += 1
    set.headers["x-powered-by"] = "benchmark"
    return new Response(`${params.id} ${query.name ?? ""}`, { headers: text })
  })
  .get("/plaintext", () => {
    requests += 1
    return new Response("Hello, World!", { headers: text })
  })
  .get("/json", () => {
    requests += 1
    return new Response(JSON.stringify({ message: "Hello, World!", n: requests }), { headers: json })
  })
  .post(
    "/json",
    ({ body }) => {
      requests += 1
      return new Response(JSON.stringify(body), { headers: json })
    },
    { parse: "json" }
  )
  .post(
    "/json-echo",
    ({ body }) => {
      requests += 1
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return badRequest()
      }
      body.revision += 1
      return new Response(JSON.stringify(body), { headers: json })
    },
    { parse: "json" }
  )
  .listen({ hostname: "127.0.0.1", port, reusePort })
await spawnWorkers(import.meta.path, port)
console.log(`listening ${port}`)
