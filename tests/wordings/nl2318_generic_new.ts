// NL2318: `new` on a class that is not generic. A generic class takes its type
// arguments here (WP18 G5), so the refusal is about this class rather than about
// generics, and Phase 0 cannot see it because it is a use rather than a declaration.
class Point {
  x: i32 = 0;
}

export const main = (): i32 => {
  const p = new Point<i32>();
  return 0;
};
