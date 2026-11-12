// WP49 stage 6: a finished task's region is recycled, not freed, so the next
// task to take its node bumps from the chunk the last one wrote
// (docs/security/async.md, ASYNC-20). The chunk is not zeroed; what the
// language promises fresh is still fresh. Each round one task fills its
// region with nonzero bytes (an array of -1, a string of "z") and ends, and
// the next, on the same node, makes what `new Array<T>(n)` promises
// zero-filled, a nullable array included, and a string of its own, and reads
// them before it writes:
//
//   1. every element of each new array is 0 (or null) in every round;
//   2. the string holds its own characters, not the last task's.
import { sleep, spawn } from "nish:async"
import { fill, fresh, Seen } from "./lib.ts"

export async function main(): Promise<i32> {
  const seen = new Seen()
  for (let round = 0; round < 200; round++) {
    const n = 16 + (round % 7) * 100
    spawn(fill(seen, n))
    await sleep(1)
    spawn(fresh(seen, n))
    await sleep(1)
  }
  console.log(`rounds ${seen.rounds}, filled ${seen.wrote}`)
  console.log(`elements a new array did not hold as zero: ${seen.dirty}`)
  return 0
}
