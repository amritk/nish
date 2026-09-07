// `>>` is `lshr` on an unsigned type and `ashr` on a signed one, and `>>>` is
// `lshr` on both, so `>>` and `>>>` are synonyms on `u32` and the golden shows
// two identical instructions. The `i32` pair below is the contrast.
export function shiftU32(x: u32): u32 {
  return (x >> 1) + (x >>> 1);
}

export function shiftI32(x: i32): i32 {
  return (x >> 1) + (x >>> 1);
}
