// NL2556: An object literal typed as a class with methods would be a plain object under Node, so the class is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
export const main = (): i32 => {
  const c: Counter = { n: 5 };
  return c.get();
};
