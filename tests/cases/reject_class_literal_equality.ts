// NL2556: The right operand of `===` takes the left operand's class, `Counter`, as its contextual type. A class with methods is made only by `new`.
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
  return c === { n: 5 } ? 1 : 0;
};
