// --deny-panics reads a `const` binding as its value, never a `let`: a `let`
// may be written before the division, so the divisor is still tested.
export const rem = (a: u64, b: u64): u64 => {
  let zero: u64 = 0;
  return b === zero ? a : a % b;
};
