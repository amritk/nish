// WP40 H1.2: a `using` of a handle class closes it at every exit of its block,
// once. The driver (`ffi_handle_file.c`) wraps `fopen` and `fclose` so each
// open and close prints its file's number; a second close of one file, or a
// file left open when the driver checks, is printed too. Each export below
// leaves its block a different way: falling off its end, an early `return`,
// `continue` and `break` out of a loop body, an `orReturn()` that propagates
// between two declarators, and a `return` of a call (not `tail`, since the close
// runs after it). `reads` is written through the handle, and `lent` lends it
// to a parameter that lends it on, both of which H1.1 admits.
declare function counted_fopen(path: string, mode: string): CPtr | null
declare function counted_fclose(p: CPtr): i32
declare function fgetc(p: CPtr): i32

class File {
  readonly file: CPtr | null
  reads: i32 = 0
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

const twice = (n: i32): i32 => n * 2

const pathFor = (fail: i32): Result<string, i32> => (fail === 0 ? Ok("data") : Err(fail))

export function fallThrough(): i32 {
  let c = 0
  {
    using f = new File("data")
    c = f.read()
  }
  return c
}

export function early(k: i32): i32 {
  using f = new File("data")
  if (k > 0) {
    return k
  }
  return f.read()
}

export function loop(n: i32): i32 {
  let total = 0
  for (let i = 0; i < n; i++) {
    using f = new File("data")
    if (i === 1) {
      continue
    }
    if (i === 3) {
      break
    }
    total = total + f.read()
  }
  return total
}

const pair = (fail: i32): Result<i32, i32> => {
  using a = new File("data"), b = new File(pathFor(fail).orReturn())
  return Ok(a.read() + b.read())
}

export function pairOf(fail: i32): i32 {
  return pair(fail).unwrapOr(-1)
}

export function doubled(n: i32): i32 {
  using f = new File("data")
  return twice(n)
}

export function doubledBare(n: i32): i32 {
  return twice(n)
}

const first = (f: File): i32 => f.read()

const relay = (f: File): i32 => first(f) + first(f)

export function lent(): i32 {
  using f = new File("data")
  return relay(f)
}

export function counted(): i32 {
  using f = new File("data")
  f.reads = f.reads + f.read()
  f.reads = f.reads + f.read()
  return f.reads
}
