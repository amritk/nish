// The `Bun.serve` twin of bench/http1-server.ts. With BENCH_CORES unset or 1,
// one process, no `reusePort` workers, so it gets the one core the Nish server
// gets. With BENCH_CORES=N, N processes on the one port with `reusePort: true`:
// this one and N-1 it spawns, which the kernel shares connections between. It
// prints `listening` once all N are bound, and stops them on SIGINT.
//
//   bun server.mjs <port> [ignored...]
const port = Number(process.argv[2] ?? 8080)
const cores = Math.max(1, Math.trunc(Number(process.env.BENCH_CORES ?? 1)) || 1)
// Set in the processes this one spawns, so they serve rather than spawn.
const isWorker = process.env.BENCH_BUN_WORKER === "1"
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
  reusePort: cores > 1,
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
/** Resolves once `worker` prints `listening`, and fails if it exits first. */
const bound = async (worker) => {
  const decoder = new TextDecoder()
  let seen = ""
  for await (const chunk of worker.stdout) {
    seen += decoder.decode(chunk)
    if (seen.includes("listening")) {
      return
    }
  }
  throw new Error(`a reusePort worker exited before listening: ${seen}`)
}

if (!isWorker && cores > 1) {
  const workers = Array.from({ length: cores - 1 }, () =>
    Bun.spawn([process.execPath, import.meta.path, String(port)], {
      env: { ...process.env, BENCH_BUN_WORKER: "1" },
      stdout: "pipe",
      stderr: "inherit",
    })
  )
  process.on("SIGINT", () => {
    for (const worker of workers) {
      worker.kill("SIGINT")
    }
    process.exit(0)
  })
  await Promise.all(workers.map(bound))
}
console.log(`listening ${port}`)
