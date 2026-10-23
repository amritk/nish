// WP40 H1.1, Row 10: a `scope()` task capturing a handle could call it from
// another thread, and after the close.
import { scope } from "nish/threads"
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

function count(f: File): i32 {
  {
    using s = scope()
    s.spawn(() => f.read())
  }
  return 0
}

export const main = (): i32 => 0
