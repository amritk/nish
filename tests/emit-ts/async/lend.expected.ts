// WP49 stage 6: `lend(x)` is the identity at run time, so the TypeScript
// reading drops it from the import of `nish:async`, which `runtime/async.mjs`
// does not export, and answers its calls with a local identity function. The
// task reads its spawner's object in place and writes a number into it.
import type { i32 } from "nish/runtime"
import { sleep, spawn } from "nish/runtime/async.mjs"
const lend = <T>(x: T): T => x;

class Note {
  text: string = "lent"
  seen: i32 = 0
}

const mark = (n: Note): string => {
  n.seen = 7
  return n.text
}

async function read(note: Note): Promise<void> {
  console.log(mark(lend(note)))
}

export async function main(): Promise<i32> {
  const note = new Note()
  spawn(read(note))
  await sleep(5)
  console.log(note.seen)
  return 0
}
