// WP51 §2.2: a reference is a tag, not a number: `f + 1` is refused.
type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

export const main = (): i32 => {
  const f: F = inc
  return f + 1
}
