// WP40 H1.1, §4d non-null assertion: `f!.read()` never reaches the handle
// pass. The parser refuses a postfix `!` on any expression, so the walk has
// no non-null case and this pins the refusal that stands in for it.
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

function count(f: File): i32 {
  return f!.read()
}

export const main = (): i32 => 0
