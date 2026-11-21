// A task may not grow an array of a view `lend` borrows through a callee's
// answer: `marksOf` hands back the note's own array, so the push stores a
// task-region `Mark` into the spawner's memory (NL2822). A callee whose
// answer is fresh, or holds no memory the view reaches, keeps it readable.
import { lend, spawn } from "nish:async"

class Mark {
  at: i32 = 0
}

class Note {
  marks: Mark[] = []
}

const marksOf = (n: Note): Mark[] => n.marks

const tag = (n: Note): void => {
  marksOf(n).push(new Mark())
}

async function task(note: Note): Promise<void> {
  tag(lend(note))
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
