// WP34 N2: `fill(value, start, end)` with `TypedArray.prototype.fill`'s ends:
// each is optional, a negative one counts back from the length, and both are
// clamped, so no range is out of range and a reversed one fills nothing. A
// `u8[]` is one `llvm.memset`; a wider element is a store loop. In f64 mode
// with a `main`, so the unmodified-Node run compares the output too.
const show = (xs: u8[]): string => {
  const parts: string[] = [];
  for (const x of xs) {
    parts.push(`${x}`);
  }
  return parts.join(" ");
};

export const main = (): i32 => {
  const a: u8[] = [0, 0, 0, 0, 0, 0];
  a.fill(255);
  console.log(show(a));
  a.fill(1, 2);
  console.log(show(a));
  a.fill(2, 1, 3);
  console.log(show(a));
  a.fill(3, -2);
  console.log(show(a));
  a.fill(4, -100, -4);
  console.log(show(a));
  a.fill(5, 4, 1);
  a.fill(5, 10, 20);
  console.log(show(a));
  const wide: i32[] = [0, 0, 0, 0];
  wide.fill(-7, 1, 3);
  console.log(`${wide[0]} ${wide[1]} ${wide[2]} ${wide[3]}`);
  const reals: f64[] = [1.0, 1.0, 1.0];
  reals.fill(0.5, -1);
  console.log(`${reals[0]} ${reals[1]} ${reals[2]}`);
  return 0;
};
