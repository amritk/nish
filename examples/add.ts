// `a + b` on two i32s can leave the i32 range, so `add` widens to i64, checks,
// and answers a `Result`: `Ok(sum)`, or `Err` when the sum overflows, `1` above
// `i32` max and `-1` below its min. The overflow check is the `Err` arm, which
// the C, N-API and wasm hosts read (the README shows it).
export const add = (a: number, b: number): Result<number, number> => {
  const sum: i64 = toI64(a) + toI64(b)
  if (sum > 2147483647) {
    return Err(1)
  }
  if (sum < -2147483648) {
    return Err(-1)
  }
  return Ok(toI32(sum))
}
