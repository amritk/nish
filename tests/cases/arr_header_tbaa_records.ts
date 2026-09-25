// An array of inline records (WP15 section 2a): the records live in element
// storage and their field stores carry no `!tbaa`, while `push` grows the
// array and rewrites its header. Every length read and every element read
// after the pushes has to see the grown header.
interface Point {
  x: i32;
  y: i32;
}

class Path {
  points: Point[];
  moves: i32 = 0;

  constructor() {
    this.points = [{ x: 1, y: 2 }];
  }
}

const extend = (p: Path, n: i32): void => {
  for (let i = 0; i < n; i += 1) {
    const q: Point = { x: i, y: i * 2 };
    p.points.push(q);
    p.moves = p.moves + 1;
  }
};

export const test = (): i32 => {
  const p = new Path();
  const n0 = p.points.length;
  p.points[0].x = 5;
  p.moves = 10;
  extend(p, 6);
  p.points[0].y = 3;
  const n1 = p.points.length;
  const last = p.points[n1 - 1];
  return n0 * 100000 + n1 * 10000 + p.points[0].x * 1000 + p.points[0].y * 100 + last.y * 10 + p.moves - 16;
};
