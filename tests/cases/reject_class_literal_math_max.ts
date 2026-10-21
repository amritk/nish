// NL2556: The second argument of `Math.max` takes the first argument's class, `Counter`, as its contextual type. A class with methods is made only by `new`.
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
  const c = new Counter(1);
  return Math.max(c, { n: 5 }).get();
};
