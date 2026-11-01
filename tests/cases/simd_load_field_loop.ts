// A vector load or store inside a loop over an array read from a field: the
// inner loop reads only `buf.length` itself, and lifts the header with the
// `data` the vector access asks for too, rather than a header without one.
import { extract, loadU8x16, splatU8x16, store, u8x16 } from "nish:simd"

class Holder {
  buf: u8[]
  constructor() {
    this.buf = new Array<u8>(64)
  }
}

const scan = (h: Holder, stop: i32): i32 => {
  const buf: u8[] = h.buf
  let i: i32 = 0
  while (i < stop && i < toI32(buf.length) && buf[i] !== 10) {
    while (i >= 0 && i <= toI32(buf.length) - 16) {
      const v: u8x16 = loadU8x16(buf, i)
      if (extract(v, 0) === 10) {
        break
      }
      i += 16
    }
    i += 1
  }
  return i
}

const fill = (h: Holder, b: u8): void => {
  const buf: u8[] = h.buf
  let i: i32 = 0
  while (i < toI32(buf.length) && buf[i] !== b) {
    while (i <= toI32(buf.length) - 16) {
      store(splatU8x16(b), buf, i)
      i += 16
    }
    i += 1
  }
}

export const main = (): i32 => {
  const h = new Holder()
  h.buf[40] = 10
  console.log(`${scan(h, 64)}`)
  h.buf[32] = 10
  console.log(`${scan(h, 64)}`)
  fill(h, 7)
  console.log(`${h.buf[0]} ${h.buf[40]} ${h.buf[63]}`)
  return 0
}
