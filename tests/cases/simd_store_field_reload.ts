// A vector store cannot write the class field that holds the array, nor the
// array's header. Before a vector access carried the scope and TBAA tag a
// scalar element access of its lane type carries, `opt -O3` read each
// `store(v, this.out, i)` as a clobber of `this.out`, its `length` and its
// `data`, and reloaded all three on every trip round the loop. `tests/run.js`
// pins the consequence a golden cannot state: after `opt -O3` the loop in
// `@Sink.fill` loads no pointer and no length.
import { loadU8x16, store, u8x16 } from "nish:simd"

export class Sink {
  count: i32 = 0
  out: u8[]

  constructor(n: i32) {
    this.out = new Array<u8>(n)
  }

  fill(src: u8[]): void {
    let i: i32 = 0
    while (i >= 0 && i <= toI32(src.length) - 16 && i <= toI32(this.out.length) - 16) {
      const v: u8x16 = loadU8x16(src, i)
      store(v, this.out, i)
      this.count = this.count + 1
      i += 16
    }
  }
}

export const main = (): i32 => {
  const src = new Array<u8>(64)
  let k: i32 = 0
  while (k < 64) {
    src[k] = toU8(k * 3)
    k += 1
  }
  const s = new Sink(48)
  s.fill(src)
  console.log(`${s.out[0]} ${s.out[17]} ${s.out[47]} ${s.count}`)
  return 0
}
