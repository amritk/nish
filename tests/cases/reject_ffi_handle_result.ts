// WP40 H1.1, Row 7: a `Result` arm of a handle class names it outside a
// borrowing parameter; a fallible open is a `CPtr | null` field.
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

function check(f: File): Result<i32, File> {
  return Ok(f.read())
}

export const main = (): i32 => 0
