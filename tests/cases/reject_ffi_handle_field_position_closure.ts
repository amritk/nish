// WP40 H1.1, Row 31: the pointer is read directly in a method's body, never in
// a closure there. An arrow cannot read `this`, so the arrow rule refuses it
// before the handle rules are asked.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
declare function ftell(p: CPtr | null): i32
function apply(g: () => i32): i32 {
  return g()
}

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  where(): i32 {
    return apply((): i32 => ftell(this.file))
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
