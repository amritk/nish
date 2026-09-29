// NL8004: a store over a slot an element reference still reads.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): number => {
  const ps: Point[] = [{ x: 1, y: 2 }];
  const r = ps[0];
  ps[0] = { x: 3, y: 4 };
  return r.x;
};
