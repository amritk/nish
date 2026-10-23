// NL2556: The argument of `indexOf` takes the element class, `Counter`, as its contextual type. A class with methods is made only by `new`.
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
  const a: Counter[] = [new Counter(1)];
  return a.indexOf({ n: 5 });
};
