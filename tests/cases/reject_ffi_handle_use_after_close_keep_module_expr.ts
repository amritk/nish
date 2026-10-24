// WP40 H1.3, §6 row 15: an assignment expression cannot keep a lent handle in a
// module binding: the only module bindings are constants, and the constant
// rule refuses the assignment before the handle rules.
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

const kept: i32 = 0
function count(f: File): i32 {
  return (kept = f).read()
}

export const main = (): i32 => 0
