// WP49 stage 5, part 3: a spawned task shares the objects and arrays its
// spawner hands it. `start` makes a `Tally`, a list of counts and a map, hands
// them with a function to three tasks, which read the map and grow nothing,
// and returns while they still sleep; the tasks update the numbers after
// `start` is gone. A spawner that feeds a task an object releases no arena
// scope over it (`FunctionFacts.feedsTasks`), so it outlives every task, and
// each task, whose own region is freed when it ends, stores only numbers into
// it (NL2609, NL2615). This program pins the behaviour, not the lifetime: the
// strong pin, with noise in the freed memory and `Arena.used()` read across
// the spawn, is `tests/link/async_spawn_shared_outlives`.
import { sleep, spawn } from "nish:async"

class Tally {
  hits: i32 = 0
  total: i32 = 0
}

const note = (t: Tally, n: i32): void => {
  t.hits = t.hits + 1
  t.total = t.total + n
}

async function work(handle: (t: Tally, n: i32) => void, tally: Tally, counts: i32[], seen: Map<string, i32>, i: i32): Promise<void> {
  await sleep(5 * (i + 1))
  handle(tally, i + 1)
  counts[i] = counts[i] + 10
  const step = seen.get("step")
  console.log(`task ${i}: hits ${tally.hits} total ${tally.total} count ${counts[i]} step ${step === undefined ? -1 : step}`)
}

async function start(): Promise<Tally> {
  let tally = new Tally()
  const counts: i32[] = [1, 2, 3]
  const seen = new Map<string, i32>()
  seen.set("step", 7)
  const first = tally
  for (let i = 0; i < 3; i++) {
    spawn(work(note, tally, counts, seen, i))
  }
  // The local moves on; the tasks keep the object they were handed.
  tally = new Tally()
  tally.hits = 100
  console.log(`start returns: ${first.hits} ${tally.hits}`)
  return first
}

export async function main(): Promise<i32> {
  const tally = await start()
  let noise = 0
  for (let k = 0; k < 100; k++) {
    const junk: string[] = [`junk ${k}`]
    noise = noise + junk.length
  }
  await sleep(40)
  console.log(`main: hits ${tally.hits} total ${tally.total} noise ${noise}`)
  return 0
}
