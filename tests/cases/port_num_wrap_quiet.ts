// WP33 NL8007, quiet: without --wrapping an i32 overflow is `nsw`, undefined
// natively, so it is not a quiet divergence and this row says nothing about it.
// A ranged place is checked on every write, a double does not wrap, and a
// string `+` concatenates in both readings.
export const main = (): number => {
  let n: i32 = 40;
  n = n + 2;
  n++;
  let step: integer<0, 10> = 3;
  step++;
  let x: f64 = 1.5;
  x = x * 2.0;
  const s = "a" + "b";
  console.log(n + step);
  console.log(`${x}`);
  console.log(s);
  return 0;
};
