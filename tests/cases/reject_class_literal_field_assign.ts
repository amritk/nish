// NL2556: An assignment to a class-typed field hands the type to the literal. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
class Holder {
  c: Counter;
  constructor(c: Counter) {
    this.c = c;
  }
}
export const main = (): i32 => {
  const h = new Holder(new Counter(1));
  h.c = { n: 5 };
  return h.c.get();
};
