// NL2590: an arrow argument reads `this`, which is neither a `const` local
// nor a parameter of the function it is written in.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
class Scaler {
  k: i32 = 2;
  run(x: i32): i32 {
    return apply((v) => v * this.k, x);
  }
}
export const main = (): i32 => new Scaler().run(3);
