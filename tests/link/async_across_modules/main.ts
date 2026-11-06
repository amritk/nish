// WP49: an await, an `awaitAll` and a `spawn` of async functions another
// module defines (`async_across_modules` in tests/run.js's link section).
import { awaitAll, spawn } from "nish:async"
import { label, report, sum } from "./lib"

export async function main(): Promise<i32> {
  const one = await sum(2, 3)
  console.log(one)
  const [p, q] = await awaitAll(label("a", 1), sum(4, 5))
  console.log(p)
  console.log(q)
  spawn(report(6))
  return 3
}
