// WP31 §5: a `u8` is not an `integer<0, 255>`, though it has the same range;
// the source of an entry is an `i32` or another range, and the conversion is
// `toI32(b)`.
export const main = (): number => {
  const b: u8 = 200
  const r: integer<0, 255> = b
  return r
}
