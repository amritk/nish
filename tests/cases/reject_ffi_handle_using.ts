// WP40 H1.1, option (i): `using` of a handle class is checked but not lowered
// yet, so a well-formed `using f = new File(path)` is refused until H1.2 emits
// the close at every exit of its block.
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
  using f = new File(path)
  return f.read()
}

export const main = (): i32 => 0
