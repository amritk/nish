// WP40 H1.3, §6 row 15: a handle's method cannot keep `this` in another
// object's field (`h.l = this`).
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
  leak(h: Holder): void {
    h.l = this
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}
class Holder {
  l: File | null = null
}

export const main = (): i32 => 0
