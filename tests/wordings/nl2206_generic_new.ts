// NL2206: Type arguments at a `new` are refused by the checker, where Phase 0's rule about declarations cannot see them.
class Point {
  x: i32 = 0;
}

export const main = (): i32 => {
  const p = new Point<i32>();
  return 0;
};
