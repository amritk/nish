// WP40 H1.1, Row 29: an object literal holding a handle would keep it past the
// call.
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

class Pair {
  n: i32 = 0
  file: i32 = 0
}
function count(f: File): i32 {
  const pair: Pair = { n: 1, file: f }
  return pair.n
}

export const main = (): i32 => 0
