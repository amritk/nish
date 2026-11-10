// WP49 stage 5, part 8: a spawn arrow may capture an object only when it holds
// nothing a task may not share; `f` is a handle class, which the `using`
// block that opened it closes while the task still waits. The arrow-capture
// rule for a handle refuses it before the spawn's does (NL2588).
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

async function each(g: (n: i32) => void, ms: i32): Promise<void> {
  await sleep(ms)
  g(ms)
}

async function start(): Promise<void> {
  using f = new File("/dev/null")
  spawn(each((n: i32): void => {
    console.log(f.read() + n)
  }, 5))
}

export async function main(): Promise<i32> {
  await start()
  await sleep(10)
  return 0
}
