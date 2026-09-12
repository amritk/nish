// WP18 §4: recursion through a *ground* type argument terminates and must be
// accepted. `countDown<string>` asks for `countDown<i32>`, which asks for
// `countDown<i32>` again — already in the set — so the worklist drains after
// one step and the program has exactly two instantiations. The opposite half
// of the boundary is `reject_generic_polymorphic_recursion`.
const countDown = <T>(x: T, n: i32): i32 => {
  if (n === 0) {
    return 0;
  }
  return countDown(1, n - 1);
};

export const test = (): number => {
  console.log(countDown("hi", 3));
  return 0;
};
