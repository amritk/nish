// WP40 H1.3, #566: in its own constructor `this` is not a receiver either: a
// method called on the half-built object would see it before the constructor
// returns. Only the constructor branch of the value rule refuses it.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
    this.read()
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
