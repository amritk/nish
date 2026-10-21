// NL2556: `push` hands the array's element type to its argument. A class with methods is made only by `new`.
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
  const a: Counter[] = [];
  a.push({ n: 5 });
  return a[0].get();
};
