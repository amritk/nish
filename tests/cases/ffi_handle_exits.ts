// WP40 H1.2: the siblings of `ffi_handle_file`'s exits. Nested `using` blocks
// close innermost first, on falling through and on an early `return` from the
// inner block; a `while` body closes once per iteration; a `using` in a
// constructor closes before `new` hands the object back; and a `using` in a
// generic function, and in one reached through a compile-time function
// parameter, closes in each instantiation. The driver (`ffi_handle_exits.c`)
// numbers each open and prints each close, as `ffi_handle_file.c` does.
declare function counted_fopen(path: string, mode: string): CPtr | null
declare function counted_fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  constructor(path: string) {
    this.file = counted_fopen(path, "r")
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
      counted_fclose(p)
    }
  }
}

export function nested(k: i32): i32 {
  using outer = new File("data")
  let c = outer.read()
  {
    using inner = new File("data")
    if (k === 1) {
      return 1
    }
    c = c + inner.read()
  }
  if (k === 2) {
    return 2
  }
  return c
}

export function whileBody(n: i32): i32 {
  let i = 0
  let total = 0
  while (i < n) {
    using f = new File("data")
    total = total + f.read()
    i++
  }
  return total
}

class Probe {
  first: i32
  constructor() {
    using f = new File("data")
    this.first = f.read()
  }
}

export function built(): i32 {
  const p = new Probe()
  return p.first
}

function readWith<T>(x: T): T {
  using f = new File("data")
  f.read()
  return x
}

export function specialised(): i32 {
  const s = readWith("ab")
  return readWith(s.length)
}

function around(n: i32, g: (n: i32) => i32): i32 {
  using f = new File("data")
  return g(n) + f.read()
}

export function passed(n: i32): i32 {
  return around(n, (m: i32): i32 => m * 2)
}
