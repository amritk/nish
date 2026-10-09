// Math.min and Math.max of f64 and f32 are llvm.minnum / llvm.maxnum: a NaN operand is
// dropped and the other answered. Natively they are instructions; on freestanding wasm32
// the backend calls libm's fmin, fmax, fminf and fmaxf, which runtime/runtime-wasm.c
// supplies. tests/run.js links this case for wasm and holds its exports to these answers.
export const minF64 = (a: f64, b: f64): f64 => Math.min(a, b);
export const maxF64 = (a: f64, b: f64): f64 => Math.max(a, b);
export const minF32 = (a: f32, b: f32): f32 => Math.min(a, b);
export const maxF32 = (a: f32, b: f32): f32 => Math.max(a, b);

const isNan = (x: f64): boolean => x !== x;

// How many of the nine answers are minnum's: 9 when all of them are.
export const test = (): i32 => {
  const zero: f64 = 0.0;
  const nan = zero / zero;
  const one: f64 = 1.0;
  const nan32 = toF32(nan);
  let ok = 0;
  if (minF64(nan, one) === one) ok++;
  if (minF64(one, nan) === one) ok++;
  if (maxF64(nan, toF64(2)) === toF64(2)) ok++;
  if (minF64(toF64(5) / toF64(2), -one) === -one) ok++;
  if (maxF64(toF64(-3), toF64(-7)) === toF64(-3)) ok++;
  if (isNan(minF64(nan, nan))) ok++;
  if (minF32(nan32, toF32(3) / toF32(2)) === toF32(3) / toF32(2)) ok++;
  if (maxF32(toF32(1) / toF32(4), nan32) === toF32(1) / toF32(4)) ok++;
  if (minF32(toF32(3), toF32(2)) === toF32(2)) ok++;
  return ok;
};
