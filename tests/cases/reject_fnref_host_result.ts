// WP51 §5.2: a class reached only through the `Result` an exported function
// takes is laid out for the host as much as one named directly, so its
// reference field is one the host could forge.
type F = (x: i32) => i32

class C {
  op: F
  constructor(op: F) {
    this.op = op
  }
}

export function h1(m: Result<C, string>): i32 {
  return m.ok ? 1 : 0
}
