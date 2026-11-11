// WP49 stage 5, part 3: an object holding a `nish/threads` lock, guard,
// channel or scope is not shared with a task: each is shared only by the
// rules of its own block.
import { sleep, spawn } from "nish:async"
import { Mutex } from "nish/threads"

class Shared {
  m: Mutex<i32>
  constructor() {
    this.m = new Mutex<i32>(0)
  }
}

const later = async (s: Shared, ms: i32): Promise<void> => {
  await sleep(ms)
}

export const main = async (): Promise<i32> => {
  const s = new Shared()
  spawn(later(s, 1))
  await sleep(10)
  return 0
}
