// A task may not hand a view `lend` borrows to a callee that stores a pointer
// into it: the array `fill` stores lives in the task's region, freed when the
// task ends, while the note it is stored into is the spawner's (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

const fill = (n: Note): void => {
  n.bytes = [1, 2, 3]
}

async function task(note: Note): Promise<void> {
  fill(lend(note))
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
