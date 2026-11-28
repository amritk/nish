// WP53 H1.1, Row 2; WP89 S5a: a `using` initialiser opens the handle it
// closes, so a ternary may pick between two it opens but not a borrowed one.
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

const count = (g: File, first: boolean): i32 => {
  using f = first ? g : new File("other")
  return f.read()
};

export const main = (): i32 => 0
