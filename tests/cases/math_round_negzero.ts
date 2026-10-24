// Math.round of an f64 is floor, a compare and a select, and then a copysign from the
// operand: a value in [-0.5, 0) rounds to -0, as in JavaScript, which `1 / r` shows.
export const roundHalf = (x: f64): f64 => Math.round(x);

export const main = (): i32 => {
  const one = toF64(1);
  const zero = toF64(0);
  console.log(`${one / roundHalf(toF64(-3) / toF64(10))} ${one / roundHalf(toF64(-1) / toF64(2))} ${one / roundHalf(-zero)}`);
  console.log(`${roundHalf(toF64(-5) / toF64(2))} ${roundHalf(toF64(5) / toF64(2))} ${roundHalf(toF64(-7) / toF64(10))}`);
  console.log(`${one / roundHalf(toF64(3) / toF64(10))} ${roundHalf(zero / zero)} ${roundHalf(-one / zero)}`);
  return 0;
};
