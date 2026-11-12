// biome-ignore-all lint/plugin: the declared shape is what the example measures
// biome-ignore-all lint/suspicious/useAwait: an `async` function with no wait is the shape measured
// Class mixed: one await on the outside, one on a program function.
import { sleep } from "nish:async"

async function double(x: i32): Promise<i32> {
  return x * 2
}

async function paced(x: i32): Promise<i32> {
  await sleep(1)
  const y = await double(x)
  return y
}

export async function main(): Promise<i32> {
  const answer = await paced(2)
  console.log(answer)
  return 0
}
