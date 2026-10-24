// WP40 H1.3, §6 row 15: a Channel cannot carry a lent handle to a reader that
// outlives the lender's `using` block.
import { Channel } from "nish/threads"
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
      return -1
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

function give(ch: Channel<File>, f: File): void {
  ch.send(f)
}

export const main = (): i32 => 0
