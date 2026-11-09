// WP49 stage 5, part 3: `spawnPiped` appends to its `stdout` and `stderr` as
// `push` does, so a task may not hand it an array it shares with its spawner
// (NL2615): the array's storage would move into the task's region.
import { sleep, spawn } from "nish:async"
import { spawnPiped } from "nish:process"

class Out {
  bytes: u8[]
  err: u8[]
  constructor() {
    this.bytes = []
    this.err = []
  }
}

const run = async (out: Out, ms: i32): Promise<void> => {
  await sleep(ms)
  const input: u8[] = []
  spawnPiped(["echo", "hi"], input, out.bytes, out.err)
}

export const main = async (): Promise<i32> => {
  const out = new Out()
  spawn(run(out, 1))
  await sleep(10)
  return 0
}
