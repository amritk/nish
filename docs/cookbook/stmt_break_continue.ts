function sumOdd(n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      continue;
    }
    if (s > 1000) {
      break;
    }
    s += i;
  }
  return s;
}
