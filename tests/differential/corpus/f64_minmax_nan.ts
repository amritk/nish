// --number-mode f64: Math.min/max with a NaN operand return NaN in JavaScript; Nish uses
// llvm.minnum/maxnum, which return the other operand (documented in docs/wp7-runtime.md).
export function main(): void {
  const z = 0;
  const nan = z / z;
  console.log(Math.min(nan, 1));
  console.log(Math.min(1, nan));
  console.log(Math.max(nan, 1));
  console.log(Math.max(1, nan));
  console.log(Math.min(nan, nan));
  console.log(Math.max(-1e308, nan));
}
