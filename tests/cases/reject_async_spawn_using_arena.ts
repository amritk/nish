// WP49 stage 5, part 3: an object a `using arena()` block allocates is freed
// when the block ends, so it may not be handed to a spawned task that outlives
// the block (NL2421).
import { sleep, spawn } from "nish:async"

class Tally {
  hits: i32 = 0
}

const count = async (tally: Tally, n: i32): Promise<void> => {
  await sleep(n)
  tally.hits = tally.hits + n
}

const start = async (): Promise<void> => {
  {
    using a = arena()
    const tally = new Tally()
    spawn(count(tally, 5))
  }
  await sleep(1)
}

export const main = async (): Promise<i32> => {
  await start()
  await sleep(10)
  return 0
}
