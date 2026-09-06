// The modulo keeps LLVM from folding the whole loop into n*(n-1)/2, so a
// real loop survives to -O2 and tests/run.js can check that it vectorises.
function sumTo(n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i % 1000;
  }
  return sum;
}

function test(): number {
  return sumTo(1000);
}
