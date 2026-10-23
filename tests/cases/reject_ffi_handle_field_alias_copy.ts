// WP40 H1.1, Row 16b: a `const` bound to the pointer may not be copied to a
// second `const`.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  peek(): i32 {
    const p = this.file
    const q = p
    return q === null ? -1 : fgetc(q)
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
