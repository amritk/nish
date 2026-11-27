// WP89 S5a: a factory is a top-level function that returns the handle it
// opens. One that returns a handle it was lent would hand its caller a second
// owner; a method has no factory form (Nish has no static methods), so its
// result type may not name a handle class; and a factory's result is
// opened by `using`, never bound by `const`, which would close it nowhere.
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
function open(): Slot {
  return new Slot()
}
function lend(s: Slot): Slot {
  return s
}
const arrow = (): Slot => new Slot()
class K {
  make(): Slot {
    return new Slot()
  }
}
export const main = (): i32 => {
  const s = open()
  return 0
}
