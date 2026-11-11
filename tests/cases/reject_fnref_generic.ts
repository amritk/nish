// WP51 §2.2: a generic function has one body per instantiation natively and
// one under Node, so `===` would disagree; it has no reference.
type F = (x: i32) => i32

const id = <T>(x: T): T => x

export const main = (): i32 => {
  const f: F = id
  return f(1)
}
