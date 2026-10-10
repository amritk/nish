// --deny-retention: NL9003, an allocation assigned over an allocation, is an error.
class Point {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}

export const main = (): i32 => {
  let p = new Point(1);
  p = new Point(2);
  return p.x;
};
