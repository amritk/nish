// WP40 H1.3, §4c: a `using` in an `if` branch closes when the branch ends, so
// the `else` cannot read it.
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

export function either(p: string, c: boolean): i32 {
  if (c) {
    using f = new File(p)
    return f.read()
  } else {
    return f.read()
  }
}

export const main = (): i32 => 0
