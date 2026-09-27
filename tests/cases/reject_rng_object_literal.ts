// WP31 §6: a ranged field of an object literal gives its literal the range,
// though an object-literal property gives a literal no other context, so an
// out-of-range literal is refused here rather than checked at run time.
interface Pixel {
  level: integer<0, 255>
}

export const main = (): number => {
  const p: Pixel = { level: 300 }
  return p.level
}
