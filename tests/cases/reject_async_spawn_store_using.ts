// WP49 stage 5, part 3: a `using` binding in a task is bound like any other
// local, with where its value lives. A handle a task opens with `using` is
// the task's memory, made in the task's region: the shared object is not the
// task's, and the handle may not keep it (NL2610). A handle cannot itself be
// stored in a field (the handle rules), so keeping is the direction the
// region rules judge here.
import { sleep, spawn } from "nish:async"
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32

class File {
  readonly file: CPtr | null
  owner: Tally | null = null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

class Tally {
  count: i32 = 0
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  using f = new File("/dev/null")
  f.owner = tally
}

export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  return 0
}
