// Math.atan2(y, x) is `std/math.ts`'s `atan2`, copied into the module as `internal`
// `@nish.atan2F64` with no libm call. The quadrant comes from both signs, so a -0 `y` gives -pi, as in JavaScript.
export const angle = (y: f64, x: f64): f64 => Math.atan2(y, x);

export const main = (): i32 => {
  const one = toF64(1);
  const zero = toF64(0);
  console.log(`${angle(one, one)} ${angle(one, zero)} ${angle(zero, -one)} ${angle(-zero, -one)}`);
  console.log(`${one / angle(-zero, one)} ${angle(zero, zero)}`);
  return 0;
};
