const identity = <T>(x: T): T => {
  return x;
};

export const fromB = (n: number): number => {
  return identity(n) * 2;
};
