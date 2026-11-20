// a's `identity` keeps its first argument and b's its second, so a collapse
// into one instantiation changes the exit code.
const identity = <T>(x: T, y: T): T => {
  return x;
};

export const fromA = (n: number): number => {
  return identity(n, 0) + 1;
};
