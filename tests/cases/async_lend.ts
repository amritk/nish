// WP49 stage 6: `lend(x)` hands what a spawned task calls its spawner's object
// in place, with no copy into the task's region. `total` reads the lent note,
// writes a number into it and copies a string out; the spawner sees the
// number afterwards.
import { lend, sleep, spawn } from "nish:async"

class Note {
  text: string = "lent"
  counts: i32[] = []
  seen: i32 = 0
}

const total = (n: Note): string => {
  n.seen = n.counts.length
  return `${n.text} ${n.seen}`
}

async function read(note: Note): Promise<void> {
  console.log(total(lend(note)))
}

export async function main(): Promise<i32> {
  const note = new Note()
  note.counts.push(3)
  note.counts.push(4)
  spawn(read(note))
  await sleep(5)
  console.log(note.seen)
  return 0
}
