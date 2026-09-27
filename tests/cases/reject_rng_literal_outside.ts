// WP31 §6: a literal outside the range is a compile error, in the voice of
// `reject_u_literal_too_wide`; one inside it would cost nothing.
export const main = (): number => {
  const d: integer<0, 9> = 12
  return d
}
