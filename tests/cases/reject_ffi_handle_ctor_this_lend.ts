// WP40 H1.3, #566: `this` cannot leave the handle class's own constructor. Lent to
// a parameter of its own type, which a method may do, the half-built object is
// refused by the constructor branch of the value rule alone.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
function peek(f: File): i32 {
  return f.read()
}
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
    peek(this)
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

export const main = (): i32 => 0
