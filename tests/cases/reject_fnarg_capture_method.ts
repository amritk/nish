// A method's or a constructor's parameter cannot have a function type, so an
// arrow can never be given to one, capturing or not.
class Runner {
  run(f: (x: i32) => i32): i32 {
    return f(1);
  }
}
class Made {
  n: i32;
  constructor(f: (x: i32) => i32) {
    this.n = f(1);
  }
}
export const main = (): i32 => {
  const k = 3;
  const m = new Made((x) => x + k);
  return new Runner().run((x) => x + k) + m.n;
};
