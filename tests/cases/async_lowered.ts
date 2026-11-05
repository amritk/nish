// WP49 stage 4, part 2: the program part 1 checked and refused (NL2653) now
// compiles. `run` awaits a value, an assignment, two statements and an
// `awaitAll`, then spawns a task the driver runs once `main` is done.
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

export async function main(): Promise<i32> {
  await run()
  return 0
}
