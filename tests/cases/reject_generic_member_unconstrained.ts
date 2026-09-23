// WP18 §8 message 8: an unconstrained type parameter has no members, so `p.x`
// is refused even though the one instantiation, `T = Point`, has an `x`.
// Monomorphisation would compile it; the language says what `T` may do.
interface Point {
  x: i32;
  y: i32;
}

const getX = <T>(p: T): i32 => p.x;

export const test = (): number => {
  const p: Point = { x: 1, y: 2 };
  return getX(p);
};
