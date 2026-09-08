function firstMultipleOver(n: number, limit: number): number {
  let k = 0;
  while (true) {
    k++;
    if (k * n > limit) {
      break;
    }
  }
  return k;
}

function sumOdd(n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      continue;
    }
    s += i;
  }
  return s;
}

function largestPowerOfTwo(limit: number): number {
  let p = 1;
  for (;;) {
    if (p * 2 > limit) break;
    p *= 2;
  }
  return p;
}

export function test(): number {
  return firstMultipleOver(7, 30) * 1000 + sumOdd(10) * 10 + largestPowerOfTwo(100);
}
