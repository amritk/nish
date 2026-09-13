// The loop variable's type is the array's element type; annotating it can only disagree.
export const run = (a: number[]): number => {
  for (const x: number of a) {
    return x;
  }
  return 0;
};
