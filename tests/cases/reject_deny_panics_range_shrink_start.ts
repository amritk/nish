// --deny-panics keeps the check of `xs.slice(n)` when `n -= 1` runs between
// the guard and the call: the guard proved `n >= 0`, and the decrement can
// take `n` to -1.
export const part = (xs: i32[], k: i32): i32[] => {
  let n = k;
  if (n >= 0 && n <= xs.length) {
    n -= 1;
    return xs.slice(n);
  }
  return [];
};
