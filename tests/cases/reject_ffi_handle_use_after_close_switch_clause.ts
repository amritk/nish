// WP40 H1.3, §4c: a `using` written directly in a `case` clause would be in
// scope in the clauses after it, which a fall-through skips the open of; the
// clause rule refuses the declaration before the handle rules see it.
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

export function pick(p: string, k: i32): i32 {
  let x = 0
  switch (k) {
    case 0:
      using f = new File(p)
      x = f.read()
      break
    case 1:
      x = f.read()
      break
  }
  return x
}

export const main = (): i32 => 0
