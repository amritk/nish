// WP40 H1.3, §4c: a `do` body's `using` closes at the end of the body, just
// before its condition runs; the condition cannot read the handle.
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

export function drain(p: string): i32 {
  let x = 0
  do {
    using f = new File(p)
    x += f.read()
  } while (f.read() > 0)
  return x
}

export const main = (): i32 => 0
