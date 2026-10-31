// A capture is handed to the arrow as an argument when the call is made, so
// an assignment to one would change only the arrow's copy: refused.
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
