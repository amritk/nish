// WP15 §2.4: a caller with no proof. `at`'s one call site passes an index
// nothing bounds, so `at` is entered knowing nothing about it and keeps its
// check, which panics with `index out of range: 5 >= 3`.
const at = (xs: i32[], i: i32): i32 => xs[i];

const beyond = (xs: i32[], by: i32): i32 => at(xs, by);

export const main = (): number => {
  const xs = [7, 8, 9];
  console.log(`${beyond(xs, 1)}`);
  console.log(`${beyond(xs, 5)}`);
  return 0;
};
