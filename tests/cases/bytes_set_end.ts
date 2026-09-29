// WP34 N2: the range `[at, at + src.length)` may end exactly at `dst.length`,
// and an empty source may start there; neither is out of range. A wider element
// copies `length * size` bytes. In f64 mode with a `main`, so the
// unmodified-Node run compares the output too.
export const main = (): i32 => {
  const dst: u8[] = [0, 0, 0, 0];
  const empty: u8[] = [];
  const two: u8[] = [6, 7];
  dst.set(empty, dst.length);
  dst.set(two, dst.length - two.length);
  console.log(`${dst[0]} ${dst[1]} ${dst[2]} ${dst[3]}`);
  const wide: i32[] = [0, 0, 0];
  const pair: i32[] = [-1, 70000];
  wide.set(pair, 1);
  console.log(`${wide[0]} ${wide[1]} ${wide[2]}`);
  const reals: f64[] = [0.5, 0.25];
  const halves: f64[] = [1.5];
  reals.set(halves, 1);
  console.log(`${reals[0]} ${reals[1]}`);
  return 0;
};
