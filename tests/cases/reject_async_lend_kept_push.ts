// Pushing a lent view into the task's own array keeps it there: `h[0]` is
// the spawner's note, so the push is refused (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

async function task(note: Note): Promise<void> {
  const h: Note[] = []
  h.push(lend(note))
  h[0].bytes = [1, 2, 3]
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
