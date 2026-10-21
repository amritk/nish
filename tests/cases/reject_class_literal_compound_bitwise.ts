// NL2556: The value of `|=` takes the target's class, `Counter`, as its contextual type. A class with methods is made only by `new`.
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
  let c = new Counter(1);
  c |= { n: 5 };
  return c.get();
};
