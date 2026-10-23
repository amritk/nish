// Math.hypot(a, b) is libm's `hypot` with two operands, declared `readnone` like an
// intrinsic. It does not overflow where `Math.sqrt(a * a + b * b)` would, and an
// infinite operand wins over a NaN one, as in JavaScript.
export const hyp = (a: f64, b: f64): f64 => Math.hypot(a, b);

export const main = (): i32 => {
  const zero = toF64(0);
  const inf = toF64(1) / zero;
  const big = toF64(3e300);
  console.log(`${hyp(toF64(3), toF64(4))} ${hyp(toF64(-5), toF64(12))} ${hyp(zero, -zero)}`);
  console.log(`${hyp(big, toF64(4e300))} ${hyp(zero / zero, inf)} ${hyp(-inf, toF64(1))}`);
  return 0;
};
