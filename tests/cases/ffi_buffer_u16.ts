// WP89 S2: a `readonly u16[]` is a buffer a declared C function reads. The
// count is in elements: `sum_u16` reads `n` `uint16_t`s, 2 bytes each. A
// count the program computed, not the length, is held to the length before C
// runs; `n` here is 3 of 5, so the check passes.
declare function sum_u16(xs: readonly u16[], n: u64): u32

export const run = (n: i32): i32 => {
  const xs: u16[] = [toU16(1), toU16(300), toU16(65535), toU16(7), toU16(9)]
  return toI32(sum_u16(xs, toU64(n)))
}
