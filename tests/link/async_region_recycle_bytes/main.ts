// WP49 stage 6: a finished task's region is emptied and kept for its node's
// next task, chunk and all, without clearing the bytes the last task left
// there. Each round below runs on the same node: it checks that what it
// makes reads as zero, then fills it with a marker for the next round to
// find. A task reads only what it wrote, because `new Array<T>(n)` and a
// class's fields are zero-filled or written before they can be read, so
// nothing the previous task left shows through (docs/security/async.md,
// ASYNC-20).
import { sleep, spawn } from "nish:async"
import { dirty, visit } from "./lib"

export async function main(): Promise<i32> {
  for (let n = 0; n < 50; n++) {
    spawn(visit(n))
    await sleep(1)
  }
  console.log(`bytes from an earlier task seen: ${dirty[0]}`)
  return 0
}
