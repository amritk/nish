// WP49 stage 5, part 3: the names `const [a, b] = await awaitAll(...)` binds
// hold what the awaited tasks answer, memory the shared object may not keep
// (NL2609).
import { awaitAll, sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
  names: string[]
  constructor() {
    this.names = [""]
  }
}

async function mk(ms: i32): Promise<string> {
  await sleep(ms)
  return `task ${ms}`
}

async function work(tally: Tally, ms: i32): Promise<void> {
  const [a, b] = await awaitAll(mk(ms), mk(ms + 1))
  tally.label = a
  tally.names[0] = b
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
