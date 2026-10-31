// An arrow given to a function's parameter may read the caller's `const`
// locals and parameters, but not `this`: a method's receiver is neither.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
class Scaler {
  k: i32 = 2;
  run(x: i32): i32 {
    return apply((v) => v * this.k, x);
  }
}
export const main = (): i32 => new Scaler().run(3);
