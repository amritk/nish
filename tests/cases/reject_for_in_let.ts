// `for...in` with a `let` head, nested in a loop and a block: NL1056 is a
// sweep over the whole tree, so it is refused wherever it stands.
export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let n: i32 = 0;
  while (n < 1) {
    {
      for (let i in xs) {
        n = n + 1;
      }
    }
  }
  return n;
};
