// WP53 H1.1, §4d H2; WP89 S5a: a constructor parameter borrows a handle for
// the length of the call, so a constructor may read it but not keep it: not
// in a field of a class that does not own handles, not in an owning field
// (only a handle the call opens moves there), and not in a generic class.
// Each refusal here was a constructor parameter before WP89 S5a let one borrow.
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

// a class that owns no handle names `File` only as a borrowing parameter
class Reader {
  readonly f: File
  constructor(f: File) {
    this.f = f
  }
}

// an owning field takes only a handle the caller opens into it, so a
// borrowed one may not move there
class Log {
  readonly file: File
  constructor(f: File) {
    this.file = f
  }
  [Symbol.dispose](): void {}
}

// nor may it hold one that may be absent
class Maybe {
  readonly f: File | null
  constructor() {
    this.f = null
  }
}

// a generic class's constructor has no one type to borrow at
class Box<T> {
  readonly n: i32
  constructor(f: File, t: T) {
    this.n = f.read()
  }
}

const wrap = (f: File): i32 => {
  using l = new Log(f)
  return 0
};

export const main = (): i32 => 0
