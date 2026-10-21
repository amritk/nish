// NL2556: Both arms of a conditional take the declaration's class type. A class with methods is made only by `new`.
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
  const flag = true;
  const c: Counter = flag ? { n: 1 } : new Counter(2);
  return c.get();
};
