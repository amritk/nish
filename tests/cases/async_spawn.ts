// WP49: `spawn` starts a task and goes on. The task runs at once, up to the
// first await that pends; a pending task is queued, and the driver finishes
// the queue after `main` returns. Nothing here waits on the kernel, so each
// task prints before `spawn` returns — TypeScript would print 7 and 0 first.
import { spawn } from "nish:async"

async function double(x: i32): Promise<i32> {
  return x * 2
}

async function report(label: i32, x: i32): Promise<void> {
  const d = await double(x)
  console.log(label * 1000 + d)
}

async function shout(x: i32): Promise<void> {
  console.log(x)
}

export async function main(): Promise<i32> {
  spawn(report(1, 10))
  spawn(shout(7))
  spawn(report(2, 21))
  console.log(0)
  return 0
}
