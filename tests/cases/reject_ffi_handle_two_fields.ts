// WP40 H1.1, Row 32: a handle class owns exactly one pointer.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  readonly log: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
    this.log = fopen(path, "a")
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
