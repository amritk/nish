// `n * n` on an i32 can leave the i32 range, so `square` multiplies in i64 and
// answers `Err(1)` when the square does not fit; a square is never negative.
// The types are spelled `i32` so the module means the same thing in both
// number modes.
export const square = (n: i32): Result<i32, i32> => {
  const wide: i64 = toI64(n) * toI64(n)
  if (wide > 2147483647) {
    return Err(toI32(1))
  }
  return Ok(toI32(wide))
}
