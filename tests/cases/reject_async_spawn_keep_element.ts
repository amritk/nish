// WP49 stage 5, part 3: an element read out of an array the task shares is
// shared memory too, so a `for-of` over it may not put one in an object of
// the task's own (NL2610).
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
}

class Holder {
  t: Tally
  constructor() {
    this.t = new Tally()
  }
}

async function work(shared: Tally[], ms: i32): Promise<void> {
  await sleep(ms)
  const holder = new Holder()
  for (const t of shared) {
    holder.t = t
  }
  console.log(holder.t.label)
}

export async function main(): Promise<i32> {
  const shared = [new Tally(), new Tally()]
  spawn(work(shared, 1))
  return 0
}
