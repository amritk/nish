// WP49 stage 5: thousands of `await fetch(url)` leave `Arena.used()` where
// it was. Each fetch is awaited through a function that hands back only its
// status, so what the fetch, its codec and its answer allocated is released
// when that call's scope ends; the server answers each connection in a task,
// which has a region of its own. The arena is read between iterations of one
// loop in `main`, past a warm-up, so no enclosing scope hides a leak.
import { spawn } from "nish:async"
import { netLocalPort, tcpListen } from "nish:net"
import { fetch } from "nish/net/fetch"
import { serve } from "../net_fetch_async/server"

const WARM: i32 = 200
const RUNS: i32 = 2000

/** The status of a GET of `url`, or 0 when it failed. */
async function status(url: string): Promise<i32> {
  const res = await fetch(url)
  if (res.isErr()) {
    return 0
  }
  return res.value.status
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 64)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  spawn(serve(listen, WARM + RUNS, 0))
  const url: string = `http://127.0.0.1:${port}/flat`
  let ok: i32 = 0
  let used: i64 = 0
  for (let i: i32 = 0; i < WARM + RUNS; i += 1) {
    if (i === WARM) {
      used = Arena.used()
    }
    const s: i32 = await status(url)
    if (s === 200) {
      ok += 1
    }
  }
  const usedAfter: i64 = Arena.used()
  console.log(`${ok} of ${WARM + RUNS} fetches answered 200`)
  console.log(`Arena.used() flat over ${RUNS} fetches: ${usedAfter === used}`)
  if (usedAfter !== used) {
    console.log(`  grew by ${usedAfter - used} bytes`)
  }
  return 0
}
