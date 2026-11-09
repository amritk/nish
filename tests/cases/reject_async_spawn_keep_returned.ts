// WP49 stage 5, part 3: an object a helper makes may hold what the helper
// was handed, so in a task a fresh helper's answer joins its arguments. A
// holder of the shared object built by a helper, an async helper, or two of
// them under `awaitAll`, is the task's memory pointing at the shared object:
// a store through it is refused (NL2609).
import { awaitAll, sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
}

class Holder {
  t: Tally
  constructor(t: Tally) {
    this.t = t
  }
}

function wrap(t: Tally): Holder {
  return new Holder(t)
}

async function wrapLater(t: Tally): Promise<Holder> {
  await sleep(1)
  return new Holder(t)
}

async function work(tally: Tally, ms: i32): Promise<void> {
  const a = wrap(tally)
  a.t.label = `a ${ms}`
  const b = await wrapLater(tally)
  b.t.label = `b ${ms}`
  const [c, d] = await awaitAll(wrapLater(tally), wrapLater(tally))
  c.t.label = `c ${ms}`
  d.t.label = `d ${ms}`
}

export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
