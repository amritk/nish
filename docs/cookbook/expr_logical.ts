const inRange = (x: number, lo: number, hi: number): boolean => x >= lo && x < hi;

const zeroOrSmallQuotient = (x: number): boolean => x === 0 || 100 / x < 50;
