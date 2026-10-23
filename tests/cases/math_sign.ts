// Math.sign of a float is copysign(1, x), or the operand itself when it is a zero or
// NaN (`fcmp ueq x, 0`), so -0 stays -0 and NaN stays NaN, as in JavaScript. Of an integer it is the
// operand's own type: `(x > 0) - (x < 0)` when signed, `x != 0` when unsigned.
export const signF64 = (x: f64): f64 => Math.sign(x);
export const signI32 = (x: i32): i32 => Math.sign(x);
export const signU32 = (x: u32): u32 => Math.sign(x);

export const main = (): i32 => {
  const zero = toF64(0);
  const one = toF64(1);
  console.log(`${signF64(toF64(-2.5))} ${signF64(toF64(7))} ${signF64(zero)} ${one / signF64(-zero)}`);
  console.log(`${signF64(zero / zero)} ${signF64(-one / zero)}`);
  console.log(`${signI32(-42)} ${signI32(0)} ${signI32(2147483647)} ${signI32(-2147483648)}`);
  const top: u32 = 4294967295;
  console.log(`${signU32(top)} ${signU32(toU32(0))}`);
  return 0;
};
