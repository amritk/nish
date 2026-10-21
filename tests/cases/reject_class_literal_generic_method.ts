// NL2556: A class whose only method is generic still has a method. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  pick<T>(x: T): T {
    return x;
  }
}
export const main = (): i32 => {
  const c: Counter = { n: 5 };
  return c.pick<i32>(c.n);
};
