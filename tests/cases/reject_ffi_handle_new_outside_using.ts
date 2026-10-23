// WP40 H1.1, Row 1: a handle-class `new` is legal only as a `using`
// initialiser; bound to a `const` it is refused.
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

function count(path: string): i32 {
  const f = new File(path)
  return f.read()
}

export const main = (): i32 => 0
