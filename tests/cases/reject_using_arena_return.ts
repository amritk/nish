// A `return` from inside a `using a = arena()` block may not hand back what the
// block allocated: the block releases before the function returns.
const describe = (n: i32): string => {
  using a = arena();
  return `n is ${n}`;
};

export const main = (): i32 => {
  console.log(describe(5));
  return 0;
};
