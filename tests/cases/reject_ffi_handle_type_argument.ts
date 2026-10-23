// WP40 H1.1, Row 5: a handle class as a type argument names it outside a
// borrowing parameter, on the function-template path and the class-template
// path alike.
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

class Box<T> {
  value: T
  constructor(value: T) {
    this.value = value
  }
}
function same<T>(value: T): T {
  return value
}
function count(f: File): i32 {
  const g = same(f)
  return 0
}
function boxed(f: File): i32 {
  const b = new Box<File>(f)
  return 0
}

export const main = (): i32 => 0
