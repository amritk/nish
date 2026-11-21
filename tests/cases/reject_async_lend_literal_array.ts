// A literal of the task's own that holds a lent view is the view's to hold
// to: `h[0]` is the spawner's note, so storing the task-region array into it
// is a store into the spawner's memory (NL2822), not into the literal.
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

async function task(note: Note): Promise<void> {
  const h = [lend(note)]
  h[0].bytes = [1, 2, 3]
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
