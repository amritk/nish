// WP40 H1.1, D2: the pointer is written once, by the constructor, so a handle
// class with no constructor leaves it unset, which the field rules refuse.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
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
