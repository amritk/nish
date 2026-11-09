// NL2689: a spawned task may not itself spawn a task with an object or an
// array: what it hands on may be memory of its own region, which is freed when
// it ends while the task it spawned still holds it.
import { sleep, spawn } from "nish:async"

class Box {
  n: i32 = 0
}

async function inner(box: Box): Promise<void> {
  await sleep(1)
  console.log(`${box.n}`)
}

async function outer(n: i32): Promise<void> {
  const box = new Box()
  box.n = n
  spawn(inner(box))
}

export async function main(): Promise<i32> {
  spawn(outer(3))
  return 0
}
