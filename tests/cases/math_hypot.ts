// Math.hypot(a, b) is `std/math.ts`'s `hypotF64` with two operands, copied into the
// module as `internal` `@nish.hypotF64`. It does not overflow where `Math.sqrt(a * a + b * b)` would, and an
// infinite operand wins over a NaN one, as in JavaScript. Beside a zero it is the other operand's
// magnitude exactly, as JavaScript's is -- on the fourth line for operands whose square is
// inexact, the last three with a square beside a rounding midpoint.
export const hyp = (a: f64, b: f64): f64 => Math.hypot(a, b);

export const main = (): i32 => {
  const zero = toF64(0);
  const inf = toF64(1) / zero;
  const big = toF64(3e300);
  console.log(`${hyp(toF64(3), toF64(4))} ${hyp(toF64(-5), toF64(12))} ${hyp(zero, -zero)}`);
  console.log(`${hyp(big, toF64(4e300))} ${hyp(zero / zero, inf)} ${hyp(-inf, toF64(1))}`);
  console.log(`${hyp(toF64(-0.1), zero)} ${hyp(toF64(123456.789), -zero)} ${hyp(zero, toF64(7.000000000000001))}`);
  console.log(
    `${hyp(toF64(1.0000000000000002), zero)} ${hyp(-zero, toF64(3.141592653589793))} ${hyp(toF64(-1.0000000000000002e100), zero)} ${hyp(toF64(1.1845144872720834), -zero)} ${hyp(zero, toF64(-1.534171680743519))} ${hyp(toF64(1.505382331739189e-140), zero)}`,
  );
  return 0;
};
