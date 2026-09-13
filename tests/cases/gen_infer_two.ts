// WP18 §2a: a type argument is inferred from the argument's type and is never
// written at a call site. `firstOf(rows)` binds `T` to `i32[]` through the
// `T[]` pattern, which is what gives the second instantiation the nested
// mangling `firstOf$arr.i32`.
const firstOf = <T>(xs: T[]): T => xs[0];

export const test = (): number => {
  const rows: i32[][] = [[1, 2], [3]];
  console.log(firstOf([4, 5, 6]));
  console.log(firstOf(firstOf(rows)));
  return 0;
};
