// NL2690: a spawned task's function argument captures only numbers, booleans,
// enums and objects or arrays it may share. The arrow reads the string `tag`
// of `start`, which the task may not share.
import { sleep, spawn } from "nish:async"

async function later(f: (n: i32) => i32, n: i32): Promise<void> {
  await sleep(1)
  console.log(`${f(n)}`)
}

async function start(base: i32): Promise<void> {
  const tag = `n${base}`
  spawn(later((n: i32): i32 => n + tag.length, 2))
}

export async function main(): Promise<i32> {
  await start(40)
  return 0
}
