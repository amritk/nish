// A proven step down is a plain `sub nsw`: `i > 0` leaves `i - 1` at least 0,
// and `n < 2` returning first leaves `n - 1` and `n - 2` at least 0, so neither
// can pass `INT_MIN` (src/bounds.ts, "Signed overflow"). The sum of the two
// recursive calls is unbounded and keeps its check.
const fib = (n: i32): i32 => {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
};

export const countDown = (n: i32): i32 => {
  let steps: i32 = 0;
  for (let i: i32 = n; i > 0; i--) {
    steps = steps ^ i;
  }
  return steps;
};

export const test = (): number => fib(10) + countDown(5);
