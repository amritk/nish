const max = (a: number, b: number): number => {
  return a > b ? a : b;
};

const sign = (x: number): number => {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
};

export const test = (): number => {
  return max(3, 8) * 10 + sign(-5) + sign(0) + sign(9) * 2;
};
