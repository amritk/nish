// WP40 H1.3, §6 row 15: a method cannot keep a lent handle, or its own `this`,
// in a field of another class.
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

class Keeper {
  keep: File | null = null
  take(f: File): void {
    this.keep = f
  }
}
class Lender {
  l: File | null = null
}
function lend(h: Lender, f: File): void {
  h.l = f
}

export const main = (): i32 => 0
