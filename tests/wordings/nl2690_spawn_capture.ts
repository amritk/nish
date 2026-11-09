// NL2690: a spawned task takes a function argument only when it captures
// nothing. The arrow reads `base` of `start`, a value that would ride in the
// task's frame where neither the spawn's argument rule nor the task's region
// rules see it.
import { sleep, spawn } from "nish:async"

async function later(f: (n: i32) => i32, n: i32): Promise<void> {
  await sleep(1)
  console.log(`${f(n)}`)
}

async function start(base: i32): Promise<void> {
  spawn(later((n: i32): i32 => n + base, 2))
}

export async function main(): Promise<i32> {
  await start(40)
  return 0
}
