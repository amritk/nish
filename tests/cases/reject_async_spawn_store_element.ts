// WP49 stage 5, part 3: an element of a shared array of objects is a slot
// outside the task's region (NL2609).
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

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  tally.items[0] = new Item()
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
