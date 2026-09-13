// NL2210: A hole has no value to store, and there is no undefined to store instead.
export const main = (): i32 => {
  const xs: i32[] = [1, , 2];
  return 0;
};
