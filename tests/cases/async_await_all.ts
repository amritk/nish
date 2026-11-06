// WP49: `awaitAll` starts each call, then polls until every one has finished;
// the answers land in the order the calls are written, whatever order they
// finish in.
import { awaitAll } from "nish:async"

async function square(x: i32): Promise<i32> {
  return x * x
}

async function sum(x: i32, y: i32): Promise<i32> {
  const a = await square(x)
  const b = await square(y)
  return a + b
}

export async function main(): Promise<i32> {
  const [p, q, r] = await awaitAll(sum(1, 2), square(3), sum(2, 3))
  console.log(p)
  console.log(q)
  console.log(r)
  return 0
}
