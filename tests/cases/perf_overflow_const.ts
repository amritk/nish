// WP15 §8: constants that do not fit the signed type they are computed in.
//
// Deliberately without a `.out`: every expression here is an overflowing
// signed `+` or `*` under the default `nsw`, which is undefined behaviour, and
// a golden that runs undefined behaviour would be pinning whatever LLVM
// happened to do that week. The compile and the `llvm-as` pass are the test.
export function test(): number {
  const big = 2147483647 + 1;
  const product = 100000 * 100000;
  // Only the `*` warns: the `+` inherits a value that has already overflowed,
  // and saying so twice would not tell the reader anything new.
  const nested = 100000 * 100000 + 1;
  return big + product + nested;
}
