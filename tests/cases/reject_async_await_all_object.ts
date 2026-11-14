// An object pattern over `awaitAll` is named for what it is, not as a non-`awaitAll` await.
import { awaitAll } from "nish:async"

async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<i32> {
  const { a, b } = await awaitAll(load(1), load(2))
  return a + b
}

export const main = (): i32 => 0
