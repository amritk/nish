// WP31 §7: a bitwise compound assignment enters the range again like any other
// store. 15 `<<= 2` is 60, outside `integer<0, 15>`, so it panics before the
// value prints; `&=` on the line before stays inside and passes.
export const main = (): number => {
  let m: integer<0, 15> = 15
  m &= 7
  console.log(`${m}`)
  m <<= 3
  console.log(`${m}`)
  return 0
}
