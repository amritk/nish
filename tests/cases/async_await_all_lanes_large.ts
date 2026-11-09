// WP49 stage 5: two calls joined by one awaitAll each hold a large array
// across their waits. Each runs in a region of its own, so the first to
// answer does not free the chunks its sibling still reads.
import { awaitAll, sleep } from "nish:async"

async function lane(n: i32, seed: i32, ms: i32): Promise<i32> {
  const xs = new Array<i32>(n)
  let i = 0
  while (i < xs.length) {
    xs[i] = seed + i
    i = i + 1
  }
  await sleep(ms)
  const ys = new Array<i32>(n)
  i = 0
  while (i < xs.length && i < ys.length) {
    ys[i] = xs[i] - seed
    i = i + 1
  }
  await sleep(ms)
  let sum = 0
  i = 0
  while (i < xs.length && i < ys.length) {
    sum = sum + (xs[i] - seed - ys[i])
    i = i + 1
  }
  return sum + xs[xs.length - 1]
}

export async function main(): Promise<i32> {
  const [a, b] = await awaitAll(lane(200000, 1, 2), lane(200000, 1000, 1))
  console.log(a)
  console.log(b)
  const [c, d] = await awaitAll(lane(32000, 7, 1), lane(32000, 70, 2))
  console.log(c)
  console.log(d)
  return 0
}
