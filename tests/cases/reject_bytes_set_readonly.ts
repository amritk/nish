// `set` writes its receiver's elements, which a `readonly` array refuses; the
// source may be readonly, since it is only read.
const into = (dst: readonly u8[], src: readonly u8[]): void => {
  dst.set(src);
};

export const main = (): i32 => {
  const a: u8[] = [0];
  into(a, a);
  return 0;
};
