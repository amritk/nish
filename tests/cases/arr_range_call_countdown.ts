// WP15 §2.4's two local rules. `xs.length - 1` is below the length whatever
// the array holds, and a decrement keeps every upper bound under `nsw`, so the
// loop that counts down from the last index needs only its own `i >= 0`: the
// golden has no `nish_panic_index` in `sumDown`. `pairs` reads the floor
// `n !== 0` gives a non-negative `n`, which leaves `n - 1` a valid index.
const sumDown = (xs: i32[]): i32 => {
  let s = 0;
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    s = s * 10 + xs[i];
  }
  return s;
};

const pairs = (xs: i32[], n: i32): i32 => {
  if (n >= 0 && n < xs.length && n !== 0) {
    const m = n - 1;
    return xs[m] + xs[n];
  }
  return 0;
};

export const main = (): number => {
  const xs = [1, 2, 3, 4];
  console.log(`${sumDown(xs)} ${sumDown([])}`);
  console.log(`${pairs(xs, 3)} ${pairs(xs, 0)}`);
  return 0;
};
