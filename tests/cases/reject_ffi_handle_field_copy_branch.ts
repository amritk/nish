// WP40 H1.1, Row 17: the pointer is written once, by `this.file = g(...)` as a
// statement at the top of the constructor; a write in a branch is not the one
// write.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32
class File {
  readonly file: CPtr | null
  constructor(path: string) {
    if (path !== "") {
      this.file = fopen(path, "r")
    } else {
      this.file = fopen("default", "r")
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
