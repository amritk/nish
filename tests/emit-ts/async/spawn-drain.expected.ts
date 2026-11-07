// Every task `spawn` starts finishes before the process exits, a task it
// starts in turn included: `main` answers before either task prints under
// Node, and the launcher's `settleTasks` waits for both, as the native driver
// drains its queue. The order is the same as native because `main` prints
// nothing and each task starts the next only after it prints.
import { checkedMul } from "nish/runtime"
import type { i32 } from "nish/runtime"
import { spawn } from "nish/runtime/async.mjs"

async function double(x: i32): Promise<i32> {
  return checkedMul(x, 2)
}

async function leaf(x: i32): Promise<void> {
  const d = await double(x)
  console.log(d)
}

async function root(x: i32): Promise<void> {
  const d = await double(x)
  console.log(d)
  spawn(leaf(d))
}

export async function main(): Promise<i32> {
  spawn(root(5))
  return 0
}
