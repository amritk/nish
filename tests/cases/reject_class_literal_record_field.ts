// NL2556: A field of an enclosing literal hands the field's class type to the inner literal. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
interface Holder {
  c: Counter;
}
export const main = (): i32 => {
  const h: Holder = { c: { n: 5 } };
  return h.c.get();
};
