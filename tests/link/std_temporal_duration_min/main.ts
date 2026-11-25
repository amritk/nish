// The least `i64` as microseconds or nanoseconds stops `new Duration` with a
// `RangeError`: its negation does not fit, so `negated` and `abs` could not
// answer it. One above it is a duration, and no line after the refusal prints.
import { Duration } from "nish/temporal"

export const main = (): i32 => {
  const big: i64 = -4503599627370496
  const least: i64 = big * 2048
  const above: Duration = new Duration(0, 0, 0, 0, 0, 0, 0, 0, 0, least + 1)
  console.log(`above ${above.negated().nanoseconds}`)
  const refused: Duration = new Duration(0, 0, 0, 0, 0, 0, 0, 0, least)
  console.log(`not reached ${refused.microseconds}`)
  return 0
}
