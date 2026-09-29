// WP33 NL8003: `[p, p]` is two copies of `p` here and the same object twice in
// TypeScript, so writing one slot leaves the other alone natively and changes
// both there. Each element is a copy-in and is reported. A literal assigned to
// an existing binding is a copy-in too.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): number => {
  const p: Point = { x: 1, y: 2 };
  const ps: Point[] = [p, p];
  ps[0].x = 5;
  console.log(ps[1].x);

  const o: Point = { x: 1, y: 2 };
  let qs: Point[] = [];
  qs = [o];
  o.y = 3;
  console.log(qs[0].y);
  return 0;
};
