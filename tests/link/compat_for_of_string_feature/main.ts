// A dialect without `for-of-string` refuses a `for...of` over a `string`, and
// the refusal names the feature that admits it.
export const main = (): i32 => {
  let n: i32 = 0;
  for (const c of "abc") {
    n = n + 1;
  }
  return n - 3;
};
