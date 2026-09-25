// WP15 §2.4: a decrement keeps an upper bound only where it cannot wrap. Under
// `--wrapping` `i - 1` on `INT_MIN` is `INT_MAX`, so `i < xs.length` does not
// survive `i -= 1` on an `i` with no known floor, and the check after it stays:
// the read panics with `index out of range: 2147483647 >= 3`.
const pick = (xs: i32[], k: i32): i32 => {
  let i = k;
  if (i < xs.length) {
    i -= 1;
    if (i >= 0) {
      return xs[i];
    }
  }
  return -1;
};

export const main = (): number => {
  const xs = [1, 2, 3];
  console.log(`${pick(xs, 2)}`);
  console.log(`${pick(xs, -2147483647 - 1)}`);
  return 0;
};
