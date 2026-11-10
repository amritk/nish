// #1326: `awaitAll` lanes that answer arrays, indexed after the await. Two in
// a row is the issue's program; inside a `for`, `while` or `do` body was the
// crash: the loop's preheader lifted the header of `a` (WP15 §2c) because
// the walk that keeps a loop's own locals out of that lift saw only plain
// declarations, not the names of an `awaitAll` pattern, so `a[0]` asked for
// a slot the body had not bound yet.
import { awaitAll, sleep } from "nish:async"

async function lane(n: i32, ms: i32): Promise<i32[]> {
  const x: i32[] = [n]
  await sleep(ms)
  return x
}

async function twice(): Promise<i32> {
  const [a, b] = await awaitAll(lane(1, 1), lane(2, 1))
  const [c, d] = await awaitAll(lane(3, 1), lane(4, 1))
  return a[0] + b[0] + c[0] + d[0]
}

async function inFor(): Promise<i32> {
  let t = 0
  for (let i = 0; i < 3; i++) {
    const [a, b] = await awaitAll(lane(i, 2), lane(10, 1))
    t += a[0] + b[0] + a.length
  }
  return t
}

async function inWhile(): Promise<i32> {
  let t = 0
  while (t < 20) {
    const [a, b] = await awaitAll(lane(3, 1), lane(4, 2))
    t += a[0] + b[0]
  }
  return t
}

async function inDo(): Promise<i32> {
  let t = 0
  do {
    const [a, b] = await awaitAll(lane(5, 1), lane(6, 1))
    t += a[0] * b[0]
  } while (t < 60)
  return t
}

export async function main(): Promise<i32> {
  const sum = await twice()
  console.log(sum)
  const forSum = await inFor()
  console.log(forSum)
  const whileSum = await inWhile()
  console.log(whileSum)
  const doSum = await inDo()
  console.log(doSum)
  return 0
}
