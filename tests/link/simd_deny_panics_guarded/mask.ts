// The guarded lane-wise scan `main.ts` calls; its header says why it is proven.
import { bitmask, eq, loadU8x16, splatU8x16 } from "nish:simd"

export const newlineMask = (xs: u8[]): i32 => {
  const newline = splatU8x16(10)
  let mask: i32 = 0
  let i: i32 = 0
  while (i >= 0 && i <= toI32(xs.length) - 16) {
    // One bit per newline among these sixteen bytes, lowest lane first; the
    // chunks' masks are folded together with xor, which cannot overflow.
    mask = mask ^ bitmask(eq(loadU8x16(xs, i), newline))
    i += 16
  }
  return mask
}
