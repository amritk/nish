// WP40 H1.1, Row 2: every declarator of a `using` is checked on its own, so a
// second one that names the first is refused at it, by position in the `.err`,
// while the first, a `new` of the class, is admitted.
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
  using a = new File(path), b = a
  return b.read()
}

export const main = (): i32 => 0
