// WP51 §2.2: a reference compares only with `===` and `!==`; a tag's order
// is no order of the functions, so `<` is refused.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const dec = (x: i32): i32 => x - 1

export const main = (): i32 => {
  const f: F = inc
  const g: F = dec
  return f < g ? 1 : 0
}
