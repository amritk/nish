// `n * n` on an i32 can leave the i32 range, so `square` multiplies in i64 and
// answers `Err(1)` when the square does not fit; a square is never negative.
export const square = (n: number): Result<number, number> => {
  const wide: i64 = toI64(n) * toI64(n)
  if (wide > 2147483647) {
    return Err(1)
  }
  return Ok(toI32(wide))
}
