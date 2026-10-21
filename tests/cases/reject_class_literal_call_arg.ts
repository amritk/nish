// NL2556: A call argument takes the parameter's class type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
const use = (c: Counter): i32 => c.get();
export const main = (): i32 => use({ n: 5 });
