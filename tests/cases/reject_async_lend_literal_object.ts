// An annotated object literal that holds a lent view keeps it lent: `h.n` is
// the spawner's note, so storing the task-region array into it is refused
// (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

class Holder {
  n: Note = new Note()
}

async function task(note: Note): Promise<void> {
  const h: Holder = { n: lend(note) }
  h.n.bytes = [1, 2, 3]
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
