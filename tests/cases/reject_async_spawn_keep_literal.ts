// WP49 stage 5, part 3: an object literal of the task's own may not hold the
// object it shares (NL2610), as an array literal may not
// (`reject_async_spawn_keep_holder`).
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
}

interface Box {
  t: Tally
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  const c: Box = { t: tally }
  console.log(c.t.label)
}

export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
