// The program `tests/run.js` links to read the C library calls a program's
// own code reaches (`src/c-symbols.ts`): every `Math` builtin LLVM can lower
// to a libm call, and `%`, on `f64` and on `f32`, over values that depend on `process.argv` so that
// nothing folds. `Math.sin` and `Math.cos` take different arguments, so LLVM
// keeps each call rather than merging the two into `sincos`; `sincos` comes
// from the pair below that shares one. The rest call no C library: `tan`,
// `atan2` and `hypot` are `std/math.ts`'s own code, `sign`, `imul` and
// `clz32` are a few instructions, and `random` is the runtime's.
export const main = (): i32 => {
  const n: f64 = toF64(process.argv.length) + 0.25;
  const m: f32 = toF32(n);
  let t: f64 = Math.sqrt(n) + Math.floor(n) + Math.ceil(n) + Math.trunc(n) + Math.round(n);
  t = t + Math.sin(n) + Math.cos(n + 1) + Math.exp(n) + Math.log(n) + Math.pow(n, n);
  t = t + Math.sin(n * 3) + Math.cos(n * 3);
  t = t + Math.abs(n) + Math.min(n, 2.5) + Math.max(n, 0.5) + (n % 0.75);
  const u: f32 = Math.abs(m) + Math.min(m, toF32(2.5)) + Math.max(m, toF32(0.5)) + (m % toF32(0.75));
  t = t + toF64(u) + toF64(toF32(Math.sqrt(toF64(m)))) + toF64(toF32(Math.floor(toF64(m))));
  console.log(`${t}`);
  return 0;
};
