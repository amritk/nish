// `p.x = p.x` stores a field into itself; the right-hand side was meant to
// be another point's (NL2714).
class Point {
  x: i32;
  y: i32;
  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

const copyX = (p: Point, q: Point): void => {
  p.x = p.x;
  p.y = q.y;
};

export const main = (): i32 => {
  const p = new Point(1, 2);
  copyX(p, new Point(3, 4));
  return p.x;
};
