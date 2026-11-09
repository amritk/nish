// WP49 stage 5, part 3: a task takes a function argument only when it
// captures nothing; this block-bodied arrow reads the spawner's `step`,
// which would ride in the task's frame unseen by the region rules (NL2690).
import { sleep, spawn } from "nish:async"

class Item {
  n: i32 = 0
}

class Tally {
  hits: i32 = 0
  label: string = ""
  item: Item
  items: Item[]
  child: Tally | null = null
  constructor() {
    this.item = new Item()
    this.items = []
  }
  keep(it: Item): void {
    this.item = it
  }
  list(): Item[] {
    return this.items
  }
}

async function each(f: (t: Tally) => void, tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  f(tally)
}

async function work(tally: Tally, ms: i32): Promise<void> {
  const step = ms * 2
  spawn(each((t: Tally): void => {
    t.hits = t.hits + step
  }, tally, ms))
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  await work(tally, 1)
  return 0
}
