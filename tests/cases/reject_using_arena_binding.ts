// The binding of `using a = arena()` holds the block's mark and is never read.
export const main = (): i32 => {
  using a = arena();
  const b = a;
  return 0;
};
