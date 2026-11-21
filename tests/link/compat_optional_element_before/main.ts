// NL1067: an element read that a `?.` link tests. Past the end of the array
// Node reads `undefined` and the `?.` skips the call, where the bounds check
// would panic, so the compatibility dialect refuses it like a final `?.[i]`.
class Cell {
  n: number = 0;
  bump(): void {
    this.n += 1;
  }
}

const touch = (xs: (Cell | null)[], i: number): void => {
  xs[i]?.bump();
};

export const main = (): void => {
  touch([new Cell()], 3);
};
