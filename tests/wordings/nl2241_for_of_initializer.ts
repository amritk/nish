// NL2241: The `for...of` variable takes each element, so an initializer would be overwritten.
export const main = (): i32 => {
  const xs: i32[] = [1];
  for (const x = 1 of xs) {
    return x;
  }
  return 0;
};
