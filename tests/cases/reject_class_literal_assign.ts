// NL2556: An assignment to a class-typed `let` hands the type to the literal. A class with methods is made only by `new`.
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
  let c: Counter = new Counter(1);
  c = { n: 5 };
  return c.get();
};
