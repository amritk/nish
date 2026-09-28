// WP31 §5: a `u32` is unrelated to a range, as a `u8` is (reject_rng_from_u8);
// its arithmetic wraps and a range's does not, so mixing them is refused.
export const main = (): number => {
  const small: u32 = 3
  const x: integer<0, 9> = small
  return x
}
