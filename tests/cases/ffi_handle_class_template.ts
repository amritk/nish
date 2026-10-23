// WP40 H1.1, §6 row 5: the class-template check. A generic class is now
// checked where it is instantiated, as a generic function always was, so
// `new Box<CPtr>()` and `new Box<File>()` are refused there
// (`reject_ffi_pointer_type_argument`, `reject_ffi_handle_type_argument`). The
// check refuses only those two: the same templates at a number, a string and a
// plain class compile as before, beside a handle class in the same program,
// and `Empty<T>`, which names `T` in no member, still compiles at a type that
// is neither.
declare function fopen(path: string, mode: string): CPtr | null
declare function fclose(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.file
    if (p !== null) {
      fclose(p)
    }
  }
}

class Point {
  x: i32
  constructor(x: i32) {
    this.x = x
  }
}

class Box<T> {
  value: T
  constructor(value: T) {
    this.value = value
  }
}

class Empty<T> {
  n: i32 = 7
}

export const main = (): i32 => {
  const a = new Box<i32>(40)
  const b = new Box<string>("two")
  const c = new Box<Point>(new Point(2))
  const e = new Empty<string>()
  console.log(a.value + c.value.x)
  console.log(b.value)
  console.log(e.n)
  return 0
}
