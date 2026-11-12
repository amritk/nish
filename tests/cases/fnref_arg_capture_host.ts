// WP51 stage 2: an arrow capturing a reference parameter of a method or a
// constructor, passed for an inline function parameter. Each call instantiates
// `apply` for its arrow, and the arrow calls the parameter through its
// dispatcher, with no indirect call.
type F = (x: i32) => i32
const inc = (x: i32): i32 => x + 1
const dbl = (x: i32): i32 => x * 2
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)
class Runner {
  base: i32 = 0
  constructor(b: i32) { this.base = b }
  run(f: F, x: i32): i32 { return apply((y: i32): i32 => f(y) + 100, x) }
}
class Made {
  v: i32 = 0
  constructor(f: F, x: i32) { this.v = apply((y: i32): i32 => f(y) * 10, x) }
}
export const main = (): void => {
  const r = new Runner(100)
  console.log(`${r.run(inc, 3)} ${r.run(dbl, 3)} ${new Made(inc, 1).v} ${new Made(dbl, 1).v}`)
}
