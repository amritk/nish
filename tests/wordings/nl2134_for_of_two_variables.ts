// NL2134: `for...of` binds one name, so a second declaration is refused before the element type is read.
export const main = (): i32 => {
  const xs: i32[] = [1];
  for (const a = 1, b = 2 of xs) {
    return a;
  }
  return 0;
};
