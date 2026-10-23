// WP40 H1.1, Row 2: a `using` opens a handle only in a function's own body, at
// depth 0. Inside an arrow the `new` is a handle value like any other, and so is
// the name it binds, each refused where it stands.
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


function apply(g: () => i32): i32 {
  return g()
}

function count(): i32 {
  return apply((): i32 => {
    using f = new File("data.txt")
    return f.read()
  })
}

export const main = (): i32 => 0
