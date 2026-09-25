// NL2338: a function-typed parameter of a constructor. A constructor is not a
// top-level function and cannot be a template over its callee.
class Counter {
  n: i32;

  constructor(step: (x: i32) => i32) {
    this.n = 0;
  }
}

export const main = (): i32 => 0;
