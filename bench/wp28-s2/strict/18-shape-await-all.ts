// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// The strict spelling of the `Promise.all` shape: `awaitAll` from nish:async.
import { awaitAll } from "nish:async"

async function next(x: i32): Promise<i32> {
  return x + 1
}

export async function main(): Promise<i32> {
  const [a, b] = await awaitAll(next(1), next(2))
  console.log(a + b)
  return 0
}
