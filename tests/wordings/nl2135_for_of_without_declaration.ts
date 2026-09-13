// NL2135: `for (x of xs)` over an existing variable is refused with the declaration form spelled out.
export const main = (): i32 => {
  const xs: i32[] = [1];
  let x: i32 = 0;
  for (x of xs) {
    return x;
  }
  return 0;
};
