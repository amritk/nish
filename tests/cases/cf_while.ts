function countDigits(n: number): number {
  let digits = 0;
  let rest = n;
  while (rest > 0) {
    rest = rest / 10;
    digits = digits + 1;
  }
  return digits;
}

function firstPowerOver(limit: number): number {
  let x = 1;
  while (true) {
    x = x * 2;
    if (x > limit) {
      return x;
    }
  }
}

export function test(): number {
  return countDigits(12345) * 1000 + firstPowerOver(100);
}
