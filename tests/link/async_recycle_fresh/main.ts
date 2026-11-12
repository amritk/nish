// WP49 stage 6: a finished task's region is recycled, not freed, so the next
// task to take its node bumps from the chunk the last one wrote
// (docs/security/async.md, ASYNC-20). The chunk is not zeroed; what the
// language promises fresh is still fresh. A node goes back to its own task
// kind's free list, so both tasks here are spawns of one async function,
// `task`. Each round one fills its region with nonzero bytes (an array of -1,
// a string of "z"; every other round two arrays of -1 that an `awaitAll`'s
// calls answered, which leaves carved chunks for the recycle to walk) and
// ends, and the next makes what `new Array<T>(n)`
// promises zero-filled, a nullable array included, and a string of its own,
// and reads them before it writes:
//
//   1. the reader ran on the node the writer had just released, one
//      generation on (`taskId()`), in every round. A region that small is
//      kept with its node (`tests/link/async_region_recycle` pins that from
//      C), so the reader's first allocations are the bytes the writer wrote;
//   2. every element of each new array is 0 (or null) in every round;
//   3. the string holds its own characters, not the last task's.
//
// The region stays far below the 64 KiB a node keeps: at most 112 elements.
import { sleep, spawn } from "nish:async"
import { JOIN, READ, Seen, task, WRITE } from "./lib.ts"

export async function main(): Promise<i32> {
  const seen = new Seen()
  for (let round = 0; round < 200; round++) {
    const n = 16 + (round % 7) * 16
    spawn(task(seen, n, round % 2 === 0 ? WRITE : JOIN))
    await sleep(1)
    spawn(task(seen, n, READ))
    await sleep(1)
  }
  console.log(`rounds ${seen.rounds}, filled ${seen.wrote}`)
  console.log(`readers that ran on the node the writer released: ${seen.sameNode}`)
  console.log(`elements a new array did not hold as zero: ${seen.dirty}`)
  return 0
}
