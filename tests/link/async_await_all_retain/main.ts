// WP49 stage 5 (ASYNC-15): a loop of `awaitAll` that never releases keeps what
// its lanes answer and a small constant per round, not a chunk per lane.
// `main` calls `Arena.mark()`, so its loop takes no per-pass release
// (src/escape.ts, "Arena control"), and each round's two lanes answer an array
// of 100 elements made after their first wait, in their own regions. Before
// the adopt carved what the caller's chunk had left, every round buried that
// chunk under the lanes' and the next allocation grew a fresh 64 KiB one:
// 30000 rounds peaked at 163 MB. Now they peak at 43 MB, about 1.4 KB a round
// for 1.2 KB of arrays; run.js bounds the peak at 80 MB, as `Arena.used()`
// cannot see a buried chunk.
import { awaitAll } from "nish:async"

import { fill, lane, wrong } from "./lib"

export async function main(): Promise<i32> {
  const [x, y] = await awaitAll(lane(0, 0), lane(1, 0))
  const mark: i64 = Arena.mark()
  let bad = wrong(x, 0) + wrong(y, 1)
  if (mark === 0) {
    bad = bad + 1
  }
  let k = 0
  while (k < 30000) {
    const [a, b] = await awaitAll(lane(k, 0), lane(k + 1, 0))
    bad = bad + wrong(a, k) + wrong(b, k + 1) + wrong(fill(100, k + 2), k + 2)
    k = k + 1
  }
  console.log(`30000 rounds: ${bad} wrong`)
  return bad
}
