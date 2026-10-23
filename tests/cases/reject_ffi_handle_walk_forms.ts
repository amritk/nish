// WP40 H1.1, Rows 5 and 35: the forms a handle or its pointer may not take
// that pass every other check, one per method: the pointer bound by `using`,
// tested by `??` or against another bound pointer, assigned to a `let`,
// compared inside a `new`'s argument, a handle chosen by `?:` as
// an argument, and `this` lent from the constructor.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
    peek(this)
  }
  bound(): i32 {
    using p = this.file
    return 0
  }
  defaulted(): i32 {
    const p = this.file
    const q = p ?? null
    return 0
  }
  same(): i32 {
    const p = this.file
    const q = this.file
    if (p !== null && q !== null) {
      return p === q ? 1 : 0
    }
    return 0
  }
  reassigned(): i32 {
    let q: CPtr | null = null
    q = this.file
    return 0
  }
  chosen(): i32 {
    using e = new File(this.file === null ? "a" : "b")
    return 0
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

function peek(f: File): i32 {
  return 0
}
function either(b: boolean, x: File, y: File): i32 {
  return peek(b ? x : y)
}

export const main = (): i32 => 0
