// WP49 stage 5, part 3: a spawned task takes a function argument that
// captures nothing — a top-level function or an arrow written at the call
// that reads only its own parameters. The call is an instantiation with the
// function in its body (WP29), so nothing of it rides in the task's frame,
// and the task may run after the spawner returns.
import { sleep, spawn } from "nish:async"

const shout = (label: string, n: i32): void => {
  console.log(`${label} ${n}`)
}

async function later(handle: (label: string, n: i32) => void, label: string, ms: i32): Promise<void> {
  await sleep(ms)
  handle(label, ms)
}

async function start(): Promise<void> {
  spawn(later(shout, "named", 10))
  spawn(later((label: string, n: i32): void => {
    console.log(`${label} ${n * 2}`)
  }, "arrow", 20))
  console.log("start returns")
}

export async function main(): Promise<i32> {
  await start()
  console.log("main done")
  return 0
}
