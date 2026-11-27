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

function openPair(): Pair {
  return new Pair()
}

const both = (p: Pair): i32 => p.read()

export const depth = (): i32 => {
  using s = new Stack(openPair())
  return s.pair.read()
}
