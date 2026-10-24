// WP40 H1.3: a `for` body's `using` binding is not in scope in the update
// clause, which is outside the body; it pins source order, not a close point.
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

export function walk(p: string): i32 {
  let x = 0
  for (let i = 0; i < 2; i += f.read()) {
    using f = new File(p)
    x += f.read()
  }
  return x
}

export const main = (): i32 => 0
