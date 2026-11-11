// WP51 §2.2: a call through a reference passes every parameter, so a
// function with a rest parameter has no reference.
type F = (x: i32) => i32

const sum = (...xs: i32[]): i32 => xs.length

export const main = (): i32 => {
  const f: F = sum
  return f(1)
}
