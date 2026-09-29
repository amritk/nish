// WP34 N2: an `f64` or `f32` offset of `set` or end of `fill` is converted as
// JavaScript's `ToIntegerOrInfinity` converts it, through `llvm.fptosi.sat`
// rather than a bare `fptosi`: NaN is 0, a fraction truncates toward zero, and
// an infinity or 1e300 saturates, which `fill`'s clamp then puts at an end of
// the array. In f64 mode with a `main`, so the unmodified-Node run compares the
// output too; `bytes_set_float_oob` covers the offsets `set` refuses.
const show = (xs: u8[]): string => {
  const parts: string[] = [];
  for (const x of xs) {
    parts.push(`${x}`);
  }
  return parts.join(" ");
};

export const main = (): i32 => {
  const nan: f64 = 0.0 / 0.0;
  const inf: f64 = 1.0 / 0.0;
  const a: u8[] = [0, 0, 0, 0, 0, 0];
  a.fill(1, nan);
  console.log(show(a));
  a.fill(2, 0, inf);
  console.log(show(a));
  a.fill(3, -inf, 1.5);
  console.log(show(a));
  a.fill(4, 1e300);
  a.fill(4, -1e300, -4.9);
  console.log(show(a));
  const half: f32 = toF32(4.5);
  a.fill(5, half);
  console.log(show(a));
  const b: u8[] = [9, 8];
  a.set(b, nan);
  console.log(show(a));
  a.set(b, 3.99);
  a.set(b, -0.5);
  console.log(show(a));
  const wide: i32[] = [0, 0, 0];
  wide.fill(-1, -inf, inf);
  console.log(`${wide[0]} ${wide[1]} ${wide[2]}`);
  return 0;
};
