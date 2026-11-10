// The lanes main.ts's rounds join, and the check they are read with: a module
// of their own, so each lane's resume is called across a module boundary.
import { sleep } from "nish:async"

/** `n` elements of the pattern `seed * 1000 + i * step`. */
export function fill(n: i32, seed: i32, step: i32): i32[] {
  const xs = new Array<i32>(n)
  let i = 0
  while (i < n) {
    xs[i] = seed * 1000 + i * step
    i = i + 1
  }
  return xs
}

/** How many elements of `xs` break `fill(n, seed, step)`'s pattern, or its length. */
export function wrong(xs: i32[], n: i32, seed: i32, step: i32): i32 {
  let bad = xs.length === n ? 0 : 1
  let i = 0
  while (i < xs.length) {
    if (xs[i] !== seed * 1000 + i * step) {
      bad = bad + 1
    }
    i = i + 1
  }
  return bad
}

/** A lane that allocates on both sides of each of its `waits` waits and answers the last array. */
export async function lane(n: i32, seed: i32, waits: i32): Promise<i32[]> {
  let xs = fill(n, seed, 3)
  let w = 0
  while (w < waits) {
    await sleep(w)
    const ys = fill(n, seed, 3)
    if (wrong(xs, n, seed, 3) === 0) {
      xs = ys
    }
    w = w + 1
  }
  return xs
}

/** A lane that waits only when `wait` is true. */
export async function maybe(n: i32, seed: i32, wait: boolean): Promise<i32[]> {
  const xs = fill(n, seed, 7)
  if (wait) {
    await sleep(1)
  }
  return xs
}
