// A field store through a parameter is a shared write, named at the store.
// The constructor's own `this.count = 0` is not: it initialises the fresh
// object `new` allocated, which nobody else holds yet.
class Counter {
  count: number;

  constructor() {
    this.count = 0;
  }
}

const bump = (c: Counter, by: number): void => {
  c.count += by;
};

export const run = (n: number): number => {
  const c = new Counter();
  bump(c, n);
  return c.count;
};
