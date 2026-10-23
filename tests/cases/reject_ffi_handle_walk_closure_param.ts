// WP40 H1.1, §4d H2: a closure's parameter is not a borrowing one. The `.err`
// names the arrow's parameter by position, since the function type the arrow
// is lent to is refused too, in the same words.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
function each(f: File, g: (f: File) => i32): i32 {
  return 0
}

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
  return each(f, (g: File): i32 => g.read())
}

export const main = (): i32 => 0
