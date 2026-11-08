// The objects and the task `main.ts` spawns (async_spawn_shared_outlives in
// tests/run.js's link section).
import { sleep } from "nish:async"

export class Totals {
  sum: i32 = 0
}

export class Tally {
  hits: i32 = 0
  totals: Totals
  constructor() {
    this.totals = new Totals()
  }
}

export async function work(tally: Tally, totals: Totals, counts: i32[], i: i32): Promise<void> {
  await sleep(5 * (i + 1))
  let line = ""
  for (let k = 0; k < 50; k++) {
    line = `${line}${i}`
  }
  tally.hits = tally.hits + 1
  tally.totals.sum = tally.totals.sum + i + 1
  totals.sum = totals.sum + 100
  counts[i] = counts[i] + line.length
  console.log(`task ${i}: hits ${tally.hits}, ${line.length} chars`)
}
