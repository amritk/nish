// NL2088: An object literal sets every field exactly once, so a repeat is an error rather than a last-wins.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const p: Point = { x: 1, x: 2 };
  return p.x;
};
