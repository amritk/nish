// WP49 stage 5, part 3: a method that stores a string it is handed into its
// receiver keeps the task's string in the shared object, as `t.label = s`
// would, so handing it one is refused (NL2609).
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
  setLabel(s: string): void {
    this.label = s
  }
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  tally.setLabel(`task ${ms}`)
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
