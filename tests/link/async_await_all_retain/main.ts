// WP49 stage 5 (ASYNC-15): a loop of `awaitAll` that never releases keeps what
// its lanes answer and a small constant per round, not a chunk per lane, and
// not what a lane made only for itself. `main` calls `Arena.mark()`, so its
// loop takes no per-pass release (src/escape.ts, "Arena control"). Each round
// joins a lane that answers 100 elements made after its first wait and one
// that makes 1000 elements after its first wait and answers a number. Both
// sleep 1 ms, so each certainly suspends and finishes in its own region.
// Before the adopt carved what the caller's chunk had left, every round buried
// that chunk and the next allocation grew a fresh 64 KiB one. Before a lane ran
// in its region from its first resume, its release at return found no chunk
// of its own and the 4 KB temporary moved into the caller with the answer.
// run.js bounds the peak, as `Arena.used()` cannot see a buried chunk.
import { awaitAll } from "nish:async"

import { count, fill, lane, wrong } from "./lib"

export async function main(): Promise<i32> {
  const [x, y] = await awaitAll(lane(0, 1), count(1, 1))
  const mark: i64 = Arena.mark()
  let bad = wrong(x, 0) + y
  if (mark === 0) {
    bad = bad + 1
  }
  let k = 0
  while (k < 3000) {
    const [a, b] = await awaitAll(lane(k, 1), count(k + 1, 1))
    bad = bad + wrong(a, k) + b + wrong(fill(100, k + 2), k + 2)
    k = k + 1
  }
  console.log(`3000 rounds: ${bad} wrong`)
  return bad
}
