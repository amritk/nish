function inRange(x: number, lo: number, hi: number): boolean {
  return x >= lo && x < hi;
}

function zeroOrSmallQuotient(x: number): boolean {
  return x === 0 || 100 / x < 50;
}
