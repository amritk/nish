// NL2556: An array literal's element takes the element type `Counter[]` names. A class with methods is made only by `new`.
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
  const a: Counter[] = [{ n: 5 }];
  return a[0].get();
};
