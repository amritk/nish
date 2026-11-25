// --deny-panics keeps the check of `xs.slice(a, b)` when `xs.pop()` runs
// between the guard and the call: the guard read the old length, and the pop
// shortens `xs`, so `b <= xs.length` no longer holds.
export const part = (xs: i32[], a: i32, b: i32): i32[] => {
  if (xs.length > 0 && a >= 0 && a <= b && b <= xs.length) {
    xs.pop();
    return xs.slice(a, b);
  }
  return [];
};
