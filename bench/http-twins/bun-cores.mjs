// BENCH_CORES for the twins on Bun (bun, bun-elysia, bun-hono). With it unset
// or 1, one process, no `reusePort`, so a twin gets the one core the Nish
// server gets. With BENCH_CORES=N, N processes on the one port with
// `reusePort: true`: the first and N-1 it spawns, which the kernel shares
// connections between. build.sh copies this file beside extra-routes.mjs.

/** The process count BENCH_CORES asks for, at least one. */
export const cores = Math.max(1, Math.trunc(Number(process.env.BENCH_CORES ?? 1)) || 1)

/** Whether `Bun.serve` binds with `reusePort`: only when several processes share the port. */
export const reusePort = cores > 1

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

/**
 * In the first process, with N > 1, spawns the N-1 others running `script`
 * on `port`, waits until each is bound, and stops them all on SIGINT. In a
 * spawned process, or with N = 1, does nothing. The caller prints `listening`
 * after it.
 */
export const spawnWorkers = async (script, port) => {
  // Set in the processes this spawns, so they serve rather than spawn.
  if (process.env.BENCH_BUN_WORKER === "1" || cores === 1) {
    return
  }
  const workers = Array.from({ length: cores - 1 }, () =>
    Bun.spawn([process.execPath, script, String(port)], {
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
