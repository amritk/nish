// The last element of `xs`, read the way the CG-3 reproducer reads it: through
// a length the bounds-check prover trusts to be non-negative.
export const lastOf = (xs: u8[]): i32 => {
  const n = xs.length;
  if (n === 0) {
    return -1;
  }
  const j = n - 1;
  return toI32(xs[j]);
};
