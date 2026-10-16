// A field store through a parameter is a shared write, named at the store.
// The constructor's own `this.count = 0` is not: it initialises the fresh
// object `new` allocated, which nobody else holds yet. Nor is `run`'s call of
// `bump`: the `Counter` it writes is one `run` made itself, so the write lands
// in memory no caller, thread or task can see while `run` runs.
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
