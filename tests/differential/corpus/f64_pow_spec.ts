// --number-mode f64: ECMAScript special cases of Math.pow that C99 pow() (llvm.pow.f64) decides
// differently: pow(±1, ±Infinity) and pow(1, NaN) are NaN in JavaScript, 1 in C.
// Listed in known-failures.txt; see docs/wp13-differential.md.
export function main(): void {
  const z = 0;
  const inf = 1 / z;
  const nan = z / z;
  console.log(Math.pow(1, inf));
  console.log(Math.pow(1, -inf));
  console.log(Math.pow(-1, inf));
  console.log(Math.pow(-1, -inf));
  console.log(Math.pow(1, nan));
  console.log(Math.pow(nan, 0));
  console.log(Math.pow(nan, 1));
  console.log(Math.pow(2, inf));
  console.log(Math.pow(0.5, inf));
  console.log(Math.pow(-2, inf));
  console.log(Math.pow(0, -1));
  console.log(Math.pow(-0, -1));
  console.log(Math.pow(-0, -2));
  console.log(Math.pow(inf, 0));
}
