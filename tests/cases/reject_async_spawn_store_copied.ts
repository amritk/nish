// WP49 stage 5, part 3: a function handed a shared object and an object of
// the task's own may copy a string from one into the other, so the pair is
// refused (NL2609).
import { sleep, spawn } from "nish:async"

class Tally {
  label: string = ""
}

class Note {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

const copyLabel = (t: Tally, note: Note): void => {
  t.label = note.text
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  copyLabel(tally, new Note(`task ${ms}`))
}
export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
