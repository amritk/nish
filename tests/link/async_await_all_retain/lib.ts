// The lanes main.ts's loop joins, and the check it reads the answers with: a
// module of their own, so each lane's resume is called across a module
// boundary.
import { sleep } from "nish:async"

/** `n` elements counting up from `seed`. */
export function fill(n: i32, seed: i32): i32[] {
  const xs = new Array<i32>(n)
  let i = 0
  while (i < xs.length) {
    xs[i] = seed + i
    i = i + 1
  }
  return xs
}

/** How many elements of `xs` are not `seed + i`, plus 1 unless it holds 100. */
export function wrong(xs: i32[], seed: i32): i32 {
  let bad = xs.length === 100 ? 0 : 1
  let i = 0
  while (i < xs.length) {
    if (xs[i] !== seed + i) {
      bad = bad + 1
    }
    i = i + 1
  }
  return bad
}

/**
 * A lane: its array made after the first wait, in the lane's own region, and
 * answered after the second.
 */
export async function lane(seed: i32, ms: i32): Promise<i32[]> {
  await sleep(ms)
  const xs = fill(100, seed)
  await sleep(ms)
  return xs
}

/** A lane that answers a number: its 1000 elements are a temporary. */
export async function count(seed: i32, ms: i32): Promise<i32> {
  await sleep(ms)
  const s = fill(1000, seed)
  await sleep(ms)
  return wrong(s, seed) === 1 ? 0 : 1
}
