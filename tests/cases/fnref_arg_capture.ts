// WP51 stage 2: an arrow passed for a function-typed parameter may capture a
// local that holds a function reference, or a nullable one narrowed by a
// test; the arrow calls the reference through its place's dispatcher.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const dbl = (x: i32): i32 => x * 2
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)
const pick = (k: i32): F => (k > 0 ? inc : dbl)

export const main = (): void => {
  const h = pick(1)
  const g: F | null = pick(0)
  console.log(`${apply((y: i32): i32 => h(y) + 1, 3)}`)
  if (g !== null) {
    console.log(`${apply((y: i32): i32 => g(y) - 1, 5)} ${apply(g, 5)}`)
  }
}
