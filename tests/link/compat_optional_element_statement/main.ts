// NL1067: a statement chain that ends in an element read. Past the end of the
// array Node reads `undefined` and drops it, where the bounds check would
// panic.
class Holder {
  xs: number[];
  constructor() {
    this.xs = [1];
  }
}

const peek = (h: Holder | null, i: number): void => {
  h?.xs[i];
};

export const main = (): void => {
  peek(new Holder(), 3);
};
