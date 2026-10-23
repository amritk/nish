// WP40 H1.1, Row 4: a closure capturing a borrowed handle could be called after
// the `using` block closes it. Nish's arrows capture nothing, so the arrow rule
// refuses it before the handle rules are asked.
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

function count(f: File): i32 {
  return apply((): i32 => f.read())
}

export const main = (): i32 => 0
