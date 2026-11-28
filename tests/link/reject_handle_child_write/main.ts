// WP89 S5a: a field that owns another handle class is written once, by
// `this.field = p` as a statement at the top of the constructor. A write under
// an `if` is refused even when every branch writes it: the walk that proves
// each owned handle is closed exactly once follows the top of the constructor
// only, and the branch that does not keep `slot` would leave it closed by no one.
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
  constructor(slot: Slot, keep: boolean) {
    if (keep) {
      this.slot = slot
    } else {
      this.slot = new Slot()
    }
  }
  [Symbol.dispose](): void {}
}

export const main = (): i32 => {
  using h = new Holder(new Slot(), true)
  return 0
}
