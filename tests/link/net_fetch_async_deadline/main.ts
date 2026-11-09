// WP49 stage 5, HF-10: every wait of the async `fetch` has a deadline. The
// listener below is never accepted from, so the kernel completes each
// connection and takes the request, and no byte ever comes back. Before
// the fix, the first fetch here parked its task forever and the test ran
// into its timeout; now `readTimeoutMs` ends it, `totalTimeoutMs` ends one
// with no read limit, and a task cancelled by `cancelAfter` answers
// `HTTP_E_CANCELLED`. Each ends within a bound, and nothing else waits.
import { cancelAfter, sleep, spawn, taskId } from "nish:async"
import { netLocalPort, tcpListen } from "nish:net"
import { monotonicNanos } from "nish:process"
import { RequestInit, fetch, httpErrorName } from "nish/net/fetch"

async function get(label: string, url: string, init: RequestInit): Promise<void> {
  const start: i64 = monotonicNanos()
  const res = await fetch(url, init)
  const ms: i64 = (monotonicNanos() - start) / toI64(1000000)
  if (res.isErr()) {
    console.log(`${label}: ${httpErrorName(res.error.code)}, within 2 s: ${ms < toI64(2000)}`)
    console.log(`  ${res.error.text}`)
    return
  }
  console.log(`${label}: answered ${res.value.status}`)
}

async function cancelledGet(url: string): Promise<void> {
  // The deadline is the task's, not the fetch's: no timeout of its own.
  cancelAfter(taskId(), 100)
  const init: RequestInit = new RequestInit()
  init.options.readTimeoutMs = 0
  await get("cancelled", url, init)
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const url: string = `http://127.0.0.1:${netLocalPort(listen)}/never`

  const read: RequestInit = new RequestInit()
  read.options.readTimeoutMs = 100
  await get("read", url, read)

  const total: RequestInit = new RequestInit()
  total.options.readTimeoutMs = 0
  total.options.totalTimeoutMs = 150
  await get("total", url, total)

  spawn(cancelledGet(url))
  // The main task is never cancelled; it outlives the spawned one.
  const ok = await sleep(400)
  console.log(`main: still running, ${ok}`)
  return 0
}

