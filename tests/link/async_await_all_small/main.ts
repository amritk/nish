// WP49 stage 5 (HF-13): lanes far smaller than a chunk. Each round of
// `awaitAll` joins five lanes of 10 to 100 elements, each filled with a
// pattern of its own, so a lane that bumped into a sibling's memory, or whose
// answer a sibling or the caller overwrote, reads a wrong element. The last
// lane can wait but takes the branch that does not: it finishes in its first
// resume while its siblings are still pending, the path where its region is
// adopted before theirs.
import { awaitAll } from "nish:async"

import { lane, maybe, wrong } from "./lib"

export async function main(): Promise<i32> {
  let bad = 0
  let r = 0
  while (r < 200) {
    const [a, b, c, d, e] = await awaitAll(
      lane(10, r, 3),
      lane(37, r + 1, 1),
      lane(64, r + 2, 2),
      lane(100, r + 3, 0),
      maybe(23, r + 4, false),
    )
    bad = bad + wrong(a, 10, r, 3) + wrong(b, 37, r + 1, 3) + wrong(c, 64, r + 2, 3)
    bad = bad + wrong(d, 100, r + 3, 3) + wrong(e, 23, r + 4, 7)
    r = r + 1
  }
  console.log(`200 rounds of five small lanes: ${bad} wrong`)
  return bad
}
