function square(x: number): number {
  return x * x;
}

function polynomial(x: number, k: number): number {
  let acc: number = square(x) * 3;
  acc = acc + k * 2;
  const bias = 7;
  return acc - bias;
}

function isPositive(n: number): boolean {
  return n > 0;
}
