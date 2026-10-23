// WP40 H1.1, Row 35: a `CPtr | null` field is tested through a `const` before a
// close taking `CPtr` is called on it.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    fclose(this.file)
  }
}

export const main = (): i32 => 0
