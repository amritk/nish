// WP40 H1.1, §4a R1/R2: the general refusal of the field allow-list. The
// pointer is read only as `this.file` in a method of its class, passed
// straight to a `declare function` or bound once to a `const`; a read through
// a borrowed parameter in a free function is refused by the one check.
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

const peek = (f: File): i32 => {
  const p = f.file
  return 0
}

export const main = (): i32 => 0
