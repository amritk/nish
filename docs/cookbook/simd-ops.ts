import { f32x4, u8x16, splatU8x16, mul, add, eq, any, bitmask } from "nish:simd"

export const axpy = (a: f32x4, x: f32x4, y: f32x4): f32x4 => add(mul(a, x), y)

export const spaces = (block: u8x16): i32 => {
  const m = eq(block, splatU8x16(32))
  return any(m) ? bitmask(m) : -1
}
