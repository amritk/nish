// WP40 H1.3, §6 row 15: a module binding cannot keep a lent handle: a module
// has no top-level `let`, and that rule refuses it before the handle rules.
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

let saved = 0
function count(f: File): i32 {
  saved = f
  return 0
}

export const main = (): i32 => 0
