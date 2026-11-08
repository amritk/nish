// WP49 stage 5, part 3: `Map.set` and `Set.add` grow their receiver, so a
// task may not call them on a map or set it shares with its spawner (NL2615).
import { sleep, spawn } from "nish:async"

class Tally {
  m: Map<string, i32>
  s: Set<string>
  constructor() {
    this.m = new Map<string, i32>()
    this.s = new Set<string>()
  }
}

const later = async (t: Tally, ms: i32): Promise<void> => {
  await sleep(ms)
  t.m.set(`k${ms}`, ms)
}

const later2 = async (t: Tally, ms: i32): Promise<void> => {
  await sleep(ms)
  t.s.add(`k${ms}`)
}

export const main = async (): Promise<i32> => {
  const t = new Tally()
  spawn(later(t, 1))
  spawn(later2(t, 1))
  await sleep(10)
  return 0
}
