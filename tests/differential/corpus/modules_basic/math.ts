export function square(n: number): number {
  return n * n;
}

export function cube(n: number): number {
  return square(n) * n;
}

export function wrapMul(a: number, b: number): number {
  return a * b;
}
