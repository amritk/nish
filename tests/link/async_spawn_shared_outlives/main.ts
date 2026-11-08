// WP49 stage 5, part 3: a spawned task shares the objects it is handed, and
// they outlive the function that spawned it. `start` builds a `Tally`, with a
// `Totals` reachable through a field and an array of counts, hands all three
// to three tasks and returns before any of them wakes. `main` then allocates
// noise over the memory a released arena scope would have given back; each
// task still updates the spawner's own objects, and what a task allocates for
// itself lands in its own region, not in `main`'s arena.
//
//   1. `Arena.used()` grows across `start`: what it built for the tasks was
//      not given back when it returned.
//   2. `Arena.used()` does not move while the tasks run: the strings each
//      builds live in its region, freed when it ends.
//   3. The objects hold every task's update after the noise.
import { sleep, spawn } from "nish:async"
import { Tally, work } from "./lib"

async function start(): Promise<Tally> {
  const tally = new Tally()
  const counts: i32[] = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    spawn(work(tally, tally.totals, counts, i))
  }
  return tally
}

export async function main(): Promise<i32> {
  const before = Arena.used()
  const tally = await start()
  const kept = Arena.used()
  let noise = ""
  for (let i = 0; i < 1000; i++) {
    noise = `${noise}${i}`
  }
  const quiet = Arena.used()
  await sleep(40)
  const after = Arena.used()
  console.log(`kept across start: ${kept > before}`)
  console.log(`main's arena still while tasks ran: ${after === quiet}`)
  console.log(`hits ${tally.hits}, sum ${tally.totals.sum}, noise ${noise.length}`)
  return 0
}
