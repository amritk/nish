// NL2242: The `for...of` variable takes the element type, so an annotation is redundant rather than checked.
export const main = (): i32 => {
  const xs: i32[] = [1];
  for (const x: i32 of xs) {
    return x;
  }
  return 0;
};
