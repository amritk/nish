// WP40 H1.1, Row 35: the dispose is one of the two shapes, so the `using` block
// runs nothing but the close.
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
      fgetc(p)
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
