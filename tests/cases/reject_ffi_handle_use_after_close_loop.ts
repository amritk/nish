// WP40 H1.3, §4c: a loop body's `using` closes at the end of each iteration;
// the next iteration cannot read the previous one's handle, before its own
// `using` or after a nested block's.
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

export function next(p: string): i32 {
  let x = 0
  for (let i = 0; i < 2; i++) {
    if (i > 0) {
      x += f.read()
    }
    using f = new File(p)
    x += f.read()
  }
  return x
}
export function nested(p: string): i32 {
  let x = 0
  for (let i = 0; i < 2; i++) {
    {
      using f = new File(p)
      x += f.read()
    }
    x += f.read()
  }
  return x
}

export const main = (): i32 => 0
