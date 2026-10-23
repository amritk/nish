// WP40 H1.1, Row 35: the close is a `declare function`; a misspelt one names
// nothing.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclsoe(p)
    }
  }
}

export const main = (): i32 => 0
