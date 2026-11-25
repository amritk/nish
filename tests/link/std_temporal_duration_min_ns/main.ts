// The least `i64` as nanoseconds stops `new Duration` with a `RangeError`,
// as std_temporal_duration_min shows for microseconds: its negation does not
// fit, so `negated` and `abs` could not answer it. One above it as
// microseconds is a duration, and no line after the refusal prints.
import { Duration } from "nish/temporal"

export const main = (): i32 => {
  const big: i64 = -4503599627370496
  const least: i64 = big * 2048
  const above: Duration = new Duration(0, 0, 0, 0, 0, 0, 0, 0, least + 1)
  console.log(`above ${above.microseconds}`)
  const refused: Duration = new Duration(0, 0, 0, 0, 0, 0, 0, 0, 0, least)
  console.log(`not reached ${refused.nanoseconds}`)
  return 0
}
