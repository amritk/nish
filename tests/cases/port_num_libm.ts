// WP33 NL8010, retired: `Math.min` and `Math.max` of doubles answer NaN for a
// NaN operand, and `Math.round(-0.4)` is -0, which `1 / r` shows, here as in
// JavaScript (`llvm.minimum`, `llvm.maximum`, a copysign). Nothing may warn.
export const main = (): number => {
  const one = toF64(1);
  const nan = toF64(0) / toF64(0);
  const low = Math.min(nan, one);
  const high = Math.max(one + one, nan);
  const r = Math.round(toF64(-4) / toF64(10));
  console.log(`${low} ${high} ${one / r}`);
  return 0;
};
