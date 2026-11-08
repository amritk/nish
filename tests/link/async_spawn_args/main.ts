// WP49 stage 5, debt (b): a spawned task's arguments outlive the function
// that spawned it. Numbers and booleans are copied into the task's frame;
// each `string` is copied into the task's own region when it is spawned.
// `start` builds both strings in its own frame and returns before the task
// wakes, and `main` then allocates 2890 characters of noise over the memory
// they were built in, more than either string; each task still prints what
// it was given.
import { spawn } from "nish:async"
import { report } from "./lib"

async function start(i: i32, big: i64, half: f64, ms: i32): Promise<void> {
  const name = `job-${i}`
  let tail = ""
  for (let k = 0; k < 100 * i; k++) {
    tail = `${tail}xxxxxxxxxx`
  }
  tail = `${tail}${i}${i}${i}`
  spawn(report(name, tail, i * 7, big, half, i % 2 === 1, ms))
}

export async function main(): Promise<i32> {
  await start(1, 4000000000, 0.5, 20)
  await start(2, 8000000000, 1, 10)
  let noise = ""
  for (let i = 0; i < 1000; i++) {
    noise = `${noise}${i}`
  }
  console.log(`main returns after ${noise.length} chars of noise`)
  return 0
}
