// A nested function would be a closure, and there are no function values.
export const run = (n: number): number => {
  function inner(): number {
    return 1;
  }
  return inner();
};
