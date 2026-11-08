// WP49 stage 5, debt (b): a spawned task's `string` argument is copied into
// the task's own region when it starts, so it outlives the spawner. `start`
// builds the name in its own frame, spawns, and returns while the task still
// sleeps; the task prints the name after `start` is gone.
import { sleep, spawn } from "nish:async"

async function greet(name: string, ms: i32): Promise<void> {
  await sleep(ms)
  console.log(`hello ${name}`)
}

async function start(n: i32): Promise<void> {
  const name = `task-${n}`
  spawn(greet(name, 5))
  console.log(`started ${n}`)
}

export async function main(): Promise<i32> {
  await start(1)
  await start(2)
  console.log("main done")
  return 0
}
