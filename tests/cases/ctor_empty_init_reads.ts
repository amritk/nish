// #740: a constructor that only reads `this` and calls a method on it sees
// the initialised fields, and so does its caller.
class Gauge {
  base: i32 = 10;
  step: i32 = 5;

  constructor() {
    console.log(this.next());
  }

  next(): i32 {
    return this.base + this.step;
  }
}

export const main = (): i32 => {
  const g = new Gauge();
  console.log(g.base * g.step);
  return 0;
};
