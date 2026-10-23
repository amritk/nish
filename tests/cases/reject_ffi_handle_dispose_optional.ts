// WP40 H1.1, D5: the `[Symbol.dispose]` of a handle class is always there, so
// it cannot be optional. The parser refuses a `?` after a computed name, so
// the refusal is its own.
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
  [Symbol.dispose]?(): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

function count(f: File): i32 {
  return f.read()
}

export const main = (): i32 => 0
