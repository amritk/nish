const identity = <T>(x: T): T => {
  return x;
};

export const fromA = (n: number): number => {
  return identity(n) + 1;
};
