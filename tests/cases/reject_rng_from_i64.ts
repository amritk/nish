// WP31 §6: the source of an entry is an `i32` or another range. An `i64` is
// neither, however small its value; the conversion is `toI32(x)`.
export const main = (): number => {
  const wide: i64 = 3
  const x: integer<0, 9> = wide
  return x
}
