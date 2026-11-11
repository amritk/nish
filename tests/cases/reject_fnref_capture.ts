// WP51 §2.2: a nested function that captures a parameter is a closure, and a
// function reference names a top-level function with no environment.
type F = (x: i32) => i32

const make = (n: i32): F => {
  const add = (x: i32): i32 => x + n
  return add
}

export const main = (): i32 => make(1)(2)
