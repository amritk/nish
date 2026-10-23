// WP40 H1.1, Row 4: inside the class, a closure capturing a `const` read from
// the pointer could outlive the call. Nish's arrows capture nothing, so the
// arrow rule refuses it before the handle rules are asked.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
function apply(g: () => i32): i32 {
  return g()
}

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  peek(): i32 {
    const p = this.file
    return apply((): i32 => (p === null ? -1 : fgetc(p)))
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
