// The tasks `main.ts` spawns (async_timer_order in tests/run.js's link section).
import { readable, sleep } from "nish:async"
import { netClose } from "nish:net"

export async function nap(label: string, ms: i32): Promise<void> {
  await sleep(ms)
  console.log(`${label} (${ms} ms)`)
}

export async function reader(fd: i32): Promise<void> {
  await readable(fd)
  console.log("reader")
  netClose(fd)
}
