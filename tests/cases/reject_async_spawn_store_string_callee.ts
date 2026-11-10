// WP49 stage 5, part 3: a function that stores a string it is handed into a
// shared object, or into an element of a shared array, keeps the task's
// string there, so handing it one is refused (NL2609).
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
  names: string[]
  constructor() {
    this.names = [""]
  }
}

const stash = (t: Tally, s: string): void => {
  t.label = s
}

const put = (a: string[], s: string): void => {
  a[0] = s
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  stash(tally, `task ${ms}`)
  put(tally.names, `name ${ms}`)
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
