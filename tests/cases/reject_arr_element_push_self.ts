// WP15 §2a: the argument of a `push` is read after the array has grown, so an
// element of the array being pushed to is read out of the block the growth
// just abandoned.
interface Point {
  x: number;
}

export const test = (): number => {
  const ps: Point[] = [{ x: 1 }];
  ps.push(ps[0]);
  return ps[1].x;
};
