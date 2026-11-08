// WP49 stage 5: `await fetch(url)` parks only its own task. A fetch the
// server answers slowly is spawned first; a second fetch, answered at once,
// completes while the first still waits, so "fast" prints before "slow".
import { spawn } from "nish:async"
import { netLocalPort, tcpListen } from "nish:net"
import { fetch } from "nish/net/fetch"
import { serve } from "./server"

async function get(label: string, url: string): Promise<void> {
  const res = await fetch(url)
  if (res.isErr()) {
    console.log(`${label}: ${res.error.text}`)
    return
  }
  console.log(`${label}: ${res.value.status} ${res.value.text()}`)
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  spawn(serve(listen, 2, 200))
  spawn(get("slow", `http://127.0.0.1:${port}/slow/one`))
  await get("fast", `http://127.0.0.1:${port}/fast/two`)
  return 0
}
