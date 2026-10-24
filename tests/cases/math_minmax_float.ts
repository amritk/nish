// Math.min and Math.max of f64 and f32 answer what JavaScript's do: a NaN operand gives
// NaN, and -0 is below +0. Natively they branch: NaN, else compare and select, and on
// equal operands the zero picked by its sign bit. wasm32 keeps llvm.minimum /
// llvm.maximum, which are `f64.min` and `f32.max` there, so a module needs no libm. tests/run.js links this case for wasm and holds its exports to these answers.
export const minF64 = (a: f64, b: f64): f64 => Math.min(a, b);
export const maxF64 = (a: f64, b: f64): f64 => Math.max(a, b);
export const minF32 = (a: f32, b: f32): f32 => Math.min(a, b);
export const maxF32 = (a: f32, b: f32): f32 => Math.max(a, b);

const isNan = (x: f64): boolean => x !== x;
const isNan32 = (x: f32): boolean => x !== x;

// How many of the eleven answers are JavaScript's: 11 when all of them are.
export const test = (): i32 => {
  const zero: f64 = 0.0;
  const nan = zero / zero;
  const one: f64 = 1.0;
  const nan32 = toF32(nan);
  let ok = 0;
  if (isNan(minF64(nan, one))) ok++;
  if (isNan(minF64(one, nan))) ok++;
  if (isNan(maxF64(nan, toF64(2)))) ok++;
  if (minF64(toF64(5) / toF64(2), -one) === -one) ok++;
  if (maxF64(toF64(-3), toF64(-7)) === toF64(-3)) ok++;
  if (isNan(minF64(nan, nan))) ok++;
  if (one / minF64(zero, -zero) < zero) ok++;
  if (one / maxF64(-zero, zero) > zero) ok++;
  if (isNan32(minF32(nan32, toF32(3) / toF32(2)))) ok++;
  if (isNan32(maxF32(toF32(1) / toF32(4), nan32))) ok++;
  if (minF32(toF32(3), toF32(2)) === toF32(2)) ok++;
  return ok;
};
