// WP40 H1.1, Row 13: a handle class may not `implements`, so it has no other
// type to widen to.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32
interface Closer {
  readonly name: string
}
class File implements Closer {
  readonly file: CPtr | null
  readonly name: string
  constructor(path: string) {
    this.file = fopen(path, "r")
    this.name = path
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

export const main = (): i32 => 0
