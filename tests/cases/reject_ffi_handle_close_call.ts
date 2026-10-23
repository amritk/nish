// WP40 H1.1, Row 22 (Q9 option A): only the dispose closes the pointer the
// object owns; a close in a method would be followed by the `using` block's.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  shut(): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
