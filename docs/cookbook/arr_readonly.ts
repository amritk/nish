function sum(xs: readonly number[]): number {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
}

function sumMutable(xs: number[]): number {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
}
