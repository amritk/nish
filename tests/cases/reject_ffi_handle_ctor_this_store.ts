// WP40 H1.3, #566: `this` cannot be stored from the handle class's own
// constructor. An array literal names no type, so the type rule never sees
// `File` and the value rule refuses `this` itself. No store can reach only
// the constructor branch: a method's `this` stored is refused the same way.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
    const xs = [this]
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
