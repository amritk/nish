// Destructuring binds by shape; a local binds one name to one value.
export const run = (xs: number[]): number => {
  const [a, b] = xs;
  return a;
};
