// WP31 §5: under --number-mode f64 a `number` is an `f64` and does not enter a
// range implicitly; the program writes `toI32(x)`, which saturates and then
// enters the range checked.
const pick = (x: integer<0, 9>): i32 => x

export const main = (): i32 => {
  const x = 4
  return pick(x)
}
