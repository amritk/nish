// WP40 H1.1, §4d: the general refusal of the position allow-list. A handle
// value may be opened by `using`, called, or lent to a parameter of its type
// (H1-H3, U1, U2); any form not on that list is refused by the one check, here
// an element of an array literal that a callee never sees.
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

const count = (f: File): i32 => [f, f].length

export const main = (): i32 => 0
