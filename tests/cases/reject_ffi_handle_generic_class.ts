// WP40 H1.1, Row 5: a handle class has no type parameters, so no instance of it
// is a second class owning the pointer.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
class File<T> {
  readonly file: CPtr | null
  tag: T
  constructor(path: string, tag: T) {
    this.file = fopen(path, "r")
    this.tag = tag
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
