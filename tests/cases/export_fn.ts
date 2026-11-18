export const double = (n: number): number => {
  return n * 2;
};

const helper = (n: number): number => {
  return n + 1;
};

export const next = (n: number): number => {
  return helper(double(n));
};
