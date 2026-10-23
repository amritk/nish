// Math.min and Math.max of f64 are llvm.minimum / llvm.maximum: a NaN operand gives NaN
// and -0 orders below +0, as in JavaScript, which `1 / m` shows.
export const lo = (a: f64, b: f64): f64 => Math.min(a, b);
export const hi = (a: f64, b: f64): f64 => Math.max(a, b);

export const main = (): i32 => {
  const zero = toF64(0);
  const one = toF64(1);
  const nan = zero / zero;
  console.log(`${lo(nan, one)} ${lo(one, nan)} ${hi(nan, one)} ${hi(toF64(-1e308), nan)}`);
  console.log(`${one / lo(zero, -zero)} ${one / lo(-zero, zero)} ${one / hi(-zero, zero)} ${one / hi(zero, -zero)}`);
  console.log(`${lo(toF64(2), toF64(-3))} ${hi(toF64(2), toF64(-3))}`);
  return 0;
};
