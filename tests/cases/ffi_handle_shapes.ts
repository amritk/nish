// WP40 H1.2: the close a `using` emits is the one its dispose spells (§4b).
// The driver (`ffi_handle_shapes.c`) hands out numbered handles, prints ` oN`
// for each open and ` cN` for each close (` vN` for the close that returns
// `void`, ` c-null` for a close given `null`), and prints a handle still open
// when an export returns. `Sure` is shape 1 on a field that is never `null`,
// so its close is called on the field with no test; `Quiet` is the same with
// a close that returns `void`; `Maybe` is shape 1 on a `CPtr | null` field
// whose close takes `CPtr | null`, so its close is called even on `null`, as
// the dispose says. `Lying` is shape 2 on a field typed `CPtr` whose C open
// returns `NULL` anyway: the close is behind the `null` test the dispose
// spells, though the type says it cannot fail. `beforeLoop` holds a handle across a loop that leaves by
// `continue` and `break`, and `bodyOrReturn` propagates an `Err` from the body
// of a block with a handle open: each closes the handle once.
declare function sure_open(): CPtr
declare function sure_close(p: CPtr): i32
declare function quiet_close(p: CPtr): void
declare function maybe_open(fail: i32): CPtr | null
declare function maybe_close(p: CPtr | null): i32
declare function lying_open(fail: i32): CPtr
declare function peek(p: CPtr): i32

class Sure {
  readonly h: CPtr
  constructor() {
    this.h = sure_open()
  }
  num(): i32 {
    return peek(this.h)
  }
  [Symbol.dispose](): void {
    sure_close(this.h)
  }
}

class Quiet {
  readonly h: CPtr
  constructor() {
    this.h = sure_open()
  }
  num(): i32 {
    return peek(this.h)
  }
  [Symbol.dispose](): void {
    quiet_close(this.h)
  }
}

class Maybe {
  readonly h: CPtr | null
  constructor(fail: i32) {
    this.h = maybe_open(fail)
  }
  [Symbol.dispose](): void {
    maybe_close(this.h)
  }
}

class Lying {
  readonly h: CPtr
  constructor(fail: i32) {
    this.h = lying_open(fail)
  }
  [Symbol.dispose](): void {
    const p = this.h
    if (p !== null) {
      sure_close(p)
    }
  }
}

const pathFor = (fail: i32): Result<i32, i32> => (fail === 0 ? Ok(10) : Err(fail))

export function sureEarly(k: i32): i32 {
  using s = new Sure()
  if (k > 0) {
    return k
  }
  return s.num()
}

export function quietEarly(k: i32): i32 {
  using q = new Quiet()
  if (k > 0) {
    return k
  }
  return q.num()
}

export function maybeEither(fail: i32): i32 {
  using m = new Maybe(fail)
  return fail
}

export function lyingEither(fail: i32): i32 {
  using l = new Lying(fail)
  return fail
}

export function beforeLoop(n: i32): i32 {
  using s = new Sure()
  let total = 0
  for (let i = 0; i < n; i++) {
    if (i === 1) {
      continue
    }
    if (i === 3) {
      break
    }
    total = total + s.num()
  }
  return total
}

const body = (fail: i32): Result<i32, i32> => {
  using s = new Sure()
  const extra = pathFor(fail).orReturn()
  return Ok(s.num() + extra)
}

export function bodyOrReturn(fail: i32): i32 {
  return body(fail).unwrapOr(-1)
}
