// Hours near the top of the i64 range stop `new Duration` with a `RangeError`
// from each field's own bound, tested before the fields are turned into
// seconds, so no product wraps to a small total the 2^53 bound would pass.
// Those bounds are why no caller reaches temporalMul's own RangeError.
import { Duration } from "nish/temporal"

export const main = (): i32 => {
  const big: i64 = 4503599627370496
  const most: i64 = big * 2047
  console.log("before")
  const refused: Duration = new Duration(0, 0, 0, 0, most)
  console.log(`not reached ${refused.hours}`)
  return 0
}
