// WP49 stage 5, part 3: a handle lent to a spawned task would be closed by the
// `using` block that opened it while the task still waits, so a task's
// argument may not be a handle class.
import { sleep, spawn } from "nish:async"
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  read(): i32 {
    const p = this.file
    if (p === null) {
      return -2
    }
    return fgetc(p)
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

const readLater = async (f: File, ms: i32): Promise<void> => {
  await sleep(ms)
  console.log(f.read())
}

const start = async (): Promise<void> => {
  using f = new File("/dev/null")
  spawn(readLater(f, 5))
}

export const main = async (): Promise<i32> => {
  await start()
  await sleep(10)
  return 0
}
