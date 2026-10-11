// Under `--wrapping` an offset proves nothing, because the sum is not exact:
// `INT_MAX + 1` is defined to be `INT_MIN`, which passes `i + 1 < xs.length`.
// The check stays, and `pick(xs, 2147483647)` panics instead of reading 8 GiB
// before the array: the unsigned compare sees `INT_MIN` as
// `index out of range: 18446744071562067968 >= 3`.
const pick = (xs: i32[], i: i32): i32 => {
  if (i >= 0 && i + 1 < xs.length) {
    return xs[i + 1];
  }
  return -1;
};

export const main = (): number => {
  const xs = [1, 2, 3];
  console.log(`${pick(xs, 1)}`);
  console.log(`${pick(xs, 2147483647)}`);
  return 0;
};
