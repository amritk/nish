// WP33 NL8006, quiet: under --number-mode f64 a `number` is a double, so its
// `/` is `fdiv` and divides exactly in both readings, as an `f64` does. `%`
// truncates in TypeScript too, so an integer remainder says nothing either.
const half = (n: number): number => n / 2;

export const main = (): i32 => {
  const ratio: f64 = 7.0 / 2.0;
  let scaled = ratio;
  scaled /= 4;
  const left: i32 = toI32(half(7)) % 4;
  console.log(`${half(7)} ${scaled}`);
  console.log(left);
  return 0;
};
