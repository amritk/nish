// b's `identity` keeps its second argument, a's its first (see a.ts).
const identity = <T>(x: T, y: T): T => {
  return y;
};

export const fromB = (n: number): number => {
  return identity(0, n) * 2;
};
