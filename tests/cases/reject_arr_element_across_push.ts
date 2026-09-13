// WP15 §2a: `p` is a pointer into `ps`'s element storage, and `push` may move
// that storage, so writing through `p` afterwards would write to the old block.
interface Point {
  x: number;
}

export const test = (): number => {
  const ps: Point[] = [{ x: 1 }];
  const p = ps[0];
  ps.push({ x: 2 });
  p.x = 3;
  return ps[0].x;
};
