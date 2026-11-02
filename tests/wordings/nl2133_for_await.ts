// NL2133: a stream of promises would hold each as a value, so `for await` is refused at the modifier rather than at the iterable.
export const main = (): i32 => {
  const xs: i32[] = [1];
  for await (const x of xs) {
    return x;
  }
  return 0;
};
