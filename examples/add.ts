// `a + b` on two i32s can leave the i32 range, so `add` widens to i64, checks,
// and answers a `Result`: `Ok(sum)`, or `Err` when the sum overflows, `1` above
// `i32` max and `-1` below its min. The overflow check is the `Err` arm, which
// the C, N-API and wasm hosts read (the README shows it). The types are spelled
// i32 so the module means the same thing in both number modes.
const ABOVE: i32 = 1
const BELOW: i32 = -1

export const add = (a: i32, b: i32): Result<i32, i32> => {
  const sum: i64 = toI64(a) + toI64(b)
  if (sum > 2147483647) {
    return Err(ABOVE)
  }
  if (sum < -2147483648) {
    return Err(BELOW)
  }
  return Ok(toI32(sum))
}
