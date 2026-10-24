// Math.tan is `std/math.ts`'s `tan`, copied into the module as `internal`
// `@nish.tanF64` with no libm call. It keeps the sign of a zero, which `1 / t` shows.
export const tangent = (x: f64): f64 => Math.tan(x);

export const main = (): i32 => {
  const zero = toF64(0);
  const one = toF64(1);
  const quarter = Math.atan2(one, one);
  console.log(`${tangent(zero)} ${one / tangent(-zero)} ${tangent(quarter)} ${tangent(-quarter)}`);
  console.log(`${tangent(zero / zero)} ${tangent(one / zero)}`);
  return 0;
};
