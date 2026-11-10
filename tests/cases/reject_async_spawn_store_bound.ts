// WP49 stage 5, part 3: every way a task binds a local carries where its
// value lives: a `for...of` variable, a helper's answer, an arrow's parameter
// and a narrowed local each hold the task's memory, which the shared object
// may not keep (NL2609).
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
  names: string[]
  constructor() {
    this.names = [""]
  }
}

function same(s: string): string {
  return s
}

function each(xs: string[], f: (n: string) => void): void {
  for (const x of xs) {
    f(x)
  }
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  const made = [`a ${ms}`, `b ${ms}`]
  for (const n of made) {
    tally.names[0] = n
  }
  tally.label = same(`c ${ms}`)
  each(made, (n: string): void => {
    tally.label = n
  })
  const maybe: string | null = ms > 0 ? `d ${ms}` : null
  if (maybe !== null) {
    tally.label = maybe
  }
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
