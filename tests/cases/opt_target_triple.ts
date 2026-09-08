// Compiled with `--target x86_64-unknown-linux-gnu` (see .args): the module
// carries `target datalayout` and `target triple`, so tests/run.js can run
// `opt -O2` on it *without* `-mtriple` and still see the loop vectorised.
// The modulo keeps LLVM from folding the loop into a closed form, and `sumTo`
// is exported so that `internal` linkage does not inline the loop into its one
// constant call site and fold it away instead.
export function sumTo(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i % 1000;
  }
  return sum;
}

export function test(): number {
  return sumTo(1000);
}
