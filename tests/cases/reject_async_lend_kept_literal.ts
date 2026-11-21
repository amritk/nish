// A literal around a lent view, stored into a field of the task's own object,
// keeps the view where the walk cannot follow it: `b.n[0]` is the spawner's
// note, so the store of the literal is refused (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

class Box {
  n: Note[] = []
}

async function task(note: Note): Promise<void> {
  const b = new Box()
  b.n = [lend(note)]
  b.n[0].bytes = [1, 2, 3]
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
