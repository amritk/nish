// `fill` writes its receiver's elements, which a `readonly` array refuses.
const clear = (xs: readonly u8[]): void => {
  xs.fill(0);
};

export const main = (): i32 => {
  const a: u8[] = [1];
  clear(a);
  return 0;
};
