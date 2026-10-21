// NL2556: A constructor's argument takes the parameter's class type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
class Holder {
  c: Counter;
  constructor(c: Counter) {
    this.c = c;
  }
}
export const main = (): i32 => new Holder({ n: 5 }).c.get();
