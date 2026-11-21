import { lend, sleep, spawn } from "nish:async"

class Note {
  counts: i32[] = []
  seen: i32 = 0
}

const tally = (n: Note): i32 => n.counts.length

const read = async (note: Note): Promise<void> => {
  note.seen = tally(lend(note))
}

export const main = async (): Promise<i32> => {
  const note = new Note()
  note.counts.push(3)
  spawn(read(note))
  await sleep(1)
  return note.seen
}
