// WP49 stage 5, part 3: a task may not put the object it shares into memory
// of its own (NL2610). Kept there, the task could store its own memory into
// the shared object through the holder, past the rule that guards a direct
// store. Every way in is refused: a constructor, an array literal, a field or
// element store, `push`, a container's `set` or `add`, a method of the task's
// object, and a callee that stores one argument into another. An object
// literal is `reject_async_spawn_keep_literal`.
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
}

class Holder {
  t: Tally
  constructor(t: Tally) {
    this.t = t
  }
}

class Bag {
  items: Tally[]
  constructor() {
    this.items = []
  }
  put(t: Tally): void {
    this.items.push(t)
  }
}

function fill(h: Holder, t: Tally): void {
  h.t = t
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  const a = new Holder(tally)
  const b = [tally]
  const d = new Holder(new Tally())
  d.t = tally
  const e = [new Tally()]
  e[0] = tally
  const f: Tally[] = []
  f.push(tally)
  const g = new Map<string, Tally>()
  g.set("k", tally)
  const h = new Set<Tally>()
  h.add(tally)
  const i = new Bag()
  i.put(tally)
  const j = new Holder(new Tally())
  fill(j, tally)
}

export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
