// `arena()` is only the initialiser of a `using` declaration: bound by `const`
// it has no block whose end releases it.
export const main = (): i32 => {
  const a = arena();
  return 0;
};
