// `-0x80000000` in `i32` is INT_MIN folded to its constant: the literal
// truncates to INT_MIN, and negating it wraps back to INT_MIN, so no
// `sub nsw i32 0, -2147483648` (poison) is ever emitted.
export function main(): number {
  const lo = -0x80000000;
  const one = -(1);
  console.log(`${lo} ${lo + 1} ${one}`);
  return 0;
}
