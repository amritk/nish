// NL2556: A unary operator hands its context, `Counter`, to its operand. A class with methods is made only by `new`.
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
  const c: Counter = -{ n: 5 };
  return c.get();
};
