// WP51 stage 2, review B6: an arrow argument that captures a reference
// parameter of the function it is written in. Each `outer`, `narrowed`,
// `elements` and `via` call instantiates `apply` with an arrow that calls
// through the captured reference's dispatcher: a parameter, a parameter
// narrowed from `F | null`, the elements of an array parameter, and a
// reference beside a function parameter of the same signature.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const dbl = (x: i32): i32 => x * 2

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

const outer = (f: F, x: i32): i32 => apply((y: i32): i32 => f(y) + 1, x)

const narrowed = (f: F | null, x: i32): i32 => {
  if (f !== null) {
    return apply((y: i32): i32 => f(y) + 1, x)
  }
  return -1
}

const elements = (fs: F[], x: i32): i32 => apply((y: i32): i32 => fs[1](y) + fs[0](y), x)

const via = (g: (x: i32) => i32, f: F, x: i32): i32 => g(x) + apply((y: i32): i32 => f(y) + 1, x)

export const main = (): void => {
  console.log(`${outer(inc, 3)} ${outer(dbl, 3)}`)
  console.log(`${narrowed(inc, 3)} ${narrowed(dbl, 3)} ${narrowed(null, 3)} ${elements([inc, dbl], 5)}`)
  console.log(`${via(inc, dbl, 3)} ${via(dbl, inc, 3)}`)
}
