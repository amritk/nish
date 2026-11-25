// --deny-panics refuses an array's `slice` whose end nothing bounds: the
// guard proves `0 <= a <= b` and says nothing of `b <= xs.length`.
export const part = (xs: i32[], a: i32, b: i32): i32[] => {
  if (a >= 0 && a <= b) {
    return xs.slice(a, b);
  }
  return [];
};
