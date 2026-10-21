// NL2556: A concise arrow body hands the return type to the literal. A class with methods is made only by `new`.
class Counter {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
  get(): i32 {
    return this.n;
  }
}
const make = (): Counter => ({ n: 5 });
export const main = (): i32 => make().get();
