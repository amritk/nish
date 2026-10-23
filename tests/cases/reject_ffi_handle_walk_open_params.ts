// WP40 H1.1, Row 5: a parameter borrows a handle only where this module alone
// calls it, with one type: not on an exported class, a generic class, a
// generic function or a generic method, and a `File | null` parameter is not
// a `File` one, so `f` may not be lent to it.
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

export class Shared {
  n: i32 = 0
  take(f: File): i32 {
    return 0
  }
}
class Generic<T> {
  n: i32 = 0
  take(f: File): i32 {
    return 0
  }
}
function generic<T>(f: File, t: T): i32 {
  return 0
}
class Methods {
  n: i32 = 0
  take<T>(f: File, t: T): i32 {
    return 0
  }
}
function maybe(f: File | null): i32 {
  return 0
}
function lend(f: File): i32 {
  return maybe(f)
}

export const main = (): i32 => 0
