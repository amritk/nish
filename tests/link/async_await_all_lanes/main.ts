// WP49 stage 5 (HF-13): every call one `awaitAll` joins runs in a region of
// its own while it waits, so no lane frees, rewinds or overwrites memory a
// sibling still holds, and what a lane answers -- a string, an array, an
// object whose fields point at the lane's memory -- outlives the join. Four
// lanes, one of which joins three more of its own, each hold more than an
// arena chunk across their waits; the rounds after the first leave
// `Arena.mark()` and `Arena.used()` where they were, as the lanes' regions go back with the round.
import { awaitAll } from "nish:async"

import { nested, numbers, text, total, wrong } from "./lib"

/** One round: four lanes, finishing in a different order than they started. */
async function round(n: i32): Promise<i32> {
  const [s, xs, inner, t] = await awaitAll(text(n, 3), numbers(n, 2), nested(n, 2), total(n, 0))
  let bad = wrong(xs, 11) + t
  if (s !== `text ${n} 0`) {
    bad = bad + 1
  }
  if (inner !== `text ${n} 0 bag ${n} 0 0`) {
    bad = bad + 1
  }
  return bad
}

export async function main(): Promise<i32> {
  const n = 40000
  const first = await round(n)
  console.log(`first round: ${first} wrong`)
  const mark: i64 = Arena.mark()
  const used: i64 = Arena.used()
  let bad = 0
  let k = 0
  while (k < 20) {
    const r = await round(n)
    bad = bad + r
    k = k + 1
  }
  const markAfter: i64 = Arena.mark()
  const after: i64 = Arena.used()
  console.log(`twenty more rounds: ${bad} wrong`)
  console.log(`Arena.mark() and Arena.used() flat over the rounds: ${markAfter === mark && after === used ? "yes" : "no"}`)
  return first + bad
}
