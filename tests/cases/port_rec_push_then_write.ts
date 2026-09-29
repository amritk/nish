// WP33 NL8003: a record put into an array is copied into the slot, so a write
// to one copy afterwards is not seen through the other natively, and is in
// TypeScript, where the array holds the same object. Each copy-in is reported
// at the value copied, naming the write: a `push` then a write to the original,
// `ps[i] = q` then a write through the array, and a `push` at the bottom of a
// loop whose write at the top reaches it on the next pass.
interface Point {
  x: i32;
  y: i32;
}

export const main = (): number => {
  const ps: Point[] = [];
  const p: Point = { x: 1, y: 2 };
  ps.push(p);
  p.x = 9;
  console.log(ps[0].x);

  const q: Point = { x: 3, y: 4 };
  ps[0] = q;
  ps[0].y = 7;
  console.log(q.y);

  const moving: Point = { x: 0, y: 0 };
  const trail: Point[] = [];
  for (let i = 0; i < 3; i = i + 1) {
    moving.x = i;
    trail.push(moving);
  }
  console.log(trail[0].x);
  return 0;
};
