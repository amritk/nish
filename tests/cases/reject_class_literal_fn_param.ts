// NL2556: A call through a function parameter checks its argument against the parameter's class, `Counter`. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
const call = (f: (c: Counter) => i32): i32 => f({ n: 5 });
export const main = (): i32 => call((c: Counter): i32 => c.get());
