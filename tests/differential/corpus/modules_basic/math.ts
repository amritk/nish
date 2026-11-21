export const square = (n: number): number => {
  return n * n;
};

export const cube = (n: number): number => {
  return square(n) * n;
};

export const wrapMul = (a: number, b: number): number => {
  return a * b;
};
