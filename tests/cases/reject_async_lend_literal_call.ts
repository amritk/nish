// A literal holding a lent view, handed straight to a callee that stores
// into its element, hands the callee the view (NL2822).
import { lend, spawn } from "nish:async"

class Note {
  bytes: u8[] = []
}

const fill = (ns: Note[]): void => {
  ns[0].bytes = [1, 2, 3]
}

async function task(note: Note): Promise<void> {
  fill([lend(note)])
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(task(note))
  return 0
}
