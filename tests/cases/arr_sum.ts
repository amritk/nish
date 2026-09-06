// Store 0..n-1 and sum it back. Compiled a second time with --unchecked-indexing
// by tests/run.js, which checks that `opt -O2` vectorises the sum loop.
function fill(xs: number[], n: number): void {
  for (let i = 0; i < n; i++) {
    xs[i] = i;
  }
}

function sum(xs: number[], n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += xs[i];
  }
  return total;
}

export function main(): number {
  const n = 1000;
  const xs = new Array<number>(n);
  fill(xs, n);
  console.log(sum(xs, n));
  return 0;
}
