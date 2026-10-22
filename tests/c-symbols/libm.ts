// The program `tests/run.js` builds to hold a private function named after a
// C23 `<math.h>` function to the `$` spelling (`src/c-symbols.ts`, #651). LLVM
// 18 does not know `tgamma`, `erf`, `ilogb` or `fmaximum_num` by name, but a
// later LLVM does, and folds a call to one with a constant argument as the C
// library's. Each is spelled apart (`@tgamma$`) so that the native binary
// prints what each function itself returns, whatever LLVM builds it. `lerp` is
// C++'s `<cmath>`, not C's, and keeps its name.
const tgamma = (x: f64): f64 => x * 2 + 0.5;

const erf = (x: f64): f64 => x - 10;

const ilogb = (x: i32): i32 => x * 3;

const fmaximum_num = (a: f64, b: f64): f64 => a + b;

const lerp = (a: f64, b: f64): f64 => a * b;

export const main = (): i32 => {
  console.log(`${tgamma(5)} ${erf(1)} ${ilogb(8)} ${fmaximum_num(1, 2)} ${lerp(3, 4)}`);
  return 0;
};
