// A lent view stored into a field of the task's own object is still the
// spawner's: `h.n.bytes = ...` would store task-region memory into it, so
// keeping the view is refused at the store (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

class Holder {
  n: Note = new Note()
}

async function task(note: Note): Promise<void> {
  const h = new Holder()
  h.n = lend(note)
  h.n.bytes = [1, 2]
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
