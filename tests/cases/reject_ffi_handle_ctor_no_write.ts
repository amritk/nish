// WP40 H1.1, D2: a constructor that never writes the pointer leaves it unset,
// which definite assignment refuses before the handle rules are asked.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    const q = path
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
