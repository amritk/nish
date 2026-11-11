// WP53 H1.1, §4d: a handle is never spread. Unannotated, the literal has no layout to
// copy into; `File` has methods, so no literal is one; and `CPtr` cannot be the field of
// an interface a spread could copy it into. The literal here is unannotated, so the
// first is what refuses it (NL2709), before its source is read.
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

function count(f: File): i32 {
  const o = { ...f }
  return 0
}

export const main = (): i32 => 0
