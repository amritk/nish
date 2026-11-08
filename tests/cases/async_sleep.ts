// WP49 stage 5: `await sleep(ms)` parks the task on the executor's timer heap
// and the loop resumes the others. Three tasks start in the order 30, 10, 20
// and print in deadline order; `main` sleeps past all three, so it prints
// last. A negative `ms` makes no wait and answers `false` at once.
import { sleep, spawn } from "nish:async"

async function nap(label: i32, ms: i32): Promise<void> {
  const ok = await sleep(ms)
  console.log(ok ? label : -label)
}

export async function main(): Promise<i32> {
  spawn(nap(3, 30))
  spawn(nap(1, 10))
  spawn(nap(2, 20))
  const none = await sleep(-1)
  console.log(none ? 1 : 0)
  const ok = await sleep(60)
  console.log(ok ? 9 : -9)
  return 0
}
