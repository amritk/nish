// The tag a vector access carries says it touches element data, and element
// data it is: a vector load still sees the element stores before it, and an
// element read still sees a vector store made through another handle on the
// same array. Each read below must come after the write it follows; a load
// hoisted out of either loop would print other sums.
import { loadU8x16, store, extract, splatU8x16 } from "nish:simd"

export const main = (): i32 => {
  const buf = new Array<u8>(32)
  let total: i32 = 0
  let k: i32 = 0
  while (k < 16) {
    buf[k] = toU8(k + 1)
    const v = loadU8x16(buf, 0)
    total = total + toI32(extract(v, 0)) + toI32(extract(v, 7)) + toI32(extract(v, 15))
    k += 1
  }
  const a: u8[] = buf
  const b: u8[] = buf
  let seen: i32 = 0
  let j: i32 = 0
  while (j < 16 && j < b.length) {
    seen = seen + toI32(b[j])
    store(splatU8x16(toU8(j)), a, 0)
    seen = seen + toI32(b[j])
    j += 1
  }
  console.log(`${total} ${seen}`)
  return 0
}
