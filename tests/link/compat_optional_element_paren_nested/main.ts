// NL1067: an element read that a `?.` link tests, in two pairs of parentheses.
// `((xs[i]))` is the same read as `xs[i]`: past the end of the array Node reads
// `undefined` and the `?.` skips the call, where the bounds check would panic.
class Cell {
  n: number = 0;
  bump(): void {
    this.n += 1;
  }
}

const touch = (xs: (Cell | null)[], i: number): void => {
  ((xs[i]))?.bump();
};

export const main = (): void => {
  const xs: (Cell | null)[] = [null];
  touch(xs, 3);
};
