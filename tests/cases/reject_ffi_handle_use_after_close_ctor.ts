// WP40 H1.3, §4c: a `using` inside a constructor reached by `new` closes at its
// block's end like any other, so the rest of the constructor cannot read it.
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

class Reader {
  n: i32
  constructor(p: string) {
    {
      using f = new File(p)
      this.n = f.read()
    }
    this.n = this.n + f.read()
  }
}
export function first(p: string): i32 {
  const r = new Reader(p)
  return r.n
}

export const main = (): i32 => 0
