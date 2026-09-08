function quotientOver(x: number, k: number): boolean {
  return 100 / x > k;
}

function bigQuotient(x: number): boolean {
  return x !== 0 && quotientOver(x, 3);
}

function zeroOrSmallQuotient(x: number): boolean {
  return x === 0 || 100 / x < 50;
}

function inRange(x: number, lo: number, hi: number): boolean {
  return lo <= x && x <= hi;
}

export function test(): number {
  let n = 0;
  if (bigQuotient(0)) n += 1;
  if (bigQuotient(10)) n += 2;
  if (zeroOrSmallQuotient(0)) n += 4;
  if (zeroOrSmallQuotient(1)) n += 8;
  if (inRange(5, 1, 9) && !inRange(0, 1, 9)) n += 16;
  return n;
}
