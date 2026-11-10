// WP49 stage 5, part 3: a callee that spawns a task with its argument keeps
// that argument past its return, so a `using arena()` block may not hand it
// an object the block frees (NL2421).
import { sleep, spawn } from "nish:async"

class Tally {
  hits: i32 = 0
}

const count = async (tally: Tally, n: i32): Promise<void> => {
  await sleep(n)
  tally.hits = tally.hits + n
}

const launch = async (tally: Tally): Promise<void> => {
  spawn(count(tally, 5))
}

const start = async (): Promise<void> => {
  {
    using a = arena()
    const tally = new Tally()
    await launch(tally)
  }
  await sleep(1)
}

export const main = async (): Promise<i32> => {
  await start()
  await sleep(10)
  return 0
}
