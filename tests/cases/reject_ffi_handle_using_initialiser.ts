// WP40 H1.1, Row 2: a `using` initialiser is exactly `new C(args)`; one picked
// by a ternary is not.
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

function count(path: string, first: boolean): i32 {
  using f = first ? new File(path) : new File("other")
  return f.read()
}

export const main = (): i32 => 0
