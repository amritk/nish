// WP49 stage 5, part 3: `reserve` grows its map's buckets in the task's
// region, as `set` does, so a task may not call it on a map it shares with
// its spawner (NL2615). Its instance has no body of its own: what it writes
// reaches it only through the code it is routed to.
import { sleep, spawn } from "nish:async"
import { reserve } from "nish/map"

async function work(seen: Map<string, i32>, ms: i32): Promise<void> {
  await sleep(ms)
  reserve(seen, 100000)
}

export async function main(): Promise<i32> {
  const seen = new Map<string, i32>()
  spawn(work(seen, 1))
  await sleep(10)
  return 0
}
