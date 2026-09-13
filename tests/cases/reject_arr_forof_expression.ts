// The `for...of` variable is declared by the loop, not assigned by it.
export const run = (a: number[]): number => {
  let x = 0;
  for (x of a) {
    return x;
  }
  return 0;
};
