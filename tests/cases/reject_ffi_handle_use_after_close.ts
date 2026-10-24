// WP40 H1.3, §4c: a `using` binding's scope ends where its close is emitted,
// so naming the handle after its block names nothing.
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

export function after(p: string): i32 {
  let x = 0
  {
    using f = new File(p)
    x = f.read()
  }
  return x + f.read()
}
function count(f: File): i32 {
  return f.read()
}
export function lent(p: string): i32 {
  {
    using f = new File(p)
  }
  return count(f)
}

export const main = (): i32 => 0
