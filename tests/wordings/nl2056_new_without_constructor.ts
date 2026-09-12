// NL2056: a class with no constructor takes no arguments at `new`, and the
// message says so rather than reporting an arity mismatch against nothing.
class Point {
  x: i32 = 0;
}

export const main = (): i32 => {
  const p = new Point(1);
  return p.x;
};
