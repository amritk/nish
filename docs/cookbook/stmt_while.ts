function countDigits(n: number): number {
  let digits = 0;
  let rest = n;
  while (rest > 0) {
    rest = rest / 10;
    digits = digits + 1;
  }
  return digits;
}
