// A spawned task that panics ends the program as it does natively: the
// panic's message on stderr, exit 1, and the task that would have printed
// after it never does. `main` answers 0 first; the panic still wins.
import { checkedAdd } from "nish/runtime"
import type { i32 } from "nish/runtime"
import { spawn } from "nish/runtime/async.mjs"

const add = (a: i32, b: i32): i32 => checkedAdd(a, b)

async function double(x: i32): Promise<i32> {
  return Math.imul(x, 2)
}

async function overflow(x: i32): Promise<void> {
  const d = await double(x)
  console.log(d)
  console.log(add(2147483647, d))
  console.log("unreachable")
}

export async function main(): Promise<i32> {
  spawn(overflow(1))
  return 0
}
