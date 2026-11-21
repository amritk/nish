// The panic sites std/threads.ts keeps, under an instruction count: each
// round opens a scope and spawns one task per slot of a fresh array, at an
// index the loop proves in range, and maps an array with `parallelMapInto`,
// whose destination is as long as its source. Both reach the checks a fix to
// `slotOutOfRange` or `dstTooShort` would change, so the count says what the
// fix costs. It prints the sum of every answer, which the twin-free count only
// needs to be the same from run to run.
import { parallelMapInto, scope } from "nish/threads"

const low = (x: i32): i32 => x & 255

const twice = (x: i32): i32 => x * 2

export const main = (): i32 => {
  const n: i32 = 20000 // bench:n
  const src = new Array<i32>(256)
  for (let i: i32 = 0; i < toI32(src.length); i++) {
    src[i] = i
  }
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const slots = new Array<i32>(4)
    {
      using s = scope()
      for (let i: i32 = 0; i < toI32(slots.length); i++) {
        s.spawn(low, round + i, slots, i)
      }
    }
    const mapped = new Array<i32>(toI32(src.length))
    parallelMapInto(src, mapped, twice)
    for (let i: i32 = 0; i < toI32(slots.length); i++) {
      sum += toI64(slots[i])
    }
    for (let i: i32 = 0; i < toI32(mapped.length); i++) {
      sum += toI64(mapped[i])
    }
  }
  console.log(`${sum}`)
  return 0
}
