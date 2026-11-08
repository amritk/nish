// WP49 stage 5, part 3: a `using` binding in a task is bound like any other
// local, with where its value lives. A string made under a task's
// `using arena()` block is the task's memory, which the shared object may not
// keep (NL2609), whether stored in the block or after it.
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  {
    using a = arena()
    const s = `a ${ms}`
    tally.label = s
  }
  using b = arena()
  const t = `b ${ms}`
  tally.label = t
}

export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
