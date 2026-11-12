// A field array replaced by a method between the guard and the load: the
// guard proved the old `this.data`, the load reads the new one, two elements
// long, and keeps its check.
import { loadI32x4, extract } from "nish:simd"

class Buf {
  data: i32[]

  constructor() {
    this.data = [1, 2, 3, 4, 5, 6]
  }

  swap(): void {
    this.data = [7, 8]
  }

  firstLane(off: i32): i32 {
    if (off < 0 || off > toI32(this.data.length) - 4) {
      panic("four lanes do not fit at off")
    }
    console.log(this.data[off + 3])
    this.swap()
    return extract(loadI32x4(this.data, off), 0)
  }
}

export const main = (): i32 => {
  const b = new Buf()
  console.log(b.firstLane(0))
  return 0
}
