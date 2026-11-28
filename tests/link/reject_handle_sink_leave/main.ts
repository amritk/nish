// WP89 S5a: a handle opened as an argument of a `new` that takes ownership
// of it is owned by nothing until that `new` runs. An argument after it that
// may leave the function, here by `orReturn` on a `Result`, would leave the opened
// `Slot` closed by no one, so the order is refused: open the handle last, or
// bind the leaving value first.
declare function slot_open(): CPtr
declare function slot_close(p: CPtr): i32

class Slot {
  readonly p: CPtr
  constructor() {
    this.p = slot_open()
  }
  [Symbol.dispose](): void {
    slot_close(this.p)
  }
}

class Holder {
  readonly slot: Slot
  readonly n: i32
  constructor(slot: Slot, n: i32) {
    this.slot = slot
    this.n = n
  }
  [Symbol.dispose](): void {}
}

const count = (ok: boolean): Result<i32, string> => (ok ? Ok(1) : Err("no"))

const build = (ok: boolean): Result<i32, string> => {
  using h = new Holder(new Slot(), count(ok).orReturn())
  return Ok(h.n)
}

export const main = (): i32 => {
  return build(true).isOk() ? 0 : 1
}
