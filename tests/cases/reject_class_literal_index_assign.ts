// NL2556: An element assignment hands the array's element type to the literal. A class with methods is made only by `new`.
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
  a[0] = { n: 5 };
  return a[0].get();
};
