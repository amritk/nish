// NL2556: A type alias of the class hands it to the literal as the class itself does. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
type C = Counter;
export const main = (): i32 => {
  const c: C = { n: 5 };
  return c.get();
};
