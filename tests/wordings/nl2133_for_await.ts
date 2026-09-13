// NL2133: There is no event loop, so `for await` is refused at the modifier rather than at the iterable.
export const main = (): i32 => {
  const xs: i32[] = [1];
  for await (const x of xs) {
    return x;
  }
  return 0;
};
