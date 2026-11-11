// WP49 stage 5, part 8: a task's function argument captures only numbers,
// booleans, enums and objects it may share; this block-bodied arrow reads the
// spawner's string `step`, which the task may not share (NL2690).
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
  const step = `s${ms}`
  spawn(each((t: Tally): void => {
    t.hits = t.hits + step.length
  }, tally, ms))
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  await work(tally, 1)
  return 0
}
