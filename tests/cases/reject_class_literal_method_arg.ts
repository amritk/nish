// NL2556: A method's argument takes the parameter's class type. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
class Sink {
  total: i32;
  constructor() {
    this.total = 0;
  }
  add(c: Counter): void {
    this.total = this.total + c.get();
  }
}
export const main = (): i32 => {
  const s = new Sink();
  s.add({ n: 5 });
  return s.total;
};
