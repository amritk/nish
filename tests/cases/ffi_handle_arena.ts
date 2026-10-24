// WP40 H1.2: a handle opened in an arena's block closes before the arena is
// released, so a dispose that read memory the block allocated would find it
// still there. Here the handle is the second declarator, beside the arena in
// one `using`, and the third opens in a block inside the arena's: both orders
// close the handle first. Each block allocates an array in the arena.
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
      return -2
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

const fill = (k: i32): i32[] => {
  const xs: i32[] = []
  for (let i = 0; i < k; i++) {
    xs.push(i)
  }
  return xs
}

const beside = (k: i32): i32 => {
  using a = arena(), f = new File("/dev/null")
  const xs = fill(k)
  return f.read() + xs.length
}

const inside = (k: i32): i32 => {
  using a = arena()
  const xs = fill(k)
  {
    using f = new File("/dev/null")
    return f.read() + xs.length
  }
}

export const main = (): number => {
  const before = Arena.used()
  const b = beside(100)
  const i = inside(200)
  const after = Arena.used()
  console.log(`${b} ${i}`)
  console.log(after === before ? "released" : "kept")
  return 0
}
