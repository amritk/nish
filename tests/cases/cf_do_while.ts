function sumDigits(n: number): number {
  let sum = 0;
  let rest = n;
  do {
    sum += rest % 10;
    rest = rest / 10;
  } while (rest > 0);
  return sum;
}

export function test(): number {
  return sumDigits(0) + sumDigits(9876);
}
