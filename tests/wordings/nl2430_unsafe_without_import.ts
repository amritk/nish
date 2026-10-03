// NL2430: a nish:unsafe function is called only through an import of it.
export const main = (): i32 => {
  const xs: i32[] = [1];
  return uncheckedGet(xs, 0);
};
