// WP40 H1.1, §4d H2: a constructor parameter is not a borrowing one, so a
// wrapper cannot hold a handle.
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
  readonly n: i32
  constructor(f: File) {
    this.n = f.read()
  }
}

function wrap(f: File): i32 {
  const r = new Reader(f)
  return r.n
}

// a constructor that takes two: the second argument lines up with the first
// parameter once the receiver is counted
class Pair {
  readonly n: i32
  constructor(a: File, b: File) {
    this.n = a.read() + b.read()
  }
}

function pair(f: File): i32 {
  const p = new Pair(f, f)
  return p.n
}

export const main = (): i32 => 0
