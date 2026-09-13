// The loop assigns the variable on every pass; an initializer would be dead.
export const run = (a: number[]): number => {
  for (const x = 1 of a) {
    return x;
  }
  return 0;
};
