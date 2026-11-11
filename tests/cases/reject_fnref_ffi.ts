// WP51 §2.2: a C function is in no set, since a tag indexes this program's
// own functions.
type F = (x: i32) => i32

declare function abs(x: i32): i32

export const main = (): i32 => {
  const f: F = abs
  return f(-1)
}
