const firstOf = <T>(xs: T[]): T => xs[0];

const eq = <T>(a: T, b: T): boolean => a === b;

export const main = (): i32 => {
  console.log(firstOf([4, 5, 6]));
  console.log(eq(1, 1));
  console.log(eq("a", "b"));
  return 0;
};
