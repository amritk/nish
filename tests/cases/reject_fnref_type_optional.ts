// WP51 stage 1: a call through a reference passes every parameter its type
// lists, so a written function type has no optional parameter.
type F = (x: i32, y?: i32) => i32

const add = (x: i32, y: i32): i32 => x + y

export const main = (): void => {
  const f: F = add
  console.log(`${f(1, 2)}`)
}
