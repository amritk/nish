// NL2586: an arrow argument assigns to a name it captured, which would change
// only its own copy.
const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) f(x);
};
const sum = (xs: i32[], total: i32): i32 => {
  each(xs, (x) => {
    total = total + x;
  });
  return total;
};
export const main = (): i32 => sum([1, 2], 0);
