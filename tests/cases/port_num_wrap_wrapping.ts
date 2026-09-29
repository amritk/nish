// WP33 NL8007 under --wrapping: i32 arithmetic is plain `add`, `sub` and `mul`,
// defined to wrap, so every `+ - *` and `++` / `--` on i32 is a quiet divergence
// from TypeScript's double.
export const main = (): number => {
  let n: i32 = 2147483647;
  n = n + 1;
  n++;
  n -= 3;
  const square: i32 = 65536 * 65536;
  console.log(n);
  console.log(square);
  return 0;
};
