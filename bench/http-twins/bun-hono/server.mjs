// The Hono twin of bench/http1-server.ts, on Bun: one `Hono` app with its
// default router, served by `Bun.serve` in one process with no `reusePort`
// workers. build.sh installs the pinned Hono from bun.lock beside this file in
// build/http-twins/bun-hono/node_modules.
//
//   bun server.mjs <port> [ignored...]
//
// The extra routes are registered first, as a small service would register
// them, and the measured routes after.
import { Hono } from "hono"
import { extraRoutes } from "../extra-routes.mjs"

const port = Number(process.argv[2] ?? 8080)
const text = { "Content-Type": "text/plain" }
const json = { "Content-Type": "application/json" }
let requests = 0

/** The request's JSON body, or undefined when it is not JSON. */
const parsed = async (c) => {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const app = new Hono()
const ok = (c) => {
  requests += 1
  return c.body("ok", 200, text)
}
for (const pattern of extraRoutes) {
  app.get(pattern, ok).post(`${pattern}/submit`, ok)
}

app
  .get("/", (c) => {
    requests += 1
    return c.body("Hi", 200, text)
  })
  .get("/id/:id", (c) => {
    requests += 1
    return c.body(`${c.req.param("id")} ${c.req.query("name") ?? ""}`, 200, {
      ...text,
      "x-powered-by": "benchmark",
    })
  })
  .get("/plaintext", (c) => {
    requests += 1
    return c.body("Hello, World!", 200, text)
  })
  .get("/json", (c) => {
    requests += 1
    return c.body(JSON.stringify({ message: "Hello, World!", n: requests }), 200, json)
  })
  .post("/json", async (c) => {
    requests += 1
    const value = await parsed(c)
    if (value === undefined) {
      return c.body("bad request", 400, text)
    }
    return c.body(JSON.stringify(value), 200, json)
  })
  .post("/json-echo", async (c) => {
    requests += 1
    const order = await parsed(c)
    if (order === undefined || order === null || typeof order !== "object" || Array.isArray(order)) {
      return c.body("bad request", 400, text)
    }
    order.revision += 1
    return c.body(JSON.stringify(order), 200, json)
  })
  .notFound((c) => {
    requests += 1
    return c.body("not found", 404, text)
  })

Bun.serve({ hostname: "127.0.0.1", port, fetch: app.fetch })
console.log(`listening ${port}`)
