// `awaitAll` is `Promise.all` under Node: the answers come back in the order
// the calls are written, destructured as the native build does.
import { awaitAll } from "nish:async"

async function square(x: i32): Promise<i32> {
  return x * x
}

async function label(x: i32): Promise<string> {
  return `n${x}`
}

export async function main(): Promise<i32> {
  const [a, b, c] = await awaitAll(square(3), label(4), square(5))
  console.log(a)
  console.log(b)
  console.log(c)
  return 0
}
