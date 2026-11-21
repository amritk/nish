// A value that may be a lent view is held as one: `v` may be the spawner's
// note, so a store through it is refused (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

async function task(note: Note, n: i32): Promise<void> {
  const v = n > 0 ? lend(note) : new Note()
  v.bytes = [1, 2, 3]
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note, 1))
  return 0
}
