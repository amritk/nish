// NL8003: a record pushed into an array, then written, then read through the array.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): number => {
  const ps: Point[] = [];
  const p: Point = { x: 1, y: 2 };
  ps.push(p);
  p.x = 9;
  return ps[0].x;
};
