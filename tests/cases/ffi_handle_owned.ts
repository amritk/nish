// WP89 S5a: a handle class that owns several native objects, and one that owns
// another handle class. The driver (`ffi_handle_owned.c`) prints ` oN` for
// each open and ` cN` for each close. `Pair` owns two pointers and closes them
// in the reverse of their declaration; `Stack` owns a `Pair` it is handed by
// `new Stack(new Pair())` and a pointer of its own, so its dispose closes its
// pointer and the `Pair` then closes its own two. `read` is one load of the
// field and the C call, with no test or copy between them. `openPair` is a
// factory: a top-level function that returns the handle it opens.
declare function slot_open(): CPtr
declare function slot_close(p: CPtr): i32
declare function slot_read(p: CPtr): i32

class Pair {
  readonly first: CPtr
  readonly second: CPtr
  constructor() {
    this.first = slot_open()
    this.second = slot_open()
  }
  read(): i32 {
    return slot_read(this.second)
  }
  [Symbol.dispose](): void {
    slot_close(this.second)
    slot_close(this.first)
  }
}

class Stack {
  readonly pair: Pair
  readonly top: CPtr
  constructor(pair: Pair) {
    this.pair = pair
    this.top = slot_open()
  }
  [Symbol.dispose](): void {
    slot_close(this.top)
  }
}

const openPair = (): Pair => {
  return new Pair()
};

const both = (p: Pair): i32 => p.read()

export const pair = (): i32 => {
  using p = openPair()
  return both(p)
}

export const stack = (early: i32): i32 => {
  using s = new Stack(new Pair())
  if (early > 0) {
    return -1
  }
  return s.pair.read()
}
