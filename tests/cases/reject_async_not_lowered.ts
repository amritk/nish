// Part 1 of WP49 stage 4 checks `async` and refuses to compile it: this
// program passes every rule, and the lowering is the next release's (NL2653).
import { awaitAll, spawn } from "nish:async"

async function double(x: i32): Promise<i32> {
  return x * 2
}

async function log(x: i32): Promise<void> {
  console.log(x)
}

async function run(): Promise<void> {
  const a = await double(3)
  let b: i32 = 0
  b = await double(a)
  await log(b)
  await (log(a))
  const [c, d] = await awaitAll(double(1), double(2))
  spawn(log(c + d))
}

export const main = (): i32 => 0
