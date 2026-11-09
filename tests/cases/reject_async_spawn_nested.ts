// WP49 stage 5, part 3: a task may not spawn a task with an object or array:
// it may hand on memory of its own region, freed when it ends (NL2689).
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

async function inner(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  tally.hits = tally.hits + 1
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  const mine = new Tally()
  spawn(inner(mine, ms))
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
