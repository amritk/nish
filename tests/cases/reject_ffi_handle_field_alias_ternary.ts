// WP40 H1.1, Row 16b: a ternary yielding the pointer would be another name for
// it.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  peek(first: boolean): i32 {
    const p: CPtr | null = first ? this.file : fopen("other", "r")
    return p === null ? -1 : fgetc(p)
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
