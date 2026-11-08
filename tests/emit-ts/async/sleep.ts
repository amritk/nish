// WP49 stage 5: `await sleep(ms)` is written as a timer, `setTimeout` behind a
// promise in the launcher's `nish:async`, so tasks wake in deadline order
// under Node as they do on the native executor. A negative `ms` answers
// `false` without a wait, as natively.
import { sleep, spawn } from "nish:async"

async function nap(label: string, ms: i32): Promise<void> {
  const ok = await sleep(ms)
  console.log(`${label} ${ok}`)
}

export async function main(): Promise<i32> {
  spawn(nap("late", 30))
  spawn(nap("soon", 5))
  const none = await sleep(-1)
  console.log(`none ${none}`)
  await sleep(60)
  console.log("main done")
  return 0
}
